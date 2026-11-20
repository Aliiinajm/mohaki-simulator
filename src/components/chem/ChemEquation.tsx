"use client";
import { useEffect, useRef } from "react";

/** Renders a balanced chemical equation with KaTeX + mhchem (\ce{...}). */
export function ChemEquation({ latex, className = "" }: { latex: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const katex = (await import("katex")).default;
      await import("katex/contrib/mhchem");
      if (!alive || !ref.current) return;
      try {
        katex.render(latex, ref.current, { displayMode: true, throwOnError: false, strict: "ignore" });
      } catch {
        ref.current.textContent = latex;
      }
    })();
    return () => {
      alive = false;
    };
  }, [latex]);
  return <div ref={ref} className={`ltr text-center text-white ${className}`} />;
}
