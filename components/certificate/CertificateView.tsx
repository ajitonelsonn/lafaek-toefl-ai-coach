import QRCode from "qrcode";
import { Icon3D } from "@/components/ui/Icon3D";
import type { CertificateDTO } from "@/lib/config/certificate";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Certificate } from "./Certificate";
import { CertificateActions } from "./CertificateActions";

/** Verification result for a certificate that exists: status and facts, the certificate, and actions. */
export async function CertificateView({ certificate: c, verifyUrl }: { certificate: CertificateDTO; verifyUrl: string }) {
  const qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#101b4dff", light: "#ffffffff" } });
  const valid = !c.revokedAt;
  const facts = [
    ["Holder", c.holderName],
    ["Certificate ID", c.code],
    ["Estimated band", `${formatBand(c.overallBand)} of 6 · CEFR ${cefrForBand(c.overallBand)}`],
    ["Mock test completed", formatDate(c.testCompletedAt)],
    ["Issued", formatDate(c.issuedAt)],
    ["Status", valid ? "Valid" : `Revoked on ${formatDate(c.revokedAt!)}`],
  ];

  return (
    <>
      {/* One A4 landscape page with no margins when printed or saved as PDF. */}
      <style>{"@page { size: A4 landscape; margin: 0; }"}</style>
      <section
        aria-labelledby="status-title"
        className={cn("rounded-[var(--radius-card)] border p-5 sm:p-6 print:hidden", valid ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft")}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Icon3D name={valid ? "success" : "error"} size={56} />
          <div className="min-w-0 flex-1">
            <h1 id="status-title" className={cn("text-2xl font-extrabold", valid ? "text-success" : "text-danger")}>
              {valid ? "Verified certificate" : "This certificate was revoked"}
            </h1>
            <p className="mt-1 text-body">
              {valid
                ? "This certificate was issued by LafaekTOEFL and matches our records."
                : "LafaekTOEFL issued this certificate but has since revoked it. It is no longer valid."}
            </p>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
                  <dd className={cn("break-words font-semibold text-ink", k === "Certificate ID" && "font-mono")}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <div className="print:w-[297mm]">
        <Certificate certificate={c} verifyUrl={verifyUrl} qrSvg={qrSvg} />
      </div>

      {valid && <CertificateActions code={c.code} verifyUrl={verifyUrl} issuedAt={c.issuedAt} />}
      <p className="mx-auto max-w-2xl text-center text-xs text-muted print:hidden">
        A practice certificate from a short LafaekTOEFL mock test. The band is the average of the four sections: Reading and Listening scored from the answers, Writing and
        Speaking rated by AI. It is not an official TOEFL score, and LafaekTOEFL is not affiliated with ETS.
      </p>
    </>
  );
}
