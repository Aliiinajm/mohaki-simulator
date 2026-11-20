import { NextRequest } from "next/server";
import { fetchWithTimeout } from "@/lib/chem/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 120);
  if (q.length < 2) return Response.json({ results: [] });
  try {
    const r = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=ar,en`,
      { headers: { "User-Agent": "NabdSimulator/1.0 (agri map search)" } },
      8000
    );
    if (!r.ok) return Response.json({ results: [] });
    const j: { display_name: string; lat: string; lon: string; boundingbox: string[] }[] = await r.json();
    return Response.json({
      results: j.map((x) => ({ name: x.display_name, lat: +x.lat, lon: +x.lon, bbox: x.boundingbox.map(Number) })),
    });
  } catch (e) {
    return Response.json({ results: [], error: "تعذر الوصول لخدمة البحث الجغرافي (Nominatim)", detail: (e as Error).message }, { status: 200 });
  }
}
