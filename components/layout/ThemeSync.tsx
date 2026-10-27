"use client";

import { useEffect } from "react";
import { useOptionalSession } from "@/components/session/SessionProvider";

/** Inline script for <head>: applies the last known theme before first paint (cached preference only). */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("lafaek-toefl:theme")||"light";if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;

/** Applies the signed-in user's saved theme (from the server). */
export function ThemeSync() {
  const session = useOptionalSession();
  const theme = session?.settings.theme ?? "light";
  useEffect(() => {
    try {
      localStorage.setItem("lafaek-toefl:theme", theme);
    } catch {
      /* convenience cache only */
    }
    const root = document.documentElement;
    if (theme !== "system") {
      root.dataset.theme = theme;
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => (root.dataset.theme = mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return null;
}
