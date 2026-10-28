import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon3D } from "@/components/ui/Icon3D";
import { CertificateLookup, VerifyShell } from "@/components/certificate/VerifyShell";
import { normaliseCertificateCode, verifyPath } from "@/lib/config/certificate";

export const metadata: Metadata = { title: "Verify a Certificate" };

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const normalised = code ? normaliseCertificateCode(code) : null;
  if (normalised) redirect(verifyPath(normalised));

  return (
    <VerifyShell>
      <Card className="mx-auto w-full max-w-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <Icon3D name="security" size={64} />
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Verify a certificate</h1>
          <p className="text-body">
            Enter the certificate ID printed on a LafaekTOEFL certificate, or scan its QR code. We will show whether it is genuine and who it was issued to.
          </p>
        </div>
        <div className="mt-6">
          <CertificateLookup defaultValue={code} error={code ? "That is not a certificate ID. It looks like LT-XXXX-XXXX-XXXX." : undefined} />
        </div>
      </Card>
    </VerifyShell>
  );
}
