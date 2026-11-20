import jpeg from "jpeg-js";
import { cacheGet, cacheSet, fetchWithTimeout } from "@/lib/chem/http";
import { LAND_CLASSES, suitability, TREES, treeById, type Climate } from "./trees";

export type BBox = { south: number; west: number; north: number; east: number };
type Tile = { data: Uint8Array; w: number; h: number };

const UA = { "User-Agent": "NabdSimulator/1.0 (agri analysis)" };
const M_PER_DEG = 111320;

export function bboxMetrics(b: BBox) {
  const latC = (b.south + b.north) / 2;
  const mLng = M_PER_DEG * Math.cos((latC * Math.PI) / 180);
  const widthM = (b.east - b.west) * mLng;
  const heightM = (b.north - b.south) * M_PER_DEG;
  return { latC, mLng, widthM, heightM, area: widthM * heightM };
}

/* ------------------------------ Satellite imagery ------------------------------ */

const lon2px = (lon: number, z: number) => ((lon + 180) / 360) * 256 * 2 ** z;
const lat2px = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z;
};

async function fetchTile(z: number, x: number, y: number): Promise<Tile | null> {
  try {
    const r = await fetchWithTimeout(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, { headers: UA }, 10000);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { data: img.data, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

function tileIsBlank(t: Tile | null): boolean {
  if (!t) return true;
  let sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < t.data.length; i += 4 * 97) {
    const l = (t.data[i] + t.data[i + 1] + t.data[i + 2]) / 3;
    sum += l;
    sum2 += l * l;
    n++;
  }
  const mean = sum / n;
  return Math.sqrt(sum2 / n - mean * mean) < 5;
}

async function fetchImagery(b: BBox) {
  let z = 18;
  const count = (zz: number) => {
    const x0 = Math.floor(lon2px(b.west, zz) / 256), x1 = Math.floor(lon2px(b.east, zz) / 256);
    const y0 = Math.floor(lat2px(b.north, zz) / 256), y1 = Math.floor(lat2px(b.south, zz) / 256);
    return { x0, x1, y0, y1, n: (x1 - x0 + 1) * (y1 - y0 + 1) };
  };
  while (z > 14 && count(z).n > 64) z--;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { x0, x1, y0, y1 } = count(z);
    const jobs: [number, number][] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
    const tiles = new Map<string, Tile>();
    let idx = 0;
    await Promise.all(
      Array.from({ length: 8 }).map(async () => {
        while (idx < jobs.length) {
          const [x, y] = jobs[idx++];
          const t = await fetchTile(z, x, y);
          if (t) tiles.set(`${x}/${y}`, t);
        }
      })
    );
    const blank = Array.from(tiles.values()).filter(tileIsBlank).length;
    if (tiles.size > 0 && blank / tiles.size < 0.5) return { z, tiles, ok: true };
    z--;
  }
  return { z, tiles: new Map<string, Tile>(), ok: false };
}

/** Pixel classifier using vegetation index (ExG), saturation, brightness and texture. */
function classifyPixelStats(r: number, g: number, b: number, std: number): number {
  const sum = r + g + b + 1e-6;
  const bright = sum / 3;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = (mx - mn) / (mx + 1e-6);
  const exg = (2 * g - r - b) / sum;
  if (bright < 38) return 0; // deep shadow
  if (b > r + 8 && b >= g - 4 && bright < 130 && exg < 0.05) return 4; // water
  if (exg > 0.045 || (g > r && g > b && sat > 0.12)) {
    if (bright < 95 || std > 16) return 5; // tree canopy (dark / textured)
    return 6; // grass
  }
  if (sat > 0.16 && r > b + 18 && r >= g - 6) {
    if (std < 3 && bright > 150 && sat < 0.24) return 3; // perfectly uniform light surface = roof / concrete
    return 7; // bare soil / sand
  }
  return 3; // impervious (asphalt / concrete / roofs)
}

/* ------------------------------ OpenStreetMap ------------------------------ */

type OsmEl = { type: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; members?: { role: string; geometry?: { lat: number; lon: number }[] }[]; lat?: number; lon?: number };

async function fetchOSM(b: BBox): Promise<{ elements: OsmEl[]; ok: boolean }> {
  const key = `osm:${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;
  const cached = await cacheGet<OsmEl[]>(key, 1000 * 60 * 60 * 24 * 14);
  if (cached) return { elements: cached, ok: true };
  const bb = `${b.south},${b.west},${b.north},${b.east}`;
  const q = `[out:json][timeout:40];(way["building"](${bb});relation["building"](${bb});way["highway"](${bb});way["natural"~"water|wood|scrub|grassland"](${bb});relation["natural"="water"](${bb});way["waterway"~"river|canal"](${bb});way["landuse"](${bb});way["leisure"~"park|garden|pitch|playground"](${bb});way["amenity"="parking"](${bb});way["railway"="rail"](${bb});node["natural"="tree"](${bb}););out geom;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  for (const ep of endpoints) {
    try {
      const r = await fetchWithTimeout(`${ep}?data=${encodeURIComponent(q)}`, { headers: { ...UA, Accept: "application/json" } }, 42000);
      if (!r.ok) continue;
      const j = await r.json();
      const elements: OsmEl[] = j.elements || [];
      await cacheSet(key, elements);
      return { elements, ok: true };
    } catch {
      /* next endpoint */
    }
  }
  return { elements: [], ok: false };
}

const HIGHWAY_W: Record<string, number> = {
  motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 8, residential: 7, unclassified: 6, living_street: 5,
  service: 4.5, motorway_link: 8, trunk_link: 8, primary_link: 8, secondary_link: 7, tertiary_link: 6, pedestrian: 4,
  track: 3, footway: 2, path: 1.5, cycleway: 2, steps: 2,
};

/* ------------------------------ Climate & air ------------------------------ */

async function fetchClimate(lat: number, lon: number): Promise<Climate | null> {
  const year = new Date().getFullYear() - 1;
  const key = `climate:${lat.toFixed(2)},${lon.toFixed(2)}:${year}`;
  const c = await cacheGet<Climate>(key, 1000 * 60 * 60 * 24 * 180);
  if (c) return c;
  try {
    const r = await fetchWithTimeout(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${year}-01-01&end_date=${year}-12-31&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
      {},
      15000
    );
    if (!r.ok) return null;
    const j = await r.json();
    const d = j.daily;
    const nums = (a: (number | null)[]) => a.filter((v): v is number => typeof v === "number");
    const mean = nums(d.temperature_2m_mean), mx = nums(d.temperature_2m_max), mn = nums(d.temperature_2m_min), pr = nums(d.precipitation_sum);
    const months: number[][] = Array.from({ length: 12 }, () => []);
    (d.time as string[]).forEach((t, i) => {
      const v = d.temperature_2m_max[i];
      if (typeof v === "number") months[parseInt(t.slice(5, 7), 10) - 1].push(v);
    });
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const climate: Climate = {
      meanTemp: +avg(mean).toFixed(1),
      maxTemp: +Math.max(...mx).toFixed(1),
      minTemp: +Math.min(...mn).toFixed(1),
      hottestMonthMax: +Math.max(...months.map(avg)).toFixed(1),
      rain: Math.round(pr.reduce((s, v) => s + v, 0)),
      year,
    };
    await cacheSet(key, climate);
    return climate;
  } catch {
    return null;
  }
}

export type Air = { pm2_5: number; pm10: number; no2: number; o3: number } | null;

async function fetchAir(lat: number, lon: number): Promise<Air> {
  try {
    const r = await fetchWithTimeout(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,nitrogen_dioxide,ozone&past_days=31&forecast_days=1`,
      {},
      12000
    );
    if (!r.ok) return null;
    const j = await r.json();
    const avg = (a: (number | null)[]) => {
      const v = a.filter((x): x is number => typeof x === "number");
      return v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1) : 0;
    };
    return { pm2_5: avg(j.hourly.pm2_5), pm10: avg(j.hourly.pm10), no2: avg(j.hourly.nitrogen_dioxide), o3: avg(j.hourly.ozone) };
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const r = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&accept-language=ar`, { headers: UA }, 8000);
    if (!r.ok) return null;
    const j = await r.json();
    return j.display_name || null;
  } catch {
    return null;
  }
}

/* ------------------------------ Shape refinement ------------------------------ */

/**
 * Connected-component analysis of "bare soil" cells:
 *  - compact rectangular blocks whose shadow lies on the sun-opposite side → building roofs (missed by OSM)
 *  - long thin soil ribbons → dirt roads
 *  - tiny specks → paved (never plant on a 3-cell patch, it is usually a roof artefact)
 */
function refineGrid(grid: Uint8Array, W: number, H: number, cell: number, bright: Float32Array, osmBuildingFrac: number) {
  const N = W * H;
  // Global shadow direction estimated from known (OSM) buildings → adjacent shadow cells
  let sdx = 0, sdy = 0;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (grid[i] !== 1) continue;
      if (grid[i + 1] === 0) sdx += 1;
      if (grid[i - 1] === 0) sdx -= 1;
      if (grid[i + W] === 0) sdy += 1;
      if (grid[i - W] === 0) sdy -= 1;
    }
  const sLen = Math.hypot(sdx, sdy);
  const shadowDir = sLen > 20 ? [sdx / sLen, sdy / sLen] : null;

  const label = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  let inferredBuildings = 0;
  let dirtRoadM = 0;
  const minArea = 30;
  for (let start = 0; start < N; start++) {
    if (grid[start] !== 7 || label[start] !== -1) continue;
    // BFS
    let qh = 0, qt = 0;
    queue[qt++] = start;
    label[start] = start;
    const cells: number[] = [];
    let minX = W, maxX = 0, minY = H, maxY = 0, sumB = 0, cx = 0, cy = 0;
    let perim = 0, shadowN = 0, bldN = 0, roadN = 0, shX = 0, shY = 0;
    while (qh < qt) {
      const i = queue[qh++];
      cells.push(i);
      const x = i % W, y = (i - x) / W;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      sumB += bright[i]; cx += x; cy += y;
      let edge = false;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) {
        if (j < 0) { edge = true; continue; }
        if (grid[j] === 7) {
          if (label[j] === -1) { label[j] = start; queue[qt++] = j; }
        } else {
          edge = true;
          if (grid[j] === 0) { shadowN++; shX += j % W; shY += (j - (j % W)) / W; }
          else if (grid[j] === 1) bldN++;
          else if (grid[j] === 2) roadN++;
        }
      }
      if (edge) perim++;
    }
    const n = cells.length;
    const area = n * cell * cell;
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const fill = n / (bw * bh);
    const diag = Math.hypot(bw, bh) * cell;
    const width = (2 * n) / Math.max(1, perim) * cell;
    const shadowFrac = shadowN / Math.max(1, perim);
    const bldFrac = bldN / Math.max(1, perim);
    const roadFrac = roadN / Math.max(1, perim);
    cx /= n; cy /= n;

    let newCls = -1;
    if (area < minArea) newCls = 3;
    else if (width <= 9 && diag >= 25 && diag / width >= 4) {
      newCls = 11;
      dirtRoadM += diag;
    } else if (area <= 3000 && fill >= 0.6 && width >= 4 && roadFrac <= 0.3) {
      let isBuilding = false;
      if (shadowDir && shadowN > 0) {
        // shadow centroid relative to component centroid, projected on the global shadow direction
        const vx = shX / shadowN - cx, vy = shY / shadowN - cy;
        const vl = Math.hypot(vx, vy) || 1;
        const dot = (vx / vl) * shadowDir[0] + (vy / vl) * shadowDir[1];
        if (dot > 0.35 && shadowFrac >= 0.08) isBuilding = true; // shadow on the far side → this block casts it
      } else if (shadowFrac >= 0.15 && fill >= 0.7) isBuilding = true;
      if (!isBuilding && osmBuildingFrac > 0.05 && bldFrac >= 0.45 && area < 400) isBuilding = true; // annex glued to a mapped building
      if (isBuilding) {
        newCls = 1;
        inferredBuildings++;
      }
    }
    if (newCls >= 0) for (const i of cells) grid[i] = newCls;
  }
  // Grass specks on roofs / noise
  const label2 = new Int32Array(N).fill(-1);
  for (let start = 0; start < N; start++) {
    if (grid[start] !== 6 || label2[start] !== -1) continue;
    let qh = 0, qt = 0;
    queue[qt++] = start;
    label2[start] = start;
    const cells: number[] = [];
    while (qh < qt) {
      const i = queue[qh++];
      cells.push(i);
      const x = i % W, y = (i - x) / W;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) if (j >= 0 && grid[j] === 6 && label2[j] === -1) { label2[j] = start; queue[qt++] = j; }
    }
    if (cells.length * cell * cell < 20) for (const i of cells) grid[i] = 3;
  }
  return { inferredBuildings, dirtRoadM };
}

/* ------------------------------ Analysis ------------------------------ */

export type AnalysisMeta = {
  bbox: BBox;
  width: number;
  height: number;
  cellSize: number;
  zoom: number;
  areaM2: number;
  widthM: number;
  heightM: number;
  classes: { id: number; ar: string; color: string; area: number; pct: number }[];
  plantableArea: number;
  existingCanopyArea: number;
  existingCanopyPct: number;
  osm: { ok: boolean; buildings: number; roadsKm: number; trees: number; features: number; dirtRoadsKm: number; inferredBuildings: number };
  imageryOk: boolean;
  climate: Climate | null;
  air: Air;
  place: string | null;
  recommendations: { id: string; score: number; reasons: string[] }[];
};

export async function analyzeArea(b: BBox): Promise<{ grid: string; meta: AnalysisMeta }> {
  const { latC, mLng, widthM, heightM, area } = bboxMetrics(b);
  const lonC = (b.west + b.east) / 2;
  const cell = Math.max(1, Math.max(widthM, heightM) / 300);
  const W = Math.max(1, Math.ceil(widthM / cell));
  const H = Math.max(1, Math.ceil(heightM / cell));

  const [img, osm, climate, air, place] = await Promise.all([fetchImagery(b), fetchOSM(b), fetchClimate(latC, lonC), fetchAir(latC, lonC), reverseGeocode(latC, lonC)]);

  const grid = new Uint8Array(W * H);
  const brightArr = new Float32Array(W * H);
  // 1) Pixel classification from satellite imagery
  const z = img.z;
  const pxPerM = 1 / ((156543.03392 * Math.cos((latC * Math.PI) / 180)) / 2 ** z);
  const samplesPerSide = Math.max(2, Math.min(5, Math.round(cell * pxPerM)));
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      let rs = 0, gs = 0, bs = 0, l2 = 0, n = 0;
      for (let sy = 0; sy < samplesPerSide; sy++) {
        for (let sx = 0; sx < samplesPerSide; sx++) {
          const xm = (col + (sx + 0.5) / samplesPerSide) * cell;
          const ym = (row + (sy + 0.5) / samplesPerSide) * cell;
          const lon = b.west + xm / mLng;
          const lat = b.north - ym / M_PER_DEG;
          const gx = lon2px(lon, z), gy = lat2px(lat, z);
          const t = img.tiles.get(`${Math.floor(gx / 256)}/${Math.floor(gy / 256)}`);
          if (!t) continue;
          const px = Math.min(t.w - 1, Math.floor(gx % 256)), py = Math.min(t.h - 1, Math.floor(gy % 256));
          const i = (py * t.w + px) * 4;
          const r = t.data[i], g = t.data[i + 1], bl = t.data[i + 2];
          rs += r; gs += g; bs += bl; l2 += ((r + g + bl) / 3) ** 2; n++;
        }
      }
      if (!n) { grid[row * W + col] = 0; continue; }
      const r = rs / n, g = gs / n, bl = bs / n;
      const mean = (r + g + bl) / 3;
      const std = Math.sqrt(Math.max(0, l2 / n - mean * mean));
      brightArr[row * W + col] = mean;
      grid[row * W + col] = classifyPixelStats(r, g, bl, std);
    }
  }

  // 2) OSM vector overlays
  const toXY = (p: { lat: number; lon: number }) => [((p.lon - b.west) * mLng) / cell, ((b.north - p.lat) * M_PER_DEG) / cell] as [number, number];
  const fillPolygon = (pts: [number, number][], cls: number, cond?: (cur: number) => boolean) => {
    if (pts.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const r0 = Math.max(0, Math.floor(minY)), r1 = Math.min(H - 1, Math.ceil(maxY));
    for (let row = r0; row <= r1; row++) {
      const yc = row + 0.5;
      const xs: number[] = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, c) => a - c);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil(xs[k] - 0.5)), c1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let col = c0; col <= c1; col++) {
          const idx = row * W + col;
          if (!cond || cond(grid[idx])) grid[idx] = cls;
        }
      }
    }
  };
  const bufferLine = (pts: [number, number][], halfW: number, cls: number, cond?: (cur: number) => boolean) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const c0 = Math.max(0, Math.floor(Math.min(x1, x2) - halfW)), c1 = Math.min(W - 1, Math.ceil(Math.max(x1, x2) + halfW));
      const r0 = Math.max(0, Math.floor(Math.min(y1, y2) - halfW)), r1 = Math.min(H - 1, Math.ceil(Math.max(y1, y2) + halfW));
      const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1e-9;
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const px = col + 0.5, py = row + 0.5;
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
          const ex = x1 + t * dx - px, ey = y1 + t * dy - py;
          if (ex * ex + ey * ey <= halfW * halfW) {
            const idx = row * W + col;
            if (grid[idx] !== 1 && (!cond || cond(grid[idx]))) grid[idx] = cls;
          }
        }
      }
    }
  };
  const rings = (el: OsmEl): [number, number][][] => {
    if (el.geometry) return [el.geometry.map(toXY)];
    if (el.members) return el.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry!.map(toXY));
    return [];
  };

  let buildings = 0, roadsM = 0, trees = 0, dirtM = 0;
  const UNPAVED = /^(unpaved|dirt|ground|sand|gravel|compacted|earth|fine_gravel|mud|grass|pebblestone|unhewn_cobblestone)$/;
  const isDirtRoad = (t: Record<string, string>) =>
    t.highway === "track" || (!!t.highway && UNPAVED.test(t.surface || "")) || (t.highway === "path" && !t.surface) || /^grade[2-5]$/.test(t.tracktype || "");
  const els = osm.elements;
  const green = /^(grass|meadow|farmland|orchard|forest|park|garden|village_green|recreation_ground|cemetery|allotments|grassland|scrub|wood)$/;
  // Green landuse hints (convert shadow to grass)
  for (const el of els) {
    const t = el.tags || {};
    if (green.test(t.landuse || "") || green.test(t.leisure || "") || green.test(t.natural || "")) rings(el).forEach((r) => fillPolygon(r, 6, (c) => c === 0 || c === 3));
  }
  for (const el of els) {
    const t = el.tags || {};
    if (t.natural === "water" || t.landuse === "reservoir" || t.landuse === "basin") rings(el).forEach((r) => fillPolygon(r, 4));
    else if (t.amenity === "parking") rings(el).forEach((r) => fillPolygon(r, 8, (c) => c !== 5));
    else if (t.leisure === "pitch") rings(el).forEach((r) => fillPolygon(r, 10));
  }
  for (const el of els) {
    const t = el.tags || {};
    if (!el.geometry) continue;
    const pts = el.geometry.map(toXY);
    if (t.waterway) bufferLine(pts, (t.waterway === "river" ? 10 : 4) / cell, 4);
    else if (t.railway === "rail") bufferLine(pts, 2.5 / cell, 9);
    else if (t.highway && t.area !== "yes") {
      const lanes = parseInt(t.lanes || "", 10);
      const explicitW = parseFloat(t.width || "");
      const w = Number.isFinite(explicitW) ? explicitW : Number.isFinite(lanes) ? lanes * 3.3 + 1 : HIGHWAY_W[t.highway] ?? 5;
      let len = 0;
      for (let i = 0; i + 1 < el.geometry.length; i++) {
        const a = el.geometry[i], c = el.geometry[i + 1];
        len += Math.hypot((c.lon - a.lon) * mLng, (c.lat - a.lat) * M_PER_DEG);
      }
      if (isDirtRoad(t)) {
        bufferLine(pts, Math.max(3, Math.min(w, 6)) / 2 / cell, 11);
        dirtM += len;
      } else {
        // sidewalk / kerb band (1.5 m) on both sides, then the carriageway
        if (!/^(footway|path|steps|cycleway|pedestrian)$/.test(t.highway)) bufferLine(pts, (w / 2 + 1.5) / cell, 3, (c) => c === 7 || c === 0 || c === 3);
        bufferLine(pts, w / 2 / cell, 2);
        roadsM += len;
      }
    }
  }
  for (const el of els) {
    if (el.tags?.building) {
      buildings++;
      rings(el).forEach((r) => fillPolygon(r, 1));
    }
    if (el.type === "node" && el.tags?.natural === "tree" && el.lat !== undefined && el.lon !== undefined) {
      trees++;
      const [x, y] = toXY({ lat: el.lat, lon: el.lon! });
      const rad = Math.max(1, 3 / cell);
      for (let row = Math.floor(y - rad); row <= Math.ceil(y + rad); row++)
        for (let col = Math.floor(x - rad); col <= Math.ceil(x + rad); col++)
          if (row >= 0 && row < H && col >= 0 && col < W && (col - x) ** 2 + (row - y) ** 2 <= rad * rad && grid[row * W + col] !== 1 && grid[row * W + col] !== 2) grid[row * W + col] = 5;
    }
  }

  // 3) Shape-based refinement: catch buildings missing from OSM, detect dirt tracks, drop specks
  const osmBuildingCells = grid.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);
  const refined = refineGrid(grid, W, H, cell, brightArr, osmBuildingCells / grid.length);
  dirtM += refined.dirtRoadM;

  // 4) Statistics
  const counts = new Array(LAND_CLASSES.length).fill(0);
  for (let i = 0; i < grid.length; i++) counts[grid[i]]++;
  const cellArea = cell * cell;
  const scale = area / (W * H * cellArea);
  const classes = LAND_CLASSES.map((c) => ({ id: c.id, ar: c.ar, color: c.color, area: Math.round(counts[c.id] * cellArea * scale), pct: +((counts[c.id] / grid.length) * 100).toFixed(1) }));
  const plantableArea = classes.filter((c) => LAND_CLASSES[c.id].plantable).reduce((s, c) => s + c.area, 0);
  const existingCanopyArea = classes[5].area;

  const recommendations = TREES.map((t) => ({ id: t.id, ...suitability(t, climate) })).sort((a, c) => c.score - a.score);

  const meta: AnalysisMeta = {
    bbox: b,
    width: W,
    height: H,
    cellSize: +cell.toFixed(3),
    zoom: z,
    areaM2: Math.round(area),
    widthM: Math.round(widthM),
    heightM: Math.round(heightM),
    classes,
    plantableArea,
    existingCanopyArea,
    existingCanopyPct: +((existingCanopyArea / area) * 100).toFixed(1),
    osm: { ok: osm.ok, buildings, roadsKm: +(roadsM / 1000).toFixed(2), trees, features: els.length, dirtRoadsKm: +(dirtM / 1000).toFixed(2), inferredBuildings: refined.inferredBuildings },
    imageryOk: img.ok,
    climate,
    air,
    place,
    recommendations,
  };
  let s = "";
  for (let i = 0; i < grid.length; i++) s += String.fromCharCode(48 + grid[i]);
  return { grid: s, meta };
}

/* ------------------------------ Planting ------------------------------ */

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PlanResult = ReturnType<typeof planTrees>;

export function planTrees(gridStr: string, meta: AnalysisMeta, speciesId: string, density: "dense" | "normal" | "sparse", seed = 1, tolerance = 0.15) {
  const rawGrid = typeof gridStr === "string"
  ? gridStr
  : gridStr == null
    ? ""
    : String(gridStr);
  const sp = treeById(speciesId);
  if (!sp) throw new Error("نوع الشجرة غير معروف");
  const { width: W, height: H, cellSize: cell, bbox: b } = meta;
  const { mLng } = bboxMetrics(b);
  const grid = new Uint8Array(W * H);
 for (let i = 0; i < grid.length; i++) {
  const code = i < rawGrid.length ? rawGrid.charCodeAt(i) - 48 : 0;
  grid[i] = Number.isFinite(code) ? code : 0;
}
  const tol = Math.min(0.3, Math.max(0.05, tolerance));

  // Chamfer distance transforms (in cells) to different obstacle families
  const INF = 1e9;
  const distanceTo = (isObstacle: (c: number) => boolean) => {
    const dist = new Float32Array(W * H);
    for (let i = 0; i < grid.length; i++) dist[i] = isObstacle(grid[i]) ? 0 : INF;
    const D1 = 1, D2 = Math.SQRT2;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!dist[i]) continue;
        let d = dist[i];
        if (x > 0) d = Math.min(d, dist[i - 1] + D1);
        if (y > 0) {
          d = Math.min(d, dist[i - W] + D1);
          if (x > 0) d = Math.min(d, dist[i - W - 1] + D2);
          if (x < W - 1) d = Math.min(d, dist[i - W + 1] + D2);
        }
        dist[i] = d;
      }
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        if (!dist[i]) continue;
        let d = dist[i];
        if (x < W - 1) d = Math.min(d, dist[i + 1] + D1);
        if (y < H - 1) {
          d = Math.min(d, dist[i + W] + D1);
          if (x < W - 1) d = Math.min(d, dist[i + W + 1] + D2);
          if (x > 0) d = Math.min(d, dist[i + W - 1] + D2);
        }
        dist[i] = d;
      }
    return dist;
  };
  const plantable = (c: number) => !!LAND_CLASSES[c]?.plantable;
  const distAny = distanceTo((c) => !plantable(c));
  const distBld = distanceTo((c) => c === 1);
  const distRoad = distanceTo((c) => c === 2 || c === 8 || c === 9);
  const distTree = distanceTo((c) => c === 5);
  const distDirt = distanceTo((c) => c === 11);
  const hasDirt = grid.some((c) => c === 11);

  const R = sp.canopy / 2;
  const factor = density === "dense" ? 1.0 : density === "sparse" ? 1.8 : 1.35;
  const s = sp.spacing * factor; // target spacing (comfortable, never crowded)
  const minSpacing = s * (1 - tol); // spacing tolerance: never closer than this
  const roadsideSpacing = s * 1.6; // sparse, scattered trees along tracks
  const bldClr = Math.max(4, R * 1.05); // whole canopy stays clear of buildings
  const roadClr = Math.max(3, R * 0.85); // whole drawn canopy stays clear of streets
  const treeClr = Math.max(2.5, s * 0.6); // existing canopy
  const genClr = Math.max(1.5, R * 0.3);
  const dirtOffset = 2; // trees line each side of a dirt track, 2 m from its edge
  const rand = mulberry32(seed * 9973 + speciesId.length * 131);

  // Hard footprint guard: no cell under the canopy may be a building / street / paved road
  const footR = Math.max(1, Math.ceil((R * 0.85) / cell));
  const footprintClear = (col: number, row: number) => {
    for (let dy = -footR; dy <= footR; dy++)
      for (let dx = -footR; dx <= footR; dx++) {
        if (dx * dx + dy * dy > footR * footR) continue;
        const c = col + dx, r = row + dy;
        if (c < 0 || r < 0 || c >= W || r >= H) return false;
        const k = grid[r * W + c];
        if (k === 1 || k === 2 || k === 8 || k === 9 || k === 4) return false;
      }
    return true;
  };

  const okCell = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= W || row >= H) return false;
    const i = row * W + col;
    if (!plantable(grid[i])) return false;
    if (distAny[i] * cell < genClr) return false;
    if (distBld[i] * cell < bldClr) return false;
    if (distRoad[i] * cell < roadClr) return false;
    if (distTree[i] * cell < treeClr) return false;
    return footprintClear(col, row);
  };

  // Spatial hash of accepted trees (metres)
  const hashSize = minSpacing;
  const buckets = new Map<string, [number, number][]>();
  const farEnough = (x: number, y: number, minD = minSpacing) => {
    const reach = Math.ceil(minD / hashSize);
    const bx = Math.floor(x / hashSize), by = Math.floor(y / hashSize);
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const arr = buckets.get(`${bx + dx},${by + dy}`);
        if (!arr) continue;
        for (const [px, py] of arr) if ((px - x) ** 2 + (py - y) ** 2 < minD * minD) return false;
      }
    return true;
  };
  const positions: number[] = [];
  let count = 0, roadsideTrees = 0;
  const accept = (x: number, y: number) => {
    const key = `${Math.floor(x / hashSize)},${Math.floor(y / hashSize)}`;
    (buckets.get(key) || buckets.set(key, []).get(key)!).push([x, y]);
    count++;
    if (positions.length < 40000) positions.push(+(b.north - y / M_PER_DEG).toFixed(7), +(b.west + x / mLng).toFixed(7));
  };

  // Pass 1 — scattered trees on both sides of dirt roads (band 2 m .. 2 m + one cell from the track edge)
  if (hasDirt) {
    const band = Math.max(cell, 1.5);
    const candidates: [number, number][] = [];
    for (let row = 0; row < H; row++)
      for (let col = 0; col < W; col++) {
        const d = distDirt[row * W + col] * cell;
        if (d < dirtOffset || d > dirtOffset + band) continue;
        if (okCell(col, row)) candidates.push([col, row]);
      }
    // shuffle deterministically so the roadside pattern looks natural rather than rastered
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const [col, row] of candidates) {
      const x = (col + 0.5) * cell, y = (row + 0.5) * cell;
      if (!farEnough(x, y, roadsideSpacing)) continue;
      accept(x, y);
      roadsideTrees++;
    }
  }

  // Pass 2 — hexagonal grid over remaining plantable land (jitter bounded by the tolerance)
  const rowH = (s * Math.sqrt(3)) / 2;
  const jit = (s * tol) / 2;
  let rowIdx = 0;
  for (let ym = s / 2; ym < H * cell; ym += rowH, rowIdx++) {
    for (let xm = rowIdx % 2 ? s : s / 2; xm < W * cell; xm += s) {
      const jx = xm + (rand() - 0.5) * 2 * jit;
      const jy = ym + (rand() - 0.5) * 2 * jit;
      const col = Math.floor(jx / cell), row = Math.floor(jy / cell);
      if (!okCell(col, row)) continue;
      if (!farEnough(jx, jy)) continue;
      accept(jx, jy);
    }
  }

  // ---- Environmental impact model ----
  const total = meta.areaM2;
  const crownArea = Math.PI * (sp.canopy / 2) ** 2;
  const effCrown = Math.min(crownArea, s * rowH);
  const addedCanopy = Math.min(count * effCrown, meta.plantableArea);
  const addedFrac = addedCanopy / total;
  const canopyBefore = meta.existingCanopyPct;
  const canopyAfter = +Math.min(100, ((meta.existingCanopyArea + addedCanopy) / total) * 100).toFixed(1);
  const pf = sp.pollutionFactor;
  // Annual pollutant removal (g/m² canopy/yr, i-Tree urban averages)
  const rates = { o3: 4.5, pm10: 2.4, no2: 1.6, so2: 0.5, co: 0.3, pm2_5: 0.35 };
  const removalKg = Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, +((addedCanopy * v * pf) / 1000).toFixed(1)])) as Record<keyof typeof rates, number>;
  const totalRemovalKg = +(removalKg.o3 + removalKg.pm10 + removalKg.no2 + removalKg.so2 + removalKg.co).toFixed(1);
  const pct = (k: number) => +Math.min(30, addedFrac * 100 * k * pf).toFixed(2);
  const reduction = { pm2_5: pct(0.22), pm10: pct(0.25), no2: pct(0.18), o3: pct(0.15) };
  const overallPollutionReduction = +((reduction.pm2_5 + reduction.pm10 + reduction.no2 + reduction.o3) / 4).toFixed(2);
  const air = meta.air;
  const airAfter = air
    ? { pm2_5: +(air.pm2_5 * (1 - reduction.pm2_5 / 100)).toFixed(1), pm10: +(air.pm10 * (1 - reduction.pm10 / 100)).toFixed(1), no2: +(air.no2 * (1 - reduction.no2 / 100)).toFixed(1), o3: +(air.o3 * (1 - reduction.o3 / 100)).toFixed(1) }
    : null;
  const cm = meta.climate;
  const climateFactor = !cm ? 1 : cm.meanTemp > 24 ? 1.35 : cm.meanTemp > 15 ? 1.1 : 0.8;
  const annualCooling = +Math.min(3.5, addedFrac * 100 * 0.045 * sp.coolingFactor * climateFactor).toFixed(2);
  const summerCooling = +Math.min(6, annualCooling * 2.2).toFixed(2);
  const surfaceCooling = +Math.min(15, annualCooling * 5).toFixed(1);
  const co2Kg = count * sp.co2;
  const o2Kg = co2Kg * 0.727;
  const rain = cm?.rain ?? 300;
  const irrigation = Math.round(((count * sp.waterLday * 365) / 1000) * (rain >= sp.minRain ? 0.35 : 1));
  const stormwater = Math.round(addedCanopy * (rain / 1000) * 0.18);

  const projection = Array.from({ length: 30 }, (_, k) => {
    const y = k + 1;
    const g = Math.min(1, Math.pow(y / sp.maturity, 1.4));
    return { year: y, growth: +g.toFixed(3), cooling: +(annualCooling * g).toFixed(2), co2: Math.round(co2Kg * g), pm: +(reduction.pm2_5 * g).toFixed(2) };
  });
  let cum = 0;
  const projectionCum = projection.map((p) => (cum += p.co2));

  return {
    species: sp.id,
    density,
    trees: count,
    positions,
    spacing: +s.toFixed(1),
    minSpacing: +minSpacing.toFixed(1),
    tolerance: tol,
    clearance: +bldClr.toFixed(1),
    roadClearance: +roadClr.toFixed(1),
    roadsideTrees,
    roadsideSpacing: +roadsideSpacing.toFixed(1),
    canopyRadius: sp.canopy / 2,
    addedCanopy: Math.round(addedCanopy),
    canopyBefore,
    canopyAfter,
    removalKg,
    totalRemovalKg,
    reduction,
    overallPollutionReduction,
    air,
    airAfter,
    annualCooling,
    summerCooling,
    surfaceCooling,
    co2Tons: +(co2Kg / 1000).toFixed(2),
    o2Tons: +(o2Kg / 1000).toFixed(2),
    peopleOxygen: Math.round(o2Kg / 300),
    carsOffset: +(co2Kg / 4600).toFixed(1),
    irrigationM3: irrigation,
    stormwaterM3: stormwater,
    co2Cum20: Math.round(projectionCum[19] / 1000),
    maturity: sp.maturity,
    projection,
  };
}
