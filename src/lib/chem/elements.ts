// Standard atomic weights (IUPAC, abridged) for all 118 elements.
const RAW =
  "H:1.008,He:4.0026,Li:6.94,Be:9.0122,B:10.81,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.180," +
  "Na:22.990,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,Ar:39.948,K:39.098,Ca:40.078," +
  "Sc:44.956,Ti:47.867,V:50.942,Cr:51.996,Mn:54.938,Fe:55.845,Co:58.933,Ni:58.693,Cu:63.546,Zn:65.38," +
  "Ga:69.723,Ge:72.630,As:74.922,Se:78.971,Br:79.904,Kr:83.798,Rb:85.468,Sr:87.62,Y:88.906,Zr:91.224," +
  "Nb:92.906,Mo:95.95,Tc:98,Ru:101.07,Rh:102.91,Pd:106.42,Ag:107.87,Cd:112.41,In:114.82,Sn:118.71," +
  "Sb:121.76,Te:127.60,I:126.90,Xe:131.29,Cs:132.91,Ba:137.33,La:138.91,Ce:140.12,Pr:140.91,Nd:144.24," +
  "Pm:145,Sm:150.36,Eu:151.96,Gd:157.25,Tb:158.93,Dy:162.50,Ho:164.93,Er:167.26,Tm:168.93,Yb:173.05," +
  "Lu:174.97,Hf:178.49,Ta:180.95,W:183.84,Re:186.21,Os:190.23,Ir:192.22,Pt:195.08,Au:196.97,Hg:200.59," +
  "Tl:204.38,Pb:207.2,Bi:208.98,Po:209,At:210,Rn:222,Fr:223,Ra:226,Ac:227,Th:232.04," +
  "Pa:231.04,U:238.03,Np:237,Pu:244,Am:243,Cm:247,Bk:247,Cf:251,Es:252,Fm:257," +
  "Md:258,No:259,Lr:266,Rf:267,Db:268,Sg:269,Bh:270,Hs:269,Mt:278,Ds:281," +
  "Rg:282,Cn:285,Nh:286,Fl:289,Mc:290,Lv:293,Ts:294,Og:294";

export const ATOMIC_WEIGHTS: Record<string, number> = {};
export const ATOMIC_NUMBERS: Record<string, number> = {};
RAW.split(",").forEach((pair, i) => {
  const [sym, w] = pair.split(":");
  ATOMIC_WEIGHTS[sym] = parseFloat(w);
  ATOMIC_NUMBERS[sym] = i + 1;
});

export const METALS = new Set(
  "Li,Be,Na,Mg,Al,K,Ca,Sc,Ti,V,Cr,Mn,Fe,Co,Ni,Cu,Zn,Ga,Rb,Sr,Y,Zr,Nb,Mo,Tc,Ru,Rh,Pd,Ag,Cd,In,Sn,Cs,Ba,La,Ce,Pr,Nd,Pm,Sm,Eu,Gd,Tb,Dy,Ho,Er,Tm,Yb,Lu,Hf,Ta,W,Re,Os,Ir,Pt,Au,Hg,Tl,Pb,Bi,Po,Fr,Ra,Ac,Th,Pa,U,Np,Pu".split(",")
);

export type Composition = Record<string, number>;

/** Parse a chemical formula like "Ca(NO3)2", "CuSO4·5H2O", "[Fe(CN)6]K3" into atom counts. */
export function parseFormula(formula: string): Composition {
  const clean = formula.replace(/\s+/g, "").replace(/[+\-]\d*$/g, "").replace(/[⁺⁻]/g, "");
  const parts = clean.split(/[·.*•]/);
  const total: Composition = {};
  for (const part of parts) {
    const m = part.match(/^(\d+)(.*)$/);
    const mult = m ? parseInt(m[1], 10) : 1;
    const body = m ? m[2] : part;
    const comp = parseGroup(body);
    for (const [el, n] of Object.entries(comp)) total[el] = (total[el] || 0) + n * mult;
  }
  return total;
}

function parseGroup(s: string): Composition {
  const stack: Composition[] = [{}];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push({});
      i++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      i++;
      let num = "";
      while (i < s.length && /\d/.test(s[i])) num += s[i++];
      const mult = num ? parseInt(num, 10) : 1;
      const top = stack.pop() || {};
      const cur = stack[stack.length - 1];
      for (const [el, n] of Object.entries(top)) cur[el] = (cur[el] || 0) + n * mult;
    } else if (/[A-Z]/.test(ch)) {
      let sym = ch;
      i++;
      while (i < s.length && /[a-z]/.test(s[i])) sym += s[i++];
      let num = "";
      while (i < s.length && /\d/.test(s[i])) num += s[i++];
      const cur = stack[stack.length - 1];
      if (!(sym in ATOMIC_WEIGHTS)) throw new Error(`Unknown element: ${sym}`);
      cur[sym] = (cur[sym] || 0) + (num ? parseInt(num, 10) : 1);
    } else {
      i++;
    }
  }
  while (stack.length > 1) {
    const top = stack.pop() || {};
    const cur = stack[stack.length - 1];
    for (const [el, n] of Object.entries(top)) cur[el] = (cur[el] || 0) + n;
  }
  return stack[0];
}

export function safeParseFormula(formula: string | null | undefined): Composition | null {
  if (!formula) return null;
  try {
    const c = parseFormula(formula);
    return Object.keys(c).length ? c : null;
  } catch {
    return null;
  }
}

export function molarMass(comp: Composition): number {
  let m = 0;
  for (const [el, n] of Object.entries(comp)) m += (ATOMIC_WEIGHTS[el] || 0) * n;
  return Math.round(m * 1000) / 1000;
}

export function compositionKey(comp: Composition): string {
  return Object.keys(comp)
    .sort()
    .map((el) => `${el}${comp[el]}`)
    .join("");
}

export function isSingleElement(comp: Composition): string | null {
  const keys = Object.keys(comp);
  return keys.length === 1 ? keys[0] : null;
}

export function isOrganic(comp: Composition): boolean {
  return !!comp.C && !!comp.H && Object.keys(comp).every((e) => ["C", "H", "O", "N", "S", "Cl", "Br", "I", "F", "P"].includes(e));
}

export function isHydrocarbonLike(comp: Composition): boolean {
  return !!comp.C && !!comp.H && Object.keys(comp).every((e) => ["C", "H", "O", "N", "S"].includes(e));
}

/** Convert a formula to mhchem-friendly string (keeps digits; mhchem auto-subscripts). */
export function toMhchem(formula: string): string {
  return formula.replace(/·/g, " * ");
}
