"use client";
import { useEffect, useState } from "react";
import type { ReactionResult } from "@/lib/chem/engine";

const COLOR_HINTS: [RegExp, string][] = [
  [/أزرق/, "#3b82f6"],
  [/أخضر/, "#22c55e"],
  [/أصفر/, "#facc15"],
  [/وردي/, "#f472b6"],
  [/بني|محمر/, "#b45309"],
  [/أسود/, "#111827"],
  [/أبيض/, "#f8fafc"],
];
const SOLUTION_COLORS: [RegExp, string][] = [
  [/Cu/, "#2563eb"], // copper(II) solutions are blue
  [/Ni/, "#16a34a"],
  [/Fe3|Fe\(/, "#ca8a04"],
  [/Co/, "#e11d48"],
  [/Cr/, "#7c3aed"],
  [/Mn/, "#db2777"],
  [/Br2/, "#c2410c"],
  [/I2/, "#7c2d12"],
];

function pick(list: [RegExp, string][], text: string, fallback: string) {
  for (const [re, c] of list) if (re.test(text)) return c;
  return fallback;
}

export function ReactionFlask({ result }: { result: ReactionResult | null }) {
  const [run, setRun] = useState(0);
  const [t, setT] = useState(0); // 0..1 animation progress
  useEffect(() => {
    setT(0);
    let raf = 0;
    const start = performance.now();
    const dur = 4200;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result, run]);

  const success = result?.status === "success";
  const prods = success ? result!.products : [];
  const gases = prods.filter((p) => p.state === "g");
  const ppt = prods.find((p) => p.state === "s" && p.note);
  const solidMetal = prods.find((p) => p.state === "s" && !p.note && /^[A-Z][a-z]?$/.test(p.formula));
  const type = result?.reactionType || "";
  const ignition = !!result?.conditions.ignition;
  const fire = success && (type === "combustion" || type === "thermite" || (ignition && !!result!.thermo?.exothermic));
  const explosive = fire && (/H2|O2/.test(result!.equation?.text || "") || type === "thermite");
  const exo = success && !!result!.thermo?.exothermic;
  const endo = success && result!.thermo ? !result!.thermo.exothermic : false;
  const heatMag = success && result!.thermo ? Math.min(1, Math.abs(result!.thermo.deltaH) / 900) : 0;
  const temp = result?.conditions.temperature ?? 25;
  const tempRise = exo ? Math.round(heatMag * 60 * Math.min(1, t * 1.6)) : endo ? -Math.round(heatMag * 15 * Math.min(1, t * 1.6)) : 0;
  const shownTemp = temp + tempRise;
  const pptColor = ppt ? pick(COLOR_HINTS, ppt.note || "", "#e2e8f0") : "#e2e8f0";
  const prodKey = prods.map((p) => p.formula).join(" ");
  const reactKey = result?.reactants.map((r) => r.displayFormula).join(" ") || "";
  const startColor = result ? pick(SOLUTION_COLORS, reactKey, "#0ea5e9") : "#0ea5e9";
  const endColor = !result ? "#0ea5e9" : success ? pick(SOLUTION_COLORS, prodKey.replace(/\b(Cu|Ni|Co)\b(?!\S)/g, ""), prods.some((p) => p.state === "aq") ? "#06b6d4" : "#38bdf8") : "#64748b";
  const mix = Math.min(1, Math.max(0, (t - 0.25) / 0.5));
  const liquid = mix >= 1 ? endColor : mix <= 0 ? startColor : `color-mix(in srgb, ${endColor} ${Math.round(mix * 100)}%, ${startColor})`;
  const pour = t < 0.3;
  const active = t > 0.3;
  const sediment = ppt ? Math.min(14, Math.max(0, (t - 0.45) * 30)) : 0;
  const gasLabel = gases.map((g) => g.formula).join(" + ");
  const isGasOnly = success && prods.every((p) => p.state === "g") && result!.reactants.every((r) => r.state === "g");

  return (
    <div className="relative select-none">
      <div className="relative flex h-72 items-end justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#07122a] to-[#0b1a36]">
        {exo && active && <div className="absolute bottom-4 h-44 w-44 rounded-full bg-orange-500 blur-3xl transition-opacity duration-700" style={{ opacity: 0.12 + heatMag * 0.3 }} />}
        {endo && active && <div className="absolute bottom-4 h-44 w-44 rounded-full bg-sky-300 blur-3xl" style={{ opacity: 0.18 }} />}
        {explosive && t > 0.3 && t < 0.55 && <div className="absolute inset-0 bg-amber-200" style={{ opacity: Math.max(0, 0.9 - (t - 0.3) * 4) }} />}

        <svg viewBox="0 0 260 260" className="relative h-full">
          <defs>
            <clipPath id="flaskClip">
              <path d="M110 30 h40 v60 l50 120 a20 20 0 0 1 -18 28 h-104 a20 20 0 0 1 -18 -28 l50 -120z" />
            </clipPath>
            <linearGradient id="liq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={liquid} stopOpacity="0.55" />
              <stop offset="1" stopColor={liquid} stopOpacity="0.95" />
            </linearGradient>
            <radialGradient id="glassShine" cx="30%" cy="30%">
              <stop offset="0" stopColor="white" stopOpacity="0.25" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <filter id="blur2">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {/* Pouring streams from two beakers */}
          {pour && result && (
            <g>
              <g transform={`translate(${60 - t * 60} ${10 + t * 20}) rotate(-35 40 20)`}>
                <path d="M20 10 h40 v34 a6 6 0 0 1 -6 6 h-28 a6 6 0 0 1 -6 -6z" fill="rgba(56,189,248,0.25)" stroke="#bae6fd" strokeWidth="2" />
                <rect x="24" y="26" width="32" height="20" fill={startColor} opacity="0.8" />
              </g>
              <path d={`M100 44 Q118 60 ${128} ${140}`} stroke={startColor} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.85" />
              <g transform={`translate(${200 + t * 60} ${10 + t * 20}) rotate(35 40 20)`}>
                <path d="M20 10 h40 v34 a6 6 0 0 1 -6 6 h-28 a6 6 0 0 1 -6 -6z" fill="rgba(52,211,153,0.25)" stroke="#a7f3d0" strokeWidth="2" />
                <rect x="24" y="26" width="32" height="20" fill="#34d399" opacity="0.8" />
              </g>
              <path d={`M160 44 Q142 60 ${132} ${140}`} stroke="#34d399" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.85" />
            </g>
          )}

          <g clipPath="url(#flaskClip)">
            {/* liquid with wave */}
            {!isGasOnly && (
              <path fill="url(#liq)">
                <animate
                  attributeName="d"
                  dur="2.6s"
                  repeatCount="indefinite"
                  values="M0 150 Q65 142 130 150 T260 150 V260 H0Z; M0 150 Q65 158 130 150 T260 150 V260 H0Z; M0 150 Q65 142 130 150 T260 150 V260 H0Z"
                />
              </path>
            )}
            {/* gas-phase reaction: colored haze */}
            {isGasOnly && <rect x="0" y="0" width="260" height="260" fill={fire ? "#fb923c" : "#67e8f9"} opacity={active ? 0.12 : 0.05} />}
            {/* bubbles */}
            {active &&
              gases.length > 0 &&
              Array.from({ length: 18 }).map((_, i) => (
                <circle key={i} cx={80 + ((i * 41) % 100)} cy={238} r={1.5 + (i % 4)} fill="white" fillOpacity="0.75" className="bubble" style={{ animationDelay: `${(i * 0.19) % 2.4}s`, animationDuration: `${2 + (i % 3) * 0.4}s` }} />
              ))}
            {/* precipitate falling */}
            {active &&
              ppt &&
              Array.from({ length: 46 }).map((_, i) => (
                <circle key={i} cx={66 + ((i * 29) % 128)} cy={212 + (i % 6) * 4} r={1.5 + (i % 3)} fill={pptColor} className="settle" style={{ animationDelay: `${(i % 12) * 0.14}s` }} />
              ))}
            {/* sediment layer */}
            {ppt && sediment > 0 && <path d={`M40 ${242 - sediment} Q130 ${236 - sediment} 220 ${242 - sediment} V260 H40Z`} fill={pptColor} opacity="0.9" />}
            {/* metal deposit (single displacement) */}
            {active && solidMetal && (
              <g>
                <rect x="124" y="120" width="12" height="100" fill="#94a3b8" rx="2" />
                {Array.from({ length: 14 }).map((_, i) => (
                  <circle key={i} cx={122 + (i % 2) * 16} cy={135 + i * 6} r={2 + (i % 2)} fill={/Cu/.test(solidMetal.formula) ? "#c2410c" : /Ag/.test(solidMetal.formula) ? "#e5e7eb" : "#9ca3af"} opacity={Math.min(1, (t - 0.3) * 3 - i * 0.05)} />
                ))}
              </g>
            )}
            {/* thermal shimmer / frost */}
            {active && exo && heatMag > 0.2 && (
              <g opacity="0.35" filter="url(#blur2)">
                {Array.from({ length: 5 }).map((_, i) => (
                  <path key={i} d={`M${70 + i * 30} 230 q6 -14 0 -28 t0 -28`} stroke="white" strokeWidth="2" fill="none" className="bubble" style={{ animationDelay: `${i * 0.4}s`, animationDuration: "3s" }} />
                ))}
              </g>
            )}
            {active && endo && Array.from({ length: 12 }).map((_, i) => <circle key={i} cx={50 + ((i * 37) % 160)} cy={160 + ((i * 23) % 80)} r={1} fill="white" opacity="0.6" />)}
          </g>

          {/* glass */}
          <path d="M110 30 h40 v60 l50 120 a20 20 0 0 1 -18 28 h-104 a20 20 0 0 1 -18 -28 l50 -120z" fill="url(#glassShine)" stroke="rgba(186,230,253,0.75)" strokeWidth="3" />
          <path d="M104 30 h52" stroke="rgba(186,230,253,0.95)" strokeWidth="4" strokeLinecap="round" />
          <path d="M125 105 l-30 75" stroke="white" strokeOpacity="0.15" strokeWidth="6" strokeLinecap="round" />

          {/* escaping gas puffs */}
          {active &&
            gases.length > 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <circle key={i} cx={122 + i * 6} cy={26} r={5 + i * 2} fill="white" opacity="0.25" className="bubble" style={{ animationDelay: `${i * 0.6}s`, animationDuration: "3s" }} />
            ))}
          {/* steam for exothermic aqueous */}
          {active && exo && !fire && heatMag > 0.15 && Array.from({ length: 3 }).map((_, i) => <ellipse key={i} cx={118 + i * 12} cy={22} rx={6} ry={3} fill="white" opacity="0.2" className="bubble" style={{ animationDelay: `${i * 0.8}s`, animationDuration: "3.5s" }} />)}
          {/* flame / smoke */}
          {fire && active && (
            <g transform="translate(130 28)">
              <path className="flame" d="M0 0 C-16 -16 -8 -34 0 -50 C8 -34 16 -16 0 0Z" fill="#f97316" />
              <path className="flame" d="M0 0 C-8 -9 -4 -20 0 -30 C4 -20 8 -9 0 0Z" fill="#fde047" style={{ animationDelay: "0.2s" }} />
              {Array.from({ length: 4 }).map((_, i) => (
                <circle key={i} cx={-6 + i * 5} cy={-52} r={4 + i} fill="#64748b" opacity="0.35" className="bubble" style={{ animationDelay: `${i * 0.5}s`, animationDuration: "2.8s" }} />
              ))}
            </g>
          )}
          {/* ignition spark before reaction */}
          {ignition && result && t < 0.3 && (
            <g transform="translate(130 120)">
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={i} x1="0" y1="0" x2={Math.cos((i * Math.PI) / 4) * 14} y2={Math.sin((i * Math.PI) / 4) * 14} stroke="#fde68a" strokeWidth="2" opacity={0.9 - t * 2} />
              ))}
            </g>
          )}

          {/* thermometer */}
          <g transform="translate(232 60)">
            <rect x="-6" y="0" width="12" height="150" rx="6" fill="#0f172a" stroke="rgba(255,255,255,0.25)" />
            <circle cx="0" cy="156" r="11" fill={shownTemp > 300 ? "#ef4444" : shownTemp > 60 ? "#f97316" : shownTemp < 0 ? "#60a5fa" : "#22d3ee"} />
            <rect x="-3" y={150 - Math.min(146, Math.max(4, ((shownTemp + 50) / 1100) * 146))} width="6" height={Math.min(146, Math.max(4, ((shownTemp + 50) / 1100) * 146))} rx="3" fill={shownTemp > 300 ? "#ef4444" : shownTemp > 60 ? "#f97316" : shownTemp < 0 ? "#60a5fa" : "#22d3ee"} />
            <text x="0" y="-8" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
              {Math.round(shownTemp)}°C
            </text>
          </g>
        </svg>

        {/* status captions */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-[11px]">
          {result && t < 0.3 && <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-cyan-100">⬇ إضافة المتفاعلات...</span>}
          {active && gases.length > 0 && <span className="ltr rounded-full bg-white/10 px-2 py-0.5 text-white">↑ {gasLabel}</span>}
          {active && ppt && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-100">⬇ {ppt.note}</span>}
          {active && exo && <span className="rounded-full bg-orange-400/20 px-2 py-0.5 text-orange-100">🔥 طارد للحرارة {tempRise > 0 ? `(+${tempRise}°C)` : ""}</span>}
          {active && endo && <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-sky-100">❄️ ماص للحرارة</span>}
          {active && solidMetal && <span className="rounded-full bg-slate-400/20 px-2 py-0.5 text-slate-100">⬇ ترسب {solidMetal.formula} على السطح</span>}
          {result?.status === "no_reaction" && t > 0.3 && <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-slate-200">لا تغيّر ملحوظ 😴</span>}
        </div>
        <button onClick={() => setRun((r) => r + 1)} className="absolute bottom-2 right-2 rounded-lg bg-black/40 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-black/60">
          ↻ إعادة
        </button>
        <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-l from-cyan-400 to-emerald-400 transition-all" style={{ width: `${t * 100}%` }} />
      </div>
    </div>
  );
}
