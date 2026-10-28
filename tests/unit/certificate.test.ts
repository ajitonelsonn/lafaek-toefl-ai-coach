import { describe, expect, it } from "vitest";
import { CERTIFICATE_MIN_BAND, certificateEligible, normaliseCertificateCode } from "@/lib/config/certificate";
import { newCertificateCode } from "@/lib/server/certificates";

const full = (band: number | null, answered = 1, sectionBand: number | null = 5) => ({
  estimatedBand: band,
  sections: (["reading", "listening", "writing", "speaking"] as const).map((skill) => ({ skill, answered, band: sectionBand })),
});

describe("certificates", () => {
  it("are earned by a full mock test with a high enough estimated band", () => {
    expect(certificateEligible(full(CERTIFICATE_MIN_BAND))).toBe(true);
    expect(certificateEligible(full(6))).toBe(true);
    expect(certificateEligible(full(CERTIFICATE_MIN_BAND - 0.5))).toBe(false);
    expect(certificateEligible(full(null))).toBe(false);
  });

  it("need all four sections, each answered and with a band", () => {
    expect(certificateEligible(full(5, 0))).toBe(false);
    expect(certificateEligible(full(5, 1, null))).toBe(false); // Writing and Speaking not rated yet
    const noSpeaking = full(5);
    noSpeaking.sections.pop();
    expect(certificateEligible(noSpeaking)).toBe(false);
  });

  it("get random IDs in the readable LT-XXXX-XXXX-XXXX format", () => {
    const codes = Array.from({ length: 200 }, newCertificateCode);
    for (const c of codes) {
      expect(c).toMatch(/^LT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(normaliseCertificateCode(c)).toBe(c);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("read IDs typed in any case or spacing, with O for 0 and I or L for 1", () => {
    expect(normaliseCertificateCode("lt 7k3m q9px 2hdw")).toBe("LT-7K3M-Q9PX-2HDW");
    expect(normaliseCertificateCode("LT7K3MQ9PX2HDW")).toBe("LT-7K3M-Q9PX-2HDW");
    expect(normaliseCertificateCode("7K3M-Q9PX-2HDW")).toBe("LT-7K3M-Q9PX-2HDW");
    expect(normaliseCertificateCode("LT-OK3M-Q9PX-IHDL")).toBe("LT-0K3M-Q9PX-1HD1");
  });

  it("reject anything that cannot be an ID", () => {
    for (const bad of ["", "LT-1234", "LT-UUUU-UUUU-UUUU", "LT-7K3M-Q9PX-2HDW-9", "<script>"]) expect(normaliseCertificateCode(bad)).toBeNull();
  });
});
