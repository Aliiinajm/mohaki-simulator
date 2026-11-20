import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, isDbConfigured, withDb } from "@/db";
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

  const id = Number(body.analysisId);
  const sp = treeById(String(body.speciesId || ""));

  if (!Number.isSafeInteger(id) || id <= 0 || !sp) {
    return Response.json(
      {
        error: "بيانات ناقصة: التحليل أو نوع الشجرة",
        hint: "اختر نوع شجرة من القائمة ثم اضغط تم",
      },
      { status: 400 }
    );
  }

  const density =
    body.density === "dense" || body.density === "sparse" ? body.density : "normal";

  let dbError: string | null = null;
  let rows: Array<typeof agriAnalyses.$inferSelect> | null = null;

  if (isDbConfigured()) {
    try {
      rows = await db
        .select()
        .from(agriAnalyses)
        .where(eq(agriAnalyses.id, id))
        .limit(1);
    } catch (e) {
      dbError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error("[/api/agri/plant] DB error:", dbError);
    }
  }

  const memoryRecord = getAnalysis(id);
  const record =
    rows && rows.length > 0
      ? { grid: rows[0].grid, meta: rows[0].meta as AnalysisMeta }
      : memoryRecord;

  if (!record) {
    return Response.json(
      {
        error: dbError
          ? `تعذر قراءة التحليل من قاعدة البيانات (${dbError})`
          : "التحليل غير موجود أو انتهت صلاحيته، أعد تحليل المنطقة",
        hint: "اضغط «تحليل المنطقة» مرة أخرى قبل اختيار الشجرة.",
        debug: {
          analysisId: id,
          dbConfigured: isDbConfigured(),
          dbRowsFound: rows ? rows.length : null,
          memoryFound: Boolean(memoryRecord),
          dbError,
        },
      },
      { status: 404 }
    );
  }

  try {
    const rawTol = Number(body.tolerance);
    const tol = Number.isFinite(rawTol) ? rawTol : 0.15;
   const plan = planTrees(
  typeof record.grid === "string" ? record.grid : String(record.grid ?? ""),
  record.meta,
  sp.id,
  density,
  id,
  tol
);
    const { positions, ...stats } = plan;

    await withDb(async (d) => {
      await d.insert(agriPlans).values({
        analysisId: id,
        species: sp.id,
        trees: plan.trees,
        stats,
      });
    });

    return Response.json({ ...stats, positions });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[/api/agri/plant] Plan error:", message);
    return Response.json(
      { error: "فشل توزيع الأشجار", detail: message },
      { status: 500 }
    );
  }
}