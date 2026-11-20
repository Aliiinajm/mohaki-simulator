import { NextRequest } from "next/server";
import { resolveCompound } from "@/lib/chem/sources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const smiles = (req.nextUrl.searchParams.get("smiles") || "").trim();
  const q = smiles || (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return Response.json({ error: "يرجى إدخال اسم المركب" }, { status: 400 });
  try {
    const data = await resolveCompound(q, { smiles: !!smiles });
    if (!data) return Response.json({ error: `لم يتم العثور على "${q}" في PubChem أو NCI CACTUS أو ChemSpider.` }, { status: 404 });
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: "خطأ في الخادم أثناء جلب المركب", detail: (e as Error).message }, { status: 500 });
  }
}
