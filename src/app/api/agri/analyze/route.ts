import { NextRequest } from "next/server";
import { withDb } from "@/db";
import { agriAnalyses } from "@/db/schema";
import { analyzeArea, bboxMetrics, type BBox } from "@/lib/agri/analyze";
import { memoryAnalyses, rememberAnalysis } from "@/lib/agri/store";

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
    const analysisId = Date.now();

    // Persist when possible; fallback to in-memory store if DB is unavailable.
    const row = await withDb(async (d) => {
      const [r] = await d
        .insert(agriAnalyses)
        .values({ id: analysisId, bbox: b, grid, meta })
        .returning({ id: agriAnalyses.id });
      return r;
    });

   const id = row?.id ?? analysisId;
    return Response.json({ id, grid, meta, persisted: Boolean(row) });
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