import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Database access layer.
 *
 * Design goals (local-dev resilience):
 *  1. Importing this module must NEVER throw. A missing/invalid `DATABASE_URL`
 *     used to throw at module-evaluation time, which made every API route that
 *     imports `@/db` (directly or via `@/lib/chem/*`) return an empty HTTP 500.
 *  2. The pool is created lazily, with explicit timeouts, so an unreachable
 *     PostgreSQL server degrades to "no cache" instead of hanging requests or
 *     crashing `next dev` with an unhandled 'error' event.
 *  3. A small circuit breaker stops hammering a down database on every request.
 */

export type DbStatus = {
  configured: boolean;
  urlMasked: string | null;
  host: string | null;
  port: string | null;
  database: string | null;
  reachable: boolean;
  tablesReady: boolean | null;
  lastError: string | null;
  hint: string | null;
};

type DbGlobal = typeof globalThis & {
  __nabdPool?: Pool;
  __nabdDb?: NodePgDatabase;
  __nabdDbDownUntil?: number;
  __nabdDbLastError?: string;
  __nabdDbMissingLogged?: boolean;
};

const g = globalThis as DbGlobal;

const rawUrl = () => (process.env.DATABASE_URL || "").trim();

export function isDbConfigured(): boolean {
  return rawUrl().length > 0;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

export function describeDatabaseUrl() {
  const url = rawUrl();
  if (!url) return { configured: false as const, urlMasked: null, host: null, port: null, database: null };
  try {
    const u = new URL(url);
    return {
      configured: true as const,
      urlMasked: maskUrl(url),
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, "") || null,
    };
  } catch {
    return { configured: true as const, urlMasked: "<invalid DATABASE_URL>", host: null, port: null, database: null };
  }
}

/** True while the circuit breaker considers the database unavailable. */
export function isDbCircuitOpen(): boolean {
  return !!g.__nabdDbDownUntil && Date.now() < g.__nabdDbDownUntil;
}

function openCircuit(error: unknown): void {
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  g.__nabdDbLastError = msg;
  g.__nabdDbDownUntil = Date.now() + 30_000; // retry after 30s
}

/** Lazily create the connection pool. Returns null when DATABASE_URL is absent. */
export function getPool(): Pool | null {
  if (!isDbConfigured()) return null;
  if (g.__nabdPool) return g.__nabdPool;
  const pool = new Pool({
    connectionString: rawUrl(),
    // Fail fast instead of hanging when PostgreSQL is not running / firewalled.
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 30_000,
    max: 10,
    statement_timeout: 15_000,
    query_timeout: 15_000,
  });
  // Without this handler an idle client error (e.g. server restarted) crashes the
  // Node process — a common cause of `next dev` dying on Windows.
  pool.on("error", () => {});
  g.__nabdPool = pool;
  return pool;
}

/** Drizzle instance, or null when the database is not configured. */
export function getDb(): NodePgDatabase | null {
  const pool = getPool();
  if (!pool) return null;
  if (!g.__nabdDb) g.__nabdDb = drizzle(pool);
  return g.__nabdDb;
}

/**
 * Run a database operation with graceful degradation.
 * Returns null (never throws) when the database is absent, unreachable or the
 * tables have not been created yet. Non-database features keep working.
 */
export async function withDb<T>(fn: (db: NodePgDatabase) => Promise<T>): Promise<T | null> {
  if (!isDbConfigured()) {
    if (!g.__nabdDbMissingLogged) {
      g.__nabdDbMissingLogged = true;
      console.warn(
        "[nabd] DATABASE_URL is not set — running without the cache/analysis database. " +
          "Chemistry lookups still work (they call PubChem/CACTUS directly). " +
          "Copy .env.example to .env and set DATABASE_URL to enable caching."
      );
    }
    return null;
  }
  if (isDbCircuitOpen()) return null;
  const db = getDb();
  if (!db) return null;
  try {
    return await fn(db);
  } catch (error) {
    openCircuit(error);
    console.warn(`[nabd] database operation failed (${error instanceof Error ? error.message : error}) — continuing without it`);
    return null;
  }
}

/**
 * Backwards-compatible `db` export.
 * Every existing `import { db } from "@/db"` keeps working; the underlying
 * instance is resolved on first use. Accessing it while the database is not
 * configured throws a descriptive error at call time (inside the caller's
 * try/catch), not at import time.
 */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Copy .env.example to .env and configure a PostgreSQL connection, " +
        "or use withDb()/getDb() to degrade gracefully without a database."
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    const real = getDb();
    if (!real) throw new DatabaseNotConfiguredError();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

/** Human-readable diagnostics used by /api/health. */
export async function dbStatus(): Promise<DbStatus> {
  const desc = describeDatabaseUrl();
  const base: DbStatus = {
    configured: desc.configured,
    urlMasked: desc.urlMasked,
    host: desc.host,
    port: desc.port,
    database: desc.database,
    reachable: false,
    tablesReady: null,
    lastError: g.__nabdDbLastError ?? null,
    hint: null,
  };
  if (!desc.configured) {
    return { ...base, hint: "أنشئ ملف ‎.env واضبط DATABASE_URL (انسخ ‎.env.example). التطبيق يعمل بدونه لكن بدون تخزين مؤقت." };
  }
  const pool = getPool();
  if (!pool) return base;
  const client = await pool.connect().catch((error: unknown) => {
    base.lastError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return null;
  });
  if (!client) {
    return {
      ...base,
      hint: `تعذر الاتصال بـ PostgreSQL على ${desc.host}:${desc.port}/${desc.database ?? "-"}. تأكد من تشغيل الخدمة ومن صحة كلمة المرور.`,
    };
  }
  try {
    await client.query("select 1");
    base.reachable = true;
    const res = await client.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'"
    );
    base.tablesReady = (res.rows[0]?.n ?? 0) >= 5;
    if (!base.tablesReady) {
      base.hint = "الاتصال يعمل لكن جداول التطبيق غير منشأة. شغّل: npx drizzle-kit push";
    }
    return base;
  } catch (error) {
    base.lastError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ...base, hint: "قاعدة البيانات متصلة لكن فشل الاستعلام التشخيصي." };
  } finally {
    client.release();
  }
}

/** Legacy export kept for compatibility. */
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const real = getPool();
    if (!real) throw new DatabaseNotConfiguredError();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
