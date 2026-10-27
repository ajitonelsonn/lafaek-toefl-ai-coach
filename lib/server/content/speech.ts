import "server-only";

// Helpers for learner recordings. Meta ASR accepts WAV, mono, 16-bit PCM, 16/24 kHz.

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number;
}

/** Parses and validates a WAV header (file signature check, not just MIME type). */
export function inspectWav(buf: Buffer): WavInfo | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let offset = 12;
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | null = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      fmt = { format: buf.readUInt16LE(offset + 8), channels: buf.readUInt16LE(offset + 10), sampleRate: buf.readUInt32LE(offset + 12), bits: buf.readUInt16LE(offset + 22) };
    } else if (id === "data" && fmt) {
      const dataSize = Math.min(size, buf.length - offset - 8);
      if (fmt.format !== 1) return null;
      return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bits, durationSeconds: dataSize / (fmt.sampleRate * fmt.channels * (fmt.bits / 8)) };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function isAcceptedForAsr(w: WavInfo) {
  return w.channels === 1 && w.bitsPerSample === 16 && (w.sampleRate === 16000 || w.sampleRate === 24000);
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Word-level similarity between the expected sentence and the transcript:
 * 1 − (word edit distance / expected length), clamped to [0, 1]. This is a
 * transcript-based estimate, not a pronunciation score.
 */
export function wordSimilarity(expected: string, transcript: string): { score: number; missing: string[]; extra: string[] } {
  const a = tokens(expected);
  const b = tokens(transcript);
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const score = a.length ? Math.max(0, 1 - d[a.length][b.length] / a.length) : 0;
  const bset = new Set(b);
  const aset = new Set(a);
  return { score: Math.round(score * 100) / 100, missing: a.filter((w) => !bset.has(w)), extra: b.filter((w) => !aset.has(w)) };
}
