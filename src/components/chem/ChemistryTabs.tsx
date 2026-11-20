"use client";
import { useState } from "react";
import { ReactionSimulator } from "./ReactionSimulator";
import { CompoundExplorer } from "./CompoundExplorer";
import { PeriodicTable } from "./PeriodicTable";

type Tab = "reactions" | "explorer" | "periodic";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "reactions", label: "محاكي التفاعلات", icon: "⚗️" },
  { id: "explorer", label: "مستكشف المركبات 3D", icon: "⚛️" },
  { id: "periodic", label: "الجدول الدوري", icon: "🧬" },
];

export function ChemistryTabs({ initialTab, initialQuery }: { initialTab: Tab; initialQuery: string }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [explorerQ, setExplorerQ] = useState(initialQuery);
  const [explorerKey, setExplorerKey] = useState(0);
  // Keep the simulator mounted to preserve its state when switching tabs
  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              window.history.replaceState(null, "", `/chemistry?tab=${t.id}`);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
              tab === t.id ? "bg-gradient-to-l from-cyan-400/25 to-emerald-400/20 text-white shadow-inner" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className={tab === "reactions" ? "" : "hidden"}>
        <ReactionSimulator />
      </div>
      {tab === "explorer" && <CompoundExplorer key={explorerKey} initial={explorerQ} />}
      {tab === "periodic" && (
        <PeriodicTable
          onSelect={(name) => {
            setExplorerQ(name);
            setExplorerKey((k) => k + 1);
            setTab("explorer");
            window.history.replaceState(null, "", `/chemistry?tab=explorer`);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
