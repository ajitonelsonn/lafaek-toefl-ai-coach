import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type Certificate } from "@prisma/client";
import { CODE_ALPHABET, certificateEligible, normaliseCertificateCode, type CertificateDTO, type CertificateSectionDTO } from "@/lib/config/certificate";
import type { MockResultDTO } from "@/lib/practice/mock-dto";
import { db } from "./db";
import { ApiError } from "./http";

// Issues and looks up mock test certificates (rules in lib/config/certificate.ts).
// A certificate is a snapshot: the holder's name and the scores at the time it was issued.

/** "LT-XXXX-XXXX-XXXX" from 60 random bits. */
export function newCertificateCode(): string {
  const bytes = randomBytes(8);
  let bits = bytes.readBigUInt64BE() >> 4n;
  let body = "";
  for (let i = 0; i < 12; i++) {
    body = CODE_ALPHABET[Number(bits & 31n)] + body;
    bits >>= 5n;
  }
  return `LT-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}

const toDTO = (c: Certificate): CertificateDTO => ({
  code: c.code,
  holderName: c.holderName,
  overallBand: c.overallBand,
  sections: c.sectionsJson as unknown as CertificateSectionDTO[],
  testCompletedAt: c.testCompletedAt.toISOString(),
  issuedAt: c.issuedAt.toISOString(),
  revokedAt: c.revokedAt?.toISOString() ?? null,
});

/**
 * Issues the certificate for a completed mock test of `userId`, or returns the one already
 * issued for it. Throws 409 when the result does not qualify.
 */
export async function issueCertificate(userId: string, result: MockResultDTO): Promise<CertificateDTO> {
  const existing = await db.certificate.findUnique({ where: { mockResultId: result.id } });
  if (existing) {
    if (existing.userId !== userId) throw new ApiError(404, "NOT_FOUND", "Mock test not found.");
    return toDTO(existing);
  }
  if (!certificateEligible(result)) throw new ApiError(409, "CONFLICT", "This mock test does not qualify for a certificate.");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
  const sections: CertificateSectionDTO[] = result.sections.map((s) => ({ skill: s.skill, band: s.band, answered: s.answered, total: s.total }));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await db.certificate.create({
        data: {
          code: newCertificateCode(),
          userId,
          mockResultId: result.id,
          holderName: user.displayName.trim(),
          overallBand: result.estimatedBand!,
          sectionsJson: sections as unknown as Prisma.InputJsonValue,
          testCompletedAt: new Date(result.completedAt),
        },
      });
      return toDTO(created);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      // Issued in parallel (e.g. a second click): return that one. Otherwise the random code
      // collided (astronomically unlikely) and a new code is tried.
      const raced = await db.certificate.findUnique({ where: { mockResultId: result.id } });
      if (raced) return toDTO(raced);
    }
  }
  throw new ApiError(500, "INTERNAL_ERROR", "The certificate could not be issued. Please try again.");
}

/** Public lookup by ID (typed in any case or spacing). Null when there is no such certificate. */
export async function findCertificate(rawCode: string): Promise<CertificateDTO | null> {
  const code = normaliseCertificateCode(rawCode);
  if (!code) return null;
  const c = await db.certificate.findUnique({ where: { code } });
  return c ? toDTO(c) : null;
}
