import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { withDb } from "@/db";
import { agriAnalyses, agriPlans } from "@/db/schema";
import { planTrees, type AnalysisMeta } from "@/lib/agri/analyze";
import { getAnalysis } from "@/lib/agri/store";
import { treeById } from "@/lib/agri/trees";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { analysisId?: number; speciesId?: string; density?: string; tolerance?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "طلب غير صالح: توقع JSON" }, { status: 400 });
  }
  const id = Number(body.analysisId);
  const sp = treeById(String(body.speciesId || ""));
  if (!Number.isFinite(id) || !sp)
    return Response.json({ error: "بيانات ناقصة: التحليل أو نوع الشجرة", hint: "اختر نوع شجرة من القائمة ثم اضغط تم" }, { status: 400 });
  const density = body.density === "dense" || body.density === "sparse" ? body.density : "normal";

  // Database first, then the in-memory fallback for databases that are absent
  // or whose tables have not been created (npx drizzle-kit push).
  const rows = await withDb((d) => d.select().from(agriAnalyses).where(eq(agriAnalyses.id, id)).limit(1));
  const record = rows && rows.length ? { grid: rows[0].grid, meta: rows[0].meta as AnalysisMeta } : getAnalysis(id);
  if (!record)
    return Response.json(
      { error: "التحليل غير موجود أو انتهت صلاحيته، أعد تحليل المنطقة", hint: "اضغط «تحليل المنطقة» مرة أخرى قبل اختيار الشجرة." },
      { status: 404 }
    );

  try {
    const tol = Number.isFinite(Number(body.tolerance)) ? Number(body.tolerance) : 0.15;
    const plan = planTrees(record.grid, record.meta, sp.id, density, id, tol);
    const { positions, ...stats } = plan;
    await withDb(async (d) => {
      await d.insert(agriPlans).values({ analysisId: id, species: sp.id, trees: plan.trees, stats });
    });
    return Response.json({ ...stats, positions });
  } catch (e) {
    return Response.json({ error: "فشل توزيع الأشجار", detail: (e as Error).message }, { status: 500 });
  }
}
