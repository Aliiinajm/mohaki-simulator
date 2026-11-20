import type { AnalysisMeta } from "./analyze";

/**
 * In-memory fallback for analysis results.
 *
 * Normally analyses live in PostgreSQL (`agri_analyses`). When the database is
 * not configured, unreachable, or its tables have not been created yet, the
 * analysis is still returned to the client and kept here so that
 * `/api/agri/plant` can build the planting plan in the same session.
 * Entries expire after 2 hours to bound memory usage.
 */

type Entry = { grid: string; meta: AnalysisMeta; expires: number };

const TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ENTRIES = 40;

const g = globalThis as typeof globalThis & { __nabdAgriStore?: Map<number, Entry>; __nabdAgriSeq?: number };

function store(): Map<number, Entry> {
  if (!g.__nabdAgriStore) g.__nabdAgriStore = new Map();
  return g.__nabdAgriStore;
}

function assertStringGrid(grid: unknown): string {
  if (typeof grid !== "string") {
    throw new Error(`قيمة grid المطلوبة نصية ولكن تم الاستلام كـ ${typeof grid}`);
  }
  return grid;
}

/** Store an analysis without a database row and return its id. */
export function rememberAnalysis(grid: unknown, meta: AnalysisMeta): number {
  const s = store();
  const safeGrid = assertStringGrid(grid);

  // Ensure meta is valid before storing.
  if (!meta || typeof meta.width !== "number" || typeof meta.height !== "number") {
    throw new Error("بيانات التعريف (meta) ناقصة الأبعاد المطلوبة");
  }

  // Keep ids clearly separated from real database ids (use large numbers to avoid collision).
  const base = Math.max(g.__nabdAgriSeq ?? 0, Date.now());
  g.__nabdAgriSeq = base + 1;
  const id = g.__nabdAgriSeq;
  s.set(id, { grid: safeGrid, meta, expires: Date.now() + TTL_MS });

  // Evict oldest / expired entries one at a time to keep O(n) bounded.
  let evicted = 0;
  for (const [k, v] of s) {
    if (evicted >= 5) break;
    if (v.expires < Date.now() || s.size > MAX_ENTRIES) {
      s.delete(k);
      evicted++;
    }
  }
  return id;
}

export function getAnalysis(id: number): { grid: string; meta: AnalysisMeta } | null {
  const s = store();
  const hit = s.get(id);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    s.delete(id);
    return null;
  }
  return { grid: hit.grid, meta: hit.meta };
}

export function memoryAnalyses(): number {
  const s = store();
  for (const [k, v] of s) if (v.expires < Date.now()) s.delete(k);
  return s.size;
}
