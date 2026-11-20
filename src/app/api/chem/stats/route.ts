import { isDbConfigured, withDb } from "@/db";
import { compounds, reactions } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await withDb(async (d) => {
      const [cc] = await d.select({ n: sql<number>`count(*)::int` }).from(compounds);
      const [rc] = await d.select({ n: sql<number>`count(*)::int` }).from(reactions);
      const popular = await d
        .select({ name: compounds.name, formula: compounds.formula, hits: compounds.hits })
        .from(compounds)
        .orderBy(desc(compounds.hits))
        .limit(8);
      const recent = await d
        .select({ equation: reactions.equation, status: reactions.status, createdAt: reactions.createdAt })
        .from(reactions)
        .orderBy(desc(reactions.createdAt))
        .limit(6);
      return { compounds: cc?.n ?? 0, reactions: rc?.n ?? 0, popular, recent };
    });
    // Same response shape as before; extra `database` field is additive.
    return Response.json(
      stats ?? { compounds: 0, reactions: 0, popular: [], recent: [], database: { available: false, configured: isDbConfigured() } }
    );
  } catch (e) {
    return Response.json({ compounds: 0, reactions: 0, popular: [], recent: [], error: (e as Error).message }, { status: 200 });
  }
}
