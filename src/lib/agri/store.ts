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

/** Store an analysis without a database row and return its id. */
export function rememberAnalysis(grid: string, meta: AnalysisMeta): number {
  const s = store();
  // Keep ids clearly separated from real database ids.
  g.__nabdAgriSeq = Math.max(g.__nabdAgriSeq ?? 0, Date.now()) + 1;
  const id = g.__nabdAgriSeq;
  s.set(id, { grid, meta, expires: Date.now() + TTL_MS });
  // Evict oldest / expired entries
  for (const [k, v] of s) {
    if (v.expires < Date.now() || s.size > MAX_ENTRIES) s.delete(k);
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
