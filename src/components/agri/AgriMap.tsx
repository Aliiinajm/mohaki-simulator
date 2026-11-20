"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { LAND_CLASSES } from "@/lib/agri/trees";
import type { BBox } from "@/lib/agri/analyze";

type L = typeof Leaflet;

export type TreeLayerData = { positions: number[]; radius: number; color: string; key: string };
export type OverlayData = { grid: string; width: number; height: number; bbox: BBox; visible: boolean };

function areaOf(b: BBox) {
  const latC = (b.south + b.north) / 2;
  const w = (b.east - b.west) * 111320 * Math.cos((latC * Math.PI) / 180);
  const h = (b.north - b.south) * 111320;
  return { w, h, a: w * h };
}

export function AgriMap({
  bbox,
  onBBox,
  overlay,
  trees,
  locked,
}: {
  bbox: BBox | null;
  onBBox: (b: BBox | null) => void;
  overlay: OverlayData | null;
  trees: TreeLayerData | null;
  locked: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const LRef = useRef<L | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const rectRef = useRef<Leaflet.Rectangle | null>(null);
  const overlayRef = useRef<Leaflet.ImageOverlay | null>(null);
  const treeLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const baseRef = useRef<{ sat: Leaflet.LayerGroup; street: Leaflet.TileLayer } | null>(null);
  const drawRef = useRef(false);
  const onBBoxRef = useRef(onBBox);
  onBBoxRef.current = onBBox;
  const [drawing, setDrawing] = useState(false);
  const [base, setBase] = useState<"sat" | "street">("sat");
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ name: string; lat: number; lon: number; bbox: number[] }[]>([]);
  const [searching, setSearching] = useState(false);
  const [planted, setPlanted] = useState(0);

  // Init map
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default as unknown as L;
      if (disposed || !el.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(el.current, { center: [24.7136, 46.6753], zoom: 15, zoomControl: false, preferCanvas: true, maxZoom: 20 });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
      const sat = L.layerGroup([
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }),
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19 }),
      ]);
      const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap contributors" });
      sat.addTo(map);
      baseRef.current = { sat, street };
      mapRef.current = map;

      // ---- Rectangle drawing (drag, or click-click) ----
      let first: Leaflet.LatLng | null = null;
      let downPt: Leaflet.Point | null = null;
      let dragged = false;
      let ignoreClick = false;
      const style = { color: "#22d3ee", weight: 2.5, dashArray: "8 6", fillColor: "#22d3ee", fillOpacity: 0.12 };
      const ensureRect = (a: Leaflet.LatLng, b: Leaflet.LatLng) => {
        const bounds = L.latLngBounds(a, b);
        if (!rectRef.current) rectRef.current = L.rectangle(bounds, style).addTo(map);
        else rectRef.current.setBounds(bounds);
      };
      const finish = (a: Leaflet.LatLng, b: Leaflet.LatLng) => {
        ensureRect(a, b);
        rectRef.current!.setStyle({ dashArray: undefined, fillOpacity: 0.06 });
        const bb = L.latLngBounds(a, b);
        first = null;
        drawRef.current = false;
        setDrawing(false);
        map.dragging.enable();
        map.getContainer().style.cursor = "";
        onBBoxRef.current({ south: bb.getSouth(), west: bb.getWest(), north: bb.getNorth(), east: bb.getEast() });
      };
      map.on("mousedown", (e: Leaflet.LeafletMouseEvent) => {
        if (!drawRef.current) return;
        if (first) return; // click-click mode in progress
        first = e.latlng;
        downPt = e.containerPoint;
        dragged = false;
      });
      map.on("mousemove", (e: Leaflet.LeafletMouseEvent) => {
        if (!drawRef.current || !first) return;
        if (downPt && e.containerPoint.distanceTo(downPt) > 6) dragged = true;
        ensureRect(first, e.latlng);
      });
      map.on("mouseup", (e: Leaflet.LeafletMouseEvent) => {
        if (!drawRef.current || !first) return;
        if (dragged && downPt) {
          ignoreClick = true;
          downPt = null;
          finish(first, e.latlng);
        }
        downPt = null;
      });
      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        if (!drawRef.current) return;
        if (!first) {
          first = e.latlng;
          ensureRect(first, e.latlng);
        } else if (!dragged && first.distanceTo(e.latlng) > 3) finish(first, e.latlng);
      });
      setReady(true);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      rectRef.current = null;
    };
  }, []);

  // Base layer switch
  useEffect(() => {
    const map = mapRef.current, b = baseRef.current;
    if (!map || !b) return;
    if (base === "sat") {
      map.removeLayer(b.street);
      b.sat.addTo(map);
    } else {
      map.removeLayer(b.sat);
      b.street.addTo(map);
    }
  }, [base, ready]);

  // External bbox reset
  useEffect(() => {
    if (!bbox && rectRef.current && mapRef.current) {
      mapRef.current.removeLayer(rectRef.current);
      rectRef.current = null;
    }
  }, [bbox]);

  // Classification overlay
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }
    if (!overlay || !overlay.visible) return;
    const c = document.createElement("canvas");
    c.width = overlay.width;
    c.height = overlay.height;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(overlay.width, overlay.height);
    const rgb = LAND_CLASSES.map((k) => [parseInt(k.color.slice(1, 3), 16), parseInt(k.color.slice(3, 5), 16), parseInt(k.color.slice(5, 7), 16)]);
    for (let i = 0; i < overlay.grid.length; i++) {
      const cls = overlay.grid.charCodeAt(i) - 48;
      const [r, g, b] = rgb[cls] || [0, 0, 0];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = cls === 0 ? 60 : 150;
    }
    ctx.putImageData(img, 0, 0);
    const bb = overlay.bbox;
    overlayRef.current = L.imageOverlay(c.toDataURL(), [[bb.south, bb.west], [bb.north, bb.east]], { opacity: 0.85, className: "pixelated-overlay" }).addTo(map);
  }, [overlay, ready]);

  // Trees layer (animated planting)
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    if (treeLayerRef.current) {
      map.removeLayer(treeLayerRef.current);
      treeLayerRef.current = null;
    }
    setPlanted(0);
    if (!trees) return;
    const group = L.layerGroup().addTo(map);
    treeLayerRef.current = group;
    const renderer = L.canvas({ padding: 0.3 });
    const total = Math.min(trees.positions.length / 2, 15000);
    const batch = Math.max(60, Math.ceil(total / 45));
    let i = 0;
    let raf = 0;
    const step = () => {
      const end = Math.min(total, i + batch);
      for (; i < end; i++) {
        const lat = trees.positions[i * 2], lng = trees.positions[i * 2 + 1];
        L.circle([lat, lng], { radius: trees.radius * 0.8, renderer, color: "#052e16", weight: 1, fillColor: trees.color, fillOpacity: 0.9 }).addTo(group);
        L.circle([lat, lng], { radius: Math.max(0.4, trees.radius * 0.18), renderer, stroke: false, fillColor: "#f0fdf4", fillOpacity: 0.55 }).addTo(group);
      }
      setPlanted(i);
      if (i < total) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [trees, ready]);

  function toggleDraw() {
    const map = mapRef.current;
    if (!map || locked) return;
    const next = !drawRef.current;
    drawRef.current = next;
    setDrawing(next);
    if (next) {
      if (rectRef.current) {
        map.removeLayer(rectRef.current);
        rectRef.current = null;
      }
      onBBoxRef.current(null);
      map.dragging.disable();
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.dragging.enable();
      map.getContainer().style.cursor = "";
    }
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/agri/geocode?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setResults(j.results || []);
    } finally {
      setSearching(false);
    }
  }

  function go(r: { lat: number; lon: number; bbox: number[] }) {
    setResults([]);
    const map = mapRef.current;
    if (!map) return;
    const [s, n, w, e] = r.bbox;
    const span = Math.max(n - s, e - w);
    if (span > 0.02) map.flyTo([r.lat, r.lon], 16, { duration: 1.5 });
    else map.flyToBounds([[s, w], [n, e]], { duration: 1.5, maxZoom: 18 });
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => mapRef.current?.flyTo([p.coords.latitude, p.coords.longitude], 17, { duration: 1.5 }));
  }

  const dims = bbox ? areaOf(bbox) : null;

  return (
    <div className="relative isolate h-[72vh] min-h-[520px] overflow-hidden rounded-3xl border border-emerald-400/20 shadow-2xl" dir="ltr">
      <div ref={el} className="absolute inset-0 z-0 bg-slate-900" />
      {/* Search */}
      <form onSubmit={search} className="absolute left-1/2 top-3 z-[500] w-[min(92%,460px)] -translate-x-1/2" dir="rtl">
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#071226]/90 px-3 py-2 shadow-xl backdrop-blur">
          <span>📍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن أي مدينة أو حي أو عنوان في العالم..." className="w-full bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none" />
          <button className="rounded-lg bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-900">{searching ? "..." : "بحث"}</button>
        </div>
        {results.length > 0 && (
          <ul className="mt-2 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-[#071226]/95 p-1 shadow-2xl backdrop-blur">
            {results.map((r, i) => (
              <li key={i}>
                <button type="button" onClick={() => go(r)} className="w-full rounded-xl px-3 py-2 text-start text-xs text-slate-200 hover:bg-emerald-400/15">
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      {/* Toolbar */}
      <div className="absolute right-3 top-20 z-[500] flex flex-col gap-2" dir="rtl">
        <button
          onClick={toggleDraw}
          disabled={locked}
          title="ارسم مستطيلاً لتحديد المنطقة"
          className={`group flex h-12 w-12 items-center justify-center rounded-2xl border shadow-xl transition disabled:opacity-40 ${drawing ? "border-cyan-300 bg-cyan-400 text-slate-900 ring-4 ring-cyan-400/30" : "border-white/15 bg-[#071226]/90 text-white hover:bg-[#0c1d3a]"}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        <button onClick={() => setBase(base === "sat" ? "street" : "sat")} title="تبديل الخريطة" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-[#071226]/90 text-lg shadow-xl hover:bg-[#0c1d3a]">
          {base === "sat" ? "🗺️" : "🛰️"}
        </button>
        <button onClick={locate} title="موقعي" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-[#071226]/90 text-lg shadow-xl hover:bg-[#0c1d3a]">
          🎯
        </button>
      </div>
      {drawing && (
        <div className="absolute bottom-14 left-1/2 z-[500] -translate-x-1/2 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-xl" dir="rtl">
          ✏️ اسحب على الخريطة لرسم مربع/مستطيل (أو انقر زاويتين)
        </div>
      )}
      {dims && !drawing && (
        <div className="absolute bottom-14 left-1/2 z-[500] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#071226]/90 px-4 py-2 font-mono text-xs text-cyan-100 shadow-xl">
          {Math.round(dims.w)} m × {Math.round(dims.h)} m • {dims.a >= 1e6 ? (dims.a / 1e6).toFixed(2) + " km²" : Math.round(dims.a).toLocaleString() + " m²"}
        </div>
      )}
      {trees && planted > 0 && planted < Math.min(trees.positions.length / 2, 15000) && (
        <div className="absolute left-3 top-20 z-[500] rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-xl" dir="rtl">
          🌱 جارِ زراعة الأشجار... {planted.toLocaleString()}
        </div>
      )}
    </div>
  );
}
