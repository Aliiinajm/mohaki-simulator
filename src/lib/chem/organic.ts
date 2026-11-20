import { Molecule } from "openchemlib";
import { parseFormula, type Composition } from "./elements";
import type { Species } from "./species";

type Mol = Molecule;

export function loadMol(smiles: string): Mol | null {
  try {
    const m = Molecule.fromSmiles(smiles);
    m.ensureHelperArrays(Molecule.cHelperRings);
    return m;
  } catch {
    return null;
  }
}

export function molInfo(m: Mol): { smiles: string; formula: string; comp: Composition; mw: number } {
  const mf = m.getMolecularFormula();
  const formula = mf.formula.replace(/[^A-Za-z0-9().+\-]/g, "");
  let comp: Composition;
  try {
    comp = parseFormula(formula.replace(/[+\-]/g, ""));
  } catch {
    comp = {};
  }
  return { smiles: m.toSmiles(), formula, comp, mw: mf.relativeWeight };
}

export function smilesToComp(smiles: string): { formula: string; comp: Composition } | null {
  // Handle multi-component salts by summing fragments
  const m = loadMol(smiles);
  if (!m) return null;
  const info = molInfo(m);
  return { formula: info.formula, comp: info.comp };
}

/** Find a carboxylic acid group: returns carbonyl C and hydroxyl O indices. */
export function findCOOH(m: Mol): { c: number; o: number } | null {
  for (let a = 0; a < m.getAtoms(); a++) {
    if (m.getAtomicNo(a) !== 6) continue;
    let dblO = -1;
    let ohO = -1;
    for (let i = 0; i < m.getConnAtoms(a); i++) {
      const n = m.getConnAtom(a, i);
      if (m.getAtomicNo(n) !== 8) continue;
      const order = m.getConnBondOrder(a, i);
      if (order === 2) dblO = n;
      else if (order === 1 && m.getConnAtoms(n) === 1 && m.getAllHydrogens(n) === 1 && m.getAtomCharge(n) === 0) ohO = n;
    }
    if (dblO >= 0 && ohO >= 0) return { c: a, o: ohO };
  }
  return null;
}

/** Find an alcohol O-H (not part of acid, not phenol). */
export function findAlcoholOH(m: Mol): number | null {
  for (let a = 0; a < m.getAtoms(); a++) {
    if (m.getAtomicNo(a) !== 8 || m.getConnAtoms(a) !== 1 || m.getAllHydrogens(a) !== 1 || m.getAtomCharge(a) !== 0) continue;
    const c = m.getConnAtom(a, 0);
    if (m.getAtomicNo(c) !== 6 || m.isAromaticAtom(c)) continue;
    let carbonyl = false;
    for (let i = 0; i < m.getConnAtoms(c); i++) {
      if (m.getConnBondOrder(c, i) === 2 && m.getAtomicNo(m.getConnAtom(c, i)) === 8) carbonyl = true;
    }
    if (m.getAtomPi(c) > 0) continue;
    if (!carbonyl) return a;
  }
  return null;
}

/** Find non-aromatic C=C or C≡C bonds. */
export function findMultipleCC(m: Mol): number[] {
  const out: number[] = [];
  for (let b = 0; b < m.getBonds(); b++) {
    const a1 = m.getBondAtom(0, b);
    const a2 = m.getBondAtom(1, b);
    if (m.getAtomicNo(a1) === 6 && m.getAtomicNo(a2) === 6 && m.getBondOrder(b) >= 2 && !m.isAromaticBond(b)) out.push(b);
  }
  return out;
}

const organicSpecies = (m: Mol, nameAr: string, name: string, state: Species["state"] = "l"): Species => {
  const info = molInfo(m);
  return { formula: info.formula, name, nameAr, smiles: info.smiles, comp: info.comp, state };
};

/**
 * Electrophilic addition across the first non-aromatic C=C / C≡C.
 * heavyAtoms: atomic numbers to attach to carbon 1 and carbon 2 (H atoms are implicit).
 * all=true saturates all multiple bonds (full hydrogenation).
 */
export function addAcross(smiles: string, heavyAtoms: number[], nameAr: string, name: string, all = false): Species | null {
  const m = loadMol(smiles);
  if (!m) return null;
  const bonds = findMultipleCC(m);
  if (!bonds.length) return null;
  if (all) {
    bonds.forEach((b) => m.setBondOrder(b, 1));
  } else {
    const b = bonds[0];
    const a1 = m.getBondAtom(0, b);
    const a2 = m.getBondAtom(1, b);
    // Markovnikov: attach the heavy atom to the more substituted carbon when only one is added
    const sub1 = m.getConnAtoms(a1);
    const sub2 = m.getConnAtoms(a2);
    const [c1, c2] = heavyAtoms.length === 1 && sub2 > sub1 ? [a2, a1] : [a1, a2];
    m.setBondOrder(b, m.getBondOrder(b) - 1);
    if (heavyAtoms[0]) m.addBond(c1, m.addAtom(heavyAtoms[0]));
    if (heavyAtoms[1]) m.addBond(c2, m.addAtom(heavyAtoms[1]));
  }
  m.ensureHelperArrays(Molecule.cHelperRings);
  return organicSpecies(m, nameAr, name);
}

/** Free-radical substitution: replace one H on an sp3 carbon with a halogen. */
export function substitute(smiles: string, halogenAtomicNo: number, nameAr: string): Species | null {
  const m = loadMol(smiles);
  if (!m) return null;
  for (let a = 0; a < m.getAtoms(); a++) {
    if (m.getAtomicNo(a) === 6 && !m.isAromaticAtom(a) && m.getAtomPi(a) === 0 && m.getAllHydrogens(a) > 0) {
      m.addBond(a, m.addAtom(halogenAtomicNo));
      m.ensureHelperArrays(Molecule.cHelperRings);
      return organicSpecies(m, nameAr, "haloalkane", "l");
    }
  }
  return null;
}

export function esterify(acidSmiles: string, alcoholSmiles: string): Species | null {
  const acid = loadMol(acidSmiles);
  const alc = loadMol(alcoholSmiles);
  if (!acid || !alc) return null;
  const g = findCOOH(acid);
  const o = findAlcoholOH(alc);
  if (!g || o === null) return null;
  const map = acid.addMolecule(alc);
  acid.addBond(g.c, map[o]);
  acid.deleteAtom(g.o);
  acid.ensureHelperArrays(Molecule.cHelperRings);
  return organicSpecies(acid, "إستر", "ester");
}

/** Deprotonate first COOH (or alcohol OH) and pair with metal cations. */
export function organicSalt(smiles: string, cationSmiles: string, cationCharge: number, kind: "acid" | "alcohol"): Species | null {
  const m = loadMol(smiles);
  if (!m) return null;
  let o: number | null = null;
  if (kind === "acid") o = findCOOH(m)?.o ?? null;
  else o = findAlcoholOH(m);
  if (o === null) return null;
  m.setAtomCharge(o, -1);
  m.ensureHelperArrays(Molecule.cHelperRings);
  const anionSmiles = m.toSmiles();
  const parts = [...Array(cationCharge).fill(anionSmiles), cationSmiles];
  const full = parts.join(".");
  const info = smilesToComp(full);
  if (!info) return null;
  return {
    formula: info.formula,
    name: kind === "acid" ? "carboxylate salt" : "alkoxide",
    nameAr: kind === "acid" ? "ملح كربوكسيلات" : "ألكوكسيد",
    smiles: full,
    comp: info.comp,
    state: kind === "acid" ? "aq" : "s",
  };
}
