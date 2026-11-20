import { dbStatus } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness diagnostics.
 * Always answers 200 while the Node process is up (so a missing database never
 * masks the rest of the API), and reports each dependency in detail.
 */
export async function GET() {
  const database = await dbStatus();

  return Response.json({
    ok: true,
    app: "محاكي نبض",
    env: process.env.NODE_ENV ?? null,
    database,
    optionalKeys: {
      CHEMSPIDER_API_KEY: Boolean(process.env.CHEMSPIDER_API_KEY),
      IBM_RXN_API_KEY: Boolean(process.env.IBM_RXN_API_KEY),
      IBM_RXN_PROJECT_ID: Boolean(process.env.IBM_RXN_PROJECT_ID),
    },
    hints: {
      chemistry: "PubChem و NCI CACTUS يعملان بدون مفاتيح. المفاتيح الاختيارية تُفعّل ChemSpider و IBM RXN فقط.",
      db: database.configured
        ? database.reachable
          ? database.tablesReady
            ? "قاعدة البيانات جاهزة."
            : "الاتصال ناجح لكن الجداول غير منشأة: npx drizzle-kit push"
          : "تعذر الاتصال بقاعدة البيانات — بقية الـ APIs تعمل بدون تخزين مؤقت."
        : "DATABASE_URL غير مضبوط — بقية الـ APIs تعمل بدون تخزين مؤقت.",
    },
  });
}
