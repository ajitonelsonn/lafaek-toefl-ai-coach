import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo variant="mark" size={96} href="/" />
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-2 text-3xl font-extrabold text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted">The link may be old, or the page may have moved.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className={buttonClasses({})}>
          Go to Dashboard
        </Link>
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          Back to Home
        </Link>
      </div>
    </main>
  );
}
