"use client";

import { useRef } from "react";
import { gsap, useMotion } from "@/lib/client/motion";

// "12", "9,288", "85%", "3 / 12": the first number counts up, the rest stays as written.
const PATTERN = /^(\d[\d,]*)(\s*(?:%|\/\s*\d[\d,]*))?$/;

/** Shows `text` and, when it is a simple number, counts it up from 0 on mount. */
export function CountUp({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = PATTERN.exec(text.trim());

  useMotion(
    ref,
    (el) => {
      if (!m) return;
      const target = Number(m[1].replace(/,/g, ""));
      const suffix = m[2] ?? "";
      // Change the existing text node's value (React keeps owning the node).
      const node = el.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const state = { n: 0 };
      gsap.to(state, {
        n: target,
        duration: Math.min(1.4, 0.5 + target / 200),
        ease: "power2.out",
        onUpdate: () => {
          node.nodeValue = `${Math.round(state.n).toLocaleString("en-US")}${suffix}`;
        },
        onComplete: () => {
          node.nodeValue = text;
        },
      });
      return () => {
        node.nodeValue = text;
      };
    },
    [text],
  );

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
