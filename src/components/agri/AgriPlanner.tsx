"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { AnalysisMeta, BBox, PlanResult } from "@/lib/agri/analyze";
import { LAND_CLASSES, TREES, treeById } from "@/lib/agri/trees";

const AgriMap = dynamic(() => import("./AgriMap").then((m) => m.AgriMap), {
  ssr: false,
  loading: () => <div className="flex h-[72vh] min-h-[520px] items-center justify-center rounded-3xl border border-emerald-400/20 bg-slate-900 text-emerald-200">جارِ تحميل الخريطة...</div>,
});

type Step = "draw" | "analyzing" | "analyzed" | "choose" | "planting" | "done";
type Analysis = { id: number; grid: string; meta: AnalysisMeta };
type Plan = Omit<PlanResult, "positions"> & { positions: number[] };

const ANALYZE_MSGS = [
  "🛰️ جلب صور الأقمار الصناعية عالية الدقة...",
  "🧠 تصنيف الغطاء الأرضي بكسل بكسل (نباتات، تربة، أسطح)...",
  "🗺️ دمج بيانات OpenStreetMap: المباني والشوارع والمياه...",
  "🌡️ جلب بيانات المناخ السنوية للموقع...",
  "💨 قياس جودة الهواء (PM2.5, NO₂, O₃)...",
  "📐 حساب المساحات القابلة للزراعة...",
];

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const fmtArea = (m2: number) => (m2 >= 1e6 ? `${fmt(m2 / 1e6, 2)} km²` : m2 >= 1e4 ? `${fmt(m2 / 1e4, 2)} هكتار` : `${fmt(m2)} m²`);

function StepDots({ step }: { step: Step }) {
  const order = ["draw", "analyzed", "choose", "done"];
  const labels = ["تحديد المنطقة", "التحليل", "نوع الشجرة", "النتائج"];
  const cur = step === "analyzing" ? 1 : step === "planting" ? 3 : order.indexOf(step);
  return (
    <div className="mb-5 flex items-center gap-1">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 flex-col items-center gap-1">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${i < cur ? "bg-emerald-400 text-slate-900" : i === cur ? "bg-cyan-400 text-slate-900 ring-4 ring-cyan-400/25" : "bg-white/10 text-slate-400"}`}>{i < cur ? "✓" : i + 1}</div>
          <span className={`text-[10px] ${i === cur ? "text-cyan-200" : "text-slate-500"}`}>{l}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ icon, label, value, unit, sub, tone = "emerald" }: { icon: string; label: string; value: string; unit?: string; sub?: string; tone?: "emerald" | "cyan" | "orange" | "violet" | "sky" | "rose" }) {
  const tones: Record<string, string> = { emerald: "text-emerald-300", cyan: "text-cyan-300", orange: "text-orange-300", violet: "text-violet-300", sky: "text-sky-300", rose: "text-rose-300" };
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="text-xl">{icon}</span>
        {label}
      </div>
      <div className={`ltr mt-2 text-start font-mono text-3xl font-black ${tones[tone]}`}>
        {value}
        {unit && <span className="text-base font-bold"> {unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function ProjectionChart({ plan }: { plan: Plan }) {
  const W = 640, H = 220, P = 36;
  const data = plan.projection;
  const maxC = Math.max(0.01, ...data.map((d) => d.cooling));
  const maxCo2 = Math.max(1, ...data.map((d) => d.co2));
  const x = (i: number) => P + (i / (data.length - 1)) * (W - P * 2);
  const yC = (v: number) => H - P - (v / maxC) * (H - P * 2);
  const yG = (v: number) => H - P - (v / maxCo2) * (H - P * 2);
  const line = (f: (d: (typeof data)[number]) => number) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${f(d).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ltr w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={P} x2={W - P} y1={P + t * (H - P * 2)} y2={P + t * (H - P * 2)} stroke="rgba(148,163,184,0.12)" />
      ))}
      <path d={`${line((d) => yG(d.co2))} L${x(data.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill="rgba(52,211,153,0.12)" />
      <path d={line((d) => yG(d.co2))} fill="none" stroke="#34d399" strokeWidth="2.5" />
      <path d={line((d) => yC(d.cooling))} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4" />
      {[1, 5, 10, 15, 20, 25, 30].map((yr) => (
        <text key={yr} x={x(yr - 1)} y={H - 12} fill="#64748b" fontSize="11" textAnchor="middle">
          {yr}
        </text>
      ))}
      <text x={W - P} y={20} fill="#34d399" fontSize="11" textAnchor="end">CO₂ kg/yr (max {fmt(maxCo2)})</text>
      <text x={P} y={20} fill="#38bdf8" fontSize="11">ΔT °C (max {maxC})</text>
      <line x1={x(plan.maturity - 1)} x2={x(plan.maturity - 1)} y1={P} y2={H - P} stroke="#facc15" strokeDasharray="3 3" />
      <text x={x(plan.maturity - 1) + 4} y={P + 12} fill="#facc15" fontSize="10">النضج</text>
    </svg>
  );
}

export function AgriPlanner() {
  const [step, setStep] = useState<Step>("draw");
  const [bbox, setBBox] = useState<BBox | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [overlayOn, setOverlayOn] = useState(true);
  const [species, setSpecies] = useState<string>("");
  const [density, setDensity] = useState<"dense" | "normal" | "sparse">("normal");
  const [tolerance, setTolerance] = useState(15);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (step !== "analyzing") return;
    setMsgIdx(0);
    const t = setInterval(() => setMsgIdx((i) => Math.min(i + 1, ANALYZE_MSGS.length - 1)), 2600);
    return () => clearInterval(t);
  }, [step]);

  const dims = useMemo(() => {
    if (!bbox) return null;
    const latC = (bbox.south + bbox.north) / 2;
    const w = (bbox.east - bbox.west) * 111320 * Math.cos((latC * Math.PI) / 180);
    const h = (bbox.north - bbox.south) * 111320;
    return { w, h, a: w * h };
  }, [bbox]);
  const tooBig = !!dims && dims.a > 2_000_000;
  const tooSmall = !!dims && dims.a < 300;

  async function analyze() {
    if (!bbox) return;
    setError("");
    setPlan(null);
    setStep("analyzing");
    try {
      const r = await fetch("/api/agri/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bbox }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "فشل التحليل");
      setAnalysis(j);
      setOverlayOn(true);
      setSpecies(j.meta.recommendations[0]?.id || "neem");
      setStep("analyzed");
    } catch (e) {
      setError((e as Error).message);
      setStep("draw");
    }
  }

  async function plant() {
    if (!analysis || !species) return;
    setError("");
    setStep("planting");
    try {
      const r = await fetch("/api/agri/plant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId: analysis.id, speciesId: species, density, tolerance: tolerance / 100 }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "فشل التوزيع");
      setPlan(j);
      setOverlayOn(false);
      setStep("done");
      setTimeout(() => document.getElementById("agri-results")?.scrollIntoView({ behavior: "smooth" }), 1600);
    } catch (e) {
      setError((e as Error).message);
      setStep("choose");
    }
  }

  function reset() {
    setBBox(null);
    setAnalysis(null);
    setPlan(null);
    setStep("draw");
    setError("");
  }

  const sp = treeById(species);
  const meta = analysis?.meta;
  const overlay = analysis ? { grid: analysis.grid, width: analysis.meta.width, height: analysis.meta.height, bbox: analysis.meta.bbox, visible: overlayOn } : null;
  const treeLayer = plan && sp ? { positions: plan.positions, radius: plan.canopyRadius, color: sp.color, key: `${analysis?.id}-${species}-${density}` } : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <AgriMap bbox={bbox} onBBox={(b) => { setBBox(b); if (b) { setAnalysis(null); setPlan(null); setStep("draw"); } }} overlay={overlay} trees={treeLayer} locked={step === "analyzing" || step === "planting"} />

        {/* Side panel */}
        <div className="glass flex max-h-[72vh] min-h-[520px] flex-col rounded-3xl p-5">
          <StepDots step={step} />
          <div className="-mx-1 flex-1 overflow-y-auto px-1">
            {error && <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

            {step === "draw" && (
              <div className="fade-up space-y-4">
                <h3 className="text-lg font-bold text-white">1. حدد المنطقة</h3>
                <ol className="space-y-3 text-sm leading-7 text-slate-300">
                  <li>🔍 ابحث عن أي مكان في العالم أو حرّك الخريطة.</li>
                  <li>
                    ✏️ اضغط على <b className="text-cyan-300">رمز القلم</b> ثم اسحب على الخريطة لرسم مربع أو مستطيل.
                  </li>
                  <li>🧠 اضغط «تحليل المنطقة» ليميز الذكاء الاصطناعي التربة والشوارع والبيوت.</li>
                </ol>
                {dims ? (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                    <div className="text-xs text-slate-400">المنطقة المحددة</div>
                    <div className="ltr mt-1 text-start font-mono text-lg font-bold text-white">
                      {fmt(dims.w)} × {fmt(dims.h)} m
                    </div>
                    <div className="text-sm text-cyan-200">{fmtArea(dims.a)}</div>
                    {tooBig && <div className="mt-2 text-xs text-rose-300">المنطقة كبيرة جداً — الحد الأقصى 2 كم² للحفاظ على دقة التحليل.</div>}
                    {tooSmall && <div className="mt-2 text-xs text-rose-300">المنطقة صغيرة جداً.</div>}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-500">لم يتم تحديد منطقة بعد</div>
                )}
                <button
                  onClick={analyze}
                  disabled={!bbox || tooBig || tooSmall}
                  className="w-full rounded-2xl bg-gradient-to-l from-cyan-400 to-emerald-400 py-3.5 font-extrabold text-slate-900 shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🧠 تحليل المنطقة
                </button>
              </div>
            )}

            {step === "analyzing" && (
              <div className="fade-up space-y-3 py-4">
                <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
                {ANALYZE_MSGS.map((m, i) => (
                  <div key={m} className={`flex items-center gap-2 text-sm transition ${i < msgIdx ? "text-emerald-300" : i === msgIdx ? "text-white" : "text-slate-600"}`}>
                    <span>{i < msgIdx ? "✓" : i === msgIdx ? "◌" : "·"}</span>
                    {m}
                  </div>
                ))}
                <p className="pt-2 text-xs text-slate-500">قد يستغرق التحليل 10–40 ثانية حسب حجم المنطقة وتوفر بيانات OpenStreetMap.</p>
              </div>
            )}

            {(step === "analyzed" || step === "choose" || step === "planting" || step === "done") && meta && step === "analyzed" && (
              <div className="fade-up space-y-4">
                <h3 className="text-lg font-bold text-white">2. نتيجة تحليل الغطاء الأرضي</h3>
                {meta.place && <p className="text-xs leading-6 text-slate-400">📍 {meta.place}</p>}
                <div className="space-y-2">
                  {meta.classes
                    .filter((c) => c.pct > 0.2)
                    .sort((a, b) => b.pct - a.pct)
                    .map((c) => (
                      <div key={c.id}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="flex items-center gap-2 text-slate-300">
                            <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
                            {c.ar}
                            {LAND_CLASSES[c.id].plantable && <span className="text-emerald-400">• قابلة للزراعة</span>}
                          </span>
                          <span className="ltr font-mono text-slate-400">{c.pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                        </div>
                      </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-emerald-400/10 p-3"><div className="text-slate-400">قابلة للزراعة</div><div className="font-bold text-emerald-300">{fmtArea(meta.plantableArea)}</div></div>
                  <div className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">الغطاء الشجري الحالي</div><div className="ltr text-start font-bold text-white">{meta.existingCanopyPct}%</div></div>
                  <div className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">مبانٍ (OSM + مستنتجة)</div><div className="font-bold text-white">{fmt(meta.osm.buildings)} + {fmt(meta.osm.inferredBuildings)}</div></div>
                  <div className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">طول الشوارع</div><div className="ltr text-start font-bold text-white">{meta.osm.roadsKm} km</div></div>
                  {meta.climate && (
                    <>
                      <div className="rounded-xl bg-orange-400/10 p-3"><div className="text-slate-400">متوسط الحرارة السنوي</div><div className="ltr text-start font-bold text-orange-300">{meta.climate.meanTemp}°C</div></div>
                      <div className="rounded-xl bg-sky-400/10 p-3"><div className="text-slate-400">الأمطار السنوية</div><div className="ltr text-start font-bold text-sky-300">{meta.climate.rain} mm</div></div>
                    </>
                  )}
                  {meta.air && (
                    <div className="col-span-2 rounded-xl bg-violet-400/10 p-3"><div className="text-slate-400">جودة الهواء (متوسط 30 يوم)</div><div className="ltr text-start font-mono font-bold text-violet-200">PM2.5 {meta.air.pm2_5} • PM10 {meta.air.pm10} • NO₂ {meta.air.no2} µg/m³</div></div>
                  )}
                </div>
                {!meta.osm.ok && <p className="rounded-xl bg-amber-400/10 p-2 text-xs text-amber-200">تعذر الوصول لـ OpenStreetMap — التصنيف اعتمد على صور الأقمار الصناعية فقط.</p>}
                <label className="flex cursor-pointer items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                  إظهار طبقة التصنيف على الخريطة
                  <input type="checkbox" checked={overlayOn} onChange={(e) => setOverlayOn(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
                </label>
                <button onClick={() => setStep("choose")} disabled={meta.plantableArea < 10} className="w-full rounded-2xl bg-gradient-to-l from-emerald-400 to-lime-300 py-3.5 font-extrabold text-slate-900 disabled:opacity-40">
                  🌳 اختيار نوع الشجرة
                </button>
                {meta.plantableArea < 10 && <p className="text-center text-xs text-rose-300">لا توجد مساحة قابلة للزراعة في هذه المنطقة.</p>}
              </div>
            )}

            {(step === "choose" || step === "planting") && meta && (
              <div className="fade-up space-y-4">
                <h3 className="text-lg font-bold text-white">3. اختر نوع الشجرة</h3>
                <p className="text-xs text-slate-400">مرتبة حسب ملاءمتها لمناخ المنطقة ({meta.climate ? `${meta.climate.meanTemp}°C، ${meta.climate.rain} mm/سنة` : "مناخ غير معروف"}).</p>
                <div className="space-y-2">
                  {meta.recommendations.map((r) => {
                    const t = TREES.find((x) => x.id === r.id)!;
                    const active = species === t.id;
                    return (
                      <button key={t.id} onClick={() => setSpecies(t.id)} className={`w-full rounded-2xl border p-3 text-start transition ${active ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{t.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-white">{t.nameAr}</span>
                              <span className={`ltr rounded-full px-2 py-0.5 text-[11px] font-bold ${r.score >= 75 ? "bg-emerald-400/20 text-emerald-300" : r.score >= 50 ? "bg-amber-400/20 text-amber-300" : "bg-rose-400/20 text-rose-300"}`}>{r.score}%</span>
                            </div>
                            <div className="ltr truncate text-start text-[11px] italic text-slate-500">{t.scientific}</div>
                          </div>
                        </div>
                        {active && (
                          <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                            <p>{t.benefitsAr}</p>
                            <p className="text-slate-400">التاج {t.canopy}م • الارتفاع {t.height}م • التباعد {t.spacing}م • {t.co2} كغ CO₂/سنة • النضج {t.maturity} سنة</p>
                            <p className="text-cyan-300/80">{r.reasons.join(" • ")}</p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <div className="mb-2 text-sm text-slate-300">كثافة الزراعة</div>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1 text-xs">
                    {(
                      [
                        ["dense", "كثيفة"],
                        ["normal", "قياسية"],
                        ["sparse", "متباعدة"],
                      ] as const
                    ).map(([k, l]) => (
                      <button key={k} onClick={() => setDensity(k)} className={`rounded-lg py-2 font-bold ${density === k ? "bg-emerald-400 text-slate-900" : "text-slate-300"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                    <span>سماحية التباعد بين الأشجار</span>
                    <span className="ltr font-mono text-cyan-300">±{tolerance}%</span>
                  </div>
                  <input type="range" min={5} max={30} step={1} value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value, 10))} className="w-full" />
                  {sp && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      التباعد المستهدف {(sp.spacing * (density === "dense" ? 1.0 : density === "sparse" ? 1.8 : 1.35)).toFixed(1)} م — لن تقل المسافة بين أي شجرتين عن {(sp.spacing * (density === "dense" ? 1.0 : density === "sparse" ? 1.8 : 1.35) * (1 - tolerance / 100)).toFixed(1)} م، وتبقى على بُعد {Math.max(4, sp.canopy * 0.525).toFixed(1)} م من المباني ولا تُزرع فوق المباني أو الشوارع إطلاقاً.
                    </p>
                  )}
                </div>
                <button onClick={plant} disabled={!species || step === "planting"} className="sticky bottom-0 w-full rounded-2xl bg-gradient-to-l from-emerald-400 to-lime-300 py-3.5 text-lg font-extrabold text-slate-900 shadow-xl disabled:opacity-60">
                  {step === "planting" ? "🌱 جارِ التخطيط..." : "✓ تم"}
                </button>
              </div>
            )}

            {step === "done" && plan && sp && meta && (
              <div className="fade-up space-y-4">
                <h3 className="text-lg font-bold text-white">4. خطة التشجير جاهزة</h3>
                <div className="rounded-2xl bg-emerald-400/10 p-4 text-center">
                  <div className="text-4xl">{sp.emoji}</div>
                  <div className="ltr mt-1 font-mono text-4xl font-black text-emerald-300">{fmt(plan.trees)}</div>
                  <div className="text-sm text-slate-300">شجرة {sp.nameAr}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">خفض التلوث</div><div className="ltr text-start text-lg font-bold text-violet-300">−{plan.overallPollutionReduction}%</div></div>
                  <div className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">خفض الحرارة السنوي</div><div className="ltr text-start text-lg font-bold text-sky-300">−{plan.annualCooling}°C</div></div>
                  <div className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">الغطاء الشجري</div><div className="ltr text-start text-lg font-bold text-emerald-300">{plan.canopyBefore}% → {plan.canopyAfter}%</div></div>
                  <div className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">CO₂ سنوياً</div><div className="ltr text-start text-lg font-bold text-emerald-300">{plan.co2Tons} t</div></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep("choose")} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-bold text-white hover:bg-white/5">تغيير الشجرة</button>
                  <button onClick={reset} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-bold text-white hover:bg-white/5">منطقة جديدة</button>
                </div>
                <label className="flex cursor-pointer items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                  إظهار طبقة التصنيف
                  <input type="checkbox" checked={overlayOn} onChange={(e) => setOverlayOn(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      {analysis && overlayOn && (
        <div className="flex flex-wrap gap-3 text-xs">
          {LAND_CLASSES.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-slate-300">
              <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
              {c.ar}
            </span>
          ))}
        </div>
      )}

      {/* Results dashboard */}
      {step === "done" && plan && sp && meta && (
        <section id="agri-results" className="fade-up scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white">📊 إحصائيات خطة التشجير</h2>
              <p className="text-sm text-slate-400">
                {sp.nameAr} • تباعد {plan.spacing}م (الحد الأدنى {plan.minSpacing}م، سماحية ±{Math.round(plan.tolerance * 100)}%) • مسافة أمان {plan.clearance}م من المباني و{plan.roadClearance}م من الشوارع • مساحة المنطقة {fmtArea(meta.areaM2)}
                {plan.roadsideTrees > 0 && <> • {fmt(plan.roadsideTrees)} شجرة متفرقة على جانبي الطرق الترابية (تباعد {plan.roadsideSpacing}م)</>}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon="🌳" label="عدد الأشجار المطلوبة" value={fmt(plan.trees)} sub={`على مساحة قابلة للزراعة ${fmtArea(meta.plantableArea)}`} />
            <Kpi icon="💨" label="خفض نسبة التلوث المحلي" value={`−${plan.overallPollutionReduction}`} unit="%" tone="violet" sub={`PM2.5 −${plan.reduction.pm2_5}% • NO₂ −${plan.reduction.no2}%`} />
            <Kpi icon="🌡️" label="خفض متوسط الحرارة السنوي" value={`−${plan.annualCooling}`} unit="°C" tone="sky" sub={`ذروة الصيف −${plan.summerCooling}°C • حرارة الأسطح −${plan.surfaceCooling}°C`} />
            <Kpi icon="🍃" label="الغطاء الشجري" value={`${plan.canopyAfter}`} unit="%" tone="cyan" sub={`كان ${plan.canopyBefore}% • +${fmtArea(plan.addedCanopy)} ظل`} />
            <Kpi icon="🏭" label="امتصاص CO₂ سنوياً" value={`${plan.co2Tons}`} unit="طن" sub={`${fmt(plan.co2Cum20)} طن خلال 20 سنة • يعادل ${plan.carsOffset} سيارة`} />
            <Kpi icon="🫁" label="إنتاج الأكسجين سنوياً" value={`${plan.o2Tons}`} unit="طن" tone="cyan" sub={`يكفي حوالي ${fmt(plan.peopleOxygen)} شخص`} />
            <Kpi icon="🧪" label="ملوثات تُزال سنوياً" value={`${plan.totalRemovalKg}`} unit="kg" tone="orange" sub="O₃ + PM10 + NO₂ + SO₂ + CO" />
            <Kpi icon="💧" label="احتياج الري السنوي" value={fmt(plan.irrigationM3)} unit="m³" tone="sky" sub={`اعتراض مياه الأمطار ${fmt(plan.stormwaterM3)} m³/سنة`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass rounded-3xl p-6">
              <h3 className="mb-4 font-bold text-white">جودة الهواء قبل وبعد التشجير (عند النضج)</h3>
              {plan.air && plan.airAfter ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <th className="p-2 text-start">الملوث</th>
                      <th className="p-2">الحالي µg/m³</th>
                      <th className="p-2">بعد التشجير</th>
                      <th className="p-2">الانخفاض</th>
                      <th className="p-2">يُزال kg/سنة</th>
                    </tr>
                  </thead>
                  <tbody className="ltr-nums">
                    {(
                      [
                        ["PM2.5", "pm2_5"],
                        ["PM10", "pm10"],
                        ["NO₂", "no2"],
                        ["O₃", "o3"],
                      ] as const
                    ).map(([label, k]) => (
                      <tr key={k} className="border-t border-white/5 text-center">
                        <td className="ltr p-2 text-start font-bold text-white">{label}</td>
                        <td className="p-2 font-mono text-slate-300">{plan.air![k]}</td>
                        <td className="p-2 font-mono text-emerald-300">{plan.airAfter![k]}</td>
                        <td className="p-2 font-mono text-violet-300">−{plan.reduction[k]}%</td>
                        <td className="p-2 font-mono text-slate-300">{plan.removalKg[k]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">بيانات جودة الهواء غير متوفرة لهذا الموقع.</p>
              )}
            </div>
            <div className="glass rounded-3xl p-6">
              <h3 className="mb-2 font-bold text-white">التطور السنوي للفوائد (30 سنة)</h3>
              <p className="mb-3 text-xs text-slate-400">تنمو الفوائد تدريجياً مع نمو التاج حتى النضج بعد {plan.maturity} سنة.</p>
              <ProjectionChart plan={plan} />
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                {[1, 5, 10, 20].map((y) => {
                  const p = plan.projection[y - 1];
                  return (
                    <div key={y} className="rounded-xl bg-white/5 p-2">
                      <div className="text-slate-400">السنة {y}</div>
                      <div className="ltr font-mono font-bold text-sky-300">−{p.cooling}°C</div>
                      <div className="ltr font-mono text-emerald-300">{fmt(p.co2)} kg</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <details className="glass rounded-3xl p-5 text-sm text-slate-400">
            <summary className="cursor-pointer font-semibold text-slate-300">منهجية التحليل والحساب</summary>
            <ul className="mt-3 list-disc space-y-2 pr-5 leading-7">
              <li>تصنيف الغطاء الأرضي: صور Esri World Imagery بدقة ~{meta.zoom >= 18 ? "0.5" : "1"} م/بكسل، تُصنَّف كل خلية ({meta.cellSize} م) بمؤشر الخضرة ExG والتشبع والسطوع والملمس، ثم تُدمج مع بيانات OpenStreetMap (المباني، الشوارع بعرضها التقديري، المياه، المواقف، الملاعب).</li>
              <li>توزيع الأشجار: شبكة سداسية بتباعد يناسب قطر التاج، مع تحويل المسافة (Distance Transform) لضمان مسافة أمان من المباني والطرق وعدم الزراعة فوق الأشجار القائمة.</li>
              <li>خفض الملوثات: معدلات إزالة نموذج i-Tree (USDA) لكل م² من التاج، معدّلة بكفاءة النوع. نسبة الانخفاض المحلي تقديرية حسب زيادة الغطاء الشجري.</li>
              <li>خفض الحرارة: كل زيادة 10% في الغطاء الشجري تخفض حرارة الهواء ~0.4–0.6°C (أكثر في المناخات الحارة)، وحرارة الأسطح المظللة أكثر بكثير.</li>
              <li>المناخ من Open-Meteo (أرشيف {meta.climate?.year ?? "—"})، وجودة الهواء من Open-Meteo Air Quality (CAMS).</li>
              <li>جميع الأرقام تقديرات تخطيطية وليست بديلاً عن دراسة ميدانية.</li>
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}
