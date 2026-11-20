"use client";
import { useEffect, useState } from "react";
import type { CompoundData } from "@/lib/chem/sources";
import { Formula } from "./CompoundCard";

const LABELS_AR: Record<string, string> = {
  "Physical Description": "الوصف الفيزيائي",
  "Color/Form": "اللون / الشكل",
  Odor: "الرائحة",
  Taste: "الطعم",
  "Boiling Point": "درجة الغليان",
  "Melting Point": "درجة الانصهار",
  Density: "الكثافة",
  Solubility: "الذوبانية",
  "Vapor Pressure": "ضغط البخار",
  "Vapor Density": "كثافة البخار",
  "Flash Point": "نقطة الوميض",
  "Autoignition Temperature": "حرارة الاشتعال الذاتي",
  Viscosity: "اللزوجة",
  "Surface Tension": "التوتر السطحي",
  "Refractive Index": "معامل الانكسار",
  "Heat of Vaporization": "حرارة التبخر",
  "Heat of Combustion": "حرارة الاحتراق",
  "Odor Threshold": "عتبة الرائحة",
  "Optical Rotation": "الدوران الضوئي",
  "Relative Evaporation Rate": "معدل التبخر النسبي",
  "Critical Temperature & Pressure": "الحرارة والضغط الحرجان",
  pH: "الأس الهيدروجيني pH",
  "Dissociation Constants": "ثوابت التفكك (pKa)",
  LogP: "معامل التوزع LogP",
  "Stability / Shelf Life": "الاستقرار / مدة الصلاحية",
  Decomposition: "التفكك الحراري",
  Corrosivity: "التآكلية",
  "Henry's Law Constant": "ثابت هنري",
  "Ionization Potential": "جهد التأين",
  Polymerization: "البلمرة",
  "Other Experimental Properties": "خواص تجريبية أخرى",
  "Kovats Retention Index": "دليل الاحتباس",
  LogS: "الذوبانية اللوغاريتمية LogS",
  "Explosive Limits and Potential": "حدود الانفجار",
  "Oxidizing Properties": "الخواص المؤكسدة",
  Reactivity: "التفاعلية",
};

function Row({ label, value }: { label: string; value: string }) {
  const ltr = /^[\x00-\x7F°·–—±≈×Å²³⁻⁺µ]+$/.test(value);
  return (
    <div className="flex gap-3 border-b border-white/5 py-2 text-sm last:border-0">
      <span className="w-36 shrink-0 text-xs font-semibold leading-6 text-slate-400">{label}</span>
      <span className={`min-w-0 flex-1 leading-6 text-slate-100 ${ltr ? "ltr text-start" : ""}`}>{value}</span>
    </div>
  );
}

/** Physical + chemical properties for one resolved compound. */
export function PropertiesPanel({ data, compact = false }: { data: CompoundData; compact?: boolean }) {
  const physical = data.experimental.filter((e) => e.kind === "physical");
  const chemical = data.experimental.filter((e) => e.kind === "chemical");
  const el = data.element;
  const physicalComputed: { label: string; value: string }[] = [];
  if (data.molecularWeight) physicalComputed.push({ label: "الكتلة المولية", value: `${data.molecularWeight} g/mol` });
  if (data.exactMass) physicalComputed.push({ label: "الكتلة الدقيقة", value: `${data.exactMass} Da` });
  if (el) {
    if (el.standardState) physicalComputed.push({ label: "الحالة القياسية", value: el.standardState });
    if (el.meltingPoint) physicalComputed.push({ label: "درجة الانصهار", value: `${el.meltingPoint} K (${(parseFloat(el.meltingPoint) - 273.15).toFixed(1)} °C)` });
    if (el.boilingPoint) physicalComputed.push({ label: "درجة الغليان", value: `${el.boilingPoint} K (${(parseFloat(el.boilingPoint) - 273.15).toFixed(1)} °C)` });
    if (el.density) physicalComputed.push({ label: "الكثافة", value: `${el.density} g/cm³` });
    if (el.atomicRadius) physicalComputed.push({ label: "نصف القطر الذري", value: `${el.atomicRadius} pm` });
  }
  if (data.hBondDonors !== null || data.hBondAcceptors !== null) physicalComputed.push({ label: "روابط هيدروجينية", value: `${data.hBondDonors ?? 0} مانح • ${data.hBondAcceptors ?? 0} مستقبل` });
  if (data.rotatableBonds !== null) physicalComputed.push({ label: "روابط قابلة للدوران", value: String(data.rotatableBonds) });
  const chemicalComputed = [...data.chemicalProfile];
  if (el) {
    if (el.electronConfiguration) chemicalComputed.unshift({ label: "التوزيع الإلكتروني", value: el.electronConfiguration });
    if (el.oxidationStates) chemicalComputed.push({ label: "حالات التأكسد", value: el.oxidationStates });
    if (el.electronegativity) chemicalComputed.push({ label: "السالبية الكهربائية", value: el.electronegativity });
    if (el.ionizationEnergy) chemicalComputed.push({ label: "طاقة التأين", value: `${el.ionizationEnergy} eV` });
    if (el.electronAffinity) chemicalComputed.push({ label: "الألفة الإلكترونية", value: `${el.electronAffinity} eV` });
  }
  return (
    <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
      <div className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.04] p-4">
        <h4 className="mb-2 flex items-center gap-2 font-bold text-sky-200">🌡️ الخواص الفيزيائية</h4>
        {physicalComputed.map((p) => (
          <Row key={p.label} label={p.label} value={p.value} />
        ))}
        {physical.map((e) => (
          <Row key={e.label} label={LABELS_AR[e.label] || e.label} value={e.value} />
        ))}
        {!physicalComputed.length && !physical.length && <p className="text-sm text-slate-500">لا تتوفر بيانات.</p>}
      </div>
      <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
        <h4 className="mb-2 flex items-center gap-2 font-bold text-amber-200">⚗️ الخواص الكيميائية</h4>
        {chemicalComputed.map((p, i) => (
          <Row key={p.label + i} label={p.label} value={p.value} />
        ))}
        {chemical.map((e) => (
          <Row key={e.label} label={LABELS_AR[e.label] || e.label} value={e.value} />
        ))}
        {!chemicalComputed.length && !chemical.length && <p className="text-sm text-slate-500">لا تتوفر بيانات.</p>}
      </div>
    </div>
  );
}

/** Lazily resolves a list of substances and shows their properties in an accordion. */
export function SubstancesProperties({ items }: { items: { title: string; formula: string; query: string; role: string; smiles?: boolean }[] }) {
  const [data, setData] = useState<Record<string, CompoundData | null | "loading" | "error">>({});
  const [open, setOpen] = useState<string | null>(items[0]?.query ?? null);

  useEffect(() => {
    let alive = true;
    items.forEach(async (it) => {
      setData((d) => (d[it.query] ? d : { ...d, [it.query]: "loading" }));
      try {
        const r = await fetch(`/api/chem/compound?${it.smiles ? "smiles" : "q"}=${encodeURIComponent(it.query)}`);
        const j = r.ok ? ((await r.json()) as CompoundData) : null;
        if (alive) setData((d) => ({ ...d, [it.query]: j ?? "error" }));
      } catch {
        if (alive) setData((d) => ({ ...d, [it.query]: "error" }));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.query).join("|")]);

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const d = data[it.query];
        const isOpen = open === it.query;
        return (
          <div key={it.query + it.role} className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
            <button onClick={() => setOpen(isOpen ? null : it.query)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${it.role === "ناتج" ? "bg-emerald-400/15 text-emerald-300" : "bg-cyan-400/15 text-cyan-300"}`}>{it.role}</span>
                <span className="font-bold text-white">{it.title}</span>
                <Formula f={it.formula} className="text-sm text-cyan-200" />
                {d && d !== "loading" && d !== "error" && d.name && <span className="ltr hidden text-xs capitalize text-slate-400 sm:inline">{d.name}</span>}
              </div>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                {d === "loading" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />}
                {d === "error" && <span className="text-rose-300">غير متوفر</span>}
                <span className={`transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </span>
            </button>
            {isOpen && (
              <div className="fade-up border-t border-white/5 p-4">
                {d && d !== "loading" && d !== "error" ? <PropertiesPanel data={d} /> : d === "error" ? <p className="text-sm text-slate-500">تعذر جلب خواص هذه المادة من قواعد البيانات.</p> : <p className="text-sm text-slate-400">جارِ جلب الخواص من PubChem...</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
