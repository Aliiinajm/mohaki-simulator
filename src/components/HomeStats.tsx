"use client";
import { useEffect, useState } from "react";

type Stats = { compounds: number; reactions: number; popular: { name: string; formula: string | null; hits: number }[] };

export function HomeStats() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/chem/stats").then((r) => r.json()).then(setS).catch(() => {});
  }, []);
  const items = [
    { v: "118", l: "عنصر في الجدول الدوري" },
    { v: "+115M", l: "مركب عبر PubChem" },
    { v: s ? String(s.compounds) : "…", l: "مركب محفوظ في الذاكرة المؤقتة" },
    { v: s ? String(s.reactions) : "…", l: "تفاعل تمت محاكاته" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((i) => (
        <div key={i.l} className="glass rounded-2xl p-5 text-center">
          <div className="ltr text-3xl font-black text-white">{i.v}</div>
          <div className="mt-1 text-xs text-slate-400">{i.l}</div>
        </div>
      ))}
    </div>
  );
}
