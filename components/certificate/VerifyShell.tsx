import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

/** Public frame for the verification pages (no sign-in needed). */
export function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-page print:min-h-0 print:bg-white">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size={40} />
          <Link href="/verify" className="text-sm font-semibold text-primary hover:underline">
            Verify a certificate
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 print:m-0 print:block print:max-w-none print:p-0">{children}</main>
    </div>
  );
}

/** ID lookup; a plain GET form, so it works without JavaScript. */
export function CertificateLookup({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <form action="/verify" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Input
        name="code"
        label="Certificate ID"
        srOnlyLabel
        placeholder="LT-XXXX-XXXX-XXXX"
        defaultValue={defaultValue}
        error={error}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        containerClassName="flex-1"
        className="font-mono uppercase tracking-wider"
      />
      <Button type="submit" size="lg" leftIcon={<Search className="size-4" />}>
        Verify
      </Button>
    </form>
  );
}
