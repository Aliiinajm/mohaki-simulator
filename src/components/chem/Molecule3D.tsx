"use client";
import { useEffect, useRef, useState } from "react";
import { smilesTo3DMolfile } from "./ocl";

type Style = "ballstick" | "stick" | "sphere" | "line";
type Atom = { x: number; y: number; z: number; el: string };
type Bond = { a: number; b: number; o: number };

const CPK: Record<string, string> = {
  H: "#f1f5f9", C: "#475569", N: "#3b82f6", O: "#ef4444", F: "#4ade80", Cl: "#22c55e", Br: "#b45309", I: "#7e22ce", S: "#eab308", P: "#f97316",
  Na: "#a78bfa", K: "#8b5cf6", Ca: "#94a3b8", Mg: "#4ade80", Fe: "#ea580c", Cu: "#c2410c", Zn: "#71717a", Al: "#cbd5e1", Si: "#f59e0b", B: "#fb923c",
  Ag: "#d4d4d8", Au: "#facc15", Pb: "#52525b", Ba: "#10b981", Li: "#c084fc", Ni: "#22c55e", Cr: "#60a5fa", Mn: "#a855f7", Hg: "#9ca3af", Sn: "#64748b",
};
const RADIUS: Record<string, number> = { H: 0.32, C: 0.55, N: 0.52, O: 0.5, F: 0.48, Cl: 0.7, Br: 0.8, I: 0.95, S: 0.72, P: 0.75 };

/** Parse an MDL molfile / SDF (V2000) into atoms & bonds. */
function parseMol(text: string): { atoms: Atom[]; bonds: Bond[] } | null {
  const lines = text.split(/\r?\n/);
  if (lines.length < 4) return null;
  const counts = lines[3];
  const na = parseInt(counts.slice(0, 3), 10), nb = parseInt(counts.slice(3, 6), 10);
  if (!Number.isFinite(na) || na <= 0) return null;
  const atoms: Atom[] = [];
  for (let i = 0; i < na; i++) {
    const l = lines[4 + i] || "";
    const x = parseFloat(l.slice(0, 10)), y = parseFloat(l.slice(10, 20)), z = parseFloat(l.slice(20, 30));
    const el = l.slice(31, 34).trim();
    if (!Number.isFinite(x)) return null;
    atoms.push({ x, y, z, el });
  }
  const bonds: Bond[] = [];
  for (let i = 0; i < nb; i++) {
    const l = lines[4 + na + i] || "";
    const a = parseInt(l.slice(0, 3), 10) - 1, b = parseInt(l.slice(3, 6), 10) - 1, o = parseInt(l.slice(6, 9), 10) || 1;
    if (a >= 0 && b >= 0 && a < na && b < na) bonds.push({ a, b, o });
  }
  return { atoms, bonds };
}

/** Lightweight canvas ball-and-stick renderer (used when WebGL / 3Dmol is unavailable). */
function CanvasMol({ data, style, spin }: { data: { atoms: Atom[]; bonds: Bond[] }; style: Style; spin: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rot = useRef({ ax: -0.5, ay: 0.6 });
  const zoom = useRef(1);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const spinRef = useRef(spin);
  spinRef.current = spin;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const cx0 = data.atoms.reduce((s, a) => s + a.x, 0) / data.atoms.length;
    const cy0 = data.atoms.reduce((s, a) => s + a.y, 0) / data.atoms.length;
    const cz0 = data.atoms.reduce((s, a) => s + a.z, 0) / data.atoms.length;
    const ext = Math.max(1.5, ...data.atoms.map((a) => Math.hypot(a.x - cx0, a.y - cy0, a.z - cz0))) + 1;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (spinRef.current) rot.current.ay += 0.008;
      const { ax, ay } = rot.current;
      const sx = Math.sin(ax), cxr = Math.cos(ax), sy = Math.sin(ay), cyr = Math.cos(ay);
      const scale = ((Math.min(w, h) / 2) * 0.86 * zoom.current) / ext;
      const proj = data.atoms.map((a) => {
        const x = a.x - cx0, y = a.y - cy0, z = a.z - cz0;
        const x1 = x * cyr + z * sy, z1 = -x * sy + z * cyr;
        const y2 = y * cxr - z1 * sx, z2 = y * sx + z1 * cxr;
        const p = 1 + z2 / (ext * 4);
        return { X: w / 2 + x1 * scale * p, Y: h / 2 - y2 * scale * p, Z: z2, p };
      });
      const items: { z: number; draw: () => void }[] = [];
      const stickW = style === "line" ? 1.5 : style === "stick" ? 0.22 * scale : 0.14 * scale;
      for (const b of data.bonds) {
        const A = proj[b.a], B = proj[b.b];
        const ca = CPK[data.atoms[b.a].el] || "#9ca3af", cb = CPK[data.atoms[b.b].el] || "#9ca3af";
        items.push({
          z: (A.Z + B.Z) / 2,
          draw: () => {
            const mx = (A.X + B.X) / 2, my = (A.Y + B.Y) / 2;
            const n = style === "line" ? 1 : Math.min(b.o, 3);
            const dx = B.Y - A.Y, dy = -(B.X - A.X);
            const len = Math.hypot(dx, dy) || 1;
            for (let k = 0; k < n; k++) {
              const off = n === 1 ? 0 : (k - (n - 1) / 2) * stickW * 1.6;
              const ox = (dx / len) * off, oy = (dy / len) * off;
              ctx.lineCap = "round";
              ctx.lineWidth = n === 1 ? stickW : stickW * 0.7;
              ctx.strokeStyle = ca;
              ctx.beginPath();
              ctx.moveTo(A.X + ox, A.Y + oy);
              ctx.lineTo(mx + ox, my + oy);
              ctx.stroke();
              ctx.strokeStyle = cb;
              ctx.beginPath();
              ctx.moveTo(mx + ox, my + oy);
              ctx.lineTo(B.X + ox, B.Y + oy);
              ctx.stroke();
            }
          },
        });
      }
      if (style !== "line") {
        data.atoms.forEach((a, i) => {
          const P = proj[i];
          const base = RADIUS[a.el] || 0.75;
          const r = (style === "sphere" ? base * 1.9 : style === "stick" ? 0.22 : base * 0.6) * scale * P.p;
          items.push({
            z: P.Z,
            draw: () => {
              const col = CPK[a.el] || "#9ca3af";
              const g = ctx.createRadialGradient(P.X - r * 0.35, P.Y - r * 0.35, r * 0.1, P.X, P.Y, r);
              g.addColorStop(0, "#ffffff");
              g.addColorStop(0.25, col);
              g.addColorStop(1, "#020617");
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(P.X, P.Y, r, 0, Math.PI * 2);
              ctx.fill();
              if (style !== "stick" && r > 9 && a.el !== "C") {
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.font = `bold ${Math.max(9, r * 0.8)}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(a.el, P.X, P.Y + 1);
              }
            },
          });
        });
      }
      items.sort((p, q) => p.z - q.z).forEach((it) => it.draw());
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data, style]);

  return (
    <canvas
      ref={ref}
      className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        rot.current.ay += (e.clientX - drag.current.x) * 0.01;
        rot.current.ax += (e.clientY - drag.current.y) * 0.01;
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (drag.current = null)}
      onWheel={(e) => {
        zoom.current = Math.min(4, Math.max(0.4, zoom.current * (e.deltaY > 0 ? 0.92 : 1.08)));
      }}
    />
  );
}

/** Interactive 3D viewer: PubChem 3D SDF by CID → OpenChemLib conformer. Renders with 3Dmol.js (WebGL) or the canvas fallback. */
export function Molecule3D({ cid, smiles, height = 340 }: { cid?: number | null; smiles?: string | null; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");
  const [label, setLabel] = useState("");
  const [style, setStyle] = useState<Style>("ballstick");
  const [spin, setSpin] = useState(true);
  const [fallback, setFallback] = useState<{ atoms: Atom[]; bonds: Bond[] } | null>(null);
  const [atomCount, setAtomCount] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setFallback(null);
    (async () => {
      let data: string | null = null;
      let src = "";
      try {
        if (cid) {
          const r = await fetch(`/api/chem/sdf?cid=${cid}`);
          if (r.ok) {
            const j = await r.json();
            if (j.dim === "3d") {
              data = j.sdf;
              src = "نموذج PubChem ثلاثي الأبعاد";
            }
          }
        }
        if (!data && smiles) {
          data = await smilesTo3DMolfile(smiles);
          src = "تشكّل محسوب بـ OpenChemLib";
        }
      } catch {
        /* handled below */
      }
      if (!alive) return;
      if (!data) {
        setStatus("fail");
        return;
      }
      const parsed = parseMol(data);
      setAtomCount(parsed?.atoms.length || 0);
      // Try 3Dmol (WebGL)
      try {
        const mod = (await import("3dmol")) as unknown as Record<string, unknown>;
        const lib = (mod.createViewer ? mod : (mod.default as Record<string, unknown>)) as { createViewer: (el: HTMLElement, cfg: object) => unknown } | undefined;
        if (!lib?.createViewer) throw new Error("3Dmol export missing");
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) throw new Error("no webgl");
        if (!alive || !ref.current) return;
        ref.current.innerHTML = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewer: any = lib.createViewer(ref.current, { backgroundColor: "#07122a", antialias: true });
        viewer.addModel(data, "sdf");
        viewerRef.current = viewer;
        applyStyle(viewer, "ballstick");
        viewer.zoomTo();
        viewer.zoom(0.9);
        viewer.spin("y", 0.6);
        viewer.render();
        setLabel(src + " • WebGL");
        setStatus("ok");
      } catch {
        if (!alive) return;
        if (parsed) {
          setFallback(parsed);
          setLabel(src);
          setStatus("ok");
        } else setStatus("fail");
      }
    })();
    return () => {
      alive = false;
      try {
        viewerRef.current?.clear?.();
      } catch {
        /* ignore */
      }
      viewerRef.current = null;
    };
  }, [cid, smiles]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyStyle(v: any, s: Style) {
    const styles: Record<Style, object> = {
      ballstick: { stick: { radius: 0.14, colorscheme: "Jmol" }, sphere: { scale: 0.28, colorscheme: "Jmol" } },
      stick: { stick: { radius: 0.2, colorscheme: "Jmol" } },
      sphere: { sphere: { colorscheme: "Jmol" } },
      line: { line: { colorscheme: "Jmol" } },
    };
    v.setStyle({}, styles[s]);
    v.render();
  }

  useEffect(() => {
    if (viewerRef.current && status === "ok") applyStyle(viewerRef.current, style);
  }, [style, status]);
  useEffect(() => {
    if (viewerRef.current && status === "ok") viewerRef.current.spin(spin ? "y" : false, 0.6);
  }, [spin, status]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#07122a]" style={{ height }}>
      <div ref={ref} className="absolute inset-0" style={{ direction: "ltr" }} />
      {fallback && status === "ok" && (
        <div className="absolute inset-0">
          <CanvasMol data={fallback} style={style} spin={spin} />
        </div>
      )}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-cyan-200/70">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          جارِ بناء النموذج ثلاثي الأبعاد...
        </div>
      )}
      {status === "fail" && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">لا يتوفر نموذج ثلاثي الأبعاد لهذه المادة</div>}
      {status === "ok" && (
        <>
          <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-xl bg-black/50 p-1 text-xs backdrop-blur">
            {(
              [
                ["ballstick", "كرات وعصي"],
                ["stick", "عصي"],
                ["sphere", "كروي"],
                ["line", "خطي"],
              ] as [Style, string][]
            ).map(([k, l]) => (
              <button key={k} onClick={() => setStyle(k)} className={`rounded-lg px-2 py-1 transition ${style === k ? "bg-cyan-400 text-slate-900" : "text-slate-200 hover:bg-white/10"}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => setSpin(!spin)} className="absolute left-3 top-3 z-10 rounded-xl bg-black/50 px-3 py-1.5 text-xs text-slate-200 backdrop-blur hover:bg-black/70">
            {spin ? "⏸ إيقاف الدوران" : "⟳ تدوير"}
          </button>
          <div className="absolute bottom-2 left-3 z-10 text-[11px] text-cyan-200/60">
            {label} • {atomCount} ذرة • اسحب للتدوير، مرر للتكبير
          </div>
        </>
      )}
    </div>
  );
}
