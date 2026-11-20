import { cacheGet, cacheSet, fetchWithTimeout } from "./http";

/**
 * IBM RXN for Chemistry — forward reaction prediction with async polling.
 * Requires IBM_RXN_API_KEY in .env. Optional: IBM_RXN_PROJECT_ID, IBM_RXN_BASE_URL.
 */
const BASE = () => (process.env.IBM_RXN_BASE_URL || "https://rxn.app.accelerate.science") + "/rxn/api/api/v1";

export const ibmRxnEnabled = () => !!process.env.IBM_RXN_API_KEY;

function headers() {
  return { "Content-Type": "application/json", Authorization: process.env.IBM_RXN_API_KEY as string };
}

async function getProjectId(): Promise<string> {
  if (process.env.IBM_RXN_PROJECT_ID) return process.env.IBM_RXN_PROJECT_ID;
  const cached = await cacheGet<string>("ibm_rxn_project", 1000 * 60 * 60 * 24 * 365);
  if (cached) return cached;
  const res = await fetchWithTimeout(`${BASE()}/projects`, { method: "POST", headers: headers(), body: JSON.stringify({ name: `nabd-simulator-${Date.now()}`, invitations: [] }) }, 10000);
  if (!res.ok) throw new Error(`IBM RXN project creation failed (${res.status})`);
  const j = await res.json();
  const id = j?.payload?.id;
  if (!id) throw new Error("IBM RXN: no project id");
  await cacheSet("ibm_rxn_project", id);
  return id;
}

export type RxnPrediction = { productSmiles: string[]; confidence: number | null; reactionSmiles: string };

export async function predictWithIbmRxn(reactantSmiles: string[], { maxPolls = 15, intervalMs = 2000 } = {}): Promise<RxnPrediction | null> {
  if (!ibmRxnEnabled()) return null;
  const projectId = await getProjectId();
  const precursors = reactantSmiles.join(".");
  const start = await fetchWithTimeout(
    `${BASE()}/predictions/pr`,
    { method: "POST", headers: headers(), body: JSON.stringify({ projectId, reactants: precursors, aiModel: "2020-08-10" }) },
    10000
  );
  if (!start.ok) throw new Error(`IBM RXN prediction request failed (${start.status})`);
  const sj = await start.json();
  const predictionId = sj?.payload?.id;
  if (!predictionId) throw new Error("IBM RXN: missing prediction id");

  // Async polling
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetchWithTimeout(`${BASE()}/predictions/${predictionId}`, { headers: headers() }, 8000);
    if (!res.ok) continue;
    const j = await res.json();
    const payload = j?.payload;
    const status: string = payload?.status || "";
    const attempt = payload?.attempts?.[0];
    if (attempt?.smiles) {
      const rxn: string = attempt.smiles;
      const productPart = rxn.split(">>")[1] || "";
      return { productSmiles: productPart.split(".").filter(Boolean), confidence: attempt.confidence ?? null, reactionSmiles: rxn };
    }
    if (status === "ERROR" || status === "FAILED") throw new Error("IBM RXN prediction failed");
  }
  throw new Error("IBM RXN polling timeout");
}
