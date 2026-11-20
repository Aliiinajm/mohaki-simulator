import { createHash } from "crypto";
import { withDb } from "@/db";
import { reactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { balanceEquation } from "./balance";
import { compositionKey, isOrganic, molarMass, safeParseFormula, type Composition } from "./elements";
import { resolveCompound, type CompoundData } from "./sources";
import { identify, predict, type Conditions, type Reactant } from "./rules";
import { enthalpyOfFormation, isSoluble, makeSalt, mol, type Species, type State } from "./species";
import { ibmRxnEnabled, predictWithIbmRxn } from "./ibmRxn";
import { smilesToComp } from "./organic";

export type ReactionInput = {
  reactant1: string;
  reactant2: string;
  moles1: number;
  moles2: number;
  temperature: number;
  catalyst: string;
  ignition: boolean;
};

type ReactantOut = {
  query: string;
  name: string;
  cid: number | null;
  formula: string;
  displayFormula: string;
  smiles: string | null;
  state: State | null;
  coefficient: number | null;
  molarMass: number;
  molesInput: number;
  massInput: number;
  consumedMoles: number;
  remainingMoles: number;
  remainingMass: number;
  role: "limiting" | "excess" | "none";
};

type ProductOut = {
  name: string;
  nameAr: string;
  formula: string;
  smiles: string;
  state: State;
  note?: string;
  coefficient: number;
  molarMass: number;
  moles: number;
  mass: number;
};

export type ReactionResult = {
  status: "success" | "no_reaction" | "error";
  reason?: string;
  requirement?: string;
  reactionType?: string;
  reactionTypeAr?: string;
  description?: string;
  observations: string[];
  notes: string[];
  equation: { text: string; latex: string } | null;
  reactants: ReactantOut[];
  products: ProductOut[];
  expectedProducts: { formula: string; nameAr: string; smiles: string }[];
  limitingReactant: string | null;
  extent: number;
  thermo: { deltaH: number; heat: number; exothermic: boolean } | null;
  kinetics: { ea: number; relativeRate: number } | null;
  engine: "rules" | "ibm-rxn" | "none";
  confidence?: number | null;
  conditions: Conditions;
  cached: boolean;
  computedAt: string;
};

const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

function displayFormulaFor(r: Reactant): { formula: string; state: State | null } {
  const id = identify(r);
  switch (id.k) {
    case "metal":
      return { formula: id.sym, state: "s" };
    case "diatomic":
      return { formula: `${id.sym}2`, state: id.sym === "Br" ? "l" : id.sym === "I" ? "s" : "g" };
    case "nonmetal":
      return { formula: id.sym, state: "s" };
    case "water":
      return { formula: "H2O", state: "l" };
    case "ammonia":
      return { formula: "NH3", state: "g" };
    case "ionic": {
      if (id.cat.id === "H" && id.an.id === "CO3") return { formula: "H2CO3", state: "aq" };
      const s = makeSalt(id.cat, id.an);
      return { formula: s.formula, state: id.an.id === "O" ? "s" : isSoluble(id.cat, id.an) ? "aq" : "s" };
    }
    case "molecular":
      return { formula: mol(id.key).formula, state: mol(id.key).state };
    default:
      return { formula: r.formula, state: null };
  }
}

const mhchemSpecies = (coef: number, formula: string, state: State | null) =>
  `${coef > 1 ? coef + " " : ""}${formula}${state ? `(${state})` : ""}`;

function toReactant(c: CompoundData): Reactant | null {
  const comp = safeParseFormula(c.formula) || (c.smiles ? smilesToComp(c.smiles)?.comp ?? null : null);
  if (!comp) return null;
  return { name: c.name, formula: c.formula || "", smiles: c.smiles, comp, mw: c.molecularWeight || molarMass(comp) };
}

function cacheKeyOf(r1: CompoundData, r2: CompoundData, input: ReactionInput) {
  const pair = [
    `${r1.smiles || r1.formula}@${input.moles1}`,
    `${r2.smiles || r2.formula}@${input.moles2}`,
  ];
  const cond = `${input.temperature}|${input.catalyst}|${input.ignition ? 1 : 0}`;
  return createHash("sha256").update(`${pair.join("+")}#${cond}#v3`).digest("hex");
}

function mergeProducts(list: Species[]): Species[] {
  const map = new Map<string, Species>();
  for (const p of list) {
    const k = compositionKey(p.comp);
    if (!map.has(k)) map.set(k, p);
  }
  return Array.from(map.values());
}

export async function runReaction(input: ReactionInput): Promise<ReactionResult> {
  const conditions: Conditions = { temperature: input.temperature, catalyst: input.catalyst || "none", ignition: !!input.ignition };
  const base: ReactionResult = {
    status: "error",
    observations: [],
    notes: [],
    equation: null,
    reactants: [],
    products: [],
    expectedProducts: [],
    limitingReactant: null,
    extent: 0,
    thermo: null,
    kinetics: null,
    engine: "none",
    conditions,
    cached: false,
    computedAt: new Date().toISOString(),
  };

  const [c1, c2] = await Promise.all([resolveCompound(input.reactant1), resolveCompound(input.reactant2)]);
  if (!c1 || !c2) {
    return { ...base, reason: `تعذر العثور على المركب: ${!c1 ? input.reactant1 : input.reactant2} في PubChem أو CACTUS.` };
  }
  const key = cacheKeyOf(c1, c2, input);
  const rows = await withDb((d) => d.select().from(reactions).where(eq(reactions.cacheKey, key)).limit(1));
  if (rows && rows.length) {
    withDb((d) => d.update(reactions).set({ hits: sql`${reactions.hits} + 1` }).where(eq(reactions.id, rows[0].id)));
    return { ...(rows[0].result as ReactionResult), cached: true };
  }

  const A = toReactant(c1);
  const B = toReactant(c2);
  if (!A || !B) return { ...base, reason: "تعذر تحليل الصيغة الجزيئية لأحد المتفاعلين." };

  const dA = displayFormulaFor(A);
  const dB = displayFormulaFor(B);
  const reactantBase = (c: CompoundData, r: Reactant, d: { formula: string; state: State | null }, moles: number, query: string): ReactantOut => ({
    query,
    name: c.name,
    cid: c.cid,
    formula: r.formula,
    displayFormula: d.formula,
    smiles: c.smiles,
    state: d.state,
    coefficient: null,
    molarMass: round(r.mw, 3),
    molesInput: moles,
    massInput: round(moles * r.mw, 4),
    consumedMoles: 0,
    remainingMoles: moles,
    remainingMass: round(moles * r.mw, 4),
    role: "none",
  });
  const rOut = [reactantBase(c1, A, dA, input.moles1, input.reactant1), reactantBase(c2, B, dB, input.moles2, input.reactant2)];

  let outcome = predict(A, B, conditions);
  let engine: ReactionResult["engine"] = "rules";
  let confidence: number | null | undefined;

  // Path 2: IBM RXN for complex organic chemistry
  if (!outcome && isOrganic(A.comp) && isOrganic(B.comp) && A.smiles && B.smiles) {
    if (ibmRxnEnabled()) {
      try {
        const pred = await predictWithIbmRxn([A.smiles, B.smiles]);
        if (pred && pred.productSmiles.length) {
          const prods: Species[] = [];
          for (const s of pred.productSmiles) {
            const info = smilesToComp(s);
            if (info) prods.push({ formula: info.formula, name: "predicted product", nameAr: "ناتج متوقع (IBM RXN)", smiles: s, comp: info.comp, state: "l" });
          }
          if (prods.length) {
            outcome = { kind: "reaction", type: "organic-ml", typeAr: "تفاعل عضوي (تنبؤ بالذكاء الاصطناعي)", products: prods, descriptionAr: "تنبأ نموذج IBM RXN (Molecular Transformer) بالناتج الرئيسي لهذا التفاعل العضوي.", observations: [], notes: ["النتيجة تنبؤ إحصائي من نموذج تعلم آلي."], ea: 80 };
            engine = "ibm-rxn";
            confidence = pred.confidence;
          }
        }
      } catch (e) {
        base.notes.push(`تعذر الاتصال بـ IBM RXN: ${(e as Error).message}`);
      }
    } else {
      base.notes.push("للتفاعلات العضوية المعقدة أضف IBM_RXN_API_KEY في ملف ‎.env لتفعيل التنبؤ بالذكاء الاصطناعي.");
    }
  }

  let result: ReactionResult;
  if (!outcome) {
    result = {
      ...base,
      status: "no_reaction",
      engine: "none",
      reactants: rOut,
      reason: "لا يوجد تفاعل معروف بين هاتين المادتين تحت الظروف المحددة (لم تتطابق أي قاعدة كيميائية).",
      equation: { text: `${dA.formula} + ${dB.formula} → لا تفاعل`, latex: `\\ce{${dA.formula} + ${dB.formula} -> }\\ \\text{N.R.}` },
    };
  } else if (outcome.kind === "blocked") {
    result = {
      ...base,
      status: "no_reaction",
      engine,
      reactants: rOut,
      reactionType: outcome.type,
      reactionTypeAr: outcome.typeAr,
      reason: outcome.reason,
      requirement: outcome.requirement,
      expectedProducts: (outcome.products || []).map((p) => ({ formula: p.formula, nameAr: p.nameAr, smiles: p.smiles })),
      equation: { text: `${dA.formula} + ${dB.formula} ↛`, latex: `\\ce{${dA.formula} + ${dB.formula} ->}\\ \\text{N.R.}` },
    };
  } else {
    const products = mergeProducts(outcome.products);
    const coeffs = balanceEquation([A.comp, B.comp], products.map((p) => p.comp));
    if (!coeffs) {
      result = { ...base, reactants: rOut, engine, reason: "تعذر موازنة المعادلة الكيميائية (قد يكون الناتج المتوقع غير متوافق ذرياً).", reactionTypeAr: outcome.typeAr };
    } else {
      const [nuA, nuB] = coeffs;
      const pc = coeffs.slice(2);
      const xiA = input.moles1 / nuA;
      const xiB = input.moles2 / nuB;
      const extent = Math.min(xiA, xiB);
      const limitingIdx = xiA <= xiB ? 0 : 1;
      rOut[0].coefficient = nuA;
      rOut[1].coefficient = nuB;
      [nuA, nuB].forEach((nu, i) => {
        const r = rOut[i];
        r.consumedMoles = round(extent * nu, 6);
        r.remainingMoles = round(Math.max(0, r.molesInput - extent * nu), 6);
        r.remainingMass = round(r.remainingMoles * r.molarMass, 4);
        r.role = Math.abs(xiA - xiB) < 1e-12 ? "limiting" : i === limitingIdx ? "limiting" : "excess";
      });
      const pOut: ProductOut[] = products.map((p, i) => {
        const mm = molarMass(p.comp);
        const moles = extent * pc[i];
        return { name: p.name, nameAr: p.nameAr, formula: p.formula, smiles: p.smiles, state: p.state, note: p.note, coefficient: pc[i], molarMass: mm, moles: round(moles, 6), mass: round(moles * mm, 4) };
      });

      // Thermochemistry (Hess's law with ΔHf°)
      let thermo: ReactionResult["thermo"] = null;
      const hfR = [A.comp, B.comp].map((c: Composition) => enthalpyOfFormation(c));
      const hfP = products.map((p) => enthalpyOfFormation(p.comp));
      if ([...hfR, ...hfP].every((v) => v !== null)) {
        const dH = pc.reduce((s, n, i) => s + n * (hfP[i] as number), 0) - (nuA * (hfR[0] as number) + nuB * (hfR[1] as number));
        thermo = { deltaH: round(dH, 1), heat: round(dH * extent, 2), exothermic: dH < 0 };
      }
      // Arrhenius relative rate vs 25°C
      const T = input.temperature + 273.15;
      const ea = outcome.ea * 1000;
      const rel = Math.exp((-ea / 8.314) * (1 / T - 1 / 298.15));

      const lhs = rOut.map((r) => mhchemSpecies(r.coefficient || 1, r.displayFormula, r.state)).join(" + ");
      const rhs = pOut.map((p) => mhchemSpecies(p.coefficient, p.formula, p.state)).join(" + ");
      const above = [conditions.catalyst !== "none" && outcome.catalystUsed ? conditions.catalyst : "", conditions.ignition ? "Δ" : ""].filter(Boolean).join(", ");
      const arrow = above ? `->[{${above}}]` : "->";
      const textArrow = above ? ` —(${above})→ ` : " → ";
      const plainL = rOut.map((r) => `${(r.coefficient || 1) > 1 ? r.coefficient : ""}${r.displayFormula}`).join(" + ");
      const plainR = pOut.map((p) => `${p.coefficient > 1 ? p.coefficient : ""}${p.formula}`).join(" + ");

      result = {
        ...base,
        status: "success",
        engine,
        confidence,
        reactionType: outcome.type,
        reactionTypeAr: outcome.typeAr,
        description: outcome.descriptionAr,
        observations: outcome.observations,
        notes: [...outcome.notes, ...base.notes],
        equation: { text: `${plainL}${textArrow}${plainR}`, latex: `\\ce{${lhs} ${arrow} ${rhs}}` },
        reactants: rOut,
        products: pOut,
        limitingReactant: rOut[limitingIdx].name,
        extent: round(extent, 6),
        thermo,
        kinetics: { ea: outcome.ea, relativeRate: rel > 1e6 ? round(rel, 0) : round(rel, 4) },
      };
    }
  }

  await withDb(async (d) => {
    await d
      .insert(reactions)
      .values({ cacheKey: key, status: result.status, equation: result.equation?.text || null, result })
      .onConflictDoNothing();
  });
  return result;
}
