import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/session/SessionProvider";
import { loadShellSession } from "@/lib/server/auth/page";

// Every page in this group requires a valid server-side session (redirects to /login).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, settings } = await loadShellSession();
  return (
    <SessionProvider initialUser={user} initialSettings={settings}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
