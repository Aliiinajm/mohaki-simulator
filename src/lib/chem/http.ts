import { withDb } from "@/db";
import { apiCache } from "@/db/schema";
import { eq } from "drizzle-orm";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

const isTransient = (e: unknown) => {
  const name = (e as Error)?.name;
  const msg = (e as Error)?.message || "";
  // AbortError = our own timeout; TypeError("fetch failed") = DNS/socket failure.
  return name === "AbortError" || name === "TypeError" || /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network/i.test(msg);
};

/**
 * Fetch with a hard timeout (AbortController).
 * Safe (GET) requests are retried once on transient network failures — this
 * keeps local development usable on unstable connections and flaky DNS.
 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  try {
    return await fetchOnce(url, init, timeoutMs);
  } catch (error) {
    const method = (init.method || "GET").toUpperCase();
    if (method !== "GET" || !isTransient(error)) throw error;
    await sleep(600);
    return fetchOnce(url, init, timeoutMs);
  }
}

/** Simple sliding-window rate limiter (PubChem: max 5 requests / second). */
class RateLimiter {
  private stamps: number[] = [];
  private chain: Promise<void> = Promise.resolve();
  constructor(private max: number, private windowMs: number) {}
  acquire(): Promise<void> {
    const next = this.chain.then(async () => {
      for (;;) {
        const now = Date.now();
        this.stamps = this.stamps.filter((s) => now - s < this.windowMs);
        if (this.stamps.length < this.max) {
          this.stamps.push(now);
          return;
        }
        const wait = this.windowMs - (now - this.stamps[0]) + 5;
        await new Promise((r) => setTimeout(r, wait));
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}

const g = globalThis as typeof globalThis & { __pubchemLimiter?: RateLimiter };
export const pubchemLimiter = g.__pubchemLimiter ?? (g.__pubchemLimiter = new RateLimiter(5, 1000));

export async function pubchemFetch(url: string, timeoutMs = 8000): Promise<Response> {
  await pubchemLimiter.acquire();
  return fetchWithTimeout(url, { headers: { "User-Agent": "NabdSimulator/1.0" } }, timeoutMs);
}

/** Key/value cache in PostgreSQL with TTL (ms). */
/** Read-through cache. Returns null when the value is absent, the database is
 *  unavailable, or the tables have not been created — never throws. */
export async function cacheGet<T>(key: string, ttlMs = 1000 * 60 * 60 * 24 * 30): Promise<T | null> {
  const rows = await withDb((d) => d.select().from(apiCache).where(eq(apiCache.key, key)).limit(1));
  if (!rows || !rows.length) return null;
  if (Date.now() - new Date(rows[0].createdAt).getTime() > ttlMs) return null;
  return rows[0].value as T;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  await withDb(async (d) => {
    await d
      .insert(apiCache)
      .values({ key, value: value as object, createdAt: new Date() })
      .onConflictDoUpdate({ target: apiCache.key, set: { value: value as object, createdAt: new Date() } });
  });
  /* cache failures are non-fatal: withDb() swallows and logs them */
}
