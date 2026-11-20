import type { Composition } from "./elements";

// Exact rational arithmetic using BigInt to balance equations via null-space computation.
type Frac = { n: bigint; d: bigint };

const bAbs = (a: bigint) => (a < BigInt(0) ? -a : a);
function gcd(a: bigint, b: bigint): bigint {
  a = bAbs(a);
  b = bAbs(b);
  while (b) [a, b] = [b, a % b];
  return a || BigInt(1);
}
function frac(n: bigint, d: bigint = BigInt(1)): Frac {
  if (d < BigInt(0)) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
const isZero = (a: Frac) => a.n === BigInt(0);

/**
 * Balance reactants -> products. Returns integer coefficients (reactants first, then products)
 * or null if no unique positive solution exists.
 */
export function balanceEquation(reactants: Composition[], products: Composition[]): number[] | null {
  const species = [...reactants, ...products];
  const elements = Array.from(new Set(species.flatMap((c) => Object.keys(c))));
  const cols = species.length;
  // Build matrix (rows = elements)
  const M: Frac[][] = elements.map((el) =>
    species.map((c, j) => frac(BigInt((c[el] || 0) * (j < reactants.length ? 1 : -1))))
  );
  // RREF
  const pivots: number[] = [];
  let row = 0;
  for (let col = 0; col < cols && row < M.length; col++) {
    let p = -1;
    for (let r = row; r < M.length; r++) if (!isZero(M[r][col])) { p = r; break; }
    if (p === -1) continue;
    [M[row], M[p]] = [M[p], M[row]];
    const pv = M[row][col];
    M[row] = M[row].map((v) => div(v, pv));
    for (let r = 0; r < M.length; r++) {
      if (r !== row && !isZero(M[r][col])) {
        const f = M[r][col];
        M[r] = M[r].map((v, k) => sub(v, mul(f, M[row][k])));
      }
    }
    pivots.push(col);
    row++;
  }
  const free = [...Array(cols).keys()].filter((c) => !pivots.includes(c));
  if (free.length !== 1) {
    if (free.length === 0) return null;
    // Multiple degrees of freedom: try setting all free vars = 1
  }
  const x: Frac[] = Array(cols).fill(frac(BigInt(0)));
  free.forEach((f) => (x[f] = frac(BigInt(1))));
  pivots.forEach((pc, r) => {
    let s = frac(BigInt(0));
    free.forEach((f) => (s = sub(s, M[r][f])));
    x[pc] = s;
  });
  // Scale to integers
  let lcm = BigInt(1);
  x.forEach((v) => (lcm = (lcm * v.d) / gcd(lcm, v.d)));
  let ints = x.map((v) => (v.n * lcm) / v.d);
  if (ints.every((v) => v <= BigInt(0))) ints = ints.map((v) => -v);
  if (ints.some((v) => v <= BigInt(0))) return null;
  let g = ints[0];
  ints.forEach((v) => (g = gcd(g, v)));
  const result = ints.map((v) => Number(v / g));
  // Verify
  for (const el of elements) {
    let bal = 0;
    species.forEach((c, j) => (bal += (c[el] || 0) * result[j] * (j < reactants.length ? 1 : -1)));
    if (bal !== 0) return null;
  }
  return result;
}
