import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/life.js';
import * as T from '../src/lib/dates.js';

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);

test('BMI reference: 70 kg, 175 cm = 22.86 (normal)', () => {
  const r = L.bmi(70, 175);
  close(r.value, 22.86); assert.equal(r.category, 'Normal weight');
  assert.equal(L.bmi(95, 170).category, 'Obese'); assert.equal(L.bmi(50, 180).category, 'Underweight');
  assert.throws(() => L.bmi(0, 170));
});
test('BMR formulas: 80 kg, 180 cm, 30 y male', () => {
  close(L.bmr('mifflin', 'male', 80, 180, 30), 1780, 0.001);
  close(L.bmr('mifflin', 'female', 60, 165, 25), 1345.25, 0.001);
  close(L.bmr('harris', 'male', 80, 180, 30), 1853.632, 0.01);
  close(L.bmr('katch', 'male', 80, 180, 30, 20), 370 + 21.6 * 64, 0.001);
  assert.throws(() => L.bmr('katch', 'male', 80, 180, 30, 0));
});
test('Navy body fat and ideal weight', () => {
  close(L.bodyFatNavy('male', 180, 38, 90), 19.8, 0.05);
  close(L.bodyFatNavy('female', 165, 33, 75, 98), 28.44, 0.05);
  const w = L.idealWeights('male', 177.8); // 70 inches
  close(w.Devine, 73, 0.001); close(w.Robinson, 71, 0.001); close(w.Hamwi, 75, 0.001);
});
test('heart rate and macros', () => {
  close(L.maxHeartRate(40).classic, 180, 0); close(L.maxHeartRate(40).tanaka, 180, 0.001);
  const m = L.macros(2000, 50, 30, 20); close(m.carbsG, 250); close(m.proteinG, 150); close(m.fatG, 44.44, 0.01);
  assert.throws(() => L.macros(2000, 50, 30, 30));
  close(L.caloriesBurned(8, 70, 30), 280);
  assert.equal(L.heartZones(30, 60).length, 5);
});
test('due date by Naegele rule', () => {
  const lmp = T.utc(2026, 1, 1);
  assert.equal(T.toISO(L.dueDate(lmp).due), '2026-10-08');
  assert.equal(T.toISO(L.dueDate(lmp, 32).due), '2026-10-12');
});
test('pace', () => { const p = L.pace(10, 50); close(p.perKm, 5); close(p.speedKmh, 12); assert.equal(L.minutesToClock(L.clockToMinutes('1:05:30')), '1:05:30'); });
test('percentage variants', () => {
  close(L.pctOf(15, 200), 30); close(L.whatPct(25, 200), 12.5); close(L.pctChange(80, 100), 25); close(L.pctChange(100, 80), -20);
  close(L.pctDifference(50, 100), 66.6667, 0.001); close(L.reversePct(30, 15), 200);
  assert.throws(() => L.pctChange(0, 5));
});
test('ratios and proportions', () => {
  assert.deepEqual(L.simplifyRatio([12, 18, 24]), [2, 3, 4]); assert.deepEqual(L.simplifyRatio([1.5, 2.5]), [3, 5]);
  close(L.solveProportion(2, 3, 8, null), 12); close(L.solveProportion(null, 3, 8, 12), 2);
  assert.throws(() => L.solveProportion(1, 2, 3, 4));
  close(L.weightedAverage([[90, 3], [80, 2]]), 86);
});
test('estimators', () => {
  const p = L.paint(5, 4, 2.5, 4, 2, 10); close(p.wallArea, 41); close(p.litres, 8.2);
  assert.equal(L.tiles(20, 0.3, 0.3, 10).withWaste, 245);
  assert.equal(L.concrete(3, 2, 0.1, 0.017, 10).bags, 39);
  const e = L.electricity([{ watts: 100, hours: 10, qty: 2 }], 8, 30); close(e.kwh, 60); close(e.cost, 480);
  close(L.fuelCost(500, 8, 1.5, 'per100').cost, 60); close(L.fuelCost(500, 20, 1.5, 'perUnit').litres, 25);
  close(L.dataTransferSeconds(1e9, 100), 80);
});
test('physics and chemistry', () => {
  const o = L.ohm({ v: 12, r: 4, i: null, p: null }); close(o.i, 3); close(o.p, 36);
  assert.throws(() => L.ohm({ v: 1, i: null, r: null, p: null }));
  const pr = L.projectile(20, 45); close(pr.range, 40.79, 0.01); close(pr.maxHeight, 10.19, 0.01); close(pr.flight, 2.884, 0.001);
  close(L.idealGas(101325, null, 1, 273.15).V, 0.022414, 1e-5);
  close(L.halfLife(100, 5730, 5730).remaining, 50);
  close(L.pH.fromH(1e-7), 7);
  close(L.molarMass('H2O').mass, 18.015, 0.001); close(L.molarMass('C6H12O6').mass, 180.156, 0.001);
  close(L.molarMass('Ca(OH)2').mass, 74.092, 0.001); close(L.molarMass('Al2(SO4)3').mass, 342.132, 0.01);
  assert.throws(() => L.molarMass('Xx2')); assert.throws(() => L.molarMass('(OH'));
});
test('date arithmetic', () => {
  assert.equal(T.toISO(T.addMonths(T.utc(2024, 1, 31), 1)), '2024-02-29');
  assert.equal(T.toISO(T.addMonths(T.utc(2026, 3, 31), -1)), '2026-02-28');
  assert.equal(T.diffDays(T.utc(2026, 1, 1), T.utc(2027, 1, 1)), 365);
  assert.deepEqual(T.ymd(T.utc(1990, 5, 20), T.utc(2026, 3, 15)), { years: 35, months: 9, days: 23 });
  assert.equal(T.workingDays(T.utc(2026, 1, 5), T.utc(2026, 1, 16)), 10);
  assert.equal(T.toISO(T.addWorkingDays(T.utc(2026, 1, 9), 1)), '2026-01-12');
  assert.ok(Number.isNaN(T.parseISO('2026-02-30'))); assert.equal(T.weekday(T.utc(2026, 1, 1)), 'Thursday');
  assert.equal(T.zoneOffsetMin('Asia/Kolkata', Date.UTC(2026, 0, 1)), 330);
  assert.equal(T.zoneOffsetMin('America/New_York', Date.UTC(2026, 0, 1)), -300);
  const inst = T.wallToInstant(Date.UTC(2026, 6, 1, 9, 0), 'America/New_York');
  assert.equal(new Date(inst).toISOString(), '2026-07-01T13:00:00.000Z');
});
