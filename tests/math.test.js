'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../math.js');

const close = (a, b, eps = 0.01) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);

test('simple interest 10000 @ 8% for 3 years', () => {
  const r = M.simpleInterest(10000, 8, 3);
  close(r.interest, 2400);
  close(r.total, 12400);
});

test('simple interest handles fractional years and zero rate', () => {
  close(M.simpleInterest(5000, 10, 0.5).interest, 250);
  close(M.simpleInterest(5000, 0, 5).interest, 0);
});

test('compound interest annual 10000 @ 8% for 3 years', () => {
  close(M.compoundInterest(10000, 8, 3, 1).total, 12597.12);
});

test('compound interest monthly and quarterly', () => {
  close(M.compoundInterest(10000, 8, 3, 12).total, 12702.37);
  close(M.compoundInterest(10000, 8, 3, 4).total, 12682.42);
});

test('continuous compounding', () => {
  close(M.compoundInterest(10000, 8, 3, 0).total, 10000 * Math.exp(0.24));
});

test('effective annual rate', () => {
  close(M.effectiveRate(8, 1), 8, 1e-9);
  close(M.effectiveRate(8, 4), 8.2432, 0.0001);
});

test('compound never lower than simple', () => {
  M.growthSeries(10000, 8, 5, 12).forEach((p) => assert.ok(p.compound >= p.simple - 1e-9));
});

test('growth series covers whole years plus fractional end', () => {
  assert.deepEqual(M.timePoints(3), [0, 1, 2, 3]);
  assert.deepEqual(M.timePoints(2.5), [0, 1, 2, 2.5]);
  const g = M.growthSeries(1000, 10, 2, 1);
  close(g[0].simple, 1000);
  close(g[2].compound, 1210);
});

test('EMI 1,000,000 @ 8.5% for 20 years', () => {
  const e = M.emi(1000000, 8.5, 20);
  close(e.emi, 8678.23);
  assert.equal(e.months, 240);
});

test('EMI amortization schedule is consistent', () => {
  const e = M.emi(500000, 9, 5);
  assert.equal(e.schedule.length, 60);
  close(e.schedule[59].balance, 0, 1e-6);
  close(e.schedule.reduce((s, r) => s + r.principal, 0), 500000, 0.001);
  close(e.schedule.reduce((s, r) => s + r.interest, 0), e.interest, 0.01);
  close(e.schedule[0].interest, (500000 * 9) / 1200, 1e-6);
});

test('EMI with zero rate splits the principal evenly', () => {
  const e = M.emi(12000, 0, 1);
  close(e.emi, 1000);
  close(e.interest, 0);
});

test('recurring deposit with zero rate', () => {
  const r = M.recurring(1000, 0, 2, 'end');
  close(r.total, 24000);
  close(r.interest, 0);
});

test('SIP 5000/month @ 12% for 10 years (end of month)', () => {
  const r = M.recurring(5000, 12, 10, 'end');
  close(r.total, 1150193.45, 0.5);
  close(M.recurring(5000, 12, 10, 'start').total, 1161695.38, 0.5);
  close(r.invested, 600000);
});

test('start-of-month deposits earn one extra month of interest', () => {
  const end = M.recurring(5000, 12, 10, 'end').total;
  const start = M.recurring(5000, 12, 10, 'start').total;
  close(start, end * 1.01, 1e-6);
});

test('recurring yearly series ends at the total', () => {
  const r = M.recurring(1000, 6, 2.5, 'end');
  const last = r.yearly[r.yearly.length - 1];
  assert.equal(last.month, 30);
  close(last.balance, r.total, 1e-9);
});

test('fixed deposit quarterly 100000 @ 7% for 5 years', () => {
  const f = M.fixedDeposit(100000, 7, 5, 4);
  close(f.total, 100000 * Math.pow(1.0175, 20), 1e-6);
  close(f.series[f.series.length - 1].balance, f.total, 1e-9);
});

test('CSV escaping', () => {
  assert.equal(M.toCSV([['a', 'b,c'], [1, 'say "hi"']]), 'a,"b,c"\r\n1,"say ""hi"""');
});
