import { withDb } from "@/db";
import { compounds } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { cacheGet, cacheSet, fetchWithTimeout, pubchemFetch } from "./http";
import { arabicToEnglish, hasArabic } from "./arabic";
import { isSingleElement, molarMass, safeParseFormula } from "./elements";
import { chemicalProfile } from "./profile";

const DATA_VERSION = 2;

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const PUG_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view";
const CACTUS = "https://cactus.nci.nih.gov/chemical/structure";

export type SourceStatus = { name: string; status: "ok" | "miss" | "error" | "skipped"; note?: string };

export type ElementInfo = {
  atomicNumber: number;
  symbol: string;
  name: string;
  atomicWeight: string;
  color: string;
  electronConfiguration: string;
  electronegativity: string;
  atomicRadius: string;
  ionizationEnergy: string;
  electronAffinity: string;
  oxidationStates: string;
  standardState: string;
  meltingPoint: string;
  boilingPoint: string;
  density: string;
  groupBlock: string;
  yearDiscovered: string;
};

export type CompoundData = {
  query: string;
  name: string;
  cid: number | null;
  smiles: string | null;
  isomericSmiles: string | null;
  formula: string | null;
  molecularWeight: number | null;
  exactMass: number | null;
  iupacName: string | null;
  inchi: string | null;
  inchiKey: string | null;
  xlogp: number | null;
  tpsa: number | null;
  charge: number | null;
  hBondDonors: number | null;
  hBondAcceptors: number | null;
  rotatableBonds: number | null;
  heavyAtoms: number | null;
  complexity: number | null;
  synonyms: string[];
  description: string | null;
  descriptionSource: string | null;
  experimental: { label: string; value: string; kind: "physical" | "chemical" }[];
  chemicalProfile: { label: string; value: string }[];
  version?: number;
  element: ElementInfo | null;
  chemspiderId: number | null;
  source: string;
  sources: SourceStatus[];
  links: { label: string; url: string }[];
  cached?: boolean;
};

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------ PubChem ------------------------------ */

const PROPS =
  "Title,MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES,ConnectivitySMILES,SMILES,IUPACName,InChI,InChIKey,XLogP,ExactMass,TPSA,Charge,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,HeavyAtomCount,Complexity";

async function pubchemProperties(query: string, asSmiles = false): Promise<Record<string, unknown> | null> {
  const trimmed = query.trim();
  let url: string;
  if (asSmiles) url = `${PUG}/compound/smiles/property/${PROPS}/JSON?smiles=${encodeURIComponent(trimmed)}`;
  else if (/^\d+$/.test(trimmed)) url = `${PUG}/compound/cid/${trimmed}/property/${PROPS}/JSON`;
  else if (/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(trimmed)) url = `${PUG}/compound/inchikey/${trimmed}/property/${PROPS}/JSON`;
  else url = `${PUG}/compound/name/${encodeURIComponent(trimmed)}/property/${PROPS}/JSON`;
  let res = await pubchemFetch(url);
  // Try as SMILES if name lookup fails and it looks like SMILES
  if (res.status === 404 && /^[A-Za-z0-9@+\-\[\]()=#\\/%.]+$/.test(trimmed)) {
    res = await pubchemFetch(`${PUG}/compound/smiles/property/${PROPS}/JSON?smiles=${encodeURIComponent(trimmed)}`);
  }
  if (!res.ok) return null;
  const json = await res.json();
  const p = json?.PropertyTable?.Properties?.[0];
  return p && p.CID ? p : null;
}

async function pubchemSynonyms(cid: number): Promise<string[]> {
  try {
    const res = await pubchemFetch(`${PUG}/compound/cid/${cid}/synonyms/JSON`, 6000);
    if (!res.ok) return [];
    const j = await res.json();
    const syn: string[] = j?.InformationList?.Information?.[0]?.Synonym || [];
    return syn.filter((s) => s.length < 60).slice(0, 15);
  } catch {
    return [];
  }
}

async function pubchemDescription(cid: number): Promise<{ text: string; source: string } | null> {
  try {
    const res = await pubchemFetch(`${PUG}/compound/cid/${cid}/description/JSON`, 6000);
    if (!res.ok) return null;
    const j = await res.json();
    const info: { Description?: string; DescriptionSourceName?: string }[] = j?.InformationList?.Information || [];
    const d = info.find((i) => i.Description);
    return d ? { text: d.Description as string, source: d.DescriptionSourceName || "PubChem" } : null;
  } catch {
    return null;
  }
}

type PugViewSection = {
  TOCHeading?: string;
  Section?: PugViewSection[];
  Information?: { Value?: { StringWithMarkup?: { String: string }[]; Number?: number[]; Unit?: string } }[];
};

const PHYSICAL_HEADINGS = new Set([
  "Physical Description", "Color/Form", "Odor", "Taste", "Boiling Point", "Melting Point", "Density", "Solubility", "Vapor Pressure", "Vapor Density",
  "Flash Point", "Autoignition Temperature", "Viscosity", "Surface Tension", "Refractive Index", "Heat of Vaporization", "Heat of Combustion", "Odor Threshold",
  "Optical Rotation", "Relative Evaporation Rate", "Critical Temperature & Pressure",
]);
const CHEMICAL_HEADINGS = new Set([
  "pH", "Dissociation Constants", "LogP", "Stability / Shelf Life", "Decomposition", "Corrosivity", "Henry's Law Constant", "Ionization Potential",
  "Polymerization", "Other Experimental Properties", "Kovats Retention Index", "LogS", "Explosive Limits and Potential", "Oxidizing Properties", "Reactivity",
]);

async function pubchemExperimental(cid: number): Promise<{ label: string; value: string; kind: "physical" | "chemical" }[]> {
  try {
    const res = await pubchemFetch(`${PUG_VIEW}/data/compound/${cid}/JSON?heading=Experimental+Properties`, 7000);
    if (!res.ok) return [];
    const j = await res.json();
    const out: { label: string; value: string; kind: "physical" | "chemical" }[] = [];
    const walk = (secs: PugViewSection[] | undefined) => {
      for (const s of secs || []) {
        const kind = s.TOCHeading && PHYSICAL_HEADINGS.has(s.TOCHeading) ? "physical" : s.TOCHeading && CHEMICAL_HEADINGS.has(s.TOCHeading) ? "chemical" : null;
        if (s.TOCHeading && kind && s.Information?.length) {
          for (const inf of s.Information) {
            const v = inf.Value;
            let str = v?.StringWithMarkup?.[0]?.String;
            if (!str && v?.Number?.length) str = `${v.Number.slice(0, 3).join(", ")} ${v.Unit || ""}`.trim();
            if (str && str.length < 260) {
              out.push({ label: s.TOCHeading, value: str, kind });
              break;
            }
          }
        }
        walk(s.Section);
      }
    };
    walk(j?.Record?.Section);
    return out;
  } catch {
    return [];
  }
}

export async function getPeriodicTable(): Promise<ElementInfo[]> {
  const cached = await cacheGet<ElementInfo[]>("periodic_table", 1000 * 60 * 60 * 24 * 365);
  if (cached) return cached;
  try {
    const res = await pubchemFetch(`${PUG}/periodictable/JSON`, 10000);
    if (!res.ok) return [];
    const j = await res.json();
    const rows: { Cell: string[] }[] = j?.Table?.Row || [];
    const els: ElementInfo[] = rows.map(({ Cell: c }) => ({
      atomicNumber: parseInt(c[0], 10),
      symbol: c[1],
      name: c[2],
      atomicWeight: c[3],
      color: c[4],
      electronConfiguration: c[5],
      electronegativity: c[6],
      atomicRadius: c[7],
      ionizationEnergy: c[8],
      electronAffinity: c[9],
      oxidationStates: c[10],
      standardState: c[11],
      meltingPoint: c[12],
      boilingPoint: c[13],
      density: c[14],
      groupBlock: c[15],
      yearDiscovered: c[16],
    }));
    if (els.length) await cacheSet("periodic_table", els);
    return els;
  } catch {
    return [];
  }
}

/* ------------------------------ CACTUS ------------------------------ */

async function cactusResolve(query: string): Promise<Partial<CompoundData> | null> {
  const enc = encodeURIComponent(query.trim());
  const get = async (rep: string) => {
    const r = await fetchWithTimeout(`${CACTUS}/${enc}/${rep}`, {}, 8000);
    if (!r.ok) throw new Error(String(r.status));
    return (await r.text()).trim().split("\n")[0];
  };
  const [smiles, formula, mw, inchikey, iupac] = await Promise.allSettled([
    get("smiles"),
    get("formula"),
    get("mw"),
    get("stdinchikey"),
    get("iupac_name"),
  ]);
  if (smiles.status !== "fulfilled" || !smiles.value || smiles.value.startsWith("<")) return null;
  const val = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
  return {
    smiles: smiles.value,
    isomericSmiles: smiles.value,
    formula: val(formula),
    molecularWeight: num(val(mw)),
    inchiKey: (val(inchikey) || "").replace("InChIKey=", "") || null,
    iupacName: val(iupac),
  };
}

/* ------------------------------ ChemSpider (RSC) ------------------------------ */

async function chemspiderLookup(name: string): Promise<{ id: number; smiles?: string; formula?: string; mw?: number; commonName?: string } | null> {
  const key = process.env.CHEMSPIDER_API_KEY;
  if (!key) return null;
  const base = "https://api.rsc.org/compounds/v1";
  const headers = { apikey: key, "Content-Type": "application/json", Accept: "application/json" };
  const r = await fetchWithTimeout(`${base}/filter/name`, { method: "POST", headers, body: JSON.stringify({ name }) }, 8000);
  if (!r.ok) return null;
  const { queryId } = await r.json();
  for (let i = 0; i < 6; i++) {
    const s = await fetchWithTimeout(`${base}/filter/${queryId}/status`, { headers }, 5000);
    const st = await s.json();
    if (st.status === "Complete") break;
    if (st.status === "Failed" || st.status === "Suspended") return null;
    await new Promise((res) => setTimeout(res, 400));
  }
  const rr = await fetchWithTimeout(`${base}/filter/${queryId}/results`, { headers }, 6000);
  const ids: number[] = (await rr.json())?.results || [];
  if (!ids.length) return null;
  const d = await fetchWithTimeout(`${base}/records/${ids[0]}/details?fields=SMILES,Formula,MolecularWeight,CommonName`, { headers }, 6000);
  if (!d.ok) return { id: ids[0] };
  const det = await d.json();
  return {
    id: ids[0],
    smiles: det.smiles,
    formula: (det.formula || "").replace(/[_{}]/g, ""),
    mw: det.molecularWeight,
    commonName: det.commonName,
  };
}

/* ------------------------------ Orchestrator ------------------------------ */

function buildLinks(d: CompoundData): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  if (d.cid) links.push({ label: "PubChem", url: `https://pubchem.ncbi.nlm.nih.gov/compound/${d.cid}` });
  links.push({
    label: "ChemSpider",
    url: d.chemspiderId
      ? `https://www.chemspider.com/Chemical-Structure.${d.chemspiderId}.html`
      : `https://www.chemspider.com/Search.aspx?q=${encodeURIComponent(d.inchiKey || d.name)}`,
  });
  if (d.inchiKey) {
    links.push({ label: "NIST WebBook", url: `https://webbook.nist.gov/cgi/cbook.cgi?InChI=${encodeURIComponent(d.inchiKey)}` });
    links.push({ label: "ChEMBL", url: `https://www.ebi.ac.uk/chembl/g/#search_results/all/query=${d.inchiKey}` });
    links.push({ label: "ChEBI", url: `https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=${d.inchiKey}` });
  }
  links.push({ label: "NCI CACTUS", url: `${CACTUS}/${encodeURIComponent(d.smiles || d.name)}/image` });
  links.push({ label: "Wikipedia", url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(d.name)}` });
  return links;
}

export function normalizeQuery(q: string): string {
  const trimmed = q.trim();
  if (hasArabic(trimmed)) return arabicToEnglish(trimmed) || trimmed;
  return trimmed;
}

export async function resolveCompound(rawQuery: string, opts: { full?: boolean; smiles?: boolean } = {}): Promise<CompoundData | null> {
  const query = opts.smiles ? rawQuery.trim() : normalizeQuery(rawQuery);
  if (!query || query.length > 300) return null;
  const queryKey = (opts.smiles ? "smiles:" : "") + query.toLowerCase();

  // 1) Cache — silently skipped when the database is unavailable or the tables
  //    are missing; the lookup then goes straight to PubChem/CACTUS.
  const rows = await withDb((d) => d.select().from(compounds).where(eq(compounds.queryKey, queryKey)).limit(1));
  if (rows && rows.length && (rows[0].data as CompoundData).version === DATA_VERSION) {
    withDb((d) => d.update(compounds).set({ hits: sql`${compounds.hits} + 1` }).where(eq(compounds.id, rows[0].id)));
    return { ...(rows[0].data as CompoundData), cached: true };
  }

  const sources: SourceStatus[] = [];
  const data: CompoundData = {
    query: rawQuery,
    name: query,
    cid: null,
    smiles: null,
    isomericSmiles: null,
    formula: null,
    molecularWeight: null,
    exactMass: null,
    iupacName: null,
    inchi: null,
    inchiKey: null,
    xlogp: null,
    tpsa: null,
    charge: null,
    hBondDonors: null,
    hBondAcceptors: null,
    rotatableBonds: null,
    heavyAtoms: null,
    complexity: null,
    synonyms: [],
    description: null,
    descriptionSource: null,
    experimental: [],
    chemicalProfile: [],
    version: DATA_VERSION,
    element: null,
    chemspiderId: null,
    source: "",
    sources,
    links: [],
  };

  // 2) PubChem
  try {
    const p = await pubchemProperties(query, !!opts.smiles);
    if (p) {
      data.cid = num(p.CID);
      data.name = (p.Title as string) || query;
      data.formula = (p.MolecularFormula as string) || null;
      data.molecularWeight = num(p.MolecularWeight);
      data.smiles = ((p.CanonicalSMILES || p.ConnectivitySMILES || p.SMILES) as string) || null;
      data.isomericSmiles = ((p.IsomericSMILES || p.SMILES || data.smiles) as string) || null;
      data.iupacName = (p.IUPACName as string) || null;
      data.inchi = (p.InChI as string) || null;
      data.inchiKey = (p.InChIKey as string) || null;
      data.xlogp = num(p.XLogP);
      data.exactMass = num(p.ExactMass);
      data.tpsa = num(p.TPSA);
      data.charge = num(p.Charge);
      data.hBondDonors = num(p.HBondDonorCount);
      data.hBondAcceptors = num(p.HBondAcceptorCount);
      data.rotatableBonds = num(p.RotatableBondCount);
      data.heavyAtoms = num(p.HeavyAtomCount);
      data.complexity = num(p.Complexity);
      data.source = "PubChem";
      sources.push({ name: "PubChem PUG REST", status: "ok" });
    } else sources.push({ name: "PubChem PUG REST", status: "miss" });
  } catch (e) {
    sources.push({ name: "PubChem PUG REST", status: "error", note: (e as Error).name === "AbortError" ? "timeout" : (e as Error).message });
  }

  // 3) CACTUS fallback
  if (!data.smiles) {
    try {
      const c = await cactusResolve(query);
      if (c) {
        Object.assign(data, Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined)));
        data.source = "NCI CACTUS";
        sources.push({ name: "NCI CACTUS", status: "ok" });
      } else sources.push({ name: "NCI CACTUS", status: "miss" });
    } catch (e) {
      sources.push({ name: "NCI CACTUS", status: "error", note: (e as Error).message });
    }
  } else sources.push({ name: "NCI CACTUS", status: "skipped", note: "not needed" });

  // 4) ChemSpider (enrichment / last fallback)
  if (process.env.CHEMSPIDER_API_KEY) {
    try {
      const cs = await chemspiderLookup(data.name);
      if (cs) {
        data.chemspiderId = cs.id;
        if (!data.smiles && cs.smiles) {
          data.smiles = cs.smiles;
          data.isomericSmiles = cs.smiles;
          data.formula = data.formula || cs.formula || null;
          data.molecularWeight = data.molecularWeight || cs.mw || null;
          data.name = cs.commonName || data.name;
          data.source = "ChemSpider";
        }
        sources.push({ name: "ChemSpider (RSC)", status: "ok" });
      } else sources.push({ name: "ChemSpider (RSC)", status: "miss" });
    } catch (e) {
      sources.push({ name: "ChemSpider (RSC)", status: "error", note: (e as Error).message });
    }
  } else sources.push({ name: "ChemSpider (RSC)", status: "skipped", note: "CHEMSPIDER_API_KEY غير مضبوط" });

  if (!data.smiles && !data.formula) return null;

  if (!data.molecularWeight && data.formula) {
    const comp = safeParseFormula(data.formula);
    if (comp) data.molecularWeight = molarMass(comp);
  }

  // 5) Enrichment (parallel, non-fatal)
  if (data.cid && opts.full !== false) {
    const [syn, desc, exp] = await Promise.all([pubchemSynonyms(data.cid), pubchemDescription(data.cid), pubchemExperimental(data.cid)]);
    data.synonyms = syn;
    if (desc) {
      data.description = desc.text;
      data.descriptionSource = desc.source;
    }
    data.experimental = exp;
  }
  const comp = safeParseFormula(data.formula);
  const el = comp ? isSingleElement(comp) : null;
  if (el && comp && comp[el] <= 8 && !(data.charge && data.charge !== 0)) {
    const table = await getPeriodicTable();
    data.element = table.find((t) => t.symbol === el) || null;
  }

  data.links = buildLinks(data);
  try {
    data.chemicalProfile = chemicalProfile({ name: data.name, formula: data.formula, smiles: data.smiles, charge: data.charge, xlogp: data.xlogp, tpsa: data.tpsa, mw: data.molecularWeight });
  } catch {
    data.chemicalProfile = [];
  }

  await withDb(async (d) => {
    await d
      .insert(compounds)
      .values({
        queryKey,
        cid: data.cid,
        name: data.name,
        smiles: data.smiles,
        formula: data.formula,
        molecularWeight: data.molecularWeight,
        source: data.source || "unknown",
        data,
      })
      .onConflictDoUpdate({ target: compounds.queryKey, set: { cid: data.cid, name: data.name, smiles: data.smiles, formula: data.formula, molecularWeight: data.molecularWeight, source: data.source || "unknown", data } });
  });
  return data;
}

/* ------------------------------ Autocomplete ------------------------------ */

export async function autocomplete(q: string, limit = 10): Promise<string[]> {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const key = `ac:${term}:${limit}`;
  const cached = await cacheGet<string[]>(key, 1000 * 60 * 60 * 24 * 7);
  if (cached) return cached;
  try {
    const res = await pubchemFetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(term)}/json?limit=${limit}`,
      5000
    );
    if (!res.ok) return [];
    const j = await res.json();
    const list: string[] = j?.dictionary_terms?.compound || [];
    await cacheSet(key, list);
    return list;
  } catch {
    return [];
  }
}

/* ------------------------------ 3D / 2D SDF ------------------------------ */

export async function getSdf(cid: number): Promise<{ sdf: string; dim: "3d" | "2d" } | null> {
  const key = `sdf:${cid}`;
  const cached = await cacheGet<{ sdf: string; dim: "3d" | "2d" }>(key, 1000 * 60 * 60 * 24 * 365);
  if (cached) return cached;
  for (const dim of ["3d", "2d"] as const) {
    try {
      const res = await pubchemFetch(`${PUG}/compound/cid/${cid}/SDF?record_type=${dim}`, 10000);
      if (res.ok) {
        const sdf = await res.text();
        const out = { sdf, dim };
        await cacheSet(key, out);
        return out;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}
