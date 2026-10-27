import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SITE } from "@/lib/config/site";
import { ToastProvider } from "@/components/ui/Toast";
import { THEME_BOOTSTRAP } from "@/components/layout/ThemeSync";
import { ConnectionStatus } from "@/components/layout/ConnectionStatus";

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.shortName}` },
  description: SITE.description,
  icons: { icon: "/assets/logo/logo-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#1769f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* Marks JS as available so entrance animations may pre-hide content (see globals.css fallback). */}
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add("js")` }} />
      </head>
      <body>
        <ToastProvider>
          {children}
          <ConnectionStatus />
        </ToastProvider>
      </body>
    </html>
  );
}
