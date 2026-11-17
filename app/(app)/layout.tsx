import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/session/SessionProvider";
import { loadShellSession } from "@/lib/server/auth/page";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth/session";
import { isGuestEmail } from "@/lib/server/auth/guest";

// Every page in this group requires a valid server-side session (redirects to /login). Guests
// (the VR "Try the demo") are signed out instead and sent to the home page.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // A guest only exists to try the VR room: leaving it for the app signs them out.
  const auth = await getAuth();
  if (auth && isGuestEmail(auth.user.emailNormalized)) redirect("/api/auth/guest/exit?next=/");
  const { user, settings } = await loadShellSession();
  return (
    <SessionProvider initialUser={user} initialSettings={settings}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
