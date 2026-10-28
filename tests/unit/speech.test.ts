import { describe, expect, it } from "vitest";
import { inspectWav, isAcceptedForAsr, wordSimilarity, repeatCorrect } from "@/lib/server/content/speech";

function wav(rate: number, channels: number, seconds: number) {
  const data = Buffer.alloc(rate * channels * 2 * seconds);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

describe("WAV validation (file signature, not MIME type)", () => {
  it("accepts 16 kHz mono PCM", () => {
    const info = inspectWav(wav(16000, 1, 2))!;
    expect(info.durationSeconds).toBeCloseTo(2);
    expect(isAcceptedForAsr(info)).toBe(true);
  });
  it("rejects stereo, other rates, and non-WAV bytes", () => {
    expect(isAcceptedForAsr(inspectWav(wav(16000, 2, 1))!)).toBe(false);
    expect(isAcceptedForAsr(inspectWav(wav(44100, 1, 1))!)).toBe(false);
    expect(inspectWav(Buffer.from("ID3 not a wav file at all, just some bytes......"))).toBeNull();
  });
});

describe("transcript similarity (practice estimate)", () => {
  it("is 1 for an exact repeat and lower for missing words", () => {
    expect(wordSimilarity("The printer is next to the kitchen.", "the printer is next to the kitchen").score).toBe(1);
    const r = wordSimilarity("The printer is next to the kitchen.", "the printer is the kitchen");
    expect(r.score).toBeLessThan(1);
    expect(r.missing).toEqual(["next", "to"]);
  });
});

describe("Listen and Repeat scoring", () => {
  const sentence = "Please keep your desk tidy and save your files every evening";
  it("counts an answer as correct when at least 80% of the words match", () => {
    expect(repeatCorrect(wordSimilarity(sentence, sentence).score)).toBe(true);
    expect(repeatCorrect(wordSimilarity(sentence, "Please keep your desk tidy and save your files every night").score)).toBe(true); // 1 of 11 words wrong
    expect(repeatCorrect(wordSimilarity(sentence, "Please keep your desk tidy").score)).toBe(false); // about half missing
  });
});
