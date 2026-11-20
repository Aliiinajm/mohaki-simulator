import { NextRequest } from "next/server";
import { withDb } from "@/db";
import { agriAnalyses } from "@/db/schema";
import { analyzeArea, bboxMetrics, type BBox } from "@/lib/agri/analyze";
import { memoryAnalyses, rememberAnalysis } from "@/lib/agri/store";
import { isDbConfigured } from "@/db";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  let b: BBox;
  try {
    const body = await req.json();
    b = body.bbox;
  } catch {
    return Response.json({ error: "طلب غير صالح: توقع JSON يحتوي bbox" }, { status: 400 });
  }
  const ok =
    b &&
    [b.south, b.west, b.north, b.east].every((v) => Number.isFinite(v)) &&
    b.north > b.south &&
    b.east > b.west &&
    Math.abs(b.north) < 85;
  if (!ok) {
    return Response.json(
      { error: "حدود المنطقة غير صالحة", hint: "ارسم مستطيلاً على الخريطة ثم أعد المحاولة" },
      { status: 400 }
    );
  }
  const { area } = bboxMetrics(b);
  if (area < 300) {
    return Response.json({ error: "المنطقة صغيرة جداً (الحد الأدنى 300 م²)" }, { status: 400 });
  }
  if (area > 2_000_000) {
    return Response.json(
      { error: "المنطقة كبيرة جداً (الحد الأقصى 2 كم²). صغّر المستطيل." },
      { status: 400 }
    );
  }

  try {
    const { grid, meta } = await analyzeArea(b);

    // Use a bigint-compatible numeric id. Date.now() is ~1.7e12, safely within
    // JS number precision and PostgreSQL bigint range.
    const analysisId = Math.floor(Date.now());

    let row: (typeof agriAnalyses.$inferSelect) | null = null;
    let usedDb = false;

    if (isDbConfigured()) {
      try {
        const r = await withDb(async (d) => {
          const [inserted] = await d
            .insert(agriAnalyses)
            .values({ id: analysisId, bbox: b, grid: String(grid), meta })
            .returning();
          return inserted ?? null;
        });
        if (r) {
          row = r;
          usedDb = true;
        }
      } catch (dbErr) {
        console.error("[api/agri/analyze] DB insert failed, falling back to memory:", dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }

    // Fallback to in-memory store if DB insert failed or DB is not configured.
    let id: number;
    if (row) {
      id = Number(row.id);
    } else {
      id = rememberAnalysis(String(grid), meta);
      console.info(`[api/agri/analyze] تحليل#${id} تم حفظه في الذاكرة المؤقتة (قاعدة البيانات غير متاحة أو فشلت)`);
    }

    return Response.json({ id, grid, meta, persisted: usedDb });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    const external = /fetch|network|timeout|abort|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(msg);
    return Response.json(
      {
        error: "فشل تحليل المنطقة",
        detail: msg,
        hint: external
          ? "تعذر الوصول إلى مصادر البيانات الخارجية (صور الأقمار الصناعية Esri أو OpenStreetMap). تحقق من اتصال الإنترنت أو أعد المحاولة."
          : "أعد رسم منطقة أصغر وحاول مرة أخرى.",
      },
      { status: 502 }
    );
  }
}

/** Exposed for diagnostics: shows whether analyses are being persisted. */
export async function GET() {
  return Response.json({ memoryAnalyses: memoryAnalyses() });
}
