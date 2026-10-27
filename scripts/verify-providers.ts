// Verifies real provider access with minimal calls. Prints only non-secret facts.
// Run: npm run verify:providers   (costs: ~1 short text call, 1 image, ~2 short TTS clips, ~3 s of ASR)
import { z } from "zod";
import nodemailer from "nodemailer";
import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import { features, env } from "../lib/server/env";
import { generateImage, generateText, healthCheck, transcribeAudio } from "../lib/server/providers/meta";
import { listVoices, synthesizeSpeech } from "../lib/server/providers/elevenlabs";
import { ProviderError } from "../lib/server/providers/http";

const skipImage = process.argv.includes("--skip-image");
const results: [string, string][] = [];
const ok = (name: string, detail: string) => results.push([`PASS ${name}`, detail]);
const fail = (name: string, e: unknown) =>
  results.push([`FAIL ${name}`, e instanceof ProviderError ? `${e.kind} ${e.status ?? ""} ${e.message}` : e instanceof Error ? e.message.slice(0, 200) : "error"]);

function wavFromPcm16(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function main() {
  try {
    const h = await healthCheck();
    const wanted = [env().META_TEXT_MODEL, env().META_IMAGE_MODEL, env().META_TRANSCRIPTION_MODEL];
    ok("meta.models", `status=${h.status} visible=${h.modelsVisible.length} configured-present=${wanted.map((m) => `${m}:${h.modelsVisible.includes(m)}`).join(",")}`);
  } catch (e) {
    fail("meta.models", e);
  }

  try {
    const r = await generateText({
      task: "verify:structured",
      schema: z.strictObject({ sentence: z.string().min(3), wordCount: z.number().int() }),
      system: "Return JSON only.",
      user: "Write one short friendly English sentence for a TOEFL learner and count its words.",
      temperature: 0.2,
    });
    ok("meta.text", `model=${r.model} inputTokens=${r.usage.inputTokens} outputTokens=${r.usage.outputTokens} requestId=${r.requestId ? "present" : "absent"} words=${r.data.wordCount}`);
  } catch (e) {
    fail("meta.text", e);
  }

  if (!skipImage) {
    try {
      const img = await generateImage("A simple friendly flat illustration of an open book on a desk, no text.", { size: "1024x1024" });
      ok("meta.image", `bytes=${img.bytes.length} mime=${img.mimeType} model=${img.model}`);
    } catch (e) {
      fail("meta.image", e);
    }
  }

  // ElevenLabs premade voice confirmed to work with a TTS-only key; used if voices cannot be listed.
  let voiceId = process.env.ELEVENLABS_VOICE_IDS?.split(",")[0]?.trim() || "21m00Tcm4TlvDq8ikWAM";
  try {
    const voices = await listVoices();
    const accents = [...new Set(voices.map((v) => v.accent).filter(Boolean))];
    ok("elevenlabs.voices", `count=${voices.length} accents=${accents.join("|") || "none labelled"}`);
    voiceId = voices[0].voiceId;
  } catch (e) {
    fail("elevenlabs.voices", e);
  }
  try {
    const tts = await synthesizeSpeech("Please press the green button to start copying.", voiceId);
    ok("elevenlabs.tts", `mp3 bytes=${tts.bytes.length} model=${tts.model}`);
  } catch (e) {
    fail("elevenlabs.tts", e);
  }
  try {
    // Round trip: ElevenLabs 16 kHz PCM -> WAV -> Meta ASR.
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_16000`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ text: "The library opens at eight in the morning.", model_id: env().ELEVENLABS_MODEL_ID }),
    });
    if (!res.ok) throw new Error(`pcm synthesis failed (${res.status})`);
    const wav = wavFromPcm16(Buffer.from(await res.arrayBuffer()), 16000);
    const asr = await transcribeAudio(wav);
    ok("meta.transcribe", `transcript="${asr.transcript.slice(0, 80)}" durationMs=${asr.audioDurationMs}`);
  } catch (e) {
    fail("meta.transcribe", e);
  }

  try {
    const t = nodemailer.createTransport({ host: env().SMTP_HOST, port: env().SMTP_PORT, secure: env().SMTP_SECURE, auth: { user: env().SMTP_USER, pass: env().SMTP_PASSWORD } });
    await t.verify();
    ok("smtp.verify", `connected and authenticated (no email sent)`);
  } catch (e) {
    fail("smtp.verify", e);
  }

  if (features.storage()) ok("s3.config", "bucket configured");
  else {
    results.push(["BLOCKED s3", "S3_BUCKET is empty — create a private bucket and set S3_BUCKET in .env.local"]);
    try {
      const s3 = new S3Client({ region: env().AWS_REGION, credentials: { accessKeyId: env().AWS_ACCESS_KEY_ID!, secretAccessKey: env().AWS_SECRET_ACCESS_KEY! } });
      const b = await s3.send(new ListBucketsCommand({}));
      ok("aws.credentials", `valid; buckets visible to this key: ${(b.Buckets ?? []).length}`);
    } catch (e) {
      fail("aws.credentials (ListBuckets)", e);
    }
  }

  for (const [k, v] of results) console.log(`${k.padEnd(32)} ${v}`);
}

main();
