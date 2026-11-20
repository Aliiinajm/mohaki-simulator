import { NextRequest } from "next/server";
import { autocomplete } from "@/lib/chem/sources";
import { arabicSuggestions, hasArabic } from "@/lib/chem/arabic";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  if (q.length < 1) return Response.json({ suggestions: [] });
  const out: { label: string; value: string; source: string }[] = [];
  if (hasArabic(q)) {
    arabicSuggestions(q).forEach((s) => out.push({ ...s, source: "قاموس عربي" }));
  } else if (q.length >= 2) {
    const list = await autocomplete(q, 10);
    const seen = new Set<string>();
    for (const term of list) {
      const k = term.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ label: term, value: term, source: "PubChem" });
    }
  }
  return Response.json({ suggestions: out });
}
