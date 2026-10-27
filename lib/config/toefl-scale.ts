// TOEFL iBT score scale from January 21, 2026: the overall and each section score are
// bands from 1 to 6 in steps of 0.5 (the overall is the average of the four sections,
// rounded to the nearest 0.5). The 0–120 total is only shown alongside as a comparison.
// CEFR mapping as printed on the 2026 Test Taker Score Report.

export const SCORE_MIN = 1;
export const SCORE_MAX = 6;

/** 1, 1.5, 2, … 6 */
export const SCORE_BANDS: number[] = Array.from({ length: (SCORE_MAX - SCORE_MIN) * 2 + 1 }, (_, i) => SCORE_MIN + i / 2);

export const isScoreBand = (v: number) => Number.isFinite(v) && v >= SCORE_MIN && v <= SCORE_MAX && Number.isInteger(v * 2);

export function cefrForBand(band: number): string {
  if (band >= 6) return "C2";
  if (band >= 5) return "C1";
  if (band >= 4) return "B2";
  if (band >= 3) return "B1";
  if (band >= 2) return "A2";
  return "A1";
}

/** "4.5" style, always one decimal like the score report. */
export const formatBand = (band: number) => band.toFixed(1);

/** Overall band: the average of the four section bands, rounded to the nearest 0.5. */
export const overallBand = (sections: number[]) => Math.round((sections.reduce((a, b) => a + b, 0) / sections.length) * 2) / 2;

/**
 * Converts a target saved on the old 0–120 scale (plans made before this change) to the
 * nearest band. Approximate concordance; only used to read old saved plans.
 */
export function legacyTotalToBand(total: number): number {
  const cut: [number, number][] = [
    [114, 6], [107, 5.5], [95, 5], [86, 4.5], [72, 4], [58, 3.5], [44, 3], [34, 2.5], [24, 2], [12, 1.5],
  ];
  return cut.find(([min]) => total >= min)?.[1] ?? 1;
}

/** Target scores read from storage: bands pass through, old 0–120 totals are converted. */
export const normaliseTarget = (v: number) => (isScoreBand(v) ? v : legacyTotalToBand(v));

/**
 * Rough practice band (1–6) from the share of correct answers in a short section. It is a
 * practice estimate only: ETS scores use different tasks, statistics and scaling.
 */
export function estimateBandFromAccuracy(correct: number, total: number): number | null {
  if (total <= 0) return null;
  const p = (correct / total) * 100;
  const cuts: [number, number][] = [[95, 6], [88, 5.5], [80, 5], [72, 4.5], [63, 4], [54, 3.5], [45, 3], [35, 2.5], [25, 2], [15, 1.5]];
  return cuts.find(([min]) => p >= min)?.[1] ?? 1;
}
