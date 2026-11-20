"use client";
import { useEffect, useState } from "react";
import { loadOCL } from "./ocl";

/** Instant 2D structure rendering in-browser with OpenChemLib (no server round-trip). */
export function MoleculeView({ smiles, height = 220, className = "" }: { smiles: string | null | undefined; height?: number; className?: string }) {
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!smiles) {
      setSvg("");
      return;
    }
    loadOCL()
      .then((OCL) => {
        const mol = OCL.Molecule.fromSmiles(smiles);
        const out = mol.toSVG(420, height * 1.6, undefined, {
          autoCrop: true,
          autoCropMargin: 18,
          suppressChiralText: true,
          factorTextSize: 1.15,
          strokeWidth: 1.6,
        } as Parameters<typeof mol.toSVG>[3]);
        if (alive) {
          setSvg(out);
          setErr(false);
        }
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [smiles, height]);

  return (
    <div className={`mol-svg flex items-center justify-center overflow-hidden rounded-2xl bg-white p-2 ${className}`} style={{ height }}>
      {err ? (
        <span className="text-sm text-slate-500">تعذر رسم البنية</span>
      ) : svg ? (
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      )}
    </div>
  );
}
