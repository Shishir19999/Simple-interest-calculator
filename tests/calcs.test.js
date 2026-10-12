import test from 'node:test';
import assert from 'node:assert/strict';
import { CALCS, CATEGORIES, getCalc, search } from '../src/calcs/registry.js';
import { makeEnv, DEFAULT_SETTINGS } from '../src/core/format.js';
import { defaults, runCalc, parseInputs } from '../src/core/runner.js';

const env = makeEnv({ ...DEFAULT_SETTINGS, currency: 'USD' }, new Date(2026, 5, 15));
const run = (id, over = {}) => {
  const c = getCalc(id);
  const r = runCalc(c, { ...defaults(c, env), ...over }, env);
  assert.ok(r.ok, `${id}: ${JSON.stringify(r.errors || r.error)}`);
  return r.result;
};
const val = (res, label) => res.stats.find((s) => s.label === label).v;
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} within ${eps} of ${b}`);

test('registry is consistent', () => {
  const ids = new Set();
  for (const c of CALCS) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
    assert.ok(CATEGORIES.some((k) => k.id === c.cat), `${c.id} has unknown category`);
    assert.ok(c.title && c.desc, `${c.id} needs title and description`);
    if (c.view === 'form') assert.ok(Array.isArray(c.inputs) && typeof c.run === 'function');
  }
  assert.ok(CALCS.length >= 100, `only ${CALCS.length} calculators`);
});

test('every form calculator runs with its default inputs and yields finite, formatted results', () => {
  for (const c of CALCS.filter((x) => x.view === 'form')) {
    const r = runCalc(c, defaults(c, env), env);
    assert.ok(r.ok, `${c.id}: ${JSON.stringify(r.errors || r.error)}`);
    assert.ok(r.result.stats.length > 0, `${c.id} has no stats`);
    for (const s of r.result.stats) {
      if (typeof s.v === 'number') assert.ok(Number.isFinite(s.v), `${c.id}/${s.label} is not finite`);
      const shown = env.kind(s.k, s.v, s.digits);
      assert.ok(shown && !/NaN|undefined|\[object/.test(shown), `${c.id}/${s.label} -> ${shown}`);
    }
    for (const t of [r.result.table, r.result.extraTable].filter(Boolean)) {
      for (const row of t.rows) assert.equal(row.length, t.cols.length, `${c.id} table row width`);
    }
    (r.result.steps || []).forEach((st) => assert.ok(!/NaN|undefined/.test(st), `${c.id} step: ${st}`));
  }
});

test('validation rejects bad input with field errors', () => {
  const c = getCalc('emi');
  const r = runCalc(c, { ...defaults(c, env), p: '-5', r: 'abc', t: '' }, env);
  assert.equal(r.ok, false);
  assert.ok(r.errors.p && r.errors.r && r.errors.t);
  assert.ok(parseInputs(getCalc('prime-factors'), { n: '12.5' }).errors.n);
  assert.ok(parseInputs(getCalc('age'), { dob: '2020-02-31', on: '2026-01-01' }).errors.dob);
});

test('reference values: finance', () => {
  close(val(run('emi'), 'Monthly EMI'), 8678.23);
  close(val(run('compound-interest'), 'Total amount'), 12702.37);
  close(val(run('simple-interest'), 'Interest earned'), 2400);
  close(val(run('sip'), 'Maturity value'), 1161695.38, 0.05);
  close(val(run('mortgage', { extra: '0' }), 'Monthly payment (before extras)'), 1896.2);
  close(val(run('sales-tax'), 'Total with tax'), 1180);
  close(val(run('tip-split', { n: '4' }), 'Each person pays'), 24.15);
  close(val(run('cagr'), 'CAGR'), 20.11, 0.01);
});
test('reference values: health and life', () => {
  close(val(run('bmi'), 'BMI'), 22.86);
  close(val(run('bmr-tdee', { age: '30', kg: '80', cm: '180' }), 'BMR (Mifflin-St Jeor)'), 1780);
  assert.equal(run('age', { dob: '1990-05-20', on: '2026-03-15' }).stats[0].v, '35 years, 9 months, 23 days');
  assert.equal(run('date-difference', { a: '2026-01-01', b: '2026-03-01' }).stats[0].v, 59);
  assert.equal(run('add-dates', { d: '2026-01-31', op: '+', y: '0', m: '1', w: '0', dd: '0' }).stats[1].v, '2026-02-28');
  assert.equal(run('working-days', { a: '2026-01-05', b: '2026-01-16', mode: 'between' }).stats[0].v, 10);
  assert.equal(run('percentage', { mode: 'of', x: '20', y: '350' }).stats[0].v, 70);
  close(val(run('percentage', { mode: 'change', x: '80', y: '100' }), 'Increase'), 25);
  assert.equal(run('day-of-week', { d: '2026-12-25' }).stats[0].v, 'Friday');
  assert.equal(run('day-of-week', { d: '2026-12-25' }).stats[2].v, 52);
});
test('reference values: maths and science', () => {
  assert.equal(run('quadratic').stats[0].v, '1 ,  2');
  close(val(run('statistics', { d: '2 4 4 4 5 5 7 9' }), 'Std. deviation (population)'), 2);
  close(val(run('shapes-2d', { shape: 'circle', circle_r: '5' }), 'Area'), 78.54);
  close(val(run('molar-mass'), 'Molar mass'), 180.156);
  close(val(run('ohms-law'), 'Power'), 36);
  assert.equal(run('prime-factors').stats[0].v, '2^3 x 3^2 x 5');
  assert.equal(run('roman', { n: '2024' }).stats[0].v, 'MMXXIV');
  assert.equal(run('number-words', { n: '2500000', s: 'indian' }).stats[0].v, 'twenty-five lakh');
  assert.equal(run('fractions', { a: '1/2', op: '+', b: '1/3' }).stats[0].v, '5/6');
  close(val(run('normal-distribution', { mode: 'lt', x: '1.96' }), 'Probability'), 0.975, 1e-4);
});

test('search finds calculators by keyword', () => {
  assert.equal(search('emi')[0].id, 'emi');
  assert.ok(search('pythagoras').some((c) => c.id === 'right-triangle'));
  assert.ok(search('how old').some((c) => c.id === 'age'));
  assert.ok(search('mpg').some((c) => c.id === 'convert-fuel'));
  assert.deepEqual(search('zzzzqq'), []);
});
