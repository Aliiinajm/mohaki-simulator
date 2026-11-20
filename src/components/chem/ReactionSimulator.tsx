"use client";
import { useState } from "react";
import type { CompoundData } from "@/lib/chem/sources";
import type { ReactionResult } from "@/lib/chem/engine";
import { CompoundSearch } from "./CompoundSearch";
import { MoleculeView } from "./MoleculeView";
import { Molecule3D } from "./Molecule3D";
import { ChemEquation } from "./ChemEquation";
import { ReactionFlask } from "./ReactionFlask";
import { Formula } from "./CompoundCard";
import { SubstancesProperties } from "./PropertiesPanel";

const CATALYSTS = [
  { v: "none", l: "بدون عامل حفاز" },
  { v: "Fe", l: "حديد Fe (هابر)" },
  { v: "Pt", l: "بلاتين Pt" },
  { v: "Pd", l: "بلاديوم Pd" },
  { v: "Ni", l: "نيكل Ni" },
  { v: "V2O5", l: "خامس أكسيد الفاناديوم V₂O₅" },
  { v: "H2SO4", l: "حمض الكبريتيك المركز H₂SO₄" },
  { v: "H3PO4", l: "حمض الفوسفوريك H₃PO₄" },
  { v: "MnO2", l: "ثاني أكسيد المنغنيز MnO₂" },
];

type Preset = { label: string; a: string; b: string; ma: number; mb: number; t: number; cat?: string; fire?: boolean };
const PRESETS: Preset[] = [
  { label: "تكوين الماء 💥", a: "hydrogen", b: "oxygen", ma: 2, mb: 1, t: 25, fire: true },
  { label: "تعادل حمض وقاعدة", a: "hydrochloric acid", b: "sodium hydroxide", ma: 1, mb: 1.5, t: 25 },
  { label: "ترسيب كلوريد الفضة", a: "silver nitrate", b: "sodium chloride", ma: 0.5, mb: 0.5, t: 25 },
  { label: "خارصين + كبريتات النحاس", a: "zinc", b: "copper sulfate", ma: 1, mb: 0.8, t: 25 },
  { label: "احتراق الميثان 🔥", a: "methane", b: "oxygen", ma: 1, mb: 3, t: 25, fire: true },
  { label: "الأسترة (فيشر)", a: "acetic acid", b: "ethanol", ma: 1, mb: 1, t: 80, cat: "H2SO4" },
  { label: "عملية هابر", a: "nitrogen", b: "hydrogen", ma: 1, mb: 3, t: 450, cat: "Fe" },
  { label: "صوديوم + ماء", a: "sodium", b: "water", ma: 2, mb: 5, t: 25 },
  { label: "إيثيلين + بروم", a: "ethylene", b: "bromine", ma: 1, mb: 1, t: 25 },
  { label: "تفاعل الثرميت", a: "aluminum", b: "ferric oxide", ma: 2, mb: 1, t: 25, fire: true },
  { label: "كربونات الكالسيوم + حمض", a: "calcium carbonate", b: "hydrochloric acid", ma: 1, mb: 2, t: 25 },
  { label: "ترسيب كبريتات الباريوم", a: "barium chloride", b: "sodium sulfate", ma: 1, mb: 1, t: 25 },
];

function ReactantPanel({
  idx,
  name,
  setName,
  moles,
  setMoles,
  data,
  setData,
  trigger,
  accent,
}: {
  idx: number;
  name: string;
  setName: (v: string) => void;
  moles: number;
  setMoles: (v: number) => void;
  data: CompoundData | null;
  setData: (d: CompoundData | null) => void;
  trigger: number;
  accent: "cyan" | "emerald";
}) {
  const [error, setError] = useState("");
  return (
    <div className="glass relative rounded-3xl p-5">
      <div className={`absolute -top-3 right-5 rounded-full px-3 py-0.5 text-xs font-bold text-slate-900 ${accent === "cyan" ? "bg-cyan-400" : "bg-emerald-400"}`}>المتفاعل {idx}</div>
      <CompoundSearch
        value={name}
        onChange={setName}
        accent={accent}
        autoResolve={trigger}
        onResolved={(d, e) => {
          setData(d);
          setError(e || "");
        }}
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">الكمية (مول)</label>
          <input
            type="number"
            min={0.001}
            step={0.1}
            value={moles}
            onChange={(e) => setMoles(parseFloat(e.target.value) || 0)}
            className="ltr w-full rounded-xl border border-white/10 bg-[#0a1630] px-3 py-2 font-mono text-white focus:border-cyan-400/60 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">الكتلة المكافئة</label>
          <div className="ltr rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-start font-mono text-slate-200">
            {data?.molecularWeight ? `${(moles * data.molecularWeight).toFixed(3)} g` : "—"}
          </div>
        </div>
      </div>
      <div className="mt-4">
        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        ) : data ? (
          <div className="fade-up">
            <MoleculeView smiles={data.isomericSmiles || data.smiles} height={170} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="ltr font-bold capitalize text-white">{data.name}</span>
              <span className="text-cyan-200">
                <Formula f={data.formula} /> • <span className="ltr font-mono">{data.molecularWeight} g/mol</span>
              </span>
            </div>
            <div className="ltr mt-1 truncate text-start font-mono text-[11px] text-slate-500" title={data.smiles || ""}>SMILES: {data.smiles}</div>
          </div>
        ) : (
          <div className="flex h-[170px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500">ستظهر البنية الكيميائية هنا فوراً</div>
        )}
      </div>
    </div>
  );
}

export function ReactionSimulator() {
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [m1, setM1] = useState(1);
  const [m2, setM2] = useState(1);
  const [d1, setD1] = useState<CompoundData | null>(null);
  const [d2, setD2] = useState<CompoundData | null>(null);
  const [t1, setT1] = useState(0);
  const [t2, setT2] = useState(0);
  const [temp, setTemp] = useState(25);
  const [catalyst, setCatalyst] = useState("none");
  const [ignition, setIgnition] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReactionResult | null>(null);
  const [error, setError] = useState("");
  const [show3d, setShow3d] = useState<number | null>(null);

  async function react(override?: { a: string; b: string; ma: number; mb: number; t: number; cat: string; fire: boolean }) {
    const body = override
      ? { reactant1: override.a, reactant2: override.b, moles1: override.ma, moles2: override.mb, temperature: override.t, catalyst: override.cat, ignition: override.fire }
      : { reactant1: d1?.name || n1, reactant2: d2?.name || n2, moles1: m1, moles2: m2, temperature: temp, catalyst, ignition };
    if (!body.reactant1.trim() || !body.reactant2.trim()) {
      setError("أدخل اسم المركبين أولاً");
      return;
    }
    setLoading(true);
    setError("");
    setShow3d(null);
    try {
      const r = await fetch("/api/chem/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const text = await r.text();
      const j = text ? JSON.parse(text) : {};
      if (!r.ok) {
        setError(j.reason || j.error || `فشل طلب التفاعل (${r.status})`);
        return;
      }
      if (j.status === "error") {
        setError(j.reason || "حدث خطأ أثناء محاكاة التفاعل");
        if (!j.reactants?.length) return;
      }
      setResult(j);
      setTimeout(() => document.getElementById("reaction-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(p: Preset) {
    setN1(p.a);
    setN2(p.b);
    setM1(p.ma);
    setM2(p.mb);
    setTemp(p.t);
    setCatalyst(p.cat || "none");
    setIgnition(!!p.fire);
    setT1((x) => x + 1);
    setT2((x) => x + 1);
    react({ a: p.a, b: p.b, ma: p.ma, mb: p.mb, t: p.t, cat: p.cat || "none", fire: !!p.fire });
  }

  const tempColor = temp < 0 ? "text-sky-300" : temp < 100 ? "text-emerald-300" : temp < 500 ? "text-amber-300" : "text-rose-400";

  return (
    <div className="space-y-8">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        <span className="py-1.5 text-sm text-slate-400">أمثلة جاهزة:</span>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)} className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-400/15">
            {p.label}
          </button>
        ))}
      </div>

      {/* Reactants */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <ReactantPanel idx={1} name={n1} setName={(v) => { setN1(v); setD1(null); }} moles={m1} setMoles={setM1} data={d1} setData={setD1} trigger={t1} accent="cyan" />
        <div className="flex items-center justify-center self-center text-5xl font-black text-cyan-300/60">+</div>
        <ReactantPanel idx={2} name={n2} setName={(v) => { setN2(v); setD2(null); }} moles={m2} setMoles={setM2} data={d2} setData={setD2} trigger={t2} accent="emerald" />
      </div>

      {/* Conditions */}
      <div className="glass rounded-3xl p-6">
        <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-white">⚙️ ظروف التفاعل</h3>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-300">درجة الحرارة</span>
              <span className={`ltr font-mono text-lg font-bold ${tempColor}`}>{temp} °C</span>
            </div>
            <input type="range" min={-50} max={1600} step={5} value={temp} onChange={(e) => setTemp(parseInt(e.target.value, 10))} className="w-full" />
            <div className="mt-2 flex gap-2">
              <input type="number" value={temp} onChange={(e) => setTemp(parseFloat(e.target.value) || 0)} className="ltr w-24 rounded-lg border border-white/10 bg-[#0a1630] px-2 py-1 font-mono text-sm text-white" />
              {[0, 25, 100, 450, 1000].map((v) => (
                <button key={v} onClick={() => setTemp(v)} className="ltr rounded-lg bg-white/5 px-2 py-1 font-mono text-xs text-slate-300 hover:bg-white/10">
                  {v}°
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">العامل الحفاز (اختياري)</label>
            <select value={catalyst} onChange={(e) => setCatalyst(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a1630] px-3 py-2.5 text-white focus:border-cyan-400/60 focus:outline-none">
              {CATALYSTS.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">مصدر حرارة / إشعال / ضوء</label>
            <button
              onClick={() => setIgnition(!ignition)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 transition ${ignition ? "border-orange-400/50 bg-orange-500/15 text-orange-200" : "border-white/10 bg-[#0a1630] text-slate-300"}`}
            >
              <span>{ignition ? "🔥 الإشعال مفعّل" : "بدون إشعال"}</span>
              <span className={`relative h-6 w-11 rounded-full transition ${ignition ? "bg-orange-400" : "bg-slate-600"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${ignition ? "left-0.5" : "left-[22px]"}`} />
              </span>
            </button>
          </div>
        </div>
        <button
          onClick={() => react()}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-cyan-400 to-emerald-400 py-4 text-lg font-extrabold text-slate-900 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.01] disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" /> جارِ محاكاة التفاعل...
            </>
          ) : (
            <>⚗️ تفاعل</>
          )}
        </button>
        {error && <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-center text-sm text-rose-200">{error}</div>}
      </div>

      {/* Result */}
      {result && (
        <div id="reaction-result" className="fade-up scroll-mt-24 space-y-6">
          <div
            className={`rounded-3xl border p-6 ${
              result.status === "success" ? "border-emerald-400/30 bg-emerald-500/[0.07]" : result.status === "no_reaction" ? "border-amber-400/30 bg-amber-500/[0.07]" : "border-rose-400/30 bg-rose-500/[0.07]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{result.status === "success" ? "✅" : result.status === "no_reaction" ? "⛔" : "⚠️"}</span>
                <div>
                  <div className="text-xl font-extrabold text-white">{result.status === "success" ? "حدث التفاعل بنجاح" : result.status === "no_reaction" ? "لا يحدث تفاعل" : "خطأ"}</div>
                  {result.reactionTypeAr && <div className="text-sm text-slate-300">نوع التفاعل: {result.reactionTypeAr}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="ltr rounded-full bg-white/5 px-3 py-1 text-slate-300">engine: {result.engine}</span>
                {result.cached && <span className="rounded-full bg-emerald-400/15 px-3 py-1 font-bold text-emerald-300">من الذاكرة المؤقتة ⚡</span>}
                {result.confidence != null && <span className="rounded-full bg-violet-400/15 px-3 py-1 text-violet-200">الثقة: {(result.confidence * 100).toFixed(0)}%</span>}
              </div>
            </div>
            {result.equation && (
              <div className="mt-5 rounded-2xl bg-black/30 px-4 py-3">
                <ChemEquation latex={result.equation.latex} />
              </div>
            )}
            {result.reason && <p className="mt-4 leading-7 text-amber-100">{result.reason}</p>}
            {result.requirement && (
              <p className="mt-2 rounded-xl bg-cyan-400/10 p-3 text-sm text-cyan-100">💡 الشرط المطلوب: {result.requirement}</p>
            )}
            {result.description && <p className="mt-4 leading-7 text-slate-200">{result.description}</p>}
          </div>

          {result.status === "no_reaction" && result.expectedProducts.length > 0 && (
            <div className="glass rounded-3xl p-6">
              <h3 className="mb-4 font-bold text-white">النواتج المتوقعة عند تحقق الشروط</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {result.expectedProducts.map((p) => (
                  <div key={p.formula} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 opacity-80">
                    <MoleculeView smiles={p.smiles} height={130} />
                    <div className="mt-2 text-center text-sm">
                      <Formula f={p.formula} className="text-cyan-200" /> — {p.nameAr}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.status === "success" && (
            <>
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="glass rounded-3xl p-6">
                  <h3 className="mb-4 font-bold text-white">🧪 النواتج</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {result.products.map((p, i) => (
                      <div key={p.formula + i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                        {show3d === i ? <Molecule3D smiles={p.smiles} height={190} /> : <MoleculeView smiles={p.smiles} height={190} />}
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <div className="text-lg font-bold text-cyan-200">
                              <Formula f={p.formula} />
                              <span className="mr-1 text-xs text-slate-400">({p.state})</span>
                            </div>
                            <div className="text-sm text-slate-300">{p.nameAr}</div>
                          </div>
                          <button onClick={() => setShow3d(show3d === i ? null : i)} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10">
                            {show3d === i ? "2D" : "3D"}
                          </button>
                        </div>
                        {p.note && <div className="mt-2 rounded-lg bg-amber-400/10 px-2 py-1 text-xs text-amber-200">⬇ {p.note}</div>}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-lg bg-black/20 p-2">
                            <div className="text-[10px] text-slate-400">المولات الناتجة</div>
                            <div className="ltr font-mono text-sm font-bold text-white">{p.moles}</div>
                          </div>
                          <div className="rounded-lg bg-black/20 p-2">
                            <div className="text-[10px] text-slate-400">الكتلة (g)</div>
                            <div className="ltr font-mono text-sm font-bold text-emerald-300">{p.mass}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass rounded-3xl p-6">
                  <h3 className="mb-2 font-bold text-white">محاكاة بصرية</h3>
                  <ReactionFlask result={result} />
                  {result.observations.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {result.observations.map((o) => (
                        <li key={o} className="flex gap-2 text-slate-200">
                          <span className="text-cyan-300">◆</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Stoichiometry */}
              <div className="glass overflow-hidden rounded-3xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-6">
                  <h3 className="font-bold text-white">📊 تقرير الحسابات الكيميائية (Stoichiometry)</h3>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-rose-400/15 px-3 py-1 text-rose-200">المتفاعل المحدد: <b className="ltr capitalize">{result.limitingReactant}</b></span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">مدى التفاعل ξ = <span className="ltr font-mono">{result.extent}</span> mol</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-white/[0.03] text-xs text-slate-400">
                      <tr>
                        <th className="p-3 text-start">المادة</th>
                        <th className="p-3">المعامل</th>
                        <th className="p-3">M (g/mol)</th>
                        <th className="p-3">المولات الابتدائية</th>
                        <th className="p-3">الكتلة الابتدائية (g)</th>
                        <th className="p-3">المستهلك (mol)</th>
                        <th className="p-3">المتبقي (mol)</th>
                        <th className="p-3">المتبقي (g)</th>
                        <th className="p-3">الدور</th>
                      </tr>
                    </thead>
                    <tbody className="ltr-nums">
                      {result.reactants.map((r) => (
                        <tr key={r.name} className="border-t border-white/5 text-center">
                          <td className="p-3 text-start">
                            <div className="ltr font-semibold capitalize text-white">{r.name}</div>
                            <Formula f={r.displayFormula} className="text-xs text-cyan-300" />
                          </td>
                          <td className="p-3 font-mono">{r.coefficient}</td>
                          <td className="p-3 font-mono">{r.molarMass}</td>
                          <td className="p-3 font-mono">{r.molesInput}</td>
                          <td className="p-3 font-mono">{r.massInput}</td>
                          <td className="p-3 font-mono">{r.consumedMoles}</td>
                          <td className="p-3 font-mono">{r.remainingMoles}</td>
                          <td className="p-3 font-mono">{r.remainingMass}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.role === "limiting" ? "bg-rose-400/15 text-rose-300" : "bg-sky-400/15 text-sky-300"}`}>
                              {r.role === "limiting" ? "محدد" : "فائض"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {result.products.map((p, i) => (
                        <tr key={p.formula + i} className="border-t border-white/5 bg-emerald-400/[0.03] text-center">
                          <td className="p-3 text-start">
                            <div className="font-semibold text-white">{p.nameAr}</div>
                            <Formula f={p.formula} className="text-xs text-emerald-300" />
                          </td>
                          <td className="p-3 font-mono">{p.coefficient}</td>
                          <td className="p-3 font-mono">{p.molarMass}</td>
                          <td className="p-3 font-mono">0</td>
                          <td className="p-3 font-mono">0</td>
                          <td className="p-3 font-mono">—</td>
                          <td className="p-3 font-mono text-emerald-300">+{p.moles}</td>
                          <td className="p-3 font-mono text-emerald-300">+{p.mass}</td>
                          <td className="p-3">
                            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">ناتج</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="glass rounded-3xl p-6">
                  <div className="text-sm text-slate-400">التغير في المحتوى الحراري ΔH°</div>
                  {result.thermo ? (
                    <>
                      <div className={`ltr mt-2 text-start font-mono text-3xl font-black ${result.thermo.exothermic ? "text-orange-300" : "text-sky-300"}`}>
                        {result.thermo.deltaH} <span className="text-base">kJ</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-300">{result.thermo.exothermic ? "🔥 طارد للحرارة" : "❄️ ماص للحرارة"}</div>
                      <div className="mt-2 text-xs text-slate-400">
                        الحرارة الكلية للكميات المدخلة: <span className="ltr font-mono">{result.thermo.heat} kJ</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">لا تتوفر بيانات ΔHf° لكل المواد.</div>
                  )}
                </div>
                <div className="glass rounded-3xl p-6">
                  <div className="text-sm text-slate-400">الحركية (معادلة أرينيوس)</div>
                  {result.kinetics && (
                    <>
                      <div className="ltr mt-2 text-start font-mono text-3xl font-black text-violet-300">×{result.kinetics.relativeRate}</div>
                      <div className="mt-1 text-sm text-slate-300">سرعة التفاعل مقارنة بـ 25°C</div>
                      <div className="mt-2 text-xs text-slate-400">
                        طاقة التنشيط التقديرية Ea ≈ <span className="ltr font-mono">{result.kinetics.ea} kJ/mol</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="glass rounded-3xl p-6">
                  <div className="text-sm text-slate-400">ملاحظات</div>
                  <ul className="mt-2 space-y-2 text-sm text-slate-300">
                    {result.notes.length ? result.notes.map((n) => <li key={n}>• {n}</li>) : <li className="text-slate-500">لا توجد ملاحظات إضافية.</li>}
                  </ul>
                </div>
              </div>
            </>
          )}
          {result.reactants.length > 0 && (
            <div className="glass rounded-3xl p-6">
              <h3 className="mb-1 font-bold text-white">🧾 الخواص الفيزيائية والكيميائية للمواد</h3>
              <p className="mb-4 text-xs text-slate-400">لكل متفاعل وناتج — من PubChem مع تحليل كيميائي محلي (نوع الرابطة، الحمضية/القاعدية، الذوبانية، المجموعات الوظيفية...)</p>
              <SubstancesProperties
                items={[
                  ...result.reactants.map((r) => ({ title: r.name, formula: r.displayFormula, query: r.cid ? String(r.cid) : r.smiles || r.name, role: "متفاعل" })),
                  ...result.products.map((p) => ({ title: p.nameAr, formula: p.formula, query: p.smiles, role: "ناتج", smiles: true })),
                  ...result.expectedProducts.map((p) => ({ title: p.nameAr, formula: p.formula, query: p.smiles, role: "ناتج متوقع", smiles: true })),
                ]}
              />
            </div>
          )}
          {result.status !== "success" && result.notes.length > 0 && (
            <div className="glass rounded-3xl p-5 text-sm text-slate-300">
              {result.notes.map((n) => (
                <p key={n}>• {n}</p>
              ))}
            </div>
          )}
          <details className="glass rounded-3xl p-5 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-300">عرض استجابة JSON الموحدة من الخادم</summary>
            <pre className="ltr mt-3 max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-start font-mono text-xs text-emerald-200">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
