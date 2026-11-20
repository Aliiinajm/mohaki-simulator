"use client";
import type * as OCLType from "openchemlib";

let oclPromise: Promise<typeof OCLType> | null = null;
export function loadOCL(): Promise<typeof OCLType> {
  if (!oclPromise) oclPromise = import("openchemlib");
  return oclPromise;
}

let resourcesPromise: Promise<boolean> | null = null;
/** The conformer generator needs OpenChemLib's static resources (torsion library) registered once. */
async function ensureResources(OCL: typeof OCLType): Promise<boolean> {
  if (!resourcesPromise) {
    resourcesPromise = (async () => {
      try {
        const r = await fetch("/ocl/resources.json");
        if (!r.ok) return false;
        OCL.Resources.register(await r.text());
        return true;
      } catch {
        return false;
      }
    })();
  }
  return resourcesPromise;
}

/** Generate a 3D molfile from SMILES with OpenChemLib's conformer generator (client-side). */
export async function smilesTo3DMolfile(smiles: string): Promise<string | null> {
  try {
    const OCL = await loadOCL();
    await ensureResources(OCL);
    const mol = OCL.Molecule.fromSmiles(smiles);
    const gen = new OCL.ConformerGenerator(42);
    const conf = gen.getOneConformerAsMolecule(mol);
    if (!conf) return null;
    return conf.toMolfile();
  } catch {
    return null;
  }
}
