import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon3D } from "@/components/ui/Icon3D";
import { CertificateView } from "@/components/certificate/CertificateView";
import { CertificateLookup, VerifyShell } from "@/components/certificate/VerifyShell";
import { normaliseCertificateCode, verifyPath } from "@/lib/config/certificate";
import { findCertificate } from "@/lib/server/certificates";
import { env } from "@/lib/server/env";

type Props = { params: Promise<{ code: string }> };

// Public: anyone with the ID (or the QR code) can check a certificate. Not indexed by search engines.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Certificate ${normaliseCertificateCode(code) ?? ""}`.trim(), robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const raw = decodeURIComponent((await params).code);
  const code = normaliseCertificateCode(raw);
  if (code && code !== raw) redirect(verifyPath(code));
  const c = code ? await findCertificate(code) : null;

  if (!c) {
    return (
      <VerifyShell>
        <Card className="mx-auto w-full max-w-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <Icon3D name="warning" size={64} />
            <h1 className="text-2xl font-extrabold text-ink">No certificate found</h1>
            <p className="text-body">
              We have no certificate with the ID <span className="font-mono font-semibold text-ink">{raw.slice(0, 40)}</span>. Check the ID and try again. A certificate that is
              not in our records was not issued by LafaekTOEFL.
            </p>
          </div>
          <div className="mt-6">
            <CertificateLookup />
          </div>
        </Card>
      </VerifyShell>
    );
  }

  return (
    <VerifyShell>
      <CertificateView certificate={c} verifyUrl={`${env().APP_URL.replace(/\/$/, "")}${verifyPath(c.code)}`} />
    </VerifyShell>
  );
}
