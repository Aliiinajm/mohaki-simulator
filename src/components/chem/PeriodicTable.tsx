"use client";
import { useEffect, useState } from "react";
import type { ElementInfo } from "@/lib/chem/sources";

function position(z: number): [number, number] {
  if (z === 1) return [1, 1];
  if (z === 2) return [1, 18];
  if (z <= 18) {
    const p = z <= 10 ? 2 : 3;
    const idx = z - (p === 2 ? 2 : 10);
    return [p, idx <= 2 ? idx : idx + 10];
  }
  if (z <= 36) return [4, z - 18];
  if (z <= 54) return [5, z - 36];
  if (z <= 86) {
    if (z <= 56) return [6, z - 54];
    if (z === 57) return [6, 3];
    if (z <= 71) return [9, z - 58 + 4];
    return [6, z - 68];
  }
  if (z <= 88) return [7, z - 86];
  if (z === 89) return [7, 3];
  if (z <= 103) return [10, z - 90 + 4];
  return [7, z - 100];
}

const BLOCK_COLORS: Record<string, string> = {
  Nonmetal: "bg-emerald-500/25 border-emerald-400/40",
  "Noble gas": "bg-violet-500/25 border-violet-400/40",
  "Alkali metal": "bg-rose-500/25 border-rose-400/40",
  "Alkaline earth metal": "bg-orange-500/25 border-orange-400/40",
  Metalloid: "bg-teal-500/25 border-teal-400/40",
  Halogen: "bg-yellow-500/25 border-yellow-400/40",
  "Post-transition metal": "bg-sky-500/25 border-sky-400/40",
  "Transition metal": "bg-blue-500/25 border-blue-400/40",
  Lanthanide: "bg-pink-500/25 border-pink-400/40",
  Actinide: "bg-fuchsia-500/25 border-fuchsia-400/40",
};

export function PeriodicTable({ onSelect }: { onSelect: (name: string) => void }) {
  const [els, setEls] = useState<ElementInfo[]>([]);
  const [hover, setHover] = useState<ElementInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/chem/periodic")
      .then((r) => r.json())
      .then((j) => setEls(j.elements || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="glass rounded-3xl p-10 text-center text-cyan-200">جارِ تحميل الجدول الدوري من PubChem...</div>;
  if (!els.length) return <div className="glass rounded-3xl p-10 text-center text-rose-200">تعذر تحميل الجدول الدوري.</div>;

  return (
    <div className="glass rounded-3xl p-4 sm:p-6">
      <div className="mb-4 flex min-h-[64px] flex-wrap items-center gap-4">
        {hover ? (
          <>
            <div className="ltr text-4xl font-black text-white">{hover.symbol}</div>
            <div className="ltr text-start text-sm text-slate-300">
              <div className="font-bold text-white">{hover.atomicNumber}. {hover.name}</div>
              <div>{hover.groupBlock} • {hover.atomicWeight} u • {hover.electronConfiguration}</div>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-400">مرّر المؤشر على أي عنصر لعرض معلوماته، واضغط لفتح صفحته الكاملة مع النموذج ثلاثي الأبعاد.</div>
        )}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="ltr grid min-w-[900px] gap-1" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: "repeat(10, 52px)" }}>
          {els.map((e) => {
            const [r, c] = position(e.atomicNumber);
            return (
              <button
                key={e.atomicNumber}
                onMouseEnter={() => setHover(e)}
                onClick={() => onSelect(e.name)}
                style={{ gridRow: r, gridColumn: c }}
                className={`flex flex-col items-center justify-center rounded-md border text-white transition hover:z-10 hover:scale-125 hover:shadow-xl ${BLOCK_COLORS[e.groupBlock] || "border-white/10 bg-white/5"}`}
              >
                <span className="text-[9px] leading-none opacity-70">{e.atomicNumber}</span>
                <span className="text-sm font-bold leading-tight">{e.symbol}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        {Object.entries(BLOCK_COLORS).map(([k, v]) => (
          <span key={k} className={`ltr rounded-md border px-2 py-0.5 text-slate-200 ${v}`}>{k}</span>
        ))}
      </div>
    </div>
  );
}
