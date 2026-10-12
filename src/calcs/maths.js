import * as X from '../lib/mathx.js';
import { num, int, pct, text, fnum, fint, fselect, farea, ftext, need } from './helpers.js';

const fmtC = (z, f) => {
  const re = Math.abs(z.re) < 1e-12 ? 0 : z.re, im = Math.abs(z.im) < 1e-12 ? 0 : z.im;
  if (!im) return f(re);
  const sign = im < 0 ? '-' : '+';
  return `${re ? f(re) + ' ' : ''}${re ? sign : im < 0 ? '-' : ''} ${f(Math.abs(im))}i`.replace(/\s+/g, ' ').trim();
};
const kv = (obj, primaryKey) => Object.entries(obj).map(([k, v]) => num(k, v, { primary: k === primaryKey }));
const CAT_EQ = 'equations', CAT_ST = 'statistics', CAT_GEO = 'geometry', CAT_NT = 'numbers';

/* dynamic shape forms */
function shapeCalc(id, title, desc, shapes, keywords, cat) {
  const first = Object.keys(shapes)[0];
  const inputs = [fselect('shape', 'Shape', Object.entries(shapes).map(([k, s]) => [k, s.name]), first)];
  for (const [k, s] of Object.entries(shapes)) {
    for (const [fid, label, def] of s.fields) inputs.push(fnum(`${k}_${fid}`, label, def, { showIf: (v) => v.shape === k, step: 'any' }));
  }
  return {
    id, cat, title, desc, keywords, inputs,
    run(v) {
      const s = shapes[v.shape];
      const args = {};
      for (const [fid] of s.fields) args[fid] = v[`${v.shape}_${fid}`];
      const out = s.calc(args);
      const keys = Object.keys(out);
      return { stats: kv(out, keys[0]), note: 'Units: area results are in the square of your length unit, volume in the cube.' };
    },
  };
}

export const maths = [
  /* ---------- equations ---------- */
  {
    id: 'linear-equation', cat: CAT_EQ, title: 'Linear equation', desc: 'Solve a x + b = 0.', keywords: 'linear equation solve x algebra',
    inputs: [fnum('a', 'a (coefficient of x)', 2, { step: 'any' }), fnum('b', 'b (constant)', -6, { step: 'any' })],
    run(v, env) {
      const r = X.solveLinear(v.a, v.b);
      if (r.type === 'none') return { stats: [text('Solution', 'No solution', { primary: true })] };
      if (r.type === 'infinite') return { stats: [text('Solution', 'Every x works', { primary: true })] };
      return { stats: [num('x', r.x, { primary: true })], steps: [`${v.a}x + ${v.b} = 0`, `x = -b / a = ${env.num(-v.b)} / ${env.num(v.a)} = ${env.num(r.x)}`] };
    },
  },
  {
    id: 'quadratic', cat: CAT_EQ, title: 'Quadratic equation', desc: 'Solve a x^2 + b x + c = 0 with real or complex roots, discriminant and vertex.', keywords: 'quadratic equation roots discriminant parabola vertex formula',
    inputs: [fnum('a', 'a', 1, { step: 'any' }), fnum('b', 'b', -3, { step: 'any' }), fnum('c', 'c', 2, { step: 'any' })],
    run(v, env) {
      need(v.a !== 0, 'a must not be zero for a quadratic (use the linear equation calculator)');
      const q = X.solveQuadratic(v.a, v.b, v.c);
      const f = env.num;
      const rootsText = q.roots.map((z) => fmtC(z, f));
      return {
        stats: [text(q.roots.length === 1 ? 'Root (double)' : 'Roots', rootsText.join(' ,  '), { primary: true }), num('Discriminant', q.disc), text('Vertex', `(${f(q.vertex.x)}, ${f(q.vertex.y)})`), text('Root type', q.disc > 0 ? 'Two real roots' : q.disc === 0 ? 'One repeated real root' : 'Two complex roots')],
        steps: ['x = (-b +/- sqrt(b^2 - 4ac)) / 2a', `Discriminant = ${f(v.b)}^2 - 4(${f(v.a)})(${f(v.c)}) = ${f(q.disc)}`, ...q.roots.map((z, i) => `x${i + 1} = ${fmtC(z, f)}`)],
      };
    },
  },
  {
    id: 'cubic', cat: CAT_EQ, title: 'Cubic equation', desc: 'Solve a x^3 + b x^2 + c x + d = 0.', keywords: 'cubic equation roots polynomial third degree',
    inputs: [fnum('a', 'a', 1, { step: 'any' }), fnum('b', 'b', -6, { step: 'any' }), fnum('c', 'c', 11, { step: 'any' }), fnum('d', 'd', -6, { step: 'any' })],
    run(v, env) {
      need(v.a !== 0, 'a must not be zero for a cubic');
      const r = X.solveCubic(v.a, v.b, v.c, v.d);
      return { stats: r.roots.map((z, i) => text(`Root ${i + 1}`, fmtC(z, env.num), { primary: i === 0 })), note: 'Complex roots come in conjugate pairs.' };
    },
  },
  {
    id: 'linear-system', cat: CAT_EQ, title: 'System of linear equations', desc: 'Solve 2 or 3 equations. Enter each equation as its coefficients followed by the constant, one per line.', keywords: 'system simultaneous equations linear gaussian elimination cramer',
    inputs: [farea('m', 'Rows: coefficients then constant (2x + y = 5, x - y = 1 -> "2 1 5" and "1 -1 1")', '2 1 5\n1 -1 1', { rows: 4 })],
    run(v, env) {
      const rows = X.parseMatrix(v.m);
      const n = rows.length;
      need(rows.every((r) => r.length === n + 1), `For ${n} equations, each row needs ${n} coefficients and one constant`);
      const s = X.solveSystem(rows.map((r) => r.slice(0, n)), rows.map((r) => r[n]));
      if (s.type === 'none') return { stats: [text('Solution', 'No solution (inconsistent)', { primary: true })] };
      if (s.type === 'infinite') return { stats: [text('Solution', 'Infinitely many solutions', { primary: true })] };
      const names = 'xyzwvu';
      return { stats: s.x.map((x, i) => num(names[i] || `x${i + 1}`, x, { primary: i === 0 })), steps: [`Determinant of the coefficient matrix = ${env.num(X.determinant(rows.map((r) => r.slice(0, n))))}`] };
    },
  },
  {
    id: 'matrix', cat: CAT_EQ, title: 'Matrix calculator', desc: 'Determinant, inverse, transpose, add, subtract and multiply.', keywords: 'matrix determinant inverse transpose multiply rank',
    inputs: [fselect('op', 'Operation', [['det', 'Determinant of A'], ['inv', 'Inverse of A'], ['tr', 'Transpose of A'], ['rank', 'Rank of A'], ['mul', 'A x B'], ['add', 'A + B'], ['sub', 'A - B']]),
      farea('a', 'Matrix A (one row per line, entries separated by spaces)', '4 7\n2 6', { rows: 4 }), farea('b', 'Matrix B', '1 0\n0 1', { rows: 4, showIf: (v) => ['mul', 'add', 'sub'].includes(v.op) })],
    run(v, env) {
      const A = X.parseMatrix(v.a);
      const asTable = (M, title) => ({ title, cols: M[0].map((_, j) => `c${j + 1}`), kinds: M[0].map(() => 'num'), rows: M });
      if (v.op === 'det') return { stats: [num('Determinant', X.determinant(A), { primary: true })] };
      if (v.op === 'rank') return { stats: [int('Rank', X.rank(A), { primary: true })] };
      if (v.op === 'tr') return { stats: [text('Size', `${A[0].length} x ${A.length}`)], table: asTable(X.transpose(A), 'Transpose') };
      if (v.op === 'inv') return { stats: [num('Determinant', X.determinant(A))], table: asTable(X.inverse(A), 'Inverse') };
      const B = X.parseMatrix(v.b);
      const R = v.op === 'mul' ? X.matMul(A, B) : X.matAdd(A, B, v.op === 'add' ? 1 : -1);
      return { stats: [text('Result size', `${R.length} x ${R[0].length}`, { primary: true })], table: asTable(R, 'Result'), steps: [env.num ? 'Entry (i, j) of A x B is the dot product of row i of A with column j of B' : ''] };
    },
  },
  {
    id: 'complex-numbers', cat: CAT_EQ, title: 'Complex numbers', desc: 'Add, subtract, multiply and divide complex numbers; modulus and argument.', keywords: 'complex number imaginary modulus argument polar',
    inputs: [fnum('a', 'Real part of z1', 3, { step: 'any' }), fnum('b', 'Imaginary part of z1', 4, { step: 'any' }), fnum('c', 'Real part of z2', 1, { step: 'any' }), fnum('d', 'Imaginary part of z2', -2, { step: 'any' })],
    run(v, env) {
      const f = env.num, z = (re, im) => fmtC({ re, im }, f), den = v.c * v.c + v.d * v.d;
      need(den !== 0, 'z2 must not be zero');
      return { stats: [text('z1 + z2', z(v.a + v.c, v.b + v.d), { primary: true }), text('z1 - z2', z(v.a - v.c, v.b - v.d)), text('z1 x z2', z(v.a * v.c - v.b * v.d, v.a * v.d + v.b * v.c)), text('z1 / z2', z((v.a * v.c + v.b * v.d) / den, (v.b * v.c - v.a * v.d) / den)), num('|z1|', Math.hypot(v.a, v.b)), num('arg(z1) in degrees', (Math.atan2(v.b, v.a) * 180) / Math.PI)] };
    },
  },
  /* ---------- statistics ---------- */
  {
    id: 'statistics', cat: CAT_ST, title: 'Descriptive statistics', desc: 'Mean, median, mode, standard deviation, variance, quartiles and more for a list of numbers.', keywords: 'statistics mean median mode standard deviation variance quartile data set average',
    inputs: [farea('d', 'Numbers (spaces, commas or new lines)', '2 4 4 4 5 5 7 9', { rows: 5 })],
    run(v, env) {
      const d = X.describe(X.parseNumbers(v.d));
      return {
        stats: [num('Mean', d.mean, { primary: true }), num('Median', d.median), text('Mode', d.modes.length ? d.modes.map(env.num).join(', ') : 'No mode'), int('Count', d.n), num('Sum', d.sum), num('Std. deviation (sample)', d.sdS), num('Std. deviation (population)', d.sdP), num('Variance (sample)', d.varS), num('Variance (population)', d.varP), num('Minimum', d.min), num('Maximum', d.max), num('Range', d.range), num('Q1', d.q1), num('Q3', d.q3), num('IQR', d.iqr), num('Std. error of mean', d.sem), num('Geometric mean', d.geoMean)],
        chart: { type: 'bar', title: 'Sorted values', xLabel: 'Position', yKind: 'num', series: [{ name: 'Value', data: d.sorted.slice(0, 200).map((x, i) => [i + 1, x]) }] },
        note: 'Quartiles use linear interpolation (the same method as Excel QUARTILE.INC). Sample statistics divide by n - 1.',
      };
    },
  },
  {
    id: 'regression', cat: CAT_ST, title: 'Linear regression and correlation', desc: 'Least-squares line, correlation coefficient and a prediction.', keywords: 'regression correlation line of best fit scatter r squared slope intercept',
    inputs: [farea('d', 'x, y pairs (one pair per line)', '1, 2\n2, 4\n3, 5\n4, 4\n5, 5', { rows: 6 }), fnum('px', 'Predict y for x =', 6, { step: 'any' })],
    run(v, env) {
      const rows = v.d.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,;]+/).map(Number));
      need(rows.length >= 2 && rows.every((r) => r.length === 2 && r.every(Number.isFinite)), 'Enter at least two lines of "x, y"');
      const xs = rows.map((r) => r[0]), ys = rows.map((r) => r[1]);
      const r = X.regression(xs, ys);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      return {
        stats: [text('Line of best fit', `y = ${env.num(r.slope)} x ${r.intercept < 0 ? '-' : '+'} ${env.num(Math.abs(r.intercept))}`, { primary: true }), num('Slope', r.slope), num('Intercept', r.intercept), num('Correlation r', r.r), num('R squared', r.r2), num(`Predicted y at x = ${env.num(v.px)}`, r.slope * v.px + r.intercept)],
        chart: { type: 'scatter', title: 'Data and fitted line', xLabel: 'x', yKind: 'num', series: [{ name: 'Data', data: rows }, { name: 'Fit', line: true, data: [[x0, r.slope * x0 + r.intercept], [x1, r.slope * x1 + r.intercept]] }] },
      };
    },
  },
  {
    id: 'normal-distribution', cat: CAT_ST, title: 'Normal distribution', desc: 'Probabilities, z-scores and percentiles for a normal distribution.', keywords: 'normal distribution gaussian z score probability percentile bell curve',
    inputs: [fnum('mu', 'Mean', 0, { step: 'any' }), fnum('sd', 'Standard deviation', 1, { min: 1e-9, step: 'any' }), fselect('mode', 'Find', [['lt', 'P(X < x)'], ['gt', 'P(X > x)'], ['between', 'P(a < X < b)'], ['inv', 'x for a probability (percentile)']]), fnum('x', 'x (or lower bound a)', 1.96, { step: 'any', showIf: (v) => v.mode !== 'inv' }), fnum('x2', 'Upper bound b', 2.5, { step: 'any', showIf: (v) => v.mode === 'between' }), fnum('p', 'Probability (0 to 1)', 0.975, { min: 0.000001, max: 0.999999, step: 'any', showIf: (v) => v.mode === 'inv' })],
    run(v) {
      const cdf = (x) => X.normalCdf(x, v.mu, v.sd);
      const z = (x) => (x - v.mu) / v.sd;
      if (v.mode === 'inv') { const x = v.mu + v.sd * X.normalInv(v.p); return { stats: [num('x', x, { primary: true }), num('z-score', z(x))] }; }
      const prob = v.mode === 'lt' ? cdf(v.x) : v.mode === 'gt' ? 1 - cdf(v.x) : cdf(v.x2) - cdf(v.x);
      need(prob >= 0, 'The lower bound must be below the upper bound');
      const lo = v.mu - 4 * v.sd, hi = v.mu + 4 * v.sd;
      const pts = Array.from({ length: 81 }, (_, i) => { const x = lo + ((hi - lo) * i) / 80; return [x, X.normalPdf(x, v.mu, v.sd)]; });
      return { stats: [num('Probability', prob, { primary: true, digits: 6 }), pct('As a percentage', prob * 100), num('z-score of x', z(v.x))], chart: { type: 'line', title: 'Density', xLabel: 'x', yKind: 'num', series: [{ name: 'Density', data: pts }] } };
    },
  },
  {
    id: 'binomial', cat: CAT_ST, title: 'Binomial distribution', desc: 'Probability of k successes in n independent trials.', keywords: 'binomial distribution probability trials successes bernoulli',
    inputs: [fint('n', 'Trials (n)', 10, { min: 1, max: 1000 }), fnum('p', 'Success probability (p)', 0.5, { min: 0, max: 1, step: 'any' }), fint('k', 'Successes (k)', 3, { min: 0, max: 1000 })],
    run(v) {
      need(v.k <= v.n, 'k cannot be larger than n');
      const pmf = (k) => X.binomialPmf(v.n, k, v.p);
      return { stats: [num('P(X = k)', pmf(v.k), { primary: true, digits: 6 }), num('P(X <= k)', X.cdfFrom(pmf, v.k), { digits: 6 }), num('P(X >= k)', 1 - X.cdfFrom(pmf, v.k - 1), { digits: 6 }), num('Mean', v.n * v.p), num('Std. deviation', Math.sqrt(v.n * v.p * (1 - v.p)))], chart: { type: 'bar', title: 'Probability of each k', xLabel: 'k', yKind: 'num', series: [{ name: 'P(X = k)', data: Array.from({ length: Math.min(v.n, 100) + 1 }, (_, k) => [k, pmf(k)]) }] } };
    },
  },
  {
    id: 'poisson', cat: CAT_ST, title: 'Poisson distribution', desc: 'Probability of k events when events occur at an average rate.', keywords: 'poisson distribution events rate lambda probability',
    inputs: [fnum('l', 'Average events (lambda)', 3, { min: 0.0001, max: 500, step: 'any' }), fint('k', 'Events (k)', 2, { min: 0, max: 1000 })],
    run(v) {
      const pmf = (k) => X.poissonPmf(v.l, k);
      return { stats: [num('P(X = k)', pmf(v.k), { primary: true, digits: 6 }), num('P(X <= k)', X.cdfFrom(pmf, v.k), { digits: 6 }), num('P(X >= k)', 1 - X.cdfFrom(pmf, v.k - 1), { digits: 6 }), num('Mean and variance', v.l)], chart: { type: 'bar', title: 'Probability of each k', xLabel: 'k', yKind: 'num', series: [{ name: 'P(X = k)', data: Array.from({ length: Math.min(Math.ceil(v.l * 3 + 10), 100) }, (_, k) => [k, pmf(k)]) }] } };
    },
  },
  {
    id: 'combinatorics', cat: CAT_ST, title: 'Permutations and combinations', desc: 'nPr, nCr and n! including repeated selections.', keywords: 'permutation combination ncr npr factorial combinatorics choose arrangements',
    inputs: [fint('n', 'n (items)', 10, { min: 0, max: 1000 }), fint('r', 'r (chosen)', 3, { min: 0, max: 1000 })],
    run(v) {
      need(v.r <= v.n, 'r cannot be larger than n');
      let nPr = 1n, nCr = 1n;
      for (let i = 0; i < v.r; i++) nPr *= BigInt(v.n - i);
      for (let i = 1; i <= Math.min(v.r, v.n - v.r); i++) nCr = (nCr * BigInt(v.n - Math.min(v.r, v.n - v.r) + i)) / BigInt(i);
      let fact = 1n;
      for (let i = 2; i <= v.n; i++) fact *= BigInt(i);
      const big = (x) => { const s = x.toString(); return s.length > 24 ? `${s[0]}.${s.slice(1, 8)}e${s.length - 1}` : s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
      return { stats: [text('nCr (combinations)', big(nCr), { primary: true }), text('nPr (permutations)', big(nPr)), text('n!', big(fact)), text('With repetition: n^r', big(BigInt(v.n) ** BigInt(v.r))), text('Combinations with repetition', big((() => { const N = v.n + v.r - 1, K = v.r; let c = 1n; for (let i = 1; i <= Math.min(K, N - K); i++) c = (c * BigInt(N - Math.min(K, N - K) + i)) / BigInt(i); return v.n === 0 ? 0n : c; })()))] };
    },
  },
  {
    id: 'confidence-interval', cat: CAT_ST, title: 'Confidence interval for a mean', desc: 'Normal-approximation interval from a sample mean, standard deviation and size.', keywords: 'confidence interval margin of error sample mean standard error z',
    inputs: [fnum('m', 'Sample mean', 50, { step: 'any' }), fnum('s', 'Sample standard deviation', 10, { min: 0, step: 'any' }), fint('n', 'Sample size', 100, { min: 2, max: 10000000 }), fselect('c', 'Confidence level', [['0.90', '90%'], ['0.95', '95%'], ['0.99', '99%']], '0.95')],
    run(v) {
      const z = X.normalInv(1 - (1 - Number(v.c)) / 2), se = v.s / Math.sqrt(v.n), me = z * se;
      return { stats: [text('Interval', `${(v.m - me).toFixed(4)} to ${(v.m + me).toFixed(4)}`, { primary: true }), num('Margin of error', me), num('Critical value z', z), num('Standard error', se)], note: v.n < 30 ? 'For samples under 30, a t-interval is more appropriate than this z-interval.' : undefined };
    },
  },
  /* ---------- geometry ---------- */
  shapeCalc('shapes-2d', 'Area and perimeter of shapes', 'Area, perimeter and more for circles, polygons, triangles and other flat shapes.', X.SHAPES_2D, 'area perimeter circle triangle rectangle square polygon ellipse trapezoid rhombus sector heron', CAT_GEO),
  shapeCalc('shapes-3d', 'Volume and surface area', 'Volume and surface area for spheres, cylinders, cones, prisms and more.', X.SHAPES_3D, 'volume surface area sphere cylinder cone cube cuboid pyramid torus frustum', CAT_GEO),
  {
    id: 'right-triangle', cat: CAT_GEO, title: 'Right triangle / Pythagoras', desc: 'Enter any two sides (leave the third at 0) to solve the triangle.', keywords: 'pythagoras pythagorean theorem right triangle hypotenuse trigonometry angles',
    inputs: [fnum('a', 'Leg a', 3, { min: 0, step: 'any' }), fnum('b', 'Leg b', 4, { min: 0, step: 'any' }), fnum('c', 'Hypotenuse c', 0, { min: 0, step: 'any' })],
    run(v, env) {
      const r = X.rightTriangle({ a: v.a, b: v.b, c: v.c });
      return { stats: [num('Leg a', r.a), num('Leg b', r.b), num('Hypotenuse c', r.c, { primary: true }), num('Angle A (deg)', r.A), num('Angle B (deg)', r.B), num('Area', r.area), num('Perimeter', r.perimeter)], steps: ['a^2 + b^2 = c^2', `c = sqrt(${env.num(r.a)}^2 + ${env.num(r.b)}^2) = ${env.num(r.c)}`] };
    },
  },
  {
    id: 'coordinate-geometry', cat: CAT_GEO, title: 'Distance, midpoint and slope', desc: 'Between two points on a plane, with the equation of the line through them.', keywords: 'distance midpoint slope line equation coordinates two points',
    inputs: [fnum('x1', 'x1', 1, { step: 'any' }), fnum('y1', 'y1', 2, { step: 'any' }), fnum('x2', 'x2', 7, { step: 'any' }), fnum('y2', 'y2', 10, { step: 'any' })],
    run(v, env) {
      const dx = v.x2 - v.x1, dy = v.y2 - v.y1, f = env.num;
      const slope = dx === 0 ? Infinity : dy / dx;
      return { stats: [num('Distance', Math.hypot(dx, dy), { primary: true }), text('Midpoint', `(${f((v.x1 + v.x2) / 2)}, ${f((v.y1 + v.y2) / 2)})`), text('Slope', dx === 0 ? 'Undefined (vertical line)' : f(slope)), text('Line', dx === 0 ? `x = ${f(v.x1)}` : `y = ${f(slope)} x ${v.y1 - slope * v.x1 < 0 ? '-' : '+'} ${f(Math.abs(v.y1 - slope * v.x1))}`), num('Angle of inclination (deg)', (Math.atan2(dy, dx) * 180) / Math.PI)] };
    },
  },
  {
    id: 'trig-values', cat: CAT_GEO, title: 'Trigonometric functions', desc: 'sin, cos, tan and their reciprocals for an angle in degrees, radians or gradians.', keywords: 'trigonometry sin cos tan sec csc cot angle degrees radians',
    inputs: [fnum('x', 'Angle', 30, { step: 'any' }), fselect('u', 'Unit', [['deg', 'Degrees'], ['rad', 'Radians'], ['grad', 'Gradians']])],
    run(v) {
      const r = v.u === 'deg' ? (v.x * Math.PI) / 180 : v.u === 'grad' ? (v.x * Math.PI) / 200 : v.x;
      const clean = (x) => (Math.abs(x) < 1e-12 ? 0 : x);
      const s = clean(Math.sin(r)), c = clean(Math.cos(r));
      const inv = (x) => (x === 0 ? 'Undefined' : 1 / x);
      return { stats: [num('sin', s, { primary: true }), num('cos', c), text('tan', c === 0 ? 'Undefined' : String(Number((s / c).toPrecision(12)))), text('sec', inv(c) === 'Undefined' ? 'Undefined' : String(Number(inv(c).toPrecision(12)))), text('csc', inv(s) === 'Undefined' ? 'Undefined' : String(Number(inv(s).toPrecision(12)))), text('cot', s === 0 ? 'Undefined' : String(Number((c / s).toPrecision(12)))), num('Radians', r), num('Degrees', (r * 180) / Math.PI)] };
    },
  },
  /* ---------- numbers ---------- */
  {
    id: 'prime-factors', cat: CAT_NT, title: 'Prime factors and divisors', desc: 'Prime factorisation, primality test and all divisors of a whole number.', keywords: 'prime factors factorization divisors is prime number theory',
    inputs: [fint('n', 'Number', 360, { min: 2, max: 9007199254740991 })],
    run(v) {
      const f = X.primeFactors(v.n);
      const groups = [...f.reduce((m, p) => m.set(p, (m.get(p) || 0) + 1), new Map())];
      const ds = v.n <= 1e12 ? X.divisors(v.n) : [];
      return { stats: [text('Prime factorisation', groups.map(([p, e]) => (e > 1 ? `${p}^${e}` : String(p))).join(' x '), { primary: true }), text('Is prime?', f.length === 1 ? 'Yes' : 'No'), ...(ds.length ? [int('Number of divisors', ds.length), text('Divisors', ds.length > 60 ? `${ds.slice(0, 60).join(', ')} ...` : ds.join(', '))] : [])] };
    },
  },
  {
    id: 'gcd-lcm', cat: CAT_NT, title: 'GCD and LCM', desc: 'Greatest common divisor and least common multiple of a list of whole numbers.', keywords: 'gcd hcf lcm greatest common divisor least common multiple',
    inputs: [ftext('n', 'Numbers (separated by spaces or commas)', '48 180 36')],
    run(v) {
      const ns = X.parseNumbers(v.n);
      need(ns.length >= 2 && ns.every((x) => Number.isInteger(x) && x > 0), 'Enter two or more positive whole numbers');
      return { stats: [int('GCD (HCF)', ns.reduce(X.gcd), { primary: true }), int('LCM', ns.reduce(X.lcm))], steps: ns.length === 2 ? [`GCD(${ns[0]}, ${ns[1]}) by Euclid: repeatedly replace (a, b) with (b, a mod b)`] : [] };
    },
  },
  {
    id: 'fractions', cat: CAT_NT, title: 'Fraction calculator', desc: 'Add, subtract, multiply, divide and simplify fractions, mixed numbers and decimals (exact).', keywords: 'fraction simplify reduce mixed number add subtract multiply divide decimal to fraction',
    inputs: [ftext('a', 'First fraction (3/4, 1 1/2, 0.75)', '3/4'), fselect('op', 'Operation', [['+', 'Add'], ['-', 'Subtract'], ['*', 'Multiply'], ['/', 'Divide'], ['s', 'Simplify only']]), ftext('b', 'Second fraction', '2/3', { showIf: (v) => v.op !== 's' })],
    run(v) {
      const a = X.parseFraction(v.a);
      const r = v.op === 's' ? a : X.fracOp(a, X.parseFraction(v.b), v.op);
      return { stats: [text('Result', X.fracToString(r), { primary: true }), text('Mixed number', X.fracToMixed(r)), text('Decimal', String(Number(r.n) / Number(r.d)))] };
    },
  },
  {
    id: 'number-base', cat: 'converters', title: 'Number base converter', desc: 'Convert between binary, octal, decimal, hexadecimal and any base up to 36.', keywords: 'base conversion binary octal hexadecimal decimal radix',
    inputs: [ftext('n', 'Number', '255'), fint('from', 'From base', 10, { min: 2, max: 36 }), fint('to', 'To base', 2, { min: 2, max: 36 })],
    run(v) {
      const to = (b) => X.toBase(v.n, v.from, b);
      return { stats: [text(`Base ${v.to}`, to(v.to).toUpperCase(), { primary: true }), text('Binary', to(2)), text('Octal', to(8)), text('Decimal', to(10)), text('Hexadecimal', to(16).toUpperCase())] };
    },
  },
  {
    id: 'roman', cat: CAT_NT, title: 'Roman numerals', desc: 'Convert numbers to Roman numerals and back.', keywords: 'roman numerals convert',
    inputs: [ftext('n', 'Number or Roman numeral', '1994')],
    run(v) {
      const s = v.n.trim();
      return /^\d+$/.test(s) ? { stats: [text('Roman numeral', X.toRoman(Number(s)), { primary: true })] } : { stats: [int('Number', X.fromRoman(s), { primary: true })] };
    },
  },
  {
    id: 'number-words', cat: CAT_NT, title: 'Number to words', desc: 'Write a number in English words, with international or Indian (lakh, crore) grouping.', keywords: 'number to words spell cheque check amount lakh crore',
    inputs: [ftext('n', 'Number', '1234567.89'), fselect('s', 'System', [['intl', 'International (million, billion)'], ['indian', 'Indian (lakh, crore)']])],
    run(v) { return { stats: [text('In words', X.numberToWords(v.n.replace(/,/g, ''), v.s), { primary: true })] }; },
  },
  {
    id: 'sequences', cat: CAT_NT, title: 'Sequences and series', desc: 'Arithmetic, geometric and Fibonacci sequences: nth term and sums.', keywords: 'arithmetic geometric sequence series progression ap gp fibonacci nth term sum',
    inputs: [fselect('t', 'Type', [['ap', 'Arithmetic (AP)'], ['gp', 'Geometric (GP)'], ['fib', 'Fibonacci']]), fnum('a', 'First term', 2, { step: 'any', showIf: (v) => v.t !== 'fib' }), fnum('d', 'Common difference / ratio', 3, { step: 'any', showIf: (v) => v.t !== 'fib' }), fint('n', 'n (term number)', 10, { min: 1, max: 500 })],
    run(v) {
      if (v.t === 'fib') { need(v.n <= 500, 'n up to 500'); let a = 0n, b = 1n, s = 0n; for (let i = 1; i <= v.n; i++) { s += a; [a, b] = [b, a + b]; } const t = X.fibonacci(v.n - 1); const sh = (x) => { const q = x.toString(); return q.length > 21 ? `${q[0]}.${q.slice(1, 7)}e${q.length - 1}` : q; }; return { stats: [text(`F(${v.n})`, sh(X.fibonacci(v.n)), { primary: true }), text(`Sum of first ${v.n} terms`, sh(s)), text('Previous term', sh(t))] }; }
      if (v.t === 'ap') return { stats: [num(`Term ${v.n}`, v.a + (v.n - 1) * v.d, { primary: true }), num(`Sum of first ${v.n}`, (v.n * (2 * v.a + (v.n - 1) * v.d)) / 2)], steps: ['a_n = a + (n - 1) d', 'S_n = n (2a + (n - 1) d) / 2'] };
      const sum = v.d === 1 ? v.a * v.n : (v.a * (1 - v.d ** v.n)) / (1 - v.d);
      return { stats: [num(`Term ${v.n}`, v.a * v.d ** (v.n - 1), { primary: true }), num(`Sum of first ${v.n}`, sum), ...(Math.abs(v.d) < 1 ? [num('Sum to infinity', v.a / (1 - v.d))] : [])], steps: ['a_n = a r^(n - 1)', 'S_n = a (1 - r^n) / (1 - r)'] };
    },
  },
  {
    id: 'rounding', cat: CAT_NT, title: 'Rounding and scientific notation', desc: 'Round to decimals or significant figures and write in scientific notation.', keywords: 'round rounding significant figures decimal places scientific notation standard form',
    inputs: [ftext('n', 'Number', '123456.789'), fint('dp', 'Decimal places', 2, { min: 0, max: 20 }), fint('sf', 'Significant figures', 4, { min: 1, max: 20 })],
    run(v) {
      const x = Number(v.n);
      need(Number.isFinite(x), 'Enter a number');
      return { stats: [text(`To ${v.dp} decimal places`, x.toFixed(v.dp), { primary: true }), text(`To ${v.sf} significant figures`, String(Number(x.toPrecision(v.sf)))), text('Scientific notation', x.toExponential(Math.max(0, v.sf - 1)).replace('e+', ' x 10^').replace('e-', ' x 10^-')), int('Nearest whole number', Math.round(x)), int('Floor', Math.floor(x)), int('Ceiling', Math.ceil(x))] };
    },
  },
  {
    id: 'random', cat: CAT_NT, title: 'Random number, dice and coin', desc: 'Cryptographically strong random integers, dice rolls and coin flips.', keywords: 'random number generator dice coin flip lottery pick',
    inputs: [fselect('t', 'Generate', [['int', 'Random integers'], ['dice', 'Dice rolls (d6)'], ['coin', 'Coin flips']]), fint('min', 'Minimum', 1, { showIf: (v) => v.t === 'int' }), fint('max', 'Maximum', 100, { showIf: (v) => v.t === 'int' }), fint('n', 'How many', 5, { min: 1, max: 200 })],
    volatile: true,
    run(v) {
      const rnd = (lo, hi) => { const span = hi - lo + 1, buf = new Uint32Array(1); const limit = Math.floor(4294967296 / span) * span; let r; do { crypto.getRandomValues(buf); r = buf[0]; } while (r >= limit); return lo + (r % span); };
      if (v.t === 'coin') { const r = Array.from({ length: v.n }, () => (rnd(0, 1) ? 'Heads' : 'Tails')); return { stats: [text('Flips', r.join(', '), { primary: true }), int('Heads', r.filter((x) => x === 'Heads').length), int('Tails', r.filter((x) => x === 'Tails').length)] }; }
      const lo = v.t === 'dice' ? 1 : v.min, hi = v.t === 'dice' ? 6 : v.max;
      need(hi >= lo, 'Maximum must be at least the minimum');
      const r = Array.from({ length: v.n }, () => rnd(lo, hi));
      return { stats: [text('Results', r.join(', '), { primary: true }), int('Sum', r.reduce((a, b) => a + b, 0))] };
    },
  },
];

