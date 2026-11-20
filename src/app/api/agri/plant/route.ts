import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { isDbConfigured, withDb, getDb } from "@/db";
import { agriAnalyses, agriPlans } from "@/db/schema";
import { planTrees, type AnalysisMeta } from "@/lib/agri/analyze";
import { getAnalysis } from "@/lib/agri/store";
import { treeById } from "@/lib/agri/trees";

export const dynamic = "force-dynamic";

interface PlantRequestBody {
  analysisId?: number | string;
  speciesId?: string;
  density?: string;
  tolerance?: number;
}

export async function POST(req: NextRequest) {
  let body: PlantRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "طلب غير صالح: توقع JSON" }, { status: 400 });
  }

  // analysisId arrives as a number from the client (JSON doesn't transmit BigInt).
  const rawId = body.analysisId;
  const id =
    typeof rawId === "number" && Number.isFinite(rawId) && Number.isInteger(rawId)
      ? rawId
      : typeof rawId === "string" && rawId.trim().length > 0
        ? Number(rawId.trim())
        : NaN;
  const sp = treeById(String(body.speciesId || ""));

  if (!Number.isSafeInteger(id) || id <= 0 || !sp) {
    return Response.json(
      {
        error: "بيانات ناقصة: التحليل غير صحيح أو نوع الشجرة غير معروف",
        hint: "اختر نوع شجرة من القائمة ثم اضغط «تم»، وتأكد من أن التحليل تم بنجاح.",
        debug: { receivedAnalysisId: rawId, resolvedId: id, speciesId: body.speciesId, speciesFound: Boolean(sp) },
      },
      { status: 400 }
    );
  }

  const density =
    body.density === "dense" || body.density === "sparse" ? body.density : "normal";

  // ---- Read analysis record (DB first, then memory) -------------------------
  let dbError: string | null = null;
  let dbGrid: string | null = null;
  let dbMeta: AnalysisMeta | null = null;

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(agriAnalyses)
          .where(eq(agriAnalyses.id, id))
          .limit(1);
        if (rows.length > 0) {
          dbGrid = typeof rows[0].grid === "string" ? rows[0].grid : String(rows[0].grid ?? "");
          dbMeta = rows[0].meta as AnalysisMeta;
        }
      }
    } catch (e) {
      dbError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error("[/api/agri/plant] DB read error:", dbError);
    }
  }

  const memoryRecord = getAnalysis(id);

  // Decide which record to use: DB wins if available, else memory.
  let recordGrid: string;
  let recordMeta: AnalysisMeta;

  if (dbGrid !== null && dbMeta !== null) {
    recordGrid = dbGrid;
    recordMeta = dbMeta;
    console.info(`[/api/agri/plant] قرأت التحليل#[${id}] من قاعدة البيانات`);
  } else if (memoryRecord) {
    recordGrid = memoryRecord.grid;
    recordMeta = memoryRecord.meta;
    console.info(`[/api/agri/plant] قرأت التحليل#[${id}] من الذاكرة المؤقتة`);
  } else {
    return Response.json(
      {
        error: "التحليل غير موجود — أعد تحليل المنطقة قبل اختيار الشجرة",
        hint: "اضغط «تحليل المنطقة» مرة أخرى، ثم اختر نوع الشجرة واضغط «تم».",
        debug: {
          analysisId: id,
          dbConfigured: isDbConfigured(),
          dbReadAttempted: dbGrid !== null || dbMeta !== null || dbError !== null,
          dbGridPresent: dbGrid !== null,
          dbMetaPresent: dbMeta !== null,
          memoryFound: Boolean(memoryRecord),
          dbError,
        },
      },
      { status: 404 }
    );
  }

  // Final guarantee: grid is a non-empty string before calling planTrees.
  if (typeof recordGrid !== "string" || recordGrid.length === 0) {
    return Response.json(
      {
        error: "بيانات الشبكة غير صالحة داخل سجل التحليل",
        hint: "أعد تحليل المنطقة من البداية.",
        debug: { gridType: typeof recordGrid, gridLength: recordGrid ? recordGrid.length : null },
      },
      { status: 500 }
    );
  }

  // ---- Run planting plan ----------------------------------------------------
  try {
    const rawTol = Number(body.tolerance);
    const tol = Number.isFinite(rawTol) ? rawTol : 0.15;
    const plan = planTrees(recordGrid, recordMeta, sp.id, density, id, tol);
    const { positions, ...stats } = plan;

    // Persist plan to DB when possible; never fail the request if DB is down.
    if (isDbConfigured()) {
      try {
        await withDb(async (d) => {
          await d.insert(agriPlans).values({
            analysisId: id,
            species: sp.id,
            trees: plan.trees,
            stats,
          });
        });
        console.info(`[/api/agri/plant] حفظ خطة#[${id}] في قاعدة البيانات (${plan.trees} شجرة)`);
      } catch (dbErr) {
        console.error("[/api/agri/plant] فشل حفظ الخطة في قاعدة البيانات (لن يتأثر النتيجة):", dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }

    return Response.json({ ...stats, positions });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[/api/agri/plant] خطأ في خطة التوزيع:", message);
    return Response.json(
      { error: "فشل توزيع الأشجار", detail: message },
      { status: 500 }
    );
  }
}
