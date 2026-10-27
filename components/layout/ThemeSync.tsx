"use client";

import { useEffect } from "react";
import { useDemoState } from "@/lib/store/demo-store";

/** Inline script for <head>: applies the saved theme before first paint. */
export const THEME_BOOTSTRAP = `(function(){try{var s=JSON.parse(localStorage.getItem("lafaek-toefl:demo-state:v1")||"null");var t=(s&&s.settings&&s.settings.theme)||"light";if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;

export function ThemeSync() {
  const { settings } = useDemoState();
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme !== "system") {
      root.dataset.theme = settings.theme;
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => (root.dataset.theme = mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);
  return null;
}
