import { compositionKey, isOrganic, isSingleElement, METALS, parseFormula, type Composition } from "./elements";
import {
  activityIndex, anion, cation, HALOGEN_ORDER, isSoluble, makeSalt, matchSalt, METAL_AR, METAL_DEFAULT_CATION, metalElement, mol,
  type Anion, type Ion, type Species,
} from "./species";
import { addAcross, esterify, findAlcoholOH, findCOOH, findMultipleCC, loadMol, organicSalt, substitute } from "./organic";

export type Conditions = { temperature: number; catalyst: string; ignition: boolean };
export type Reactant = { name: string; formula: string; smiles: string | null; comp: Composition; mw: number };

export type RuleOutcome =
  | {
      kind: "reaction";
      type: string;
      typeAr: string;
      products: Species[];
      descriptionAr: string;
      observations: string[];
      notes: string[];
      ea: number; // estimated activation energy kJ/mol
      catalystUsed?: boolean;
    }
  | { kind: "blocked"; type: string; typeAr: string; reason: string; requirement?: string; products?: Species[] };

type Ident =
  | { k: "metal"; sym: string }
  | { k: "diatomic"; sym: string }
  | { k: "nonmetal"; sym: string }
  | { k: "water" }
  | { k: "ammonia" }
  | { k: "ionic"; cat: Ion; an: Anion }
  | { k: "molecular"; key: string }
  | { k: "organic" }
  | { k: "unknown" };

const MOLECULAR_KEYS = ["CO2", "CO", "SO2", "SO3", "P4O10", "H2O2", "NO", "NO2"];
const MOLECULAR_MAP = new Map(MOLECULAR_KEYS.map((k) => [compositionKey(parseFormula(k)), k]));

export function identify(r: Reactant): Ident {
  const c = r.comp;
  const el = isSingleElement(c);
  if (el) {
    if (METALS.has(el)) return { k: "metal", sym: el };
    if (["H", "N", "O", "F", "Cl", "Br", "I"].includes(el) && c[el] === 2) return { k: "diatomic", sym: el };
    if (["C", "S", "P", "Si"].includes(el)) return { k: "nonmetal", sym: el };
  }
  const key = compositionKey(c);
  if (key === "H2O1") return { k: "water" };
  if (key === "H3N1") return { k: "ammonia" };
  const salt = matchSalt(c);
  if (salt) return { k: "ionic", cat: salt.cat, an: salt.an };
  const mk = MOLECULAR_MAP.get(key);
  if (mk) return { k: "molecular", key: mk };
  if (isOrganic(c)) return { k: "organic" };
  return { k: "unknown" };
}

const isAcid = (i: Ident): i is Extract<Ident, { k: "ionic" }> => i.k === "ionic" && i.cat.id === "H";
const isHydroxide = (i: Ident): i is Extract<Ident, { k: "ionic" }> => i.k === "ionic" && i.an.id === "OH";
const isOxide = (i: Ident): i is Extract<Ident, { k: "ionic" }> => i.k === "ionic" && i.an.id === "O";

const ALKALI = ["Li", "Na", "K", "Rb", "Cs"];
const ALKALINE_HEAVY = ["Ca", "Sr", "Ba"];
const HALOGEN_Z: Record<string, number> = { F: 9, Cl: 17, Br: 35, I: 53 };
const HALOGEN_AR: Record<string, string> = { F: "الفلور", Cl: "الكلور", Br: "البروم", I: "اليود" };

const cat = (c: Conditions) => c.catalyst.toLowerCase();
const hasCat = (c: Conditions, ...names: string[]) => names.some((n) => cat(c) === n.toLowerCase());
const fireOk = (c: Conditions, minT: number) => c.ignition || c.temperature >= minT;

function aqueous(c: Conditions): string | null {
  if (c.temperature < 0) return "درجة الحرارة أقل من 0°C — المحلول المائي متجمد فتتوقف حركة الأيونات ولا يحدث التفاعل.";
  return null;
}
function aqNotes(c: Conditions): string[] {
  return c.temperature > 100 ? ["درجة الحرارة أعلى من درجة غليان الماء — يتبخر المذيب وقد يحدث التفاعل في الحالة الصلبة/الغازية."] : [];
}

function metalCationFor(sym: string, strongOxidizer = false): Ion | null {
  if (sym === "Fe" && strongOxidizer) return cation("Fe3");
  const id = METAL_DEFAULT_CATION[sym];
  return id ? cation(id) : null;
}

function reaction(
  type: string,
  typeAr: string,
  products: Species[],
  descriptionAr: string,
  opts: { observations?: string[]; notes?: string[]; ea?: number; catalystUsed?: boolean } = {}
): RuleOutcome {
  return {
    kind: "reaction",
    type,
    typeAr,
    products,
    descriptionAr,
    observations: opts.observations || [],
    notes: opts.notes || [],
    ea: opts.ea ?? 50,
    catalystUsed: opts.catalystUsed,
  };
}
function blocked(type: string, typeAr: string, reason: string, requirement?: string, products?: Species[]): RuleOutcome {
  return { kind: "blocked", type, typeAr, reason, requirement, products };
}

const gasObs = (s: Species[]) =>
  s.filter((p) => p.state === "g").map((p) => `تصاعد غاز ${p.nameAr} (${p.formula})`);
const ppObs = (s: Species[]) => s.filter((p) => p.note && p.state === "s").map((p) => `${p.note}: ${p.nameAr} (${p.formula})`);

/* ======================================================================= */

export function predict(A: Reactant, B: Reactant, c: Conditions): RuleOutcome | null {
  const a = identify(A);
  const b = identify(B);
  const pairs: [Ident, Reactant, Ident, Reactant][] = [
    [a, A, b, B],
    [b, B, a, A],
  ];
  for (const [x, X, y, Y] of pairs) {
    const r = organicRules(x, X, y, Y, c);
    if (r) return r;
  }
  for (const [x, X, y, Y] of pairs) {
    const r = inorganicRules(x, X, y, Y, c);
    if (r) return r;
  }
  return null;
}

/* ------------------------------ Organic ------------------------------ */

function organicRules(x: Ident, X: Reactant, y: Ident, Y: Reactant, c: Conditions): RuleOutcome | null {
  if (!X.smiles) return null;
  const mx = loadMol(X.smiles);
  if (!mx) return null;
  const xIsOrganic = isOrganic(X.comp);
  if (!xIsOrganic) return null;
  const cooh = findCOOH(mx);
  const multi = findMultipleCC(mx).length > 0;

  // Combustion of organic compounds
  if (y.k === "diatomic" && y.sym === "O") {
    const prods: Species[] = [mol("CO2"), mol("H2O")];
    if (X.comp.N) prods.push(mol("N2"));
    if (X.comp.S) prods.push(mol("SO2"));
    for (const h of ["Cl", "Br", "F", "I"]) if (X.comp[h]) prods.push(mol(`H${h}`));
    if (X.comp.P) prods.push(mol("P4O10"));
    if (!fireOk(c, 450)) {
      return blocked(
        "combustion", "احتراق", "المركب العضوي لا يحترق تلقائياً عند هذه الحرارة.",
        "فعّل مصدر الإشعال/اللهب أو ارفع الحرارة إلى ≥ 450°C (درجة الاشتعال الذاتي التقريبية).", prods
      );
    }
    return reaction("combustion", "احتراق كامل", prods, "تفاعل أكسدة سريع طارد للحرارة يتحد فيه المركب العضوي مع الأكسجين منتجاً ثاني أكسيد الكربون وبخار الماء.", {
      observations: ["لهب وانطلاق حرارة وضوء", "تكوّن بخار ماء وغاز CO₂"],
      ea: 160,
    });
  }

  // Y organic too: esterification
  if (cooh && Y.smiles && isOrganic(Y.comp)) {
    const my = loadMol(Y.smiles);
    if (my && findAlcoholOH(my) !== null && !findCOOH(my)) {
      const ester = esterify(X.smiles, Y.smiles);
      if (ester) {
        const prods = [ester, mol("H2O")];
        if (!hasCat(c, "H2SO4")) return blocked("esterification", "أسترة (فيشر)", "التفاعل بطيء جداً وعكوس بدون حمض قوي.", "أضف حمض الكبريتيك المركز H₂SO₄ كعامل حفاز وسخّن إلى ≥ 60°C.", prods);
        if (c.temperature < 60) return blocked("esterification", "أسترة (فيشر)", "درجة الحرارة منخفضة؛ معدل الأسترة ضئيل.", "ارفع الحرارة إلى ≥ 60°C (تسخين بالارتداد).", prods);
        return reaction("esterification", "أسترة (فيشر)", prods, "يتفاعل الحمض الكربوكسيلي مع الكحول بوجود حمض الكبريتيك لتكوين إستر وماء (تفاعل تكاثف عكوس).", {
          observations: ["ظهور رائحة فواكه مميزة للإستر"],
          notes: ["التفاعل عكوس؛ الحسابات تفترض اكتمال التفاعل نظرياً (المردود النظري)."],
          ea: 60,
          catalystUsed: true,
        });
      }
    }
  }

  // Carboxylic acid with inorganic base/carbonate/metal
  if (cooh) {
    if (isHydroxide(y) && y.cat.id !== "NH4") {
      const salt = organicSalt(X.smiles, y.cat.smiles, y.cat.charge, "acid");
      if (salt) {
        const err = aqueous(c);
        if (err) return blocked("neutralization", "تعادل حمض عضوي", err);
        return reaction("neutralization", "تعادل حمض عضوي", [salt, mol("H2O")], "يتعادل الحمض الكربوكسيلي مع القاعدة مكوناً ملح الكربوكسيلات والماء.", { ea: 15, notes: aqNotes(c) });
      }
    }
    if (y.k === "ionic" && (y.an.id === "CO3" || y.an.id === "HCO3") && y.cat.id !== "H") {
      const salt = organicSalt(X.smiles, y.cat.smiles, y.cat.charge, "acid");
      if (salt) {
        const err = aqueous(c);
        if (err) return blocked("acid-carbonate", "حمض + كربونات", err);
        const prods = [salt, mol("H2O"), mol("CO2")];
        return reaction("acid-carbonate", "حمض عضوي + كربونات", prods, "يتفاعل الحمض مع الكربونات/البيكربونات فيتكون ملح وماء ويتصاعد ثاني أكسيد الكربون.", {
          observations: ["فوران وتصاعد فقاعات CO₂"],
          ea: 20,
        });
      }
    }
    if (y.k === "metal" && activityIndex(y.sym) < activityIndex("H")) {
      const ci = metalCationFor(y.sym);
      const salt = ci ? organicSalt(X.smiles, ci.smiles, ci.charge, "acid") : null;
      if (salt) return reaction("acid-metal", "حمض عضوي + فلز", [salt, mol("H2")], "يحل الفلز النشط محل هيدروجين مجموعة الكربوكسيل ويتصاعد الهيدروجين.", { observations: ["تصاعد فقاعات H₂"], ea: 45 });
    }
  }

  // Alcohol + alkali metal → alkoxide + H2
  if (y.k === "metal" && ALKALI.includes(y.sym) && findAlcoholOH(mx) !== null && !cooh) {
    const ci = metalCationFor(y.sym)!;
    const alk = organicSalt(X.smiles, ci.smiles, 1, "alcohol");
    if (alk) return reaction("alkoxide", "تكوين ألكوكسيد", [alk, mol("H2")], "يتفاعل الفلز القلوي مع الكحول مكوناً ألكوكسيد الفلز ويتصاعد غاز الهيدروجين.", { observations: ["تصاعد فقاعات H₂ بهدوء"], ea: 40 });
  }

  if (multi) {
    // Hydrogenation
    if (y.k === "diatomic" && y.sym === "H") {
      const p = addAcross(X.smiles, [], "المركب المشبع (ناتج الهدرجة)", "hydrogenated product", true);
      if (p) {
        if (!hasCat(c, "Ni", "Pt", "Pd")) return blocked("hydrogenation", "هدرجة حفزية", "إضافة الهيدروجين للرابطة المزدوجة تحتاج طاقة تنشيط عالية جداً.", "أضف عامل حفاز (Ni أو Pt أو Pd).", [p]);
        if (hasCat(c, "Ni") && c.temperature < 140) return blocked("hydrogenation", "هدرجة حفزية", "النيكل يحتاج حرارة أعلى ليكون فعّالاً.", "ارفع الحرارة إلى ≥ 150°C أو استخدم Pt/Pd.", [p]);
        return reaction("hydrogenation", "هدرجة حفزية (إضافة)", [p], "يضاف الهيدروجين إلى الروابط غير المشبعة بوجود عامل حفاز فلزي فيتحول المركب إلى مركب مشبع.", { ea: 60, catalystUsed: true });
      }
    }
    // Halogen addition
    if (y.k === "diatomic" && ["Cl", "Br", "I"].includes(y.sym)) {
      const z = HALOGEN_Z[y.sym];
      const p = addAcross(X.smiles, [z, z], `مركب ثنائي الهالوجين (${HALOGEN_AR[y.sym]})`, "dihalide");
      if (p) return reaction("halogen-addition", "إضافة هالوجين", [p], `يُضاف ${HALOGEN_AR[y.sym]} إلى الرابطة المزدوجة/الثلاثية فيتكون مركب ثنائي الهالوجين.`, {
        observations: y.sym === "Br" ? ["زوال اللون البني المحمر لماء البروم (كشف عدم التشبع)"] : [],
        ea: 35,
      });
    }
    // Hydrohalogenation
    if (isAcid(y) && ["Cl", "Br", "I"].includes(y.an.id)) {
      const p = addAcross(X.smiles, [HALOGEN_Z[y.an.id]], "هاليد ألكيل (ناتج إضافة HX)", "alkyl halide");
      if (p) return reaction("hydrohalogenation", "إضافة هاليد الهيدروجين", [p], "يضاف HX إلى الرابطة المزدوجة وفق قاعدة ماركوفنيكوف.", { ea: 50 });
    }
    // Hydration
    if (y.k === "water") {
      const p = addAcross(X.smiles, [8], "كحول (ناتج الإماهة)", "alcohol");
      if (p) {
        if (!hasCat(c, "H2SO4", "H3PO4")) return blocked("hydration", "إماهة حفزية", "إضافة الماء للألكين تحتاج وسطاً حمضياً.", "أضف H₃PO₄ أو H₂SO₄ كعامل حفاز.", [p]);
        if (c.temperature < 100) return blocked("hydration", "إماهة حفزية", "الحرارة غير كافية.", "ارفع الحرارة إلى ≥ 100°C (صناعياً ~300°C).", [p]);
        return reaction("hydration", "إماهة حفزية", [p], "يضاف الماء إلى الرابطة المزدوجة بوجود حمض كعامل حفاز فيتكون كحول.", { ea: 70, catalystUsed: true });
      }
    }
  } else if (y.k === "diatomic" && ["Cl", "Br"].includes(y.sym)) {
    // Free-radical substitution (alkanes)
    const p = substitute(X.smiles, HALOGEN_Z[y.sym], `هاليد ألكيل (استبدال بـ${HALOGEN_AR[y.sym]})`);
    if (p) {
      const prods = [p, mol(`H${y.sym}`)];
      if (!c.ignition) return blocked("halogenation", "هلجنة بالجذور الحرة", "تفاعل الاستبدال في الألكانات يحتاج طاقة لكسر رابطة الهالوجين.", "فعّل مصدر الضوء/الإشعال (أشعة UV).", prods);
      return reaction("halogenation", "استبدال بالجذور الحرة", prods, "تكسر الأشعة رابطة الهالوجين فيستبدل ذرة هيدروجين في الألكان مكوناً هاليد ألكيل وهاليد الهيدروجين.", { ea: 70 });
    }
  }
  return null;
}

/* ------------------------------ Inorganic ------------------------------ */

function inorganicRules(x: Ident, X: Reactant, y: Ident, Y: Reactant, c: Conditions): RuleOutcome | null {
  // ---- Hydrogen + Oxygen
  if (x.k === "diatomic" && x.sym === "H" && y.k === "diatomic" && y.sym === "O") {
    const prods = [mol("H2O", c.temperature >= 100 ? "g" : "l")];
    if (!fireOk(c, 500) && !hasCat(c, "Pt", "Pd"))
      return blocked("synthesis", "احتراق الهيدروجين", "خليط H₂ و O₂ مستقر حركياً عند هذه الحرارة (طاقة تنشيط عالية).", "فعّل الإشعال (شرارة) أو استخدم Pt/Pd أو ارفع الحرارة ≥ 500°C.", prods);
    return reaction("combustion", "احتراق الهيدروجين (تكوين الماء)", prods, "يتحد الهيدروجين مع الأكسجين في تفاعل شديد الطرد للحرارة لتكوين الماء.", {
      observations: ["فرقعة/انفجار مع لهب أزرق باهت", "تكثف قطرات ماء"],
      ea: c.ignition ? 120 : 75,
      catalystUsed: hasCat(c, "Pt", "Pd"),
    });
  }
  // ---- Hydrogen + Halogen
  if (x.k === "diatomic" && x.sym === "H" && y.k === "diatomic" && HALOGEN_ORDER.includes(y.sym)) {
    const prods = [mol(`H${y.sym}`)];
    const req: Record<string, number> = { F: -273, Cl: 250, Br: 200, I: 300 };
    if (!fireOk(c, req[y.sym]) || (y.sym === "I" && c.temperature < 300))
      return blocked("synthesis", "تكوين هاليد الهيدروجين", `تفاعل H₂ مع ${HALOGEN_AR[y.sym]} يحتاج طاقة تنشيط.`, y.sym === "Cl" ? "فعّل الضوء/الإشعال أو ارفع الحرارة ≥ 250°C." : `ارفع الحرارة إلى ≥ ${req[y.sym]}°C.`, prods);
    return reaction("synthesis", "اتحاد مباشر", prods, `يتحد الهيدروجين مع ${HALOGEN_AR[y.sym]} مكوناً هاليد الهيدروجين.`, { ea: y.sym === "F" ? 10 : 80, observations: y.sym === "Cl" ? ["تفاعل انفجاري بوجود الضوء"] : [] });
  }
  // ---- Haber
  if (x.k === "diatomic" && x.sym === "N" && y.k === "diatomic" && y.sym === "H") {
    const prods = [mol("NH3")];
    if (!hasCat(c, "Fe")) return blocked("synthesis", "عملية هابر-بوش", "رابطة N≡N الثلاثية قوية جداً ولا تنكسر بدون عامل حفاز.", "أضف الحديد (Fe) كعامل حفاز واضبط الحرارة 400–500°C.", prods);
    if (c.temperature < 350) return blocked("synthesis", "عملية هابر-بوش", "الحرارة منخفضة؛ معدل التفاعل بطيء جداً حتى مع الحفاز.", "ارفع الحرارة إلى 400–500°C.", prods);
    return reaction("synthesis", "عملية هابر-بوش", prods, "يتحد النيتروجين مع الهيدروجين بوجود الحديد كعامل حفاز تحت ضغط مرتفع لإنتاج الأمونيا.", {
      notes: [c.temperature > 550 ? "حرارة مرتفعة جداً: يزاح الاتزان نحو المتفاعلات ويقل المردود (مبدأ لوشاتلييه)." : "ظروف مثالية تقريباً (≈200 atm في الصناعة).", "التفاعل عكوس؛ المحاكاة تعرض المردود النظري."],
      ea: 100,
      catalystUsed: true,
    });
  }
  // ---- N2 + O2
  if (x.k === "diatomic" && x.sym === "N" && y.k === "diatomic" && y.sym === "O") {
    const prods = [mol("NO")];
    if (!(c.temperature >= 1500 || c.ignition)) return blocked("synthesis", "أكسدة النيتروجين", "النيتروجين خامل جداً عند هذه الحرارة.", "يحتاج حرارة ≥ 1500°C أو شرارة كهربائية (مثل البرق).", prods);
    return reaction("synthesis", "أكسدة النيتروجين", prods, "عند الحرارة العالية جداً أو الشرارة الكهربائية يتحد النيتروجين مع الأكسجين مكوناً أكسيد النيتريك.", { ea: 280, observations: ["يحدث طبيعياً عند البرق"] });
  }
  // ---- Non-metal + O2
  if (x.k === "nonmetal" && y.k === "diatomic" && y.sym === "O") {
    const map: Record<string, [Species, number, string]> = {
      C: [mol("CO2"), 700, "الكربون"],
      S: [mol("SO2"), 232, "الكبريت"],
      P: [mol("P4O10"), 34, "الفوسفور"],
      Si: [{ formula: "SiO2", name: "silicon dioxide", nameAr: "ثاني أكسيد السيليكون", smiles: "O=[Si]=O", comp: { Si: 1, O: 2 }, state: "s" }, 1000, "السيليكون"],
    };
    const [p, t, ar] = map[x.sym];
    if (!fireOk(c, t)) return blocked("combustion", "احتراق لافلز", `${ar} لا يشتعل عند هذه الحرارة.`, `فعّل الإشعال أو ارفع الحرارة إلى ≥ ${t}°C.`, [p]);
    return reaction("combustion", "احتراق لافلز", [p], `يحترق ${ar} في الأكسجين مكوناً أكسيداً حمضياً.`, { ea: 120, observations: x.sym === "S" ? ["لهب أزرق ورائحة خانقة لـ SO₂"] : ["توهج وانطلاق حرارة"] });
  }
  // ---- CO / SO2 / NO + O2
  if (x.k === "molecular" && y.k === "diatomic" && y.sym === "O") {
    if (x.key === "CO") {
      const prods = [mol("CO2")];
      if (!fireOk(c, 609)) return blocked("combustion", "احتراق أول أكسيد الكربون", "لا يحترق تلقائياً عند هذه الحرارة.", "فعّل الإشعال أو ارفع الحرارة ≥ 609°C.", prods);
      return reaction("combustion", "احتراق أول أكسيد الكربون", prods, "يحترق CO بلهب أزرق مكوناً CO₂.", { ea: 120, observations: ["لهب أزرق"] });
    }
    if (x.key === "SO2") {
      const prods = [mol("SO3")];
      if (!hasCat(c, "V2O5", "Pt")) return blocked("synthesis", "طريقة التلامس", "أكسدة SO₂ بطيئة جداً بدون حفاز.", "أضف خامس أكسيد الفاناديوم V₂O₅ واضبط الحرارة ≈ 450°C.", prods);
      if (c.temperature < 400 || c.temperature > 600) return blocked("synthesis", "طريقة التلامس", "خارج نطاق الحرارة الفعّال للحفاز.", "اضبط الحرارة بين 400 و 600°C.", prods);
      return reaction("synthesis", "طريقة التلامس (صناعة H₂SO₄)", prods, "يتأكسد SO₂ إلى SO₃ بوجود V₂O₅ — الخطوة الرئيسية في صناعة حمض الكبريتيك.", { ea: 90, catalystUsed: true, notes: ["تفاعل عكوس طارد للحرارة."] });
    }
    if (x.key === "NO") return reaction("synthesis", "أكسدة أكسيد النيتريك", [mol("NO2")], "يتأكسد NO فوراً في الهواء إلى NO₂ البني.", { ea: 5, observations: ["ظهور غاز بني محمر"] });
  }
  // ---- Ammonia + O2 (Ostwald)
  if (x.k === "ammonia" && y.k === "diatomic" && y.sym === "O") {
    if (hasCat(c, "Pt") && c.temperature >= 700) return reaction("oxidation", "طريقة أوستفالد", [mol("NO"), mol("H2O", "g")], "تتأكسد الأمونيا حفزياً على البلاتين إلى أكسيد النيتريك (خطوة صناعة حمض النيتريك).", { ea: 90, catalystUsed: true });
    if (fireOk(c, 651)) return reaction("combustion", "احتراق الأمونيا", [mol("N2"), mol("H2O", "g")], "تحترق الأمونيا في الأكسجين مكونة النيتروجين وبخار الماء.", { ea: 140, observations: ["لهب أصفر مخضر"] });
    return blocked("oxidation", "أكسدة الأمونيا", "الأمونيا لا تتفاعل مع الأكسجين عند هذه الحرارة.", "استخدم Pt مع حرارة ≥ 700°C (أوستفالد) أو فعّل الإشعال.");
  }
  // ---- Ammonia + acid
  if (x.k === "ammonia" && isAcid(y)) {
    if (y.an.id === "CO3") return null;
    const salt = makeSalt(cation("NH4"), y.an);
    return reaction("neutralization", "تعادل (أمونيا + حمض)", [salt], "تستقبل الأمونيا البروتون من الحمض مكونة ملح الأمونيوم.", { ea: 5, observations: y.an.id === "Cl" ? ["تكوّن دخان أبيض كثيف من NH₄Cl"] : [] });
  }
  if (x.k === "ammonia" && y.k === "water") return blocked("ionization", "تأين", "الأمونيا تذوب في الماء وتتأين جزئياً (NH₃ + H₂O ⇌ NH₄⁺ + OH⁻) — قاعدة ضعيفة، اتزان وليس تفاعلاً كاملاً.");

  // ---- Metal + O2
  if (x.k === "metal" && y.k === "diatomic" && y.sym === "O") {
    const sym = x.sym;
    if (["Ag", "Au", "Pt", "Pd", "Ir", "Rh"].includes(sym)) return blocked("oxidation", "أكسدة فلز", `${METAL_AR[sym] || sym} فلز نبيل لا يتأكسد بالأكسجين.`);
    const ci = metalCationFor(sym, true);
    if (!ci) return null;
    const oxide = makeSalt(ci, anion("O"));
    const req: Record<string, number> = { Mg: 470, Al: 600, Zn: 400, Cu: 300, Pb: 300, Fe: 0, Ni: 400, Sn: 300, Mn: 300, Cr: 500, Co: 400, Hg: 300 };
    const t = ALKALI.includes(sym) || ALKALINE_HEAVY.includes(sym) ? -273 : req[sym] ?? 300;
    if (!fireOk(c, t)) return blocked("oxidation", "أكسدة فلز", `${METAL_AR[sym] || sym} لا يتأكسد بشكل ملحوظ عند هذه الحرارة.`, `فعّل الإشعال أو ارفع الحرارة إلى ≥ ${t}°C.`, [oxide]);
    const obs: Record<string, string> = { Mg: "ضوء أبيض ساطع جداً", Na: "لهب أصفر برتقالي", K: "لهب بنفسجي", Fe: "تكوّن صدأ بني محمر", Cu: "تكوّن طبقة سوداء من CuO", Li: "لهب أحمر قرمزي", Ca: "لهب أحمر برتقالي" };
    return reaction("oxidation", "أكسدة فلز (تكوين أكسيد)", [oxide], `يتحد ${METAL_AR[sym] || sym} مع الأكسجين مكوناً أكسيداً قاعدياً.`, {
      observations: obs[sym] ? [obs[sym]] : [],
      notes: sym === "Fe" && !c.ignition && c.temperature < 300 ? ["في الظروف العادية يكون الصدأ بطيئاً جداً ويحتاج رطوبة."] : [],
      ea: sym === "Fe" ? 90 : 60,
    });
  }
  // ---- Metal + halogen
  if (x.k === "metal" && y.k === "diatomic" && HALOGEN_ORDER.includes(y.sym)) {
    const ci = metalCationFor(x.sym, true);
    if (!ci) return blocked("synthesis", "اتحاد فلز مع هالوجين", `${METAL_AR[x.sym] || x.sym} لا يتفاعل في ظروف المحاكاة.`);
    const salt = makeSalt(ci, anion(y.sym), "s");
    const easy = ALKALI.includes(x.sym) || ALKALINE_HEAVY.includes(x.sym) || x.sym === "Al" || y.sym === "F";
    if (!easy && !fireOk(c, 150)) return blocked("synthesis", "اتحاد فلز مع هالوجين", "الفلز يحتاج إلى تسخين لبدء التفاعل.", "ارفع الحرارة إلى ≥ 150°C أو فعّل الإشعال.", [salt]);
    return reaction("synthesis", "اتحاد مباشر (فلز + هالوجين)", [salt], `يتحد ${METAL_AR[x.sym] || x.sym} مع ${HALOGEN_AR[y.sym]} مكوناً ملح هاليد أيوني.`, { ea: 40, observations: ["انطلاق حرارة وتكوّن مادة صلبة"] });
  }
  // ---- Metal + water
  if (x.k === "metal" && y.k === "water") {
    const s = x.sym;
    if (ALKALI.includes(s) || ALKALINE_HEAVY.includes(s) || (s === "Mg" && c.temperature >= 70)) {
      const ci = metalCationFor(s)!;
      const prods = [makeSalt(ci, anion("OH")), mol("H2")];
      const err = aqueous(c);
      if (err && !ALKALI.includes(s)) return blocked("single-displacement", "فلز + ماء", err);
      const obs: Record<string, string> = { Na: "يطفو ويتحرك بسرعة على سطح الماء مع أزيز", K: "يشتعل بلهب بنفسجي", Li: "فوران هادئ", Cs: "انفجار عنيف", Rb: "تفاعل عنيف جداً" };
      return reaction("single-displacement", "فلز نشط + ماء", prods, `يحل ${METAL_AR[s]} محل هيدروجين الماء مكوناً هيدروكسيداً قاعدياً ويتصاعد الهيدروجين.`, {
        observations: [obs[s] || "تصاعد فقاعات H₂", "المحلول يصبح قاعدياً (يحمر الفينولفثالين)"],
        ea: ALKALI.includes(s) ? 20 : 50,
      });
    }
    if (s === "Mg") return blocked("single-displacement", "فلز + ماء", "المغنيسيوم يتفاعل ببطء شديد مع الماء البارد.", "ارفع الحرارة إلى ≥ 70°C (ماء ساخن).", [makeSalt(cation("Mg"), anion("OH")), mol("H2")]);
    if (["Fe", "Zn", "Al"].includes(s)) {
      const oxide: Species =
        s === "Fe"
          ? { formula: "Fe3O4", name: "iron(II,III) oxide", nameAr: "أكسيد الحديد المغناطيسي", smiles: "[Fe+2].[Fe+3].[Fe+3].[O-2].[O-2].[O-2].[O-2]", comp: { Fe: 3, O: 4 }, state: "s" }
          : makeSalt(metalCationFor(s)!, anion("O"));
      const prods = [oxide, mol("H2")];
      if (c.temperature < 400) return blocked("single-displacement", "فلز + بخار الماء", `${METAL_AR[s]} لا يتفاعل مع الماء السائل.`, "يتفاعل مع بخار الماء الساخن فقط: ارفع الحرارة ≥ 400°C.", prods);
      return reaction("single-displacement", "فلز + بخار الماء", prods, `يتفاعل ${METAL_AR[s]} المسخن مع بخار الماء مكوناً أكسيد الفلز وغاز الهيدروجين.`, { ea: 100 });
    }
    return blocked("single-displacement", "فلز + ماء", `${METAL_AR[s] || s} أقل نشاطاً — لا يستطيع إزاحة الهيدروجين من الماء.`);
  }
  // ---- Basic oxide + water
  if (isOxide(x) && y.k === "water") {
    if ([...ALKALI, ...ALKALINE_HEAVY].includes(x.cat.id)) {
      const err = aqueous(c);
      if (err) return blocked("synthesis", "أكسيد قاعدي + ماء", err);
      return reaction("synthesis", "أكسيد قاعدي + ماء", [makeSalt(x.cat, anion("OH"))], "يذوب الأكسيد القاعدي في الماء مكوناً محلول هيدروكسيد (قلوي).", { ea: 20, observations: x.cat.id === "Ca" ? ["انطلاق حرارة شديدة (إطفاء الجير)"] : ["انطلاق حرارة"] });
    }
    return blocked("synthesis", "أكسيد + ماء", "هذا الأكسيد لا يذوب في الماء ولا يتفاعل معه.");
  }
  // ---- Acidic oxide + water
  if (x.k === "molecular" && y.k === "water") {
    const acidMap: Record<string, Species[]> = {
      CO2: [{ formula: "H2CO3", name: "carbonic acid", nameAr: "حمض الكربونيك", smiles: "OC(=O)O", comp: { H: 2, C: 1, O: 3 }, state: "aq" }],
      SO2: [mol("H2SO3")],
      SO3: [makeSalt(cation("H"), anion("SO4"))],
      P4O10: [makeSalt(cation("H"), anion("PO4"))],
      NO2: [makeSalt(cation("H"), anion("NO3")), mol("NO")],
    };
    const prods = acidMap[x.key];
    if (prods) {
      const err = aqueous(c);
      if (err) return blocked("synthesis", "أكسيد حمضي + ماء", err);
      return reaction("synthesis", "أكسيد حمضي + ماء", prods, "يذوب الأكسيد الحمضي في الماء مكوناً حمضاً (أساس المطر الحمضي).", { ea: 25, notes: x.key === "CO2" ? ["حمض الكربونيك ضعيف وغير مستقر."] : [] });
    }
  }
  // ---- Halogen + water
  if (x.k === "diatomic" && x.sym === "Cl" && y.k === "water") {
    const hclo: Species = { formula: "HClO", name: "hypochlorous acid", nameAr: "حمض الهيبوكلوروز", smiles: "OCl", comp: { H: 1, Cl: 1, O: 1 }, state: "aq" };
    return reaction("disproportionation", "تفاعل كلور مع الماء", [makeSalt(cation("H"), anion("Cl")), hclo], "يتفاعل الكلور مع الماء في تفاعل عدم تناسب مكوناً HCl و HClO (مادة مبيضة ومطهرة).", { ea: 30 });
  }
  // ---- Basic oxide + acidic oxide
  if (isOxide(x) && x.cat.id !== "H" && y.k === "molecular" && (y.key === "CO2" || y.key === "SO3")) {
    const salt = makeSalt(x.cat, anion(y.key === "CO2" ? "CO3" : "SO4"), "s");
    return reaction("synthesis", "أكسيد قاعدي + أكسيد حمضي", [salt], "يتحد الأكسيد القاعدي مع الأكسيد الحمضي مباشرة مكوناً ملحاً.", { ea: 60 });
  }
  // ---- Hydroxide + acidic oxide
  if (isHydroxide(x) && y.k === "molecular" && (y.key === "CO2" || y.key === "SO3")) {
    const err = aqueous(c);
    if (err) return blocked("neutralization", "قاعدة + أكسيد حمضي", err);
    const salt = makeSalt(x.cat, anion(y.key === "CO2" ? "CO3" : "SO4"));
    return reaction("neutralization", "قاعدة + أكسيد حمضي", [salt, mol("H2O")], "تتفاعل القاعدة مع الأكسيد الحمضي مكونة ملحاً وماء.", {
      ea: 20,
      observations: x.cat.id === "Ca" && y.key === "CO2" ? ["تعكر ماء الجير (كشف CO₂)"] : ppObs([salt]),
    });
  }
  // ---- Metal oxide reduction by H2
  if (isOxide(x) && y.k === "diatomic" && y.sym === "H") {
    const reducible: Record<string, number> = { Cu: 250, Pb: 300, Fe3: 500, Fe2: 500, Ni: 300, Sn: 500, Ag: 100 };
    const t = reducible[x.cat.id];
    if (t === undefined) return blocked("reduction", "اختزال بالهيدروجين", "أكسيد هذا الفلز مستقر جداً ولا يُختزل بالهيدروجين.");
    const prods = [metalElement(x.cat.formula, METAL_AR[x.cat.formula]), mol("H2O", "g")];
    if (c.temperature < t) return blocked("reduction", "اختزال بالهيدروجين", "الحرارة غير كافية للاختزال.", `ارفع الحرارة إلى ≥ ${t}°C.`, prods);
    return reaction("reduction", "اختزال أكسيد فلز", prods, "يختزل الهيدروجين أكسيد الفلز المسخن إلى الفلز الحر ويتكون بخار الماء.", { ea: 80, observations: x.cat.id === "Cu" ? ["تحول اللون الأسود إلى أحمر نحاسي"] : [] });
  }
  // ---- Thermite / metal + metal oxide
  if (x.k === "metal" && isOxide(y) && y.cat.id !== "H") {
    const oxMetal = y.cat.formula;
    if (activityIndex(x.sym) >= activityIndex(oxMetal)) return blocked("single-displacement", "إحلال فلز في أكسيد", `${METAL_AR[x.sym] || x.sym} أقل نشاطاً من ${METAL_AR[oxMetal] || oxMetal}.`);
    const ci = metalCationFor(x.sym, true);
    if (!ci) return null;
    const prods = [makeSalt(ci, anion("O")), metalElement(oxMetal, METAL_AR[oxMetal])];
    if (!fireOk(c, 1000)) return blocked("thermite", "تفاعل الثرميت", "طاقة التنشيط عالية جداً.", "فعّل الإشعال (شريط مغنيسيوم) أو ارفع الحرارة ≥ 1000°C.", prods);
    return reaction("thermite", "تفاعل الثرميت (إحلال)", prods, "يختزل الفلز الأنشط أكسيد الفلز الأقل نشاطاً في تفاعل شديد الطرد للحرارة.", { ea: 150, observations: ["حرارة هائلة (~2500°C) وتكوّن فلز منصهر", "شرر ولهب ساطع"] });
  }
  // ---- Metal + acid
  if (x.k === "metal" && isAcid(y)) {
    const s = x.sym;
    const err = aqueous(c);
    if (err) return blocked("single-displacement", "فلز + حمض", err);
    if (["Au", "Pt"].includes(s)) return blocked("single-displacement", "فلز + حمض", `${METAL_AR[s]} فلز نبيل لا يذوب إلا في الماء الملكي.`);
    const ci = metalCationFor(s);
    if (!ci) return null;
    if (y.an.id === "NO3") {
      const prods = [makeSalt(ci, anion("NO3")), mol("NO"), mol("H2O")];
      return reaction("redox", "أكسدة واختزال (حمض النيتريك)", prods, "حمض النيتريك عامل مؤكسد قوي؛ يؤكسد الفلز ويُختزل إلى أكسيد النيتريك بدلاً من تصاعد الهيدروجين.", {
        observations: ["تصاعد غاز عديم اللون يتحول إلى بني محمر في الهواء (NO → NO₂)", ...(s === "Cu" ? ["المحلول يصبح أزرق"] : [])],
        ea: 50,
      });
    }
    if (activityIndex(s) > activityIndex("H")) {
      if (y.an.id === "SO4" && ["Cu", "Ag", "Hg"].includes(s)) {
        const prods = [makeSalt(ci, anion("SO4")), mol("SO2"), mol("H2O")];
        if (c.temperature < 100) return blocked("redox", "فلز + حمض الكبريتيك", `${METAL_AR[s]} لا يتفاعل مع حمض الكبريتيك المخفف.`, "يتفاعل مع الحمض المركز الساخن فقط: ارفع الحرارة ≥ 100°C.", prods);
        return reaction("redox", "فلز + حمض الكبريتيك المركز الساخن", prods, "حمض الكبريتيك المركز الساخن يؤكسد الفلز ويُختزل إلى SO₂.", { observations: ["تصاعد غاز SO₂ ذي الرائحة الخانقة"], ea: 70 });
      }
      return blocked("single-displacement", "فلز + حمض", `${METAL_AR[s] || s} يقع تحت الهيدروجين في سلسلة النشاط الكيميائي فلا يستطيع إحلال هيدروجين الحمض.`);
    }
    const salt = makeSalt(ci, y.an);
    const prods = [salt, mol("H2")];
    const notes = aqNotes(c);
    if (!salt.note && salt.state === "s") notes.push("الملح الناتج غير ذائب وقد يغلف سطح الفلز ويبطئ التفاعل.");
    return reaction("single-displacement", "إحلال بسيط (فلز + حمض)", prods, `يحل ${METAL_AR[s] || s} محل هيدروجين الحمض مكوناً ملحاً ويتصاعد غاز الهيدروجين.`, {
      observations: ["تصاعد فقاعات غاز H₂ (يشتعل بفرقعة)", ...ppObs(prods)],
      notes,
      ea: 45,
    });
  }
  // ---- Metal + salt (single displacement)
  if (x.k === "metal" && y.k === "ionic" && y.cat.id !== "H" && y.an.id !== "O" && y.an.id !== "OH") {
    const s = x.sym;
    const saltMetal = y.cat.formula;
    if (y.cat.id === "NH4") return null;
    const err = aqueous(c);
    if (err) return blocked("single-displacement", "إحلال فلز", err);
    if (!isSoluble(y.cat, y.an)) return blocked("single-displacement", "إحلال فلز", "الملح غير ذائب في الماء فلا تتوفر أيونات حرة للتفاعل.");
    if (ALKALI.includes(s) || ALKALINE_HEAVY.includes(s))
      return blocked("single-displacement", "إحلال فلز", `${METAL_AR[s]} نشط جداً فيتفاعل مع ماء المحلول أولاً منتجاً الهيدروجين والهيدروكسيد بدلاً من إحلال الفلز.`);
    if (activityIndex(s) >= activityIndex(saltMetal))
      return blocked("single-displacement", "إحلال فلز", `${METAL_AR[s] || s} أقل نشاطاً من ${METAL_AR[saltMetal] || saltMetal} في سلسلة النشاط الكيميائي، فلا يحدث إحلال.`);
    const ci = metalCationFor(s);
    if (!ci) return null;
    const prods = [makeSalt(ci, y.an), metalElement(saltMetal, METAL_AR[saltMetal])];
    const obs: string[] = [`ترسب ${METAL_AR[saltMetal] || saltMetal} الحر على سطح ${METAL_AR[s] || s}`];
    if (y.cat.id === "Cu") obs.push("زوال اللون الأزرق للمحلول تدريجياً");
    if (y.cat.id === "Ag") obs.push("تكوّن بلورات فضية لامعة");
    return reaction("single-displacement", "إحلال بسيط (فلز + ملح)", prods, `يحل ${METAL_AR[s] || s} الأنشط محل ${METAL_AR[saltMetal] || saltMetal} في محلول ملحه.`, { observations: obs, ea: 40, notes: aqNotes(c) });
  }
  // ---- Halogen displacement
  if (x.k === "diatomic" && HALOGEN_ORDER.includes(x.sym) && y.k === "ionic" && HALOGEN_ORDER.includes(y.an.id) && y.cat.id !== "H") {
    if (HALOGEN_ORDER.indexOf(x.sym) >= HALOGEN_ORDER.indexOf(y.an.id))
      return blocked("single-displacement", "إحلال هالوجين", `${HALOGEN_AR[x.sym]} أقل نشاطاً من ${HALOGEN_AR[y.an.id]} فلا يحل محله.`);
    const err = aqueous(c);
    if (err) return blocked("single-displacement", "إحلال هالوجين", err);
    const prods = [makeSalt(y.cat, anion(x.sym)), mol(`${y.an.id}2`)];
    return reaction("single-displacement", "إحلال هالوجين", prods, `يحل ${HALOGEN_AR[x.sym]} الأنشط محل أيون ${HALOGEN_AR[y.an.id]} في محلول الملح.`, {
      observations: [y.an.id === "Br" ? "ظهور لون برتقالي/بني للبروم" : y.an.id === "I" ? "ظهور لون بني (يصبح أزرق داكن مع النشا)" : "تغير لون المحلول"],
      ea: 30,
    });
  }
  // ---- Ionic + ionic (double displacement: neutralization, precipitation, gas)
  if (x.k === "ionic" && y.k === "ionic") return doubleDisplacement(x, y, c);
  // ---- Water + soluble ionic: dissolution
  if (x.k === "ionic" && y.k === "water") {
    if (x.cat.id === "H") return blocked("ionization", "تأين", "الحمض يتأين في الماء (H⁺ + أنيون) — عملية تأين/تخفيف وليست تفاعلاً ينتج مواد جديدة.");
    return blocked("dissolution", "ذوبان", isSoluble(x.cat, x.an) ? "الملح يذوب في الماء ويتفكك إلى أيوناته (تغير فيزيائي) دون تكوين نواتج جديدة." : "المادة شحيحة الذوبان في الماء ولا تتفاعل معه.");
  }
  return null;
}

function doubleDisplacement(x: Extract<Ident, { k: "ionic" }>, y: Extract<Ident, { k: "ionic" }>, c: Conditions): RuleOutcome | null {
  if (x.cat.id === y.cat.id && x.an.id === y.an.id) return blocked("none", "نفس المادة", "المادتان متطابقتان — لا يوجد تفاعل.");
  if (x.cat.id === "H" && y.cat.id === "H") return blocked("none", "حمض + حمض", "الحمضان لا يتفاعلان معاً (كلاهما مانح للبروتون).");
  if (x.an.id === "OH" && y.an.id === "OH") return blocked("none", "قاعدة + قاعدة", "القاعدتان لا تتفاعلان معاً.");
  if (x.an.id === "O" && y.cat.id !== "H") return null;
  if (y.an.id === "O" && x.cat.id !== "H") return null;
  const err = aqueous(c);
  const prods: Species[] = [];
  const add = (ct: Ion, an: Anion) => {
    if (ct.id === "H" && an.id === "HCO3") {
      prods.push(mol("CO2"), mol("H2O"));
      return;
    }
    const s = makeSalt(ct, an);
    prods.push(s);
    if (s.formula === "CO2" || s.formula === "NH3") prods.push(mol("H2O"));
  };
  add(x.cat, y.an);
  add(y.cat, x.an);
  const isH2O = (s: Species) => s.formula === "H2O";
  const gas = prods.some((s) => s.state === "g");
  const water = prods.some(isH2O);
  const ppt = prods.some((s) => s.state === "s" && !!s.note);
  const reactantsInsoluble = !isSoluble(x.cat, x.an) && !isSoluble(y.cat, y.an);
  const acidBase = (x.cat.id === "H" && (y.an.id === "OH" || y.an.id === "O")) || (y.cat.id === "H" && (x.an.id === "OH" || x.an.id === "O"));
  const acidCarb = (x.cat.id === "H" && ["CO3", "HCO3"].includes(y.an.id)) || (y.cat.id === "H" && ["CO3", "HCO3"].includes(x.an.id));
  const ammonia = prods.some((s) => s.formula === "NH3");

  let type = "double-displacement";
  let typeAr = "إحلال مزدوج";
  let desc = "يتبادل الأيونان الموجبان شريكيهما السالبين.";
  if (acidBase) {
    type = "neutralization";
    typeAr = "تعادل (حمض + قاعدة)";
    desc = "يتحد أيون الهيدروجين من الحمض مع أيون الهيدروكسيد/الأكسيد من القاعدة لتكوين الماء، ويتكون ملح.";
  } else if (acidCarb) {
    type = "acid-carbonate";
    typeAr = "حمض + كربونات";
    desc = "يتفاعل الحمض مع الكربونات/البيكربونات فيتكون ملح وماء ويتصاعد غاز ثاني أكسيد الكربون.";
  } else if (ammonia) {
    type = "ammonia-release";
    typeAr = "قاعدة + ملح أمونيوم";
    desc = "تطرد القاعدة القوية غاز الأمونيا من ملح الأمونيوم.";
  } else if (ppt) {
    type = "precipitation";
    typeAr = "ترسيب (إحلال مزدوج)";
    desc = "عند خلط المحلولين تتحد أيونات لتكوين مركب شحيح الذوبان يترسب.";
  }

  if (!gas && !water && !ppt) {
    return blocked(type, typeAr, "لا يتكون راسب أو غاز أو ماء — تبقى جميع الأيونات حرة في المحلول (أيونات متفرجة)، لذا لا يحدث تفاعل فعلي.");
  }
  if (reactantsInsoluble && !acidBase && !acidCarb) return blocked(type, typeAr, "كلا المتفاعلين غير ذائب في الماء فلا تتوفر أيونات حرة للتبادل.");
  if (err) return blocked(type, typeAr, err, undefined, prods);
  const observations = [...ppObs(prods), ...gasObs(prods)];
  if (acidBase) observations.push("ارتفاع حرارة المحلول (تفاعل طارد للحرارة)", "تغير لون الكاشف عند نقطة التعادل");
  if (acidCarb) observations.unshift("فوران شديد");
  if (ammonia) observations.push("رائحة نفاذة للأمونيا تزرق ورقة تباع الشمس الحمراء المبللة");
  const notes = aqNotes(c);
  if (ammonia && c.temperature < 40) notes.push("التسخين الخفيف يسرّع طرد الأمونيا.");
  return reaction(type, typeAr, prods, desc, { observations: Array.from(new Set(observations)), notes, ea: acidBase ? 10 : 20 });
}
