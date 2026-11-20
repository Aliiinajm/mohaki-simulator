import { NextRequest } from "next/server";
import { getSdf } from "@/lib/chem/sources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cid = parseInt(req.nextUrl.searchParams.get("cid") || "", 10);
  if (!Number.isFinite(cid) || cid <= 0) return Response.json({ error: "cid غير صالح" }, { status: 400 });
  const r = await getSdf(cid);
  if (!r) return Response.json({ error: "لا يتوفر نموذج ثلاثي الأبعاد" }, { status: 404 });
  return Response.json(r);
}
