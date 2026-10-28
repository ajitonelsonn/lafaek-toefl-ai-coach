import type { Metadata } from "next";
import QRCode from "qrcode";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Certificate } from "@/components/certificate/Certificate";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Icon3D } from "@/components/ui/Icon3D";
import { CERTIFICATE_MIN_BAND, verifyPath } from "@/lib/config/certificate";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import { requireAuthPage } from "@/lib/server/auth/session";
import { env } from "@/lib/server/env";
import { mockHistory } from "@/lib/server/mock-test";

export const metadata: Metadata = { title: "Certificate Preview" };

const SAMPLE_CODE = "LT-XXXX-XXXX-XXXX";

// A sample certificate with the learner's name and example scores, watermarked "PREVIEW",
// so learners can see what a high mock test score earns before they have one.
export default async function Page() {
  const { user } = await requireAuthPage();
  const earned = (await mockHistory(user.id)).find((r) => r.certificateCode)?.certificateCode ?? null;
  const base = env().APP_URL.replace(/\/$/, "");
  // The QR code points at the lookup page (and is blurred): a preview has no ID to verify.
  const qrSvg = await QRCode.toString(`${base}/verify`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#101b4dff", light: "#ffffffff" } });
  const now = new Date().toISOString();
  const min = formatBand(CERTIFICATE_MIN_BAND);

  return (
    <>
      <PageHeader title="Certificate Preview" description="See the certificate you can earn with a high mock test score." icon="score" />
      <div className="flex flex-col gap-6">
        <Card as="section" aria-labelledby="preview-title" className="flex flex-col items-center gap-5 border-[#e6c768] bg-gradient-to-r from-[#fff8e1] via-surface to-surface text-center md:flex-row md:text-left">
          <Icon3D name="achievement" size={72} />
          <div className="min-w-0 flex-1">
            <h2 id="preview-title" className="text-xl font-extrabold text-ink">
              {earned ? "You have already earned a certificate" : "Your certificate will look like this"}
            </h2>
            <p className="mt-1 text-sm text-body">
              Score an estimated band of <span className="font-bold text-ink">{min} ({cefrForBand(CERTIFICATE_MIN_BAND)})</span> or higher on a full mock test, with all four
              sections answered. You then get this certificate with your real scores, its own ID and a QR code that anyone can check online. The scores below are only an
              example.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
            {earned && (
              <LinkButton href={verifyPath(earned)} size="lg" rightIcon={<ArrowRight className="size-4" />}>
                View your certificate
              </LinkButton>
            )}
            <LinkButton href="/mock-test" size="lg" variant={earned ? "secondary" : "primary"} rightIcon={earned ? undefined : <ArrowRight className="size-4" />}>
              Take the mock test
            </LinkButton>
          </div>
        </Card>

        <Certificate
          preview
          qrSvg={qrSvg}
          verifyUrl={`${base}${verifyPath(SAMPLE_CODE)}`}
          certificate={{
            code: SAMPLE_CODE,
            holderName: user.displayName,
            overallBand: 5,
            sections: [
              { skill: "reading", band: 5.5, answered: 5, total: 5 },
              { skill: "listening", band: 4.5, answered: 6, total: 6 },
              { skill: "writing", band: 5, answered: 1, total: 1 },
              { skill: "speaking", band: 5, answered: 2, total: 2 },
            ],
            testCompletedAt: now,
            issuedAt: now,
            revokedAt: null,
          }}
        />
      </div>
    </>
  );
}
