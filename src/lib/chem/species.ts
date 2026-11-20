import { compositionKey, parseFormula, type Composition } from "./elements";

export type State = "s" | "l" | "g" | "aq";

export type Species = {
  formula: string;
  name: string;
  nameAr: string;
  smiles: string;
  comp: Composition;
  state: State;
  note?: string; // e.g. precipitate color
};

export type Ion = {
  id: string;
  formula: string;
  charge: number;
  en: string;
  ar: string;
  smiles: string;
  poly: boolean;
};

export const CATIONS: Ion[] = [
  { id: "H", formula: "H", charge: 1, en: "hydrogen", ar: "الهيدروجين", smiles: "[H+]", poly: false },
  { id: "Li", formula: "Li", charge: 1, en: "lithium", ar: "الليثيوم", smiles: "[Li+]", poly: false },
  { id: "Na", formula: "Na", charge: 1, en: "sodium", ar: "الصوديوم", smiles: "[Na+]", poly: false },
  { id: "K", formula: "K", charge: 1, en: "potassium", ar: "البوتاسيوم", smiles: "[K+]", poly: false },
  { id: "Rb", formula: "Rb", charge: 1, en: "rubidium", ar: "الروبيديوم", smiles: "[Rb+]", poly: false },
  { id: "Cs", formula: "Cs", charge: 1, en: "cesium", ar: "السيزيوم", smiles: "[Cs+]", poly: false },
  { id: "Ag", formula: "Ag", charge: 1, en: "silver", ar: "الفضة", smiles: "[Ag+]", poly: false },
  { id: "NH4", formula: "NH4", charge: 1, en: "ammonium", ar: "الأمونيوم", smiles: "[NH4+]", poly: true },
  { id: "Mg", formula: "Mg", charge: 2, en: "magnesium", ar: "المغنيسيوم", smiles: "[Mg+2]", poly: false },
  { id: "Ca", formula: "Ca", charge: 2, en: "calcium", ar: "الكالسيوم", smiles: "[Ca+2]", poly: false },
  { id: "Sr", formula: "Sr", charge: 2, en: "strontium", ar: "السترونشيوم", smiles: "[Sr+2]", poly: false },
  { id: "Ba", formula: "Ba", charge: 2, en: "barium", ar: "الباريوم", smiles: "[Ba+2]", poly: false },
  { id: "Zn", formula: "Zn", charge: 2, en: "zinc", ar: "الخارصين", smiles: "[Zn+2]", poly: false },
  { id: "Fe2", formula: "Fe", charge: 2, en: "iron(II)", ar: "الحديد (II)", smiles: "[Fe+2]", poly: false },
  { id: "Fe3", formula: "Fe", charge: 3, en: "iron(III)", ar: "الحديد (III)", smiles: "[Fe+3]", poly: false },
  { id: "Cu", formula: "Cu", charge: 2, en: "copper(II)", ar: "النحاس (II)", smiles: "[Cu+2]", poly: false },
  { id: "Al", formula: "Al", charge: 3, en: "aluminium", ar: "الألومنيوم", smiles: "[Al+3]", poly: false },
  { id: "Pb", formula: "Pb", charge: 2, en: "lead(II)", ar: "الرصاص (II)", smiles: "[Pb+2]", poly: false },
  { id: "Ni", formula: "Ni", charge: 2, en: "nickel(II)", ar: "النيكل (II)", smiles: "[Ni+2]", poly: false },
  { id: "Sn", formula: "Sn", charge: 2, en: "tin(II)", ar: "القصدير (II)", smiles: "[Sn+2]", poly: false },
  { id: "Mn", formula: "Mn", charge: 2, en: "manganese(II)", ar: "المنغنيز (II)", smiles: "[Mn+2]", poly: false },
  { id: "Cr", formula: "Cr", charge: 3, en: "chromium(III)", ar: "الكروم (III)", smiles: "[Cr+3]", poly: false },
  { id: "Co", formula: "Co", charge: 2, en: "cobalt(II)", ar: "الكوبالت (II)", smiles: "[Co+2]", poly: false },
  { id: "Hg", formula: "Hg", charge: 2, en: "mercury(II)", ar: "الزئبق (II)", smiles: "[Hg+2]", poly: false },
];

export type Anion = Ion & { acidSmiles?: string; acidAr?: string; acidEn?: string };

export const ANIONS: Anion[] = [
  { id: "F", formula: "F", charge: -1, en: "fluoride", ar: "فلوريد", smiles: "[F-]", poly: false, acidSmiles: "F", acidAr: "حمض الهيدروفلوريك", acidEn: "hydrofluoric acid" },
  { id: "Cl", formula: "Cl", charge: -1, en: "chloride", ar: "كلوريد", smiles: "[Cl-]", poly: false, acidSmiles: "Cl", acidAr: "حمض الهيدروكلوريك", acidEn: "hydrochloric acid" },
  { id: "Br", formula: "Br", charge: -1, en: "bromide", ar: "بروميد", smiles: "[Br-]", poly: false, acidSmiles: "Br", acidAr: "حمض الهيدروبروميك", acidEn: "hydrobromic acid" },
  { id: "I", formula: "I", charge: -1, en: "iodide", ar: "يوديد", smiles: "[I-]", poly: false, acidSmiles: "I", acidAr: "حمض الهيدرويوديك", acidEn: "hydroiodic acid" },
  { id: "NO3", formula: "NO3", charge: -1, en: "nitrate", ar: "نترات", smiles: "[O-][N+](=O)[O-]", poly: true, acidSmiles: "O[N+](=O)[O-]", acidAr: "حمض النيتريك", acidEn: "nitric acid" },
  { id: "SO4", formula: "SO4", charge: -2, en: "sulfate", ar: "كبريتات", smiles: "[O-]S(=O)(=O)[O-]", poly: true, acidSmiles: "OS(=O)(=O)O", acidAr: "حمض الكبريتيك", acidEn: "sulfuric acid" },
  { id: "CO3", formula: "CO3", charge: -2, en: "carbonate", ar: "كربونات", smiles: "C(=O)([O-])[O-]", poly: true, acidSmiles: "OC(=O)O", acidAr: "حمض الكربونيك", acidEn: "carbonic acid" },
  { id: "HCO3", formula: "HCO3", charge: -1, en: "bicarbonate", ar: "بيكربونات", smiles: "OC(=O)[O-]", poly: true },
  { id: "PO4", formula: "PO4", charge: -3, en: "phosphate", ar: "فوسفات", smiles: "[O-]P(=O)([O-])[O-]", poly: true, acidSmiles: "OP(=O)(O)O", acidAr: "حمض الفوسفوريك", acidEn: "phosphoric acid" },
  { id: "CH3COO", formula: "CH3COO", charge: -1, en: "acetate", ar: "أسيتات", smiles: "CC(=O)[O-]", poly: true, acidSmiles: "CC(=O)O", acidAr: "حمض الخليك", acidEn: "acetic acid" },
  { id: "S", formula: "S", charge: -2, en: "sulfide", ar: "كبريتيد", smiles: "[S-2]", poly: false, acidSmiles: "S", acidAr: "كبريتيد الهيدروجين", acidEn: "hydrogen sulfide" },
  { id: "OH", formula: "OH", charge: -1, en: "hydroxide", ar: "هيدروكسيد", smiles: "[OH-]", poly: true },
  { id: "O", formula: "O", charge: -2, en: "oxide", ar: "أكسيد", smiles: "[O-2]", poly: false },
];

export const cation = (id: string) => CATIONS.find((c) => c.id === id)!;
export const anion = (id: string) => ANIONS.find((a) => a.id === id)!;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/* ------------------------------ Molecular species ------------------------------ */

const MOL: Record<string, Omit<Species, "comp">> = {
  H2O: { formula: "H2O", name: "water", nameAr: "ماء", smiles: "O", state: "l" },
  H2: { formula: "H2", name: "hydrogen", nameAr: "هيدروجين", smiles: "[H][H]", state: "g" },
  O2: { formula: "O2", name: "oxygen", nameAr: "أكسجين", smiles: "O=O", state: "g" },
  N2: { formula: "N2", name: "nitrogen", nameAr: "نيتروجين", smiles: "N#N", state: "g" },
  F2: { formula: "F2", name: "fluorine", nameAr: "فلور", smiles: "FF", state: "g" },
  Cl2: { formula: "Cl2", name: "chlorine", nameAr: "كلور", smiles: "ClCl", state: "g" },
  Br2: { formula: "Br2", name: "bromine", nameAr: "بروم", smiles: "BrBr", state: "l" },
  I2: { formula: "I2", name: "iodine", nameAr: "يود", smiles: "II", state: "s" },
  CO2: { formula: "CO2", name: "carbon dioxide", nameAr: "ثاني أكسيد الكربون", smiles: "O=C=O", state: "g" },
  CO: { formula: "CO", name: "carbon monoxide", nameAr: "أول أكسيد الكربون", smiles: "[C-]#[O+]", state: "g" },
  NH3: { formula: "NH3", name: "ammonia", nameAr: "أمونيا", smiles: "N", state: "g" },
  SO2: { formula: "SO2", name: "sulfur dioxide", nameAr: "ثاني أكسيد الكبريت", smiles: "O=S=O", state: "g" },
  SO3: { formula: "SO3", name: "sulfur trioxide", nameAr: "ثالث أكسيد الكبريت", smiles: "O=S(=O)=O", state: "g" },
  NO: { formula: "NO", name: "nitric oxide", nameAr: "أكسيد النيتريك", smiles: "[N]=O", state: "g" },
  NO2: { formula: "NO2", name: "nitrogen dioxide", nameAr: "ثاني أكسيد النيتروجين", smiles: "N(=O)[O]", state: "g" },
  P4O10: { formula: "P4O10", name: "phosphorus pentoxide", nameAr: "خامس أكسيد الفوسفور", smiles: "O=P12OP3(=O)OP(=O)(O1)OP(=O)(O2)O3", state: "s" },
  H2O2: { formula: "H2O2", name: "hydrogen peroxide", nameAr: "بيروكسيد الهيدروجين", smiles: "OO", state: "l" },
  HCl: { formula: "HCl", name: "hydrogen chloride", nameAr: "كلوريد الهيدروجين", smiles: "Cl", state: "g" },
  HBr: { formula: "HBr", name: "hydrogen bromide", nameAr: "بروميد الهيدروجين", smiles: "Br", state: "g" },
  HF: { formula: "HF", name: "hydrogen fluoride", nameAr: "فلوريد الهيدروجين", smiles: "F", state: "g" },
  HI: { formula: "HI", name: "hydrogen iodide", nameAr: "يوديد الهيدروجين", smiles: "I", state: "g" },
  H2SO3: { formula: "H2SO3", name: "sulfurous acid", nameAr: "حمض الكبريتوز", smiles: "OS(=O)O", state: "aq" },
  C: { formula: "C", name: "carbon", nameAr: "كربون", smiles: "[C]", state: "s" },
  S: { formula: "S", name: "sulfur", nameAr: "كبريت", smiles: "[S]", state: "s" },
};

export function mol(key: keyof typeof MOL | string, state?: State): Species {
  const m = MOL[key];
  return { ...m, state: state || m.state, comp: parseFormula(m.formula) };
}

export function metalElement(sym: string, nameAr?: string): Species {
  return { formula: sym, name: sym, nameAr: nameAr || sym, smiles: `[${sym}]`, comp: { [sym]: 1 }, state: "s" };
}

/* ------------------------------ Salts ------------------------------ */

const PRECIPITATE_COLORS: Record<string, string> = {
  "Ag-Cl": "راسب أبيض",
  "Ag-Br": "راسب أصفر باهت",
  "Ag-I": "راسب أصفر",
  "Pb-I": "راسب أصفر ذهبي",
  "Pb-Cl": "راسب أبيض",
  "Ba-SO4": "راسب أبيض",
  "Sr-SO4": "راسب أبيض",
  "Pb-SO4": "راسب أبيض",
  "Ca-SO4": "راسب أبيض قليل",
  "Cu-OH": "راسب أزرق",
  "Fe3-OH": "راسب بني محمر",
  "Fe2-OH": "راسب أخضر",
  "Ni-OH": "راسب أخضر",
  "Co-OH": "راسب وردي/أزرق",
  "Mn-OH": "راسب أبيض مائل للوردي",
  "Al-OH": "راسب أبيض جيلاتيني",
  "Zn-OH": "راسب أبيض",
  "Mg-OH": "راسب أبيض",
  "Ca-CO3": "راسب أبيض",
  "Ba-CO3": "راسب أبيض",
  "Cu-CO3": "راسب أزرق مخضر",
  "Ag-CO3": "راسب أصفر باهت",
  "Ag-OH": "راسب بني (Ag₂O)",
  "Cu-S": "راسب أسود",
  "Pb-S": "راسب أسود",
  "Zn-S": "راسب أبيض",
  "Ag-PO4": "راسب أصفر",
  "Ca-PO4": "راسب أبيض",
};

const ALWAYS_SOLUBLE_CATIONS = new Set(["H", "Li", "Na", "K", "Rb", "Cs", "NH4"]);

/** Solubility rules (simplified, 25°C, aqueous). */
export function isSoluble(cat: Ion, an: Anion): boolean {
  if (ALWAYS_SOLUBLE_CATIONS.has(cat.id)) return true;
  if (["NO3", "CH3COO", "HCO3"].includes(an.id)) return true;
  if (["Cl", "Br", "I"].includes(an.id)) return !["Ag", "Pb", "Hg"].includes(cat.id);
  if (an.id === "F") return !["Ca", "Mg", "Ba", "Sr", "Pb"].includes(cat.id);
  if (an.id === "SO4") return !["Ba", "Sr", "Pb", "Ca", "Ag"].includes(cat.id);
  if (an.id === "OH") return ["Ba", "Sr", "Ca"].includes(cat.id);
  if (an.id === "O") return false;
  return false; // CO3, PO4, S
}

export function precipitateNote(cat: Ion, an: Anion): string {
  return PRECIPITATE_COLORS[`${cat.id}-${an.id}`] || "راسب";
}

export function makeSalt(cat: Ion, an: Anion, stateOverride?: State): Species {
  // Special molecular results
  if (cat.id === "H" && (an.id === "OH" || an.id === "O")) return mol("H2O");
  if (cat.id === "H" && an.id === "CO3") return { ...mol("CO2"), note: "H₂CO₃ يتفكك إلى CO₂ + H₂O" };
  if (cat.id === "NH4" && an.id === "OH") return mol("NH3");
  const g = gcd(cat.charge, -an.charge);
  const nCat = -an.charge / g;
  const nAn = cat.charge / g;
  const part = (ion: Ion, n: number) => (n === 1 ? ion.formula : ion.poly ? `(${ion.formula})${n}` : `${ion.formula}${n}`);
  let formula: string;
  if (an.id === "CH3COO" && cat.id === "H") formula = "CH3COOH";
  else if (an.id === "CH3COO") formula = `${part(cat, nCat)}${nAn === 1 ? "CH3COO" : `(CH3COO)${nAn}`}`;
  else formula = `${part(cat, nCat)}${part(an, nAn)}`;
  if (cat.id === "H") {
    return {
      formula,
      name: an.acidEn || `hydrogen ${an.en}`,
      nameAr: an.acidAr || `${an.ar} الهيدروجين`,
      smiles: an.acidSmiles || Array(nCat).fill("[H+]").concat(Array(nAn).fill(an.smiles)).join("."),
      comp: parseFormula(formula),
      state: "aq",
    };
  }
  const soluble = isSoluble(cat, an);
  const smiles = [...Array(nCat).fill(cat.smiles), ...Array(nAn).fill(an.smiles)].join(".");
  return {
    formula,
    name: `${cat.en} ${an.en}`,
    nameAr: `${an.ar} ${cat.ar}`,
    smiles,
    comp: parseFormula(formula),
    state: stateOverride || (an.id === "O" ? "s" : soluble ? "aq" : "s"),
    note: !soluble && an.id !== "O" && !stateOverride ? precipitateNote(cat, an) : undefined,
  };
}

/** Map composition-key → {cation, anion} for every salt/acid/base/oxide combination. */
const SALT_MAP = new Map<string, { cat: Ion; an: Anion }>();
for (const c of CATIONS) {
  for (const a of ANIONS) {
    if (c.id === "H" && (a.id === "OH" || a.id === "O")) continue;
    if (c.id === "NH4" && (a.id === "OH" || a.id === "O")) continue;
    if (c.id === "H" && a.id === "HCO3") continue;
    const s = makeSalt(c, a);
    if (c.id === "H" && a.id === "CO3") {
      SALT_MAP.set(compositionKey(parseFormula("H2CO3")), { cat: c, an: a });
      continue;
    }
    const k = compositionKey(s.comp);
    if (!SALT_MAP.has(k)) SALT_MAP.set(k, { cat: c, an: a });
  }
}
export function matchSalt(comp: Composition) {
  return SALT_MAP.get(compositionKey(comp)) || null;
}

/* ------------------------------ Activity series ------------------------------ */

export const ACTIVITY = ["K", "Na", "Li", "Ba", "Sr", "Ca", "Mg", "Al", "Mn", "Zn", "Cr", "Fe", "Co", "Ni", "Sn", "Pb", "H", "Cu", "Hg", "Ag", "Pt", "Au"];
export const activityIndex = (sym: string) => {
  const i = ACTIVITY.indexOf(sym);
  return i === -1 ? 99 : i;
};
export const METAL_DEFAULT_CATION: Record<string, string> = {
  K: "K", Na: "Na", Li: "Li", Rb: "Rb", Cs: "Cs", Ba: "Ba", Sr: "Sr", Ca: "Ca", Mg: "Mg", Al: "Al", Mn: "Mn", Zn: "Zn",
  Cr: "Cr", Fe: "Fe2", Co: "Co", Ni: "Ni", Sn: "Sn", Pb: "Pb", Cu: "Cu", Hg: "Hg", Ag: "Ag",
};
export const METAL_AR: Record<string, string> = {
  K: "بوتاسيوم", Na: "صوديوم", Li: "ليثيوم", Rb: "روبيديوم", Cs: "سيزيوم", Ba: "باريوم", Sr: "سترونشيوم", Ca: "كالسيوم",
  Mg: "مغنيسيوم", Al: "ألومنيوم", Mn: "منغنيز", Zn: "خارصين", Cr: "كروم", Fe: "حديد", Co: "كوبالت", Ni: "نيكل", Sn: "قصدير",
  Pb: "رصاص", Cu: "نحاس", Hg: "زئبق", Ag: "فضة", Pt: "بلاتين", Au: "ذهب",
};
export const HALOGEN_ORDER = ["F", "Cl", "Br", "I"];

/* ------------------------------ Thermochemistry (ΔHf°, kJ/mol) ------------------------------ */

const DHF_RAW: [string, number][] = [
  ["H2O", -285.8], ["CO2", -393.5], ["CO", -110.5], ["NH3", -45.9], ["HCl", -92.3], ["HBr", -36.3], ["HI", 26.5], ["HF", -273.3],
  ["H2SO4", -814.0], ["HNO3", -174.1], ["H3PO4", -1284.4], ["H2O2", -187.8], ["SO2", -296.8], ["SO3", -395.7], ["NO", 91.3],
  ["NO2", 33.2], ["P4O10", -2984.0], ["CH4", -74.6], ["C2H6", -84.0], ["C3H8", -103.8], ["C4H10", -125.6], ["C8H18", -250.1],
  ["C2H4", 52.4], ["C2H2", 227.4], ["C6H6", 49.1], ["C2H6O", -277.6], ["CH4O", -239.2], ["C6H12O6", -1273.3], ["C2H4O2", -484.3],
  ["C4H8O2", -479.3], ["C12H22O11", -2226.1], ["C3H6O", -248.4], ["NaCl", -411.2], ["KCl", -436.7], ["LiCl", -408.6], ["CaCl2", -795.8],
  ["MgCl2", -641.3], ["ZnCl2", -415.1], ["FeCl2", -341.8], ["FeCl3", -399.5], ["AlCl3", -704.2], ["CuCl2", -220.1], ["BaCl2", -858.6],
  ["AgCl", -127.0], ["PbCl2", -359.4], ["NH4Cl", -314.4], ["NaBr", -361.1], ["KBr", -393.8], ["NaI", -287.8], ["KI", -327.9],
  ["AgBr", -100.4], ["AgI", -61.8], ["PbI2", -175.5], ["NaF", -576.6], ["CuSO4", -771.4], ["ZnSO4", -982.8], ["Na2SO4", -1387.1],
  ["K2SO4", -1437.8], ["BaSO4", -1473.2], ["MgSO4", -1284.9], ["CaSO4", -1434.5], ["FeSO4", -928.4], ["(NH4)2SO4", -1180.9],
  ["NaNO3", -467.9], ["KNO3", -494.6], ["AgNO3", -124.4], ["Cu(NO3)2", -302.9], ["Pb(NO3)2", -451.9], ["Ca(NO3)2", -938.4],
  ["Ba(NO3)2", -992.1], ["NH4NO3", -365.6], ["NaOH", -425.6], ["KOH", -424.8], ["LiOH", -484.9], ["Ca(OH)2", -985.2],
  ["Mg(OH)2", -924.5], ["Ba(OH)2", -944.7], ["Cu(OH)2", -449.8], ["Fe(OH)3", -823.0], ["Al(OH)3", -1276.0], ["Zn(OH)2", -641.9],
  ["CaCO3", -1207.6], ["Na2CO3", -1130.7], ["K2CO3", -1151.0], ["NaHCO3", -950.8], ["MgCO3", -1095.8], ["BaCO3", -1216.3],
  ["CaO", -634.9], ["MgO", -601.6], ["Na2O", -414.2], ["K2O", -361.5], ["Li2O", -597.9], ["BaO", -548.0], ["Fe2O3", -824.2],
  ["Fe3O4", -1118.4], ["CuO", -157.3], ["Al2O3", -1675.7], ["ZnO", -350.5], ["PbO", -217.3], ["Ag2O", -31.1], ["H2CO3", -699.7],
  ["CH3COONa", -708.8], ["H2S", -20.6], ["H2SO3", -608.8], ["N2O5", -43.1],
];
export const DHF = new Map<string, number>();
for (const [f, v] of DHF_RAW) DHF.set(compositionKey(parseFormula(f)), v);

export function enthalpyOfFormation(comp: Composition): number | null {
  const keys = Object.keys(comp);
  // Elements in standard state: 0
  if (keys.length === 1) {
    const el = keys[0];
    const n = comp[el];
    const diatomic = ["H", "N", "O", "F", "Cl", "Br", "I"].includes(el);
    if ((diatomic && n === 2) || (!diatomic && (n === 1 || (el === "P" && n === 4) || (el === "S" && n === 8)))) return 0;
  }
  const v = DHF.get(compositionKey(comp));
  return v === undefined ? null : v;
}
