import { NextRequest } from "next/server";
import { runReaction } from "@/lib/chem/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ status: "error", reason: "JSON غير صالح" }, { status: 400 });
  }
  const r1 = String(body.reactant1 || "").trim();
  const r2 = String(body.reactant2 || "").trim();
  const moles1 = Number(body.moles1);
  const moles2 = Number(body.moles2);
  const temperature = Number(body.temperature);
  if (!r1 || !r2) return Response.json({ status: "error", reason: "يجب إدخال مركبين" }, { status: 400 });
  if (!(moles1 > 0) || !(moles2 > 0) || moles1 > 1e6 || moles2 > 1e6) return Response.json({ status: "error", reason: "عدد المولات يجب أن يكون أكبر من صفر" }, { status: 400 });
  if (!Number.isFinite(temperature) || temperature < -273.15 || temperature > 5000) return Response.json({ status: "error", reason: "درجة حرارة غير صالحة (-273 إلى 5000°C)" }, { status: 400 });
  try {
    const result = await runReaction({
      reactant1: r1,
      reactant2: r2,
      moles1,
      moles2,
      temperature,
      catalyst: String(body.catalyst || "none"),
      ignition: !!body.ignition,
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ status: "error", reason: "خطأ داخلي في محرك التفاعل", detail: (e as Error).message }, { status: 500 });
  }
}
