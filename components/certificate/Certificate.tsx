import Image from "next/image";
import { Cormorant_Garamond } from "next/font/google";
import { BRAND, icon3dSrc } from "@/lib/config/assets";
import type { CertificateDTO } from "@/lib/config/certificate";
import { getSkill } from "@/lib/config/practice-types";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import { cn } from "@/lib/utils/cn";

// The certificate as one A4-landscape sheet. Every size is in cqw (percent of the sheet's width),
// so it scales from a phone screen to a printed page without reflowing.

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], display: "swap" });

const NAVY = "#101b4d";
const GOLD = "#b8912a";

const longDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

/** Fine interlaced rosette, like the security print on paper certificates. */
function Guilloche() {
  return (
    <svg aria-hidden viewBox="0 0 297 210" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <g fill="none" stroke={NAVY} strokeWidth="0.14" opacity="0.07" transform="translate(148.5 98)">
        {Array.from({ length: 36 }, (_, i) => (
          <ellipse key={i} rx="78" ry="30" transform={`rotate(${i * 5})`} />
        ))}
      </g>
    </svg>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={cn("absolute w-[7cqw]", className)} fill="none" stroke={GOLD}>
      <path d="M1.5 39V10a8.5 8.5 0 0 1 8.5-8.5h29" strokeWidth="1.3" />
      <path d="M5.5 39V13a7.5 7.5 0 0 1 7.5-7.5h26" strokeWidth="0.5" />
      <path d="M10 27c0-9.4 7.6-17 17-17" strokeWidth="0.6" />
      <circle cx="10" cy="10" r="2.4" fill={GOLD} stroke="none" />
      <path d="M17 17l2.4-4.4 2.4 4.4-2.4 4.4z" fill={GOLD} stroke="none" transform="rotate(-45 19.4 17)" />
    </svg>
  );
}

/** Gold rosette seal with the overall band and CEFR level. */
function Seal({ band }: { band: number }) {
  const points = Array.from({ length: 64 }, (_, i) => {
    const r = i % 2 ? 46 : 50;
    const a = (i / 64) * 2 * Math.PI;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 124" className="w-[11.5cqw]" role="img" aria-label={`Seal: estimated band ${formatBand(band)}, CEFR ${cefrForBand(band)}`} style={{ fontFamily: serif.style.fontFamily, fontVariantNumeric: "lining-nums" }}>
      <defs>
        <linearGradient id="cert-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e199" />
          <stop offset="0.45" stopColor="#d4ac3c" />
          <stop offset="1" stopColor="#9a7419" />
        </linearGradient>
        <path id="cert-ring" d="M50 50m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0" />
      </defs>
      <path d="M33 74L22 122l11-7 9 9 8-48z" fill={NAVY} stroke="url(#cert-gold)" strokeWidth="1" />
      <path d="M67 74l11 48-11-7-9 9-8-48z" fill={NAVY} stroke="url(#cert-gold)" strokeWidth="1" />
      <polygon points={points} fill="url(#cert-gold)" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#fff6d6" strokeWidth="0.6" opacity="0.8" />
      <text fill={NAVY} fontSize="5.6" fontWeight="700" letterSpacing="0.4">
        <textPath href="#cert-ring" startOffset="0" textLength="252" lengthAdjust="spacing">
          LAFAEKTOEFL · MOCK TEST · CERTIFIED ACHIEVEMENT ·
        </textPath>
      </text>
      <circle cx="50" cy="50" r="34.5" fill={NAVY} />
      <circle cx="50" cy="50" r="31.5" fill="none" stroke="url(#cert-gold)" strokeWidth="0.8" />
      <text x="50" y="38" textAnchor="middle" fill="#e9cf7a" fontSize="6" fontWeight="700" letterSpacing="1.2">BAND</text>
      <text x="50" y="61" textAnchor="middle" fill="#ffffff" fontSize="23" fontWeight="700">{formatBand(band)}</text>
      <text x="50" y="72" textAnchor="middle" fill="#e9cf7a" fontSize="6.4" fontWeight="700" letterSpacing="0.8">CEFR {cefrForBand(band)}</text>
    </svg>
  );
}

/** "PREVIEW" tiled across the sheet, like the watermark on a specimen document. */
function PreviewWatermark() {
  return (
    <svg aria-hidden viewBox="0 0 297 210" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <pattern id="cert-preview" width="66" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
          <text x="2" y="19" fontSize="8.5" fontWeight="800" letterSpacing="2" fill="#1769f5" opacity="0.07" fontFamily="ui-sans-serif, system-ui, sans-serif">
            PREVIEW
          </text>
        </pattern>
      </defs>
      <rect width="297" height="210" fill="url(#cert-preview)" />
    </svg>
  );
}

/** Rubber-stamp overlay for a revoked certificate or a preview. */
function Stamp({ title, note, color }: { title: string; note?: string; color: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex -rotate-12 flex-col items-center rounded-[1cqw] border-[0.45cqw] px-[2.6cqw] py-[0.9cqw] opacity-75" style={{ borderColor: color, color }}>
        <span className="text-[6cqw] font-black uppercase leading-none tracking-[0.1em]">{title}</span>
        {note && <span className="mt-[0.5cqw] text-[1.2cqw] font-bold uppercase tracking-[0.2em]">{note}</span>}
      </span>
    </div>
  );
}

/**
 * `preview` shows a sample for learners who have not earned one yet: tiled "PREVIEW" watermark, a stamp,
 * and a blurred QR code, so it cannot pass for a real certificate.
 */
export function Certificate({ certificate: c, verifyUrl, qrSvg, preview = false }: { certificate: CertificateDTO; verifyUrl: string; qrSvg: string; preview?: boolean }) {
  const nameSize = c.holderName.length > 32 ? "text-[3.6cqw]" : c.holderName.length > 22 ? "text-[4.6cqw]" : "text-[5.6cqw]";
  return (
    <div className="@container w-full">
      <article
        aria-label={preview ? `Sample certificate (preview) for ${c.holderName}` : `Certificate of achievement for ${c.holderName}`}
        className="relative aspect-[297/210] w-full overflow-hidden bg-[#fffdf6] text-[#101b4d] lining-nums shadow-[0_20px_60px_-20px_rgba(16,27,77,0.35)] [print-color-adjust:exact] print:shadow-none"
      >
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#fffdf6_55%,#f8f0dc_100%)]" />
        <Guilloche />
        <Image src={BRAND.mark.src} alt="" width={BRAND.mark.width} height={BRAND.mark.height} sizes="400px" className="pointer-events-none absolute left-1/2 top-[50%] w-[36cqw] -translate-x-1/2 -translate-y-1/2 opacity-[0.045]" />

        {/* frame */}
        <div aria-hidden className="absolute inset-[1.8cqw] border-[0.6cqw] border-[#101b4d]" />
        <div aria-hidden className="absolute inset-[2.9cqw] border-[0.12cqw] border-[#b8912a]" />
        <Corner className="left-[3.3cqw] top-[3.3cqw]" />
        <Corner className="right-[3.3cqw] top-[3.3cqw] -scale-x-100" />
        <Corner className="bottom-[3.3cqw] left-[3.3cqw] -scale-y-100" />
        <Corner className="bottom-[3.3cqw] right-[3.3cqw] -scale-100" />

        <div className="absolute inset-x-[7cqw] bottom-[4.4cqw] top-[5cqw] flex flex-col items-center text-center">
          <div className="flex items-center gap-[0.8cqw]">
            <Image src={BRAND.mark.src} alt="" width={BRAND.mark.width} height={BRAND.mark.height} sizes="120px" className="h-[4.4cqw] w-auto" />
            <Image src={BRAND.wordmark.src} alt="LafaekTOEFL AI Coach" width={BRAND.wordmark.width} height={BRAND.wordmark.height} sizes="240px" className="h-[2.8cqw] w-auto" />
          </div>
          <p className="mt-[1.2cqw] text-[1cqw] font-bold uppercase tracking-[0.42em] text-[#9a7419]">Mock Test · TOEFL 2026 Scale</p>
          <h2 className={cn(serif.className, "mt-[0.3cqw] text-[4.6cqw] font-semibold leading-none tracking-[0.02em]")}>Certificate of Achievement</h2>
          <p className={cn(serif.className, "mt-[1.6cqw] text-[1.9cqw] italic text-[#3b4670]")}>This certifies that</p>
          <p className={cn(serif.className, nameSize, "mt-[0.2cqw] max-w-full truncate px-[2cqw] font-bold leading-tight")}>{c.holderName}</p>
          <div aria-hidden className="mt-[0.4cqw] flex w-[46cqw] items-center gap-[0.8cqw]">
            <span className="h-[0.1cqw] flex-1 bg-gradient-to-r from-transparent to-[#b8912a]" />
            <span className="size-[0.7cqw] rotate-45 bg-[#b8912a]" />
            <span className="h-[0.1cqw] flex-1 bg-gradient-to-l from-transparent to-[#b8912a]" />
          </div>
          <p className="mt-[1.3cqw] max-w-[62cqw] text-[1.4cqw] leading-[1.55] text-[#2b3560]">
            has completed all four sections of the LafaekTOEFL Mock Test and achieved an estimated band of{" "}
            <strong className="font-bold text-[#101b4d]">{formatBand(c.overallBand)} out of 6</strong>, CEFR level{" "}
            <strong className="font-bold text-[#101b4d]">{cefrForBand(c.overallBand)}</strong>, on the TOEFL 2026 score scale.
          </p>

          <ul className="mt-[2.4cqw] flex gap-[1.2cqw]">
            {c.sections.map((s) => (
              <li key={s.skill} className="flex w-[12.5cqw] items-center gap-[0.8cqw] rounded-[0.7cqw] border-[0.1cqw] border-[#b8912a]/45 bg-white/75 px-[1cqw] py-[0.7cqw] text-left">
                <Image src={icon3dSrc(s.skill)} alt="" width={64} height={64} className="size-[2.6cqw] shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[0.8cqw] font-bold uppercase tracking-[0.14em] text-[#6b7393]">{getSkill(s.skill).title}</span>
                  {s.band !== null ? (
                    <span className={cn(serif.className, "block text-[2.2cqw] font-bold leading-none")}>
                      {formatBand(s.band)}
                      <span className="text-[1.1cqw] font-semibold text-[#6b7393]"> / 6</span>
                    </span>
                  ) : (
                    <span className={cn(serif.className, "block text-[1.5cqw] font-semibold italic leading-tight")}>Completed</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto grid w-full grid-cols-[1fr_auto_1fr] items-end gap-[2cqw]">
            <div className="flex items-end gap-[1cqw] text-left">
              <div
                className={cn("size-[8cqw] shrink-0 rounded-[0.4cqw] bg-white p-[0.5cqw] ring-[0.1cqw] ring-[#b8912a]/50 [&>svg]:h-full [&>svg]:w-full", preview && "[&>svg]:opacity-60 [&>svg]:blur-[0.35cqw]")}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="min-w-0 pb-[0.2cqw]">
                <p className="text-[0.8cqw] font-bold uppercase tracking-[0.14em] text-[#6b7393]">Certificate ID</p>
                <p className="font-mono text-[1.3cqw] font-bold tracking-[0.06em]">{c.code}</p>
                <p className="mt-[0.5cqw] text-[0.8cqw] font-bold uppercase tracking-[0.14em] text-[#6b7393]">Verify online</p>
                <p className="break-all font-mono text-[0.9cqw] text-[#2b3560]">{verifyUrl.replace(/^https?:\/\//, "")}</p>
              </div>
            </div>
            <Seal band={c.overallBand} />
            <div className="flex flex-col items-end gap-[1.2cqw] text-right">
              <div className="w-[19cqw]">
                <p className={cn(serif.className, "text-[1.7cqw] font-semibold leading-tight")}>{longDate(c.issuedAt)}</p>
                <div className="mt-[0.3cqw] h-[0.1cqw] bg-[#b8912a]" />
                <p className="mt-[0.3cqw] text-[0.8cqw] font-bold uppercase tracking-[0.14em] text-[#6b7393]">Date of issue</p>
              </div>
              <div className="w-[19cqw]">
                <p className={cn(serif.className, "text-[1.7cqw] font-semibold italic leading-tight")}>LafaekTOEFL AI Coach</p>
                <div className="mt-[0.3cqw] h-[0.1cqw] bg-[#b8912a]" />
                <p className="mt-[0.3cqw] text-[0.8cqw] font-bold uppercase tracking-[0.14em] text-[#6b7393]">Issued by</p>
              </div>
            </div>
          </div>

          <p className="mt-[1.4cqw] max-w-[78cqw] text-[0.75cqw] leading-snug text-[#6b7393]">
            Practice certificate from a short mock test. The band is the average of the four section bands: Reading and Listening scored from the answers, Writing and
            Speaking rated by AI. It is not an official TOEFL score report. LafaekTOEFL is not affiliated with or endorsed by ETS. TOEFL is a registered trademark of ETS.
          </p>
        </div>

        {preview && <PreviewWatermark />}
        {preview && <Stamp title="Preview" note="Sample · not a real certificate" color="#1769f5" />}
        {c.revokedAt && <Stamp title="Revoked" color="#b42318" />}
      </article>
    </div>
  );
}
