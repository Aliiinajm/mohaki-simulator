"use client";
import { useState } from "react";
import type { CompoundData } from "@/lib/chem/sources";
import { CompoundSearch } from "./CompoundSearch";
import { CompoundCard } from "./CompoundCard";

const QUICK = ["caffeine", "aspirin", "glucose", "benzene", "ethanol", "dopamine", "paracetamol", "cholesterol", "nicotine", "sulfuric acid", "gold", "iron"];

export function CompoundExplorer({ initial = "" }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const [trigger, setTrigger] = useState(initial ? 1 : 0);
  const [data, setData] = useState<CompoundData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <h3 className="mb-1 text-lg font-bold text-white">🔎 ابحث عن أي مركب أو عنصر</h3>
        <p className="mb-4 text-sm text-slate-400">يدعم الاسم الشائع، اسم IUPAC، صيغة SMILES، رقم CID أو InChIKey — مع اقتراحات فورية أثناء الكتابة. البحث يمر عبر PubChem ثم NCI CACTUS ثم ChemSpider تلقائياً.</p>
        <CompoundSearch
          value={q}
          onChange={setQ}
          autoResolve={trigger}
          onResolved={(d, e) => {
            setLoading(false);
            setData(d);
            setError(e || "");
          }}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQ(s);
                setLoading(true);
                setTrigger((t) => t + 1);
              }}
              className="ltr rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-slate-300 transition hover:bg-cyan-400/15 hover:text-cyan-100"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {loading && !data && (
        <div className="glass flex items-center justify-center gap-3 rounded-3xl p-10 text-cyan-200">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /> جارِ جلب البيانات من قواعد البيانات...
        </div>
      )}
      {error && <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-center text-rose-200">{error}</div>}
      {data && <CompoundCard key={data.cid ?? data.name} data={data} />}
      {!data && !error && !loading && (
        <div className="glass rounded-3xl p-12 text-center text-slate-400">
          <div className="floaty mb-4 text-6xl">⚛️</div>
          ابدأ بكتابة اسم مركب لعرض الرسم الثلاثي الأبعاد والصيغة الكيميائية والخصائص الكاملة
        </div>
      )}
    </div>
  );
}
