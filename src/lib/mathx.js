/* Pure maths helpers: solvers, matrices, statistics, probability, number theory, geometry. No DOM. */

/* ---------------- equations ---------------- */
const cplx = (re, im = 0) => ({ re, im });
const clean = (x) => (Math.abs(x) < 1e-12 ? 0 : x);

export function solveLinear(a, b) {
  if (a === 0) return b === 0 ? { type: 'infinite' } : { type: 'none' };
  return { type: 'one', x: -b / a };
}

/** Roots of ax^2 + bx + c = 0 (real or complex). */
export function solveQuadratic(a, b, c) {
  if (a === 0) { const l = solveLinear(b, c); return { degree: 1, ...l, roots: l.type === 'one' ? [cplx(l.x)] : [], disc: null }; }
  const disc = b * b - 4 * a * c;
  const vertex = { x: -b / (2 * a), y: c - (b * b) / (4 * a) };
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    // numerically stable form avoids cancellation
    const q = -0.5 * (b + Math.sign(b || 1) * s);
    const r1 = q / a, r2 = q === 0 ? r1 : c / q;
    const roots = [r1, r2].sort((x, y) => x - y).map((r) => cplx(clean(r)));
    return { degree: 2, disc, roots: disc === 0 ? [roots[0]] : roots, vertex };
  }
  const s = Math.sqrt(-disc) / (2 * a), re = -b / (2 * a);
  return { degree: 2, disc, roots: [cplx(re, -Math.abs(s)), cplx(re, Math.abs(s))], vertex };
}

/** Roots of ax^3 + bx^2 + cx + d = 0 via the depressed cubic (Cardano / trigonometric method). */
export function solveCubic(a, b, c, d) {
  if (a === 0) return solveQuadratic(b, c, d);
  const B = b / a, C = c / a, D = d / a;
  const p = C - (B * B) / 3;
  const q = (2 * B * B * B) / 27 - (B * C) / 3 + D;
  const shift = -B / 3;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  let roots;
  if (Math.abs(disc) < 1e-12 * Math.max(1, Math.abs(q * q))) {
    if (Math.abs(p) < 1e-12 && Math.abs(q) < 1e-12) roots = [cplx(shift)];
    else { const u = Math.cbrt(-q / 2); roots = [cplx(2 * u + shift), cplx(-u + shift)]; }
  } else if (disc > 0) {
    const s = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + s), v = Math.cbrt(-q / 2 - s);
    const re = shift - (u + v) / 2, im = (Math.sqrt(3) / 2) * (u - v);
    roots = [cplx(u + v + shift), cplx(re, -Math.abs(im)), cplx(re, Math.abs(im))];
  } else {
    const r = Math.sqrt(-(p * p * p) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    roots = [0, 1, 2].map((k) => cplx(m * Math.cos((phi + 2 * Math.PI * k) / 3) + shift)).sort((x, y) => x.re - y.re);
  }
  roots = roots.map((z) => cplx(clean(z.re), clean(z.im)));
  return { degree: 3, disc, roots };
}

/* ---------------- matrices (arrays of rows) ---------------- */
export function parseMatrix(text) {
  const rows = String(text).trim().split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean).map((r) => r.split(/[\s,]+/).filter(Boolean).map(Number));
  if (!rows.length) throw new Error('Enter a matrix, one row per line');
  const w = rows[0].length;
  for (const r of rows) {
    if (r.length !== w) throw new Error('Every row must have the same number of entries');
    if (r.some((x) => !Number.isFinite(x))) throw new Error('Matrix entries must be numbers');
  }
  return rows;
}
export const matMul = (A, B) => {
  if (A[0].length !== B.length) throw new Error(`Cannot multiply a ${A.length}x${A[0].length} matrix by a ${B.length}x${B[0].length} matrix`);
  return A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
};
export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
export const matAdd = (A, B, sign = 1) => {
  if (A.length !== B.length || A[0].length !== B[0].length) throw new Error('Matrices must have the same size');
  return A.map((r, i) => r.map((v, j) => v + sign * B[i][j]));
};
export function determinant(A) {
  const n = A.length;
  if (A.some((r) => r.length !== n)) throw new Error('Determinant needs a square matrix');
  const M = A.map((r) => r.slice());
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return 0;
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; det = -det; }
    det *= M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return clean(det);
}
export function inverse(A) {
  const n = A.length;
  if (A.some((r) => r.length !== n)) throw new Error('Inverse needs a square matrix');
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('The matrix is singular (determinant is 0), so it has no inverse');
    [M[p], M[c]] = [M[c], M[p]];
    const pv = M[c][c];
    for (let k = 0; k < 2 * n; k++) M[c][k] /= pv;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r) => r.slice(n).map(clean));
}
export function rank(A) {
  const M = A.map((r) => r.slice());
  let rk = 0;
  for (let c = 0; c < M[0].length && rk < M.length; c++) {
    let p = rk;
    for (let r = rk + 1; r < M.length; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-10) continue;
    [M[p], M[rk]] = [M[rk], M[p]];
    for (let r = rk + 1; r < M.length; r++) { const f = M[r][c] / M[rk][c]; for (let k = c; k < M[0].length; k++) M[r][k] -= f * M[rk][k]; }
    rk++;
  }
  return rk;
}
/** Solve A x = b. Returns {type:'one', x} | {type:'none'} | {type:'infinite', rank}. */
export function solveSystem(A, b) {
  const n = A.length;
  if (A.some((r) => r.length !== A[0].length) || b.length !== n) throw new Error('Check the number of equations and coefficients');
  const aug = A.map((r, i) => [...r, b[i]]);
  const rA = rank(A), rAug = rank(aug);
  if (rA < rAug) return { type: 'none' };
  if (rA < A[0].length) return { type: 'infinite', rank: rA };
  if (n !== A[0].length) {
    // overdetermined but consistent: use normal equations
    const At = transpose(A);
    const x = solveSystem(matMul(At, A), matMul(At, b.map((v) => [v])).map((r) => r[0]));
    return x;
  }
  const inv = inverse(A);
  return { type: 'one', x: inv.map((row) => clean(row.reduce((s, v, k) => s + v * b[k], 0))) };
}

/* ---------------- statistics ---------------- */
export function parseNumbers(text) {
  const parts = String(text).split(/[\s,;]+/).filter(Boolean);
  const nums = parts.map(Number);
  if (nums.some((x) => !Number.isFinite(x))) throw new Error('Enter numbers separated by spaces, commas or new lines');
  return nums;
}
export const sum = (a) => a.reduce((s, v) => s + v, 0);
export const mean = (a) => sum(a) / a.length;
/** Quantile with linear interpolation (Excel QUARTILE.INC / R type 7). */
export function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
export function describe(data) {
  if (!data.length) throw new Error('Enter at least one number');
  const n = data.length, s = [...data].sort((a, b) => a - b), m = mean(data);
  const ss = data.reduce((t, v) => t + (v - m) ** 2, 0);
  const counts = new Map();
  for (const v of data) counts.set(v, (counts.get(v) || 0) + 1);
  const maxC = Math.max(...counts.values());
  const modes = maxC > 1 ? [...counts].filter(([, c]) => c === maxC).map(([v]) => v).sort((a, b) => a - b) : [];
  const varP = ss / n, varS = n > 1 ? ss / (n - 1) : NaN;
  const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75);
  const m3 = data.reduce((t, v) => t + (v - m) ** 3, 0) / n;
  return {
    n, sum: sum(data), mean: m, median: quantile(s, 0.5), modes, min: s[0], max: s[n - 1], range: s[n - 1] - s[0],
    varP, varS, sdP: Math.sqrt(varP), sdS: Math.sqrt(varS), q1, q3, iqr: q3 - q1,
    sem: n > 1 ? Math.sqrt(varS / n) : NaN, skew: varP ? m3 / Math.pow(varP, 1.5) : 0, sorted: s,
    geoMean: s[0] > 0 ? Math.exp(mean(data.map(Math.log))) : NaN,
  };
}
export function regression(xs, ys) {
  const n = xs.length;
  if (n !== ys.length || n < 2) throw new Error('Enter at least two x,y pairs');
  const mx = mean(xs), my = mean(ys);
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (sxx === 0) throw new Error('All x values are equal: the slope is undefined');
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r = syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
  return { n, slope, intercept, r, r2: r * r, mx, my, covS: sxy / (n - 1) };
}

/* ---------------- probability ---------------- */
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lnGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = LG[0];
  for (let i = 1; i < 9; i++) x += LG[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
export const lnFact = (n) => lnGamma(n + 1);
export function erf(x) {
  const ax = Math.abs(x);
  if (ax < 2.5) {
    let term = ax, s = ax;
    for (let n = 1; n < 80; n++) { term *= (-ax * ax) / n; const t = term / (2 * n + 1); s += t; if (Math.abs(t) < 1e-17 * Math.abs(s)) break; }
    return Math.sign(x) * ((2 / Math.sqrt(Math.PI)) * s);
  }
  return Math.sign(x) * (1 - erfcLarge(ax));
}
function erfcLarge(x) { let k = x; for (let i = 80; i >= 1; i--) k = x + i / 2 / k; return Math.exp(-x * x) / (Math.sqrt(Math.PI) * k); }
export const normalPdf = (x, mu = 0, sd = 1) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
export function normalCdf(x, mu = 0, sd = 1) {
  const z = (x - mu) / sd;
  if (z > 2.5) return 1 - 0.5 * erfcLarge(z / Math.SQRT2);
  if (z < -2.5) return 0.5 * erfcLarge(-z / Math.SQRT2);
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
/** Inverse standard normal CDF (Acklam's rational approximation refined by one Halley step). */
export function normalInv(p) {
  if (p <= 0 || p >= 1) throw new Error('Probability must be strictly between 0 and 1');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const e = normalCdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
export function binomialPmf(n, k, p) {
  if (k < 0 || k > n || !Number.isInteger(k)) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}
export function poissonPmf(lambda, k) {
  if (k < 0 || !Number.isInteger(k)) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - lnFact(k));
}
export const cdfFrom = (pmf, k) => { let s = 0; for (let i = 0; i <= k; i++) s += pmf(i); return Math.min(1, s); };

/* ---------------- number theory ---------------- */
export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
export const lcm = (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a / gcd(a, b) * b));
export function primeFactors(n) {
  if (!Number.isInteger(n) || n < 2) throw new Error('Enter a whole number of 2 or more');
  if (n > Number.MAX_SAFE_INTEGER) throw new Error('Number is too large (max 9,007,199,254,740,991)');
  const out = [];
  for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) while (n % p === 0) { out.push(p); n /= p; }
  if (n > 1) out.push(n);
  return out;
}
export const isPrime = (n) => n >= 2 && primeFactors(n).length === 1;
export function divisors(n) {
  const ds = [];
  for (let i = 1; i * i <= n; i++) if (n % i === 0) { ds.push(i); if (i * i !== n) ds.push(n / i); }
  return ds.sort((a, b) => a - b);
}
export function sieve(limit) {
  const flags = new Uint8Array(limit + 1).fill(1);
  flags[0] = flags[1] = 0;
  for (let i = 2; i * i <= limit; i++) if (flags[i]) for (let j = i * i; j <= limit; j += i) flags[j] = 0;
  const out = [];
  for (let i = 2; i <= limit; i++) if (flags[i]) out.push(i);
  return out;
}
export function fibonacci(n) { let a = 0n, b = 1n; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; }

/** Fraction helpers using BigInt so large numerators stay exact. */
export function frac(n, d) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new Error('The denominator cannot be zero');
  if (d < 0n) { n = -n; d = -d; }
  const g = bgcd(n < 0n ? -n : n, d);
  return { n: n / g, d: d / g };
}
const bgcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a || 1n; };
export const fracOp = (a, b, op) => {
  if (op === '+') return frac(a.n * b.d + b.n * a.d, a.d * b.d);
  if (op === '-') return frac(a.n * b.d - b.n * a.d, a.d * b.d);
  if (op === '*') return frac(a.n * b.n, a.d * b.d);
  if (b.n === 0n) throw new Error('Cannot divide by zero');
  return frac(a.n * b.d, a.d * b.n);
};
export function parseFraction(s) {
  const t = String(s).trim();
  let m = /^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t); // mixed number
  if (m) { const w = BigInt(m[1]), n = BigInt(m[2]), d = BigInt(m[3]); return frac(t.startsWith('-') ? w * d - n : w * d + n, d); }
  m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return frac(m[1], m[2]);
  m = /^(-?)(\d*)\.(\d+)$/.exec(t);
  if (m) return frac(BigInt(`${m[1]}${m[2] || 0}${m[3]}`), 10n ** BigInt(m[3].length));
  if (/^-?\d+$/.test(t)) return frac(t, 1);
  throw new Error('Enter a fraction like 3/4, a mixed number like 1 1/2, or a decimal');
}
export function fracToString(f) { return f.d === 1n ? String(f.n) : `${f.n}/${f.d}`; }
export function fracToMixed(f) {
  if (f.d === 1n || (f.n < 0n ? -f.n : f.n) < f.d) return fracToString(f);
  const neg = f.n < 0n, n = neg ? -f.n : f.n;
  const w = n / f.d, r = n % f.d;
  return `${neg ? '-' : ''}${w}${r ? ` ${r}/${f.d}` : ''}`;
}

export function toBase(nStr, from, to) {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  const s = String(nStr).trim().toLowerCase().replace(/^0[xbo]/, '');
  const neg = s.startsWith('-');
  let v = 0n;
  for (const ch of neg ? s.slice(1) : s) {
    const dgt = digits.indexOf(ch);
    if (dgt < 0 || dgt >= from) throw new Error(`"${ch}" is not a valid base-${from} digit`);
    v = v * BigInt(from) + BigInt(dgt);
  }
  return (neg ? '-' : '') + v.toString(to);
}

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error('Roman numerals cover 1 to 3999');
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
export function fromRoman(str) {
  const s = String(str).trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(s)) throw new Error('Use only the letters M, D, C, L, X, V, I');
  let total = 0;
  const val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  for (let i = 0; i < s.length; i++) total += val[s[i]] < (val[s[i + 1]] || 0) ? -val[s[i]] : val[s[i]];
  if (toRoman(total) !== s) throw new Error('That is not a standard Roman numeral');
  return total;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function below1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100; if (n) parts.push('and'); }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  else if (n > 0 || !parts.length) parts.push(ONES[n]);
  return parts.join(' ');
}
/** Whole number to English words. system: 'intl' (thousand/million/billion...) or 'indian' (lakh/crore). */
export function numberToWords(input, system = 'intl') {
  const s = String(input).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error('Enter a plain number such as 1234.56');
  const neg = s.startsWith('-');
  const [ip, fp] = (neg ? s.slice(1) : s).split('.');
  if (ip.length > 21) throw new Error('Number is too large (max 21 digits)');
  let n = BigInt(ip);
  const words = [];
  if (n === 0n) words.push('zero');
  else if (system === 'indian') {
    const units = [['crore', 10000000n], ['lakh', 100000n], ['thousand', 1000n]];
    for (const [name, v] of units) { const q = n / v; if (q > 0n) { words.push(`${numberToWords(String(q), system)} ${name}`); n %= v; } }
    if (n > 0n) words.push(below1000(Number(n)));
  } else {
    const names = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion'];
    const groups = [];
    while (n > 0n) { groups.push(Number(n % 1000n)); n /= 1000n; }
    for (let i = groups.length - 1; i >= 0; i--) if (groups[i]) words.push(`${below1000(groups[i])}${names[i] ? ` ${names[i]}` : ''}`);
  }
  let out = words.join(' ');
  if (fp) out += ` point ${[...fp].map((d) => ONES[Number(d)]).join(' ')}`;
  return (neg ? 'minus ' : '') + out;
}

/* ---------------- geometry ---------------- */
const PI = Math.PI;
const pos = (v, name) => { if (!(v > 0)) throw new Error(`${name} must be above zero`); return v; };
export const SHAPES_2D = {
  circle: { name: 'Circle', fields: [['r', 'Radius', 5]], calc: ({ r }) => ({ Area: PI * pos(r, 'Radius') ** 2, Circumference: 2 * PI * r, Diameter: 2 * r }) },
  rectangle: { name: 'Rectangle', fields: [['l', 'Length', 8], ['w', 'Width', 5]], calc: ({ l, w }) => ({ Area: pos(l, 'Length') * pos(w, 'Width'), Perimeter: 2 * (l + w), Diagonal: Math.hypot(l, w) }) },
  square: { name: 'Square', fields: [['a', 'Side', 6]], calc: ({ a }) => ({ Area: pos(a, 'Side') ** 2, Perimeter: 4 * a, Diagonal: a * Math.SQRT2 }) },
  triangle: { name: 'Triangle (three sides)', fields: [['a', 'Side a', 3], ['b', 'Side b', 4], ['c', 'Side c', 5]], calc: ({ a, b, c }) => {
    pos(a, 'Side a'); pos(b, 'Side b'); pos(c, 'Side c');
    if (a + b <= c || a + c <= b || b + c <= a) throw new Error('These sides cannot form a triangle (the two shorter sides must add up to more than the longest)');
    const s = (a + b + c) / 2, area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    const A = Math.acos((b * b + c * c - a * a) / (2 * b * c)) * (180 / PI), B = Math.acos((a * a + c * c - b * b) / (2 * a * c)) * (180 / PI);
    return { Area: area, Perimeter: a + b + c, 'Angle A (deg)': A, 'Angle B (deg)': B, 'Angle C (deg)': 180 - A - B, Inradius: area / s, Circumradius: (a * b * c) / (4 * area) };
  } },
  trianglebh: { name: 'Triangle (base and height)', fields: [['b', 'Base', 10], ['h', 'Height', 6]], calc: ({ b, h }) => ({ Area: 0.5 * pos(b, 'Base') * pos(h, 'Height') }) },
  ellipse: { name: 'Ellipse', fields: [['a', 'Semi-axis a', 5], ['b', 'Semi-axis b', 3]], calc: ({ a, b }) => {
    pos(a, 'Semi-axis a'); pos(b, 'Semi-axis b');
    const h = ((a - b) / (a + b)) ** 2;
    return { Area: PI * a * b, 'Perimeter (Ramanujan approx.)': PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h))) };
  } },
  trapezoid: { name: 'Trapezoid', fields: [['a', 'Parallel side a', 8], ['b', 'Parallel side b', 5], ['h', 'Height', 4]], calc: ({ a, b, h }) => ({ Area: ((pos(a, 'Side a') + pos(b, 'Side b')) / 2) * pos(h, 'Height'), Median: (a + b) / 2 }) },
  parallelogram: { name: 'Parallelogram', fields: [['b', 'Base', 8], ['h', 'Height', 5], ['s', 'Slanted side', 6]], calc: ({ b, h, s }) => ({ Area: pos(b, 'Base') * pos(h, 'Height'), Perimeter: 2 * (b + pos(s, 'Side')) }) },
  rhombus: { name: 'Rhombus', fields: [['p', 'Diagonal p', 6], ['q', 'Diagonal q', 8]], calc: ({ p, q }) => ({ Area: (pos(p, 'Diagonal p') * pos(q, 'Diagonal q')) / 2, Side: Math.hypot(p / 2, q / 2), Perimeter: 4 * Math.hypot(p / 2, q / 2) }) },
  polygon: { name: 'Regular polygon', fields: [['n', 'Number of sides', 6], ['s', 'Side length', 4]], calc: ({ n, s }) => {
    if (!Number.isInteger(n) || n < 3) throw new Error('A polygon needs a whole number of sides, 3 or more');
    pos(s, 'Side length');
    return { Area: (n * s * s) / (4 * Math.tan(PI / n)), Perimeter: n * s, 'Interior angle (deg)': ((n - 2) * 180) / n, Apothem: s / (2 * Math.tan(PI / n)), Circumradius: s / (2 * Math.sin(PI / n)) };
  } },
  sector: { name: 'Circle sector', fields: [['r', 'Radius', 6], ['t', 'Angle (deg)', 60]], calc: ({ r, t }) => {
    pos(r, 'Radius'); if (!(t > 0 && t <= 360)) throw new Error('Angle must be above 0 and at most 360 degrees');
    return { Area: (t / 360) * PI * r * r, 'Arc length': (t / 360) * 2 * PI * r, Perimeter: (t / 360) * 2 * PI * r + 2 * r };
  } },
  annulus: { name: 'Ring (annulus)', fields: [['R', 'Outer radius', 6], ['r', 'Inner radius', 4]], calc: ({ R, r }) => { if (!(R > r && r >= 0)) throw new Error('Outer radius must be larger than inner radius'); return { Area: PI * (R * R - r * r), Perimeter: 2 * PI * (R + r) }; } },
};
export const SHAPES_3D = {
  sphere: { name: 'Sphere', fields: [['r', 'Radius', 5]], calc: ({ r }) => ({ Volume: (4 / 3) * PI * pos(r, 'Radius') ** 3, 'Surface area': 4 * PI * r * r }) },
  cube: { name: 'Cube', fields: [['a', 'Edge', 4]], calc: ({ a }) => ({ Volume: pos(a, 'Edge') ** 3, 'Surface area': 6 * a * a, 'Space diagonal': a * Math.sqrt(3) }) },
  cuboid: { name: 'Cuboid', fields: [['l', 'Length', 6], ['w', 'Width', 4], ['h', 'Height', 3]], calc: ({ l, w, h }) => ({ Volume: pos(l, 'Length') * pos(w, 'Width') * pos(h, 'Height'), 'Surface area': 2 * (l * w + l * h + w * h), 'Space diagonal': Math.sqrt(l * l + w * w + h * h) }) },
  cylinder: { name: 'Cylinder', fields: [['r', 'Radius', 3], ['h', 'Height', 10]], calc: ({ r, h }) => ({ Volume: PI * pos(r, 'Radius') ** 2 * pos(h, 'Height'), 'Lateral area': 2 * PI * r * h, 'Surface area': 2 * PI * r * (r + h) }) },
  cone: { name: 'Cone', fields: [['r', 'Radius', 3], ['h', 'Height', 4]], calc: ({ r, h }) => { const sl = Math.hypot(pos(r, 'Radius'), pos(h, 'Height')); return { Volume: (PI * r * r * h) / 3, 'Slant height': sl, 'Lateral area': PI * r * sl, 'Surface area': PI * r * (r + sl) }; } },
  pyramid: { name: 'Square pyramid', fields: [['a', 'Base edge', 6], ['h', 'Height', 4]], calc: ({ a, h }) => { const sl = Math.hypot(a / 2, pos(h, 'Height')); return { Volume: (pos(a, 'Base edge') ** 2 * h) / 3, 'Slant height': sl, 'Surface area': a * a + 2 * a * sl }; } },
  hemisphere: { name: 'Hemisphere', fields: [['r', 'Radius', 5]], calc: ({ r }) => ({ Volume: (2 / 3) * PI * pos(r, 'Radius') ** 3, 'Curved area': 2 * PI * r * r, 'Total surface area': 3 * PI * r * r }) },
  torus: { name: 'Torus', fields: [['R', 'Major radius', 5], ['r', 'Minor radius', 2]], calc: ({ R, r }) => { if (!(R > r && r > 0)) throw new Error('Major radius must be larger than the minor radius'); return { Volume: 2 * PI * PI * R * r * r, 'Surface area': 4 * PI * PI * R * r }; } },
  frustum: { name: 'Cone frustum', fields: [['R', 'Bottom radius', 5], ['r', 'Top radius', 3], ['h', 'Height', 6]], calc: ({ R, r, h }) => { pos(R, 'Bottom radius'); pos(r, 'Top radius'); pos(h, 'Height'); const sl = Math.hypot(R - r, h); return { Volume: (PI * h * (R * R + R * r + r * r)) / 3, 'Slant height': sl, 'Surface area': PI * (R * R + r * r + (R + r) * sl) }; } },
};

/** Solve a right triangle from two known parts among legs a, b, hypotenuse c (any two). */
export function rightTriangle({ a, b, c }) {
  const known = [a, b, c].filter((x) => x > 0).length;
  if (known < 2) throw new Error('Enter any two of the three sides');
  if (c > 0 && a > 0 && c <= a) throw new Error('The hypotenuse must be longer than a leg');
  if (c > 0 && b > 0 && c <= b) throw new Error('The hypotenuse must be longer than a leg');
  if (!(a > 0)) a = Math.sqrt(c * c - b * b); else if (!(b > 0)) b = Math.sqrt(c * c - a * a); else if (!(c > 0)) c = Math.hypot(a, b);
  const A = (Math.atan2(a, b) * 180) / PI;
  return { a, b, c, A, B: 90 - A, area: (a * b) / 2, perimeter: a + b + c };
}

/* ---------------- numeric helpers for graphing ---------------- */
/** Sign-change scan + bisection for roots of f in [lo, hi]. */
export function findRoots(f, lo, hi, samples = 600) {
  const roots = [];
  const step = (hi - lo) / samples;
  let x0 = lo, y0 = f(x0);
  for (let i = 1; i <= samples; i++) {
    const x1 = lo + i * step, y1 = f(x1);
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      if (y0 === 0) roots.push(x0);
      else if (y0 * y1 < 0) {
        let a = x0, b = x1, fa = y0;
        for (let k = 0; k < 60; k++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
        const r = (a + b) / 2;
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(y0), Math.abs(y1))) roots.push(r);
      }
    }
    x0 = x1; y0 = y1;
  }
  return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > step * 0.5);
}
