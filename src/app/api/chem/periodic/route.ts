import { getPeriodicTable } from "@/lib/chem/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const els = await getPeriodicTable();
  return Response.json({ elements: els });
}
