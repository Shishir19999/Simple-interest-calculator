import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/lib/finext.js';
import * as F from '../src/lib/finmath.js';

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);

test('EMI reference values', () => {
  close(F.emi(1000000, 8.5, 20).emi, 8678.23, 0.01);
  close(F.emi(100000, 12, 1).emi, 8884.88, 0.01);
});
test('amortization pays the loan to zero', () => {
  const r = F.emi(500000, 9, 10);
  close(r.schedule[r.schedule.length - 1].balance, 0, 1e-6);
  close(r.schedule.reduce((s, x) => s + x.principal, 0), 500000, 0.01);
});
test('30 year mortgage 300000 @ 6.5% = 1896.20 monthly', () => {
  const r = M.mortgage(300000, 6.5, 30);
  close(r.payment, 1896.2, 0.01);
  close(r.totalInterest, 382633.2, 5);
  assert.equal(r.months, 360);
});
test('extra payments shorten the loan and save interest', () => {
  const r = M.mortgage(300000, 6.5, 30, { extraMonthly: 200 });
  assert.ok(r.months < 360 && r.monthsSaved > 50);
  assert.ok(r.interestSaved > 50000);
  close(r.schedule[r.schedule.length - 1].balance, 0, 0.01);
  assert.ok(M.mortgage(300000, 6.5, 30, { lumpSum: 50000, lumpMonth: 12 }).interestSaved > 0);
});
test('zero-rate loan', () => { close(F.emi(12000, 0, 1).emi, 1000); close(M.mortgage(12000, 0, 1).totalInterest, 0); });
test('affordable loan is the inverse of EMI', () => {
  close(M.affordableLoan(F.emi(750000, 9.25, 15).emi, 9.25, 15), 750000, 0.01);
});
test('SIP 5000/month 12% for 10 years', () => {
  close(F.recurring(5000, 12, 10, 'end').total, 1150193.45, 0.01); close(F.recurring(5000, 12, 10, 'start').total, 1161695.38, 0.01);
});
test('future value and present value', () => {
  close(M.futureValue(1000, 0, 0.05, 10), 1628.89, 0.01);
  close(M.futureValue(0, 100, 0.01, 12), 1268.25, 0.01);
  close(M.presentValue(1628.894627, 0.05, 10), 1000, 0.001);
});
test('NPV and IRR', () => {
  close(M.npv(10, [-1000, 300, 400, 500]), -21.04, 0.01);
  close(M.irr([-1000, 300, 400, 500]), 8.9, 0.1);
  close(M.irr([-100, 110]), 10, 1e-6);
  assert.ok(Number.isNaN(M.irr([100, 200])));
});
test('CAGR, inflation, rule of 72', () => {
  close(M.cagr(1000, 2000, 5), 14.87, 0.01);
  close(M.inflationValue(100, 6, 10), 179.08, 0.01);
  close(M.rule72(8).exact, 9.006, 0.001);
  assert.throws(() => M.cagr(0, 1, 1));
});
test('break-even', () => {
  const b = M.breakEven(50000, 25, 15);
  close(b.units, 5000); assert.equal(b.unitsCeil, 5000);
  assert.throws(() => M.breakEven(1, 10, 10));
});
test('sales tax add and remove', () => {
  close(M.salesTax(1000, 18, 'add').gross, 1180);
  const r = M.salesTax(1180, 18, 'remove'); close(r.net, 1000); close(r.tax, 180);
});
test('discount, markup, margin', () => {
  close(M.discount(1000, 20, 10).final, 720); close(M.discount(1000, 20, 10).effectivePct, 28);
  close(M.markup(80, 25).price, 100); close(M.markup(80, 25).margin, 20);
  close(M.marginFrom(80, 100).markup, 25); close(M.priceForMargin(80, 20), 100);
});
test('tip split', () => { const r = M.tipSplit(84, 15, 4); close(r.tip, 12.6); close(r.perPerson, 24.15); });
test('salary and hourly', () => { close(M.hourlyToSalary(25, 40, 52).yearly, 52000); close(M.salaryToHourly(52000, 40, 52).hourly, 25); });
test('progressive tax slabs', () => {
  const r = M.slabTax(1000000, [{ upTo: 300000, rate: 0 }, { upTo: 700000, rate: 5 }, { upTo: 1000000, rate: 10 }, { upTo: null, rate: 20 }]);
  close(r.tax, 50000); close(r.effective, 5);
  close(M.slabTax(1500000, [{ upTo: 500000, rate: 10 }, { upTo: null, rate: 30 }]).tax, 350000);
});
test('depreciation methods end at salvage value', () => {
  for (const m of ['sl', 'syd', 'ddb']) {
    const rows = M.depreciation(10000, 1000, 5, m);
    close(rows[rows.length - 1].book, 1000, 1e-6);
  }
  close(M.depreciation(10000, 1000, 5, 'sl')[0].depreciation, 1800);
  close(M.depreciation(10000, 1000, 5, 'syd')[0].depreciation, 3000);
});
test('savings goal', () => {
  const m = M.savingsGoal(100000, 0, 6, 5);
  close(M.futureValue(0, m, 0.005, 60), 100000, 0.01);
  assert.equal(M.savingsGoal(100, 1000, 5, 1), 0);
});
test('withdrawals and card payoff', () => {
  assert.ok(M.withdrawals(1000000, 5000, 6, 30).lasted);
  assert.ok(!M.withdrawals(100000, 5000, 0, 30).lasted);
  const c = M.creditCardPayoff(5000, 18, 200);
  assert.equal(c.months, 32);
  assert.throws(() => M.creditCardPayoff(10000, 24, 100));
});
test('retirement and FIRE', () => {
  const r = M.retirement({ age: 30, retireAge: 60, current: 0, monthlySave: 10000, returnPct: 10, inflationPct: 6, monthlyExpenseToday: 40000, withdrawPct: 4 });
  assert.equal(r.years, 30); assert.ok(r.corpus > 2e7);
  const f = M.fire({ current: 0, annualSave: 20000, annualExpenses: 40000, returnPct: 5, withdrawPct: 4 });
  close(f.target, 1000000); assert.ok(f.years > 20 && f.years < 40);
});
test('lump sum vs SIP', () => {
  const r = M.lumpVsSip(100000, 1000, 12, 10);
  close(r.lumpFv, 100000 * Math.pow(1.01, 120), 0.01);
  assert.equal(r.sipInvested, 120000);
});
