import test from 'node:test';
import assert from 'node:assert/strict';
import * as X from '../src/lib/mathx.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `expected ${a} to be near ${b}`);

test('linear and quadratic equations', () => {
  assert.equal(X.solveLinear(2, -6).x, 3);
  assert.equal(X.solveLinear(0, 0).type, 'infinite');
  assert.equal(X.solveLinear(0, 5).type, 'none');
  const q = X.solveQuadratic(1, -3, 2);
  assert.deepEqual(q.roots.map((r) => r.re), [1, 2]);
  const c = X.solveQuadratic(1, 2, 5);
  close(c.roots[1].re, -1); close(c.roots[1].im, 2);
  assert.equal(X.solveQuadratic(1, -2, 1).roots.length, 1);
  close(X.solveQuadratic(1, 1e8, 1).roots[1].re, -1e-8, 1e-6); // no catastrophic cancellation
});
test('cubic equations', () => {
  const r = X.solveCubic(1, -6, 11, -6).roots.map((z) => z.re);
  close(r[0], 1); close(r[1], 2); close(r[2], 3);
  const one = X.solveCubic(1, 0, 0, -8);
  close(one.roots[0].re, 2); assert.equal(one.roots.length, 3); close(one.roots[1].im + one.roots[2].im, 0);
  const triple = X.solveCubic(1, -3, 3, -1);
  close(triple.roots[0].re, 1, 1e-4);
  const dbl = X.solveCubic(1, -5, 8, -4).roots.map((z) => z.re).sort((a, b) => a - b);
  close(dbl[0], 1, 1e-4); close(dbl[dbl.length - 1], 2, 1e-4);
});
test('matrices', () => {
  const A = [[4, 7], [2, 6]];
  close(X.determinant(A), 10);
  const inv = X.inverse(A);
  close(inv[0][0], 0.6); close(inv[0][1], -0.7); close(inv[1][0], -0.2); close(inv[1][1], 0.4);
  assert.deepEqual(X.matMul([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[19, 22], [43, 50]]);
  assert.deepEqual(X.transpose([[1, 2, 3]]), [[1], [2], [3]]);
  assert.throws(() => X.inverse([[1, 2], [2, 4]]), /singular/);
  assert.throws(() => X.matMul([[1, 2]], [[1, 2]]));
  close(X.determinant([[2, 0, 1], [1, 3, 2], [1, 1, 1]]), 0 + 2 * (3 - 2) - 0 + 1 * (1 - 3));
  assert.deepEqual(X.parseMatrix('1 2\n3 4'), [[1, 2], [3, 4]]);
});
test('linear systems', () => {
  const s = X.solveSystem([[2, 1], [1, -1]], [5, 1]);
  close(s.x[0], 2); close(s.x[1], 1);
  const s3 = X.solveSystem([[1, 1, 1], [0, 2, 5], [2, 5, -1]], [6, -4, 27]);
  close(s3.x[0], 5); close(s3.x[1], 3); close(s3.x[2], -2);
  assert.equal(X.solveSystem([[1, 1], [2, 2]], [1, 3]).type, 'none');
  assert.equal(X.solveSystem([[1, 1], [2, 2]], [1, 2]).type, 'infinite');
});
test('descriptive statistics', () => {
  const d = X.describe([2, 4, 4, 4, 5, 5, 7, 9]);
  close(d.mean, 5); close(d.sdP, 2); close(d.varS, 32 / 7); close(d.median, 4.5);
  assert.deepEqual(d.modes, [4]); close(d.q1, 4); close(d.q3, 5.5); close(d.range, 7);
  assert.deepEqual(X.describe([1, 2, 3]).modes, []);
  assert.throws(() => X.describe([]));
  assert.throws(() => X.parseNumbers('1 two 3'));
});
test('regression and correlation', () => {
  const r = X.regression([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
  close(r.slope, 0.6); close(r.intercept, 2.2); close(r.r, 0.7745966692, 1e-9);
  close(X.regression([1, 2, 3], [2, 4, 6]).r, 1);
  assert.throws(() => X.regression([1, 1, 1], [1, 2, 3]));
});
test('normal distribution', () => {
  close(X.normalCdf(0), 0.5); close(X.normalCdf(1.96), 0.9750021048517795, 1e-9);
  close(X.normalCdf(-3), 0.0013498980316301, 1e-10); close(X.normalCdf(5), 0.9999997133484281, 1e-12);
  close(X.normalInv(0.975), 1.959963984540054, 1e-9); close(X.normalInv(0.5), 0, 1e-12);
  close(X.normalPdf(0), 0.3989422804014327);
  close(X.erf(0.5), 0.5204998778130465, 1e-12);
  assert.throws(() => X.normalInv(1));
});
test('binomial and poisson', () => {
  close(X.binomialPmf(10, 3, 0.5), 120 / 1024, 1e-10);
  close(X.cdfFrom((k) => X.binomialPmf(10, k, 0.5), 5), 0.623046875, 1e-10);
  close(X.poissonPmf(2, 3), 0.18044704431548356, 1e-10);
  close(Math.exp(X.lnGamma(5)), 24, 1e-9);
});
test('number theory', () => {
  assert.deepEqual(X.primeFactors(360), [2, 2, 2, 3, 3, 5]);
  assert.deepEqual(X.primeFactors(97), [97]);
  assert.ok(X.isPrime(1000000007)); assert.ok(!X.isPrime(1000000008));
  assert.equal(X.gcd(48, 18), 6); assert.equal(X.lcm(4, 6), 12);
  assert.deepEqual(X.divisors(28), [1, 2, 4, 7, 14, 28]);
  assert.equal(X.sieve(30).join(), '2,3,5,7,11,13,17,19,23,29');
  assert.equal(X.fibonacci(90).toString(), '2880067194370816120');
  assert.throws(() => X.primeFactors(1));
});
test('fractions', () => {
  assert.equal(X.fracToString(X.frac(6, 8)), '3/4');
  assert.equal(X.fracToString(X.fracOp(X.parseFraction('1/2'), X.parseFraction('1/3'), '+')), '5/6');
  assert.equal(X.fracToMixed(X.parseFraction('7/2')), '3 1/2');
  assert.equal(X.fracToString(X.parseFraction('0.75')), '3/4');
  assert.equal(X.fracToString(X.parseFraction('1 1/2')), '3/2');
  assert.throws(() => X.frac(1, 0));
});
test('bases, roman numerals, number words', () => {
  assert.equal(X.toBase('255', 10, 16), 'ff'); assert.equal(X.toBase('ff', 16, 2), '11111111'); assert.equal(X.toBase('-10', 10, 2), '-1010');
  assert.throws(() => X.toBase('12', 2, 10));
  assert.equal(X.toRoman(1994), 'MCMXCIV'); assert.equal(X.fromRoman('MCMXCIV'), 1994);
  assert.throws(() => X.fromRoman('IIII')); assert.throws(() => X.toRoman(4000));
  assert.equal(X.numberToWords('1234'), 'one thousand two hundred and thirty-four');
  assert.equal(X.numberToWords('100000', 'indian'), 'one lakh');
  assert.equal(X.numberToWords('12.05'), 'twelve point zero five');
  assert.equal(X.numberToWords('0'), 'zero');
});
test('geometry reference values', () => {
  close(X.SHAPES_2D.circle.calc({ r: 5 }).Area, 78.53981633974483);
  close(X.SHAPES_2D.triangle.calc({ a: 3, b: 4, c: 5 }).Area, 6);
  close(X.SHAPES_2D.triangle.calc({ a: 3, b: 4, c: 5 })['Angle C (deg)'], 90, 1e-9);
  assert.throws(() => X.SHAPES_2D.triangle.calc({ a: 1, b: 2, c: 10 }), /cannot form/);
  close(X.SHAPES_2D.polygon.calc({ n: 6, s: 1 }).Area, 2.598076211353316);
  close(X.SHAPES_2D.ellipse.calc({ a: 5, b: 3 })['Perimeter (Ramanujan approx.)'], 25.5270, 1e-4);
  close(X.SHAPES_3D.sphere.calc({ r: 1 }).Volume, 4.1887902047863905);
  close(X.SHAPES_3D.cylinder.calc({ r: 3, h: 10 }).Volume, 282.7433388230814);
  close(X.SHAPES_3D.cone.calc({ r: 3, h: 4 })['Slant height'], 5);
  close(X.SHAPES_3D.torus.calc({ R: 5, r: 2 }).Volume, 2 * Math.PI ** 2 * 5 * 4);
  assert.throws(() => X.SHAPES_3D.sphere.calc({ r: -1 }));
  const t = X.rightTriangle({ a: 3, b: 4, c: 0 });
  close(t.c, 5); close(t.A, 36.86989764584402);
});
test('root finding', () => {
  const r = X.findRoots((x) => x * x - 2, -5, 5);
  assert.equal(r.length, 2); close(r[1], Math.SQRT2, 1e-9);
  assert.equal(X.findRoots((x) => 1 / x, -1, 1).length, 0); // asymptote is not a root
});
