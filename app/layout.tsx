import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SITE } from "@/lib/config/site";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeSync, THEME_BOOTSTRAP } from "@/components/layout/ThemeSync";

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
      </head>
      <body>
        <ToastProvider>
          <ThemeSync />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
