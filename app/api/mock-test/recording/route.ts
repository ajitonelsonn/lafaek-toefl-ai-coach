import { ApiError, json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { inspectWav, isAcceptedForAsr } from "@/lib/server/content/speech";
import { saveMockRecording } from "@/lib/server/mock-test";

const MAX_BYTES = 4 * 1024 * 1024;
export const maxDuration = 30;

// Stores one Speaking answer of a started mock test (16 kHz WAV) for AI rating after submit.
export const POST = route(async (req) => {
  const { user } = await requireAuth();
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 8192) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The recording is too large.");
  await rateLimit("mock-recording", user.id, 60, 3600);

  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const itemId = String(form?.get("itemId") ?? "");
  const unitId = String(form?.get("unitId") ?? "");
  const file = form?.get("audio");
  if (token.length < 20 || token.length > 8000 || !/^[0-9a-f-]{36}$/.test(itemId) || !/^[a-z]\d{0,2}$/.test(unitId) || !(file instanceof Blob)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Please record your answer again.");
  }
  if (file.size > MAX_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The recording is too large.");
  const wav = Buffer.from(await file.arrayBuffer());
  const info = inspectWav(wav);
  if (!info || !isAcceptedForAsr(info) || info.durationSeconds > 120) throw new ApiError(400, "VALIDATION_ERROR", "The recording format is not supported.");

  await saveMockRecording(user.id, { token, itemId, unitId, wav, durationMs: Math.round(info.durationSeconds * 1000) });
  return json({ saved: true }, { status: 201 });
});
