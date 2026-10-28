import { MOCK_SECTION_ORDER } from "./mock-test";
import type { SkillId } from "./practice-types";

// Certificates for a high mock test score. Each one has a public ID that anyone can check at
// /verify/<ID>; the record in our database is what makes it genuine. They are practice
// certificates, never official TOEFL scores.

/** Lowest estimated band (1–6) that earns a certificate: upper B2. */
export const CERTIFICATE_MIN_BAND = 4.5;

interface ResultLike {
  estimatedBand: number | null;
  sections: { skill: SkillId; answered: number; band: number | null }[];
}

/**
 * A full mock test (all four sections answered, each with a band, so Writing and Speaking have been
 * rated) with a high enough overall band.
 */
export function certificateEligible(r: ResultLike): boolean {
  return (
    r.estimatedBand !== null &&
    r.estimatedBand >= CERTIFICATE_MIN_BAND &&
    MOCK_SECTION_ORDER.every((skill) => r.sections.some((s) => s.skill === skill && s.answered > 0 && s.band !== null))
  );
}

/** Crockford base32: no I, L, O or U, so IDs are easy to read aloud and type. */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_RE = /^LT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/**
 * Reads a typed or scanned ID ("lt 7k3m q9px 2hdw", "LT7K3MQ9PX2HDW", O for 0, I or L for 1)
 * as "LT-7K3M-Q9PX-2HDW". Returns null when it cannot be an ID.
 */
export function normaliseCertificateCode(raw: string): string | null {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (s.length === 14 && s.startsWith("LT")) s = s.slice(2);
  s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== 12) return null;
  const code = `LT-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  return CODE_RE.test(code) ? code : null;
}

export interface CertificateSectionDTO {
  skill: SkillId;
  /** Practice band; null only on certificates issued before Writing and Speaking were AI-rated. */
  band: number | null;
  answered: number;
  total: number;
}

export interface CertificateDTO {
  code: string;
  holderName: string;
  overallBand: number;
  sections: CertificateSectionDTO[];
  testCompletedAt: string;
  issuedAt: string;
  revokedAt: string | null;
}

export const verifyPath = (code: string) => `/verify/${code}`;
