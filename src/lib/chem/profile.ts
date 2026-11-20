import { ATOMIC_WEIGHTS, isOrganic, METALS, safeParseFormula, type Composition } from "./elements";
import { identify, type Reactant } from "./rules";
import { ACTIVITY, isSoluble, precipitateNote } from "./species";
import { loadMol } from "./organic";

export type Prop = { label: string; value: string };

const STRONG_ACIDS = new Set(["Cl", "Br", "I", "NO3", "SO4"]);
const STRONG_BASES = new Set(["Li", "Na", "K", "Rb", "Cs", "Ca", "Sr", "Ba"]);
const EN: Record<string, number> = { H: 2.2, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Cl: 3.16, Br: 2.96, I: 2.66, S: 2.58, P: 2.19, Na: 0.93, K: 0.82, Li: 0.98, Ca: 1.0, Mg: 1.31, Al: 1.61, Fe: 1.83, Cu: 1.9, Zn: 1.65, Ag: 1.93, Ba: 0.89, Si: 1.9, B: 2.04 };

function massPercent(comp: Composition): string {
  const total = Object.entries(comp).reduce((s, [el, n]) => s + (ATOMIC_WEIGHTS[el] || 0) * n, 0);
  return Object.entries(comp)
    .sort((a, b) => (ATOMIC_WEIGHTS[b[0]] || 0) * b[1] - (ATOMIC_WEIGHTS[a[0]] || 0) * a[1])
    .map(([el, n]) => `${el} ${(((ATOMIC_WEIGHTS[el] || 0) * n * 100) / total).toFixed(1)}%`)
    .join(" • ");
}

function functionalGroups(smiles: string): { groups: string[]; rings: number; aromatic: number } {
  const m = loadMol(smiles);
  if (!m) return { groups: [], rings: 0, aromatic: 0 };
  const g = new Set<string>();
  let aromatic = 0;
  const nAt = m.getAtoms();
  for (let a = 0; a < nAt; a++) if (m.isAromaticAtom(a)) aromatic++;
  const isO = (i: number) => m.getAtomicNo(i) === 8;
  const isN = (i: number) => m.getAtomicNo(i) === 7;
  const isC = (i: number) => m.getAtomicNo(i) === 6;
  for (let a = 0; a < nAt; a++) {
    const z = m.getAtomicNo(a);
    if (z === 6) {
      let dblO = -1, ohO = -1, singleO = -1, nAmine = -1, tripleN = false, dblC = false, tripleC = false;
      for (let i = 0; i < m.getConnAtoms(a); i++) {
        const n = m.getConnAtom(a, i), o = m.getConnBondOrder(a, i);
        if (isO(n)) {
          if (o === 2) dblO = n;
          else if (m.getAllHydrogens(n) === 1 && m.getConnAtoms(n) === 1) ohO = n;
          else singleO = n;
        } else if (isN(n)) {
          if (o === 3) tripleN = true;
          else nAmine = n;
        } else if (isC(n) && !m.isAromaticBond(m.getConnBond(a, i))) {
          if (o === 2) dblC = true;
          if (o === 3) tripleC = true;
        }
      }
      if (dblO >= 0 && ohO >= 0) g.add("حمض كربوكسيلي −COOH");
      else if (dblO >= 0 && singleO >= 0) g.add("إستر −COO−");
      else if (dblO >= 0 && nAmine >= 0) g.add("أميد −CONH−");
      else if (dblO >= 0 && m.getAllHydrogens(a) >= 1) g.add("ألدهيد −CHO");
      else if (dblO >= 0) g.add("كيتون C=O");
      else if (ohO >= 0 && m.isAromaticAtom(a)) g.add("فينول Ar−OH");
      else if (ohO >= 0) g.add("كحول −OH");
      if (tripleN) g.add("نيتريل −C≡N");
      if (dblC) g.add("ألكين C=C");
      if (tripleC) g.add("ألكاين C≡C");
      if (singleO >= 0 && dblO < 0 && ohO < 0) {
        const o = singleO;
        let bothC = true;
        for (let i = 0; i < m.getConnAtoms(o); i++) if (!isC(m.getConnAtom(o, i))) bothC = false;
        if (bothC && m.getConnAtoms(o) === 2) {
          let carbonyl = false;
          for (let i = 0; i < m.getConnAtoms(o); i++) {
            const c = m.getConnAtom(o, i);
            for (let j = 0; j < m.getConnAtoms(c); j++) if (isO(m.getConnAtom(c, j)) && m.getConnBondOrder(c, j) === 2) carbonyl = true;
          }
          if (!carbonyl) g.add("إيثر C−O−C");
        }
      }
      for (let i = 0; i < m.getConnAtoms(a); i++) {
        const zz = m.getAtomicNo(m.getConnAtom(a, i));
        if ([9, 17, 35, 53].includes(zz)) g.add("هاليد عضوي C−X");
      }
    } else if (z === 7) {
      let dblO = 0, hasC = false, carbonyl = false;
      for (let i = 0; i < m.getConnAtoms(a); i++) {
        const n = m.getConnAtom(a, i);
        if (isO(n) && m.getConnBondOrder(a, i) === 2) dblO++;
        if (isC(n)) {
          hasC = true;
          for (let j = 0; j < m.getConnAtoms(n); j++) if (isO(m.getConnAtom(n, j)) && m.getConnBondOrder(n, j) === 2) carbonyl = true;
        }
      }
      if (dblO >= 1 && m.getAtomCharge(a) !== 0) g.add("نيترو −NO₂");
      else if (hasC && !carbonyl && !m.isAromaticAtom(a) && m.getAtomCharge(a) === 0) g.add("أمين −NH₂/−NR₂");
      else if (m.isAromaticAtom(a)) g.add("حلقة غير متجانسة نيتروجينية");
    } else if (z === 16) {
      if (m.getAllHydrogens(a) === 1) g.add("ثيول −SH");
      let dblO = 0;
      for (let i = 0; i < m.getConnAtoms(a); i++) if (isO(m.getConnAtom(a, i)) && m.getConnBondOrder(a, i) === 2) dblO++;
      if (dblO === 2) g.add("سلفونيل / سلفونات");
    }
  }
  if (aromatic >= 6) g.add("حلقة أروماتية (بنزينية)");
  const rings = m.getBonds() - m.getAtoms() + m.getFragments().length;
  return { groups: Array.from(g), rings: Math.max(0, rings), aromatic };
}

export function chemicalProfile(input: { name: string; formula: string | null; smiles: string | null; charge: number | null; xlogp: number | null; tpsa: number | null; mw: number | null }): Prop[] {
  const out: Prop[] = [];
  const comp = safeParseFormula(input.formula);
  if (!comp) return out;
  const r: Reactant = { name: input.name, formula: input.formula || "", smiles: input.smiles, comp, mw: input.mw || 0 };
  const id = identify(r);
  const elements = Object.keys(comp);
  const hasMetal = elements.some((e) => METALS.has(e));
  const atoms = Object.values(comp).reduce((s, n) => s + n, 0);

  // Type & bonding
  if (id.k === "metal") out.push({ label: "النوع", value: "عنصر فلزي" }, { label: "نوع الرابطة", value: "رابطة فلزية (بحر إلكترونات)" });
  else if (id.k === "diatomic") out.push({ label: "النوع", value: "عنصر لافلزي ثنائي الذرة" }, { label: "نوع الرابطة", value: "تساهمية غير قطبية" });
  else if (id.k === "nonmetal") out.push({ label: "النوع", value: "عنصر لافلزي" }, { label: "نوع الرابطة", value: "تساهمية شبكية / جزيئية" });
  else if (elements.length === 1) out.push({ label: "النوع", value: "عنصر" });
  else if (id.k === "ionic" || (hasMetal && !isOrganic(comp)) || input.smiles?.includes(".")) out.push({ label: "النوع", value: "مركب أيوني" }, { label: "نوع الرابطة", value: "أيونية (شبكة بلورية)" });
  else if (isOrganic(comp)) out.push({ label: "النوع", value: "مركب عضوي" }, { label: "نوع الرابطة", value: "تساهمية" });
  else out.push({ label: "النوع", value: "مركب جزيئي" }, { label: "نوع الرابطة", value: "تساهمية" });

  // Two-element polarity
  if (elements.length === 2 && id.k !== "ionic" && EN[elements[0]] && EN[elements[1]]) {
    const d = Math.abs(EN[elements[0]] - EN[elements[1]]);
    out.push({ label: "فرق السالبية الكهربائية", value: `${d.toFixed(2)} → ${d < 0.4 ? "رابطة غير قطبية" : d < 1.7 ? "رابطة تساهمية قطبية" : "طابع أيوني"}` });
  }

  // Acid / base / salt behaviour
  if (id.k === "ionic") {
    if (id.cat.id === "H") {
      const strong = STRONG_ACIDS.has(id.an.id);
      out.push({ label: "التصنيف", value: `حمض ${strong ? "قوي" : "ضعيف"} (${id.an.acidAr || ""})` });
      out.push({ label: "التأين في الماء", value: strong ? "تأين كامل — إلكتروليت قوي" : "تأين جزئي — إلكتروليت ضعيف" });
      out.push({ label: "pH المحلول المخفف", value: strong ? "≈ 1 – 2" : "≈ 2.5 – 4.5" });
      out.push({ label: "التفاعلية", value: "يتفاعل مع القواعد (تعادل)، الفلزات النشطة (↑H₂)، والكربونات (↑CO₂)" });
    } else if (id.an.id === "OH") {
      const strong = STRONG_BASES.has(id.cat.id);
      out.push({ label: "التصنيف", value: `قاعدة ${strong ? "قوية (قلوي)" : "ضعيفة / شحيحة الذوبان"}` });
      out.push({ label: "pH المحلول", value: strong ? "≈ 13 – 14" : "≈ 8 – 11" });
      out.push({ label: "التفاعلية", value: "تتعادل مع الأحماض وتمتص الأكاسيد الحمضية (CO₂)" });
    } else if (id.an.id === "O") {
      const metal = METALS.has(id.cat.formula);
      out.push({ label: "التصنيف", value: metal ? "أكسيد قاعدي" : "أكسيد حمضي" });
      out.push({ label: "التفاعلية", value: metal ? "يتفاعل مع الأحماض ومع الماء (إن كان قلوياً) مكوناً هيدروكسيداً" : "يتفاعل مع الماء مكوناً حمضاً" });
    } else {
      const sol = isSoluble(id.cat, id.an);
      out.push({ label: "التصنيف", value: `ملح (${id.cat.ar} + ${id.an.ar})` });
      out.push({ label: "الذوبانية في الماء", value: sol ? "ذائب — يتفكك إلى أيونات (إلكتروليت قوي)" : `شحيح الذوبان — ${precipitateNote(id.cat, id.an)}` });
      const acidicCation = ["NH4", "Fe3", "Al", "Cu", "Zn", "Fe2"].includes(id.cat.id);
      const basicAnion = ["CO3", "HCO3", "CH3COO", "S", "PO4", "F"].includes(id.an.id);
      out.push({ label: "محلوله المائي", value: acidicCation && !basicAnion ? "حمضي قليلاً (تميؤ الكاتيون)" : basicAnion && !acidicCation ? "قاعدي قليلاً (تميؤ الأنيون)" : "متعادل تقريباً" });
      if (["NO3", "ClO3", "MnO4", "Cr2O7"].includes(id.an.id)) out.push({ label: "خاصية", value: "عامل مؤكسد" });
    }
  } else if (id.k === "metal") {
    const i = ACTIVITY.indexOf(id.sym);
    out.push({ label: "سلسلة النشاط الكيميائي", value: i < 0 ? "غير مصنف" : i < ACTIVITY.indexOf("H") ? `نشط — يحل محل الهيدروجين من الأحماض (الترتيب ${i + 1}/${ACTIVITY.length})` : `أقل نشاطاً من الهيدروجين (الترتيب ${i + 1}/${ACTIVITY.length})` });
    out.push({ label: "السلوك الكيميائي", value: i >= 0 && i <= 2 ? "يتفاعل بعنف مع الماء والأكسجين — يُحفظ تحت الزيت" : i >= 0 && i <= 6 ? "يتأكسد في الهواء ويتفاعل مع الماء الساخن/البخار" : i >= 0 && i < ACTIVITY.indexOf("H") ? "يتفاعل مع الأحماض المخففة ويتأكسد بالتسخين" : "فلز خامل نسبياً، مقاوم للتآكل" });
    out.push({ label: "نوع التفاعلات", value: "عامل مختزل (يفقد إلكترونات ويكوّن كاتيونات)" });
  } else if (id.k === "diatomic") {
    const info: Record<string, string> = { H: "عامل مختزل، قابل للاشتعال بشدة (حدود الانفجار 4–75%)", O: "عامل مؤكسد، يدعم الاحتراق", N: "خامل جداً بسبب الرابطة الثلاثية N≡N", F: "أقوى عامل مؤكسد، يتفاعل مع كل العناصر تقريباً", Cl: "عامل مؤكسد قوي، مبيّض ومطهر، سام", Br: "عامل مؤكسد، سائل أحمر بني متطاير", I: "عامل مؤكسد ضعيف، يتسامى" };
    out.push({ label: "السلوك الكيميائي", value: info[id.sym] || "—" });
  } else if (id.k === "water") out.push({ label: "التصنيف", value: "مذيب قطبي عالمي، أمفوتيري (حمض وقاعدة)" }, { label: "pH", value: "7 (متعادل)" });
  else if (id.k === "ammonia") out.push({ label: "التصنيف", value: "قاعدة ضعيفة (Kb = 1.8×10⁻⁵)" }, { label: "pH المحلول", value: "≈ 11" });
  else if (id.k === "molecular") {
    const info: Record<string, string> = { CO2: "أكسيد حمضي — يذوب في الماء مكوناً حمض الكربونيك، لا يدعم الاحتراق", CO: "غاز سام قابل للاشتعال، عامل مختزل", SO2: "أكسيد حمضي، عامل مختزل، مسبب للمطر الحمضي", SO3: "أكسيد حمضي قوي — يكوّن حمض الكبريتيك مع الماء", NO: "جذر حر، يتأكسد فوراً إلى NO₂", NO2: "غاز بني سام، عامل مؤكسد", H2O2: "عامل مؤكسد ومختزل، يتفكك إلى ماء وأكسجين", P4O10: "أكسيد حمضي، مجفف قوي جداً" };
    out.push({ label: "التصنيف", value: info[id.key] || "مركب جزيئي" });
  }

  // Organic features
  if (isOrganic(comp) && input.smiles) {
    const fg = functionalGroups(input.smiles);
    if (fg.groups.length) out.push({ label: "المجموعات الوظيفية", value: fg.groups.join("، ") });
    else if (comp.C && comp.H && Object.keys(comp).length === 2) out.push({ label: "المجموعات الوظيفية", value: "هيدروكربون مشبع (ألكان) — لا مجموعات وظيفية" });
    const X = (comp.F || 0) + (comp.Cl || 0) + (comp.Br || 0) + (comp.I || 0);
    const dbe = comp.C - (comp.H + X) / 2 + (comp.N || 0) / 2 + 1;
    out.push({ label: "درجة عدم التشبع (DBE)", value: `${dbe} — ${dbe === 0 ? "مشبع تماماً" : `${dbe} رابطة مضاعفة/حلقة`}${fg.rings ? ` • عدد الحلقات ${fg.rings}` : ""}` });
    if (fg.groups.some((g) => g.startsWith("حمض كربوكسيلي"))) out.push({ label: "الحموضة", value: "حمض عضوي ضعيف (pKa ≈ 4–5)، يتفاعل مع القواعد والكربونات" });
    if (fg.groups.some((g) => g.startsWith("أمين"))) out.push({ label: "القاعدية", value: "قاعدة عضوية ضعيفة (تكوّن أملاح أمونيوم مع الأحماض)" });
    if (fg.groups.some((g) => g.startsWith("ألكين") || g.startsWith("ألكاين"))) out.push({ label: "التفاعلية", value: "تفاعلات إضافة (H₂، X₂، HX، H₂O) — يزيل لون ماء البروم" });
    if (fg.groups.some((g) => g.startsWith("كحول"))) out.push({ label: "التفاعلية", value: "أكسدة إلى ألدهيد/كيتون/حمض، أسترة مع الأحماض، نزع ماء إلى ألكين" });
    out.push({ label: "الاحتراق", value: `قابل للاشتعال — يحترق في الأكسجين إلى CO₂ و H₂O${comp.N ? " و N₂" : ""}${comp.S ? " و SO₂" : ""}` });
  }

  // Polarity / solubility estimate from descriptors
  if (input.xlogp !== null && input.xlogp !== undefined) {
    out.push({ label: "القطبية (XLogP)", value: input.xlogp < 0 ? `${input.xlogp} — قطبي، محب للماء` : input.xlogp < 2 ? `${input.xlogp} — متوسط القطبية` : `${input.xlogp} — غير قطبي، محب للدهون` });
  }
  if (input.tpsa !== null && input.tpsa !== undefined && isOrganic(comp)) {
    out.push({ label: "الامتصاص الحيوي (TPSA)", value: input.tpsa < 60 ? `${input.tpsa} Å² — نفاذية عالية عبر الأغشية` : input.tpsa < 140 ? `${input.tpsa} Å² — امتصاص فموي محتمل` : `${input.tpsa} Å² — نفاذية منخفضة` });
  }
  if (input.charge) out.push({ label: "الشحنة الكلية", value: `${input.charge > 0 ? "+" : ""}${input.charge} (أيون)` });

  out.push({ label: "التركيب الكتلي", value: massPercent(comp) });
  out.push({ label: "عدد الذرات في الوحدة", value: `${atoms} ذرة • ${elements.length} عنصر` });
  return out;
}
