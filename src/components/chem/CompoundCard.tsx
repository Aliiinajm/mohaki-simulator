"use client";
import { useState } from "react";
import type { CompoundData } from "@/lib/chem/sources";
import { MoleculeView } from "./MoleculeView";
import { Molecule3D } from "./Molecule3D";
import { PropertiesPanel } from "./PropertiesPanel";

export function Formula({ f, className = "" }: { f: string | null | undefined; className?: string }) {
  if (!f) return <span>—</span>;
  const parts = f.split(/(\d+)/);
  return (
    <span className={`ltr font-mono ${className}`}>
      {parts.map((p, i) => (/^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>))}
    </span>
  );
}

function CopyRow({ label, value }: { label: string; value: string | null }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 border-b border-white/5 py-2.5 last:border-0">
      <span className="w-24 shrink-0 text-xs font-semibold text-slate-400">{label}</span>
      <code className="ltr min-w-0 flex-1 break-all text-start font-mono text-xs text-cyan-100">{value}</code>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }}
        className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
      >
        {done ? "✓ نُسخ" : "نسخ"}
      </button>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="ltr mt-1 text-start font-mono text-base font-semibold text-white">
        {value === null || value === undefined || value === "" ? "—" : value}
        {unit && value !== null && value !== undefined && value !== "" ? <span className="text-xs text-slate-400"> {unit}</span> : null}
      </div>
    </div>
  );
}

export function CompoundCard({ data }: { data: CompoundData }) {
  const el = data.element;
  return (
    <div className="fade-up space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ltr text-3xl font-extrabold capitalize text-white">{data.name}</h2>
              {data.cached && <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">من الذاكرة المؤقتة ⚡</span>}
            </div>
            {data.iupacName && <div className="ltr mt-1 text-start text-sm text-slate-400">IUPAC: {data.iupacName}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-xl bg-cyan-400/10 px-3 py-1.5 text-xl font-bold text-cyan-200">
                <Formula f={data.formula} />
              </span>
              {data.molecularWeight && (
                <span className="ltr rounded-xl bg-emerald-400/10 px-3 py-1.5 font-mono text-emerald-200">{data.molecularWeight} g/mol</span>
              )}
              {data.cid && <span className="ltr rounded-xl bg-white/5 px-3 py-1.5 font-mono text-sm text-slate-300">CID {data.cid}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((s) => (
              <span
                key={s.name}
                title={s.note}
                className={`ltr rounded-full px-3 py-1 text-[11px] font-semibold ${
                  s.status === "ok" ? "bg-emerald-400/15 text-emerald-300" : s.status === "error" ? "bg-rose-400/15 text-rose-300" : s.status === "miss" ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-slate-400"
                }`}
              >
                {s.status === "ok" ? "●" : "○"} {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Structures */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl p-5">
          <h3 className="mb-3 font-bold text-cyan-100">الصيغة البنائية ثنائية الأبعاد</h3>
          <MoleculeView smiles={data.isomericSmiles || data.smiles} height={340} />
        </div>
        <div className="glass rounded-3xl p-5">
          <h3 className="mb-3 font-bold text-cyan-100">النموذج الذري ثلاثي الأبعاد</h3>
          <Molecule3D cid={data.cid} smiles={data.isomericSmiles || data.smiles} height={340} />
        </div>
      </div>

      {/* Element info */}
      {el && (
        <div className="glass rounded-3xl p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl border-2 text-slate-900" style={{ background: `#${el.color || "94a3b8"}`, borderColor: "rgba(255,255,255,0.4)" }}>
              <span className="text-xs font-bold">{el.atomicNumber}</span>
              <span className="text-3xl font-black">{el.symbol}</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">بيانات العنصر من الجدول الدوري</h3>
              <p className="ltr text-start text-sm text-slate-400">{el.name} • {el.groupBlock}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="العدد الذري" value={el.atomicNumber} />
            <Stat label="الكتلة الذرية" value={el.atomicWeight} unit="u" />
            <Stat label="التوزيع الإلكتروني" value={el.electronConfiguration} />
            <Stat label="السالبية الكهربائية" value={el.electronegativity} />
            <Stat label="نصف القطر الذري" value={el.atomicRadius} unit="pm" />
            <Stat label="طاقة التأين" value={el.ionizationEnergy} unit="eV" />
            <Stat label="الألفة الإلكترونية" value={el.electronAffinity} unit="eV" />
            <Stat label="حالات التأكسد" value={el.oxidationStates} />
            <Stat label="الحالة القياسية" value={el.standardState} />
            <Stat label="درجة الانصهار" value={el.meltingPoint} unit="K" />
            <Stat label="درجة الغليان" value={el.boilingPoint} unit="K" />
            <Stat label="الكثافة" value={el.density} unit="g/cm³" />
            <Stat label="سنة الاكتشاف" value={el.yearDiscovered} />
          </div>
        </div>
      )}

      {/* Properties */}
      <div className="glass rounded-3xl p-6">
        <h3 className="mb-4 font-bold text-cyan-100">الخصائص المحسوبة (PubChem)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="الكتلة المولية" value={data.molecularWeight} unit="g/mol" />
          <Stat label="الكتلة الدقيقة" value={data.exactMass} unit="Da" />
          <Stat label="XLogP (المحبة للدهون)" value={data.xlogp} />
          <Stat label="TPSA" value={data.tpsa} unit="Å²" />
          <Stat label="الشحنة" value={data.charge} />
          <Stat label="مانحات رابطة H" value={data.hBondDonors} />
          <Stat label="مستقبلات رابطة H" value={data.hBondAcceptors} />
          <Stat label="روابط قابلة للدوران" value={data.rotatableBonds} />
          <Stat label="الذرات الثقيلة" value={data.heavyAtoms} />
          <Stat label="التعقيد" value={data.complexity} />
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="mb-4 font-bold text-cyan-100">الخواص الفيزيائية والكيميائية</h3>
        <PropertiesPanel data={data} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h3 className="mb-3 font-bold text-cyan-100">المعرّفات الكيميائية</h3>
          <CopyRow label="SMILES" value={data.smiles} />
          <CopyRow label="Isomeric" value={data.isomericSmiles !== data.smiles ? data.isomericSmiles : null} />
          <CopyRow label="InChIKey" value={data.inchiKey} />
          <CopyRow label="InChI" value={data.inchi} />
          <CopyRow label="ChemSpider" value={data.chemspiderId ? String(data.chemspiderId) : null} />
        </div>
        <div className="glass rounded-3xl p-6">
          <h3 className="mb-3 font-bold text-cyan-100">الوصف</h3>
          {data.description ? (
            <>
              <p className="ltr text-start text-sm leading-7 text-slate-300">{data.description}</p>
              <p className="mt-2 text-xs text-slate-500">المصدر: {data.descriptionSource}</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">لا يتوفر وصف.</p>
          )}
          {data.synonyms.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 text-sm font-bold text-slate-300">أسماء مرادفة</h4>
              <div className="flex flex-wrap gap-2">
                {data.synonyms.map((s) => (
                  <span key={s} className="ltr rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">{s}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="mb-3 font-bold text-cyan-100">قواعد البيانات المرتبطة</h3>
        <div className="flex flex-wrap gap-2">
          {data.links.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="ltr rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15">
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
