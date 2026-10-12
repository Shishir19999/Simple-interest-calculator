import test from 'node:test';
import assert from 'node:assert/strict';
import { smartEval } from '../src/lib/nlq.js';

const ctx = { now: new Date(2026, 0, 15), sig: 12 };
const t = (s) => smartEval(s, ctx).text;

test('percent phrases', () => {
  assert.equal(t('20% of 350'), '70');
  assert.equal(t('15% tip on 84'), 'Tip 12.60, total 96.60');
  assert.equal(t('20% off 500'), 'Pay 400.00 (save 100.00)');
  assert.equal(t('30 is what % of 120'), '25%');
});
test('unit conversion', () => {
  assert.equal(t('5 km to miles'), '3.10685596119 mile');
  assert.equal(t('100 f to c'), '37.7777777778 celsius');
  assert.equal(t('2 hours to min'), '120 minute');
  assert.equal(t('12 in to cm'), '30.48 centimetre');
  assert.equal(t('2*3 kg in lb'), '13.2277357311 pound');
  assert.throws(() => smartEval('5 km to kg', ctx), /Cannot convert/);
});
test('currency uses the bundled snapshot', () => {
  assert.match(t('100 usd to eur'), /^92\.00 EUR$/);
});
test('dates', () => {
  assert.equal(t('today + 90 days'), 'Wednesday, 15 April 2026');
  assert.equal(t('2026-01-31 + 1 month'), 'Saturday, 28 February 2026');
  assert.equal(t('2026-03-01 - 2026-01-01'), '59 days');
  assert.equal(t('date - 1 week'), 'Thursday, 8 January 2026');
});
test('falls back to expressions', () => {
  assert.equal(t('0.1+0.2'), '0.3');
  const r = smartEval('x = 4*5', ctx);
  assert.equal(r.assigned, 'x'); assert.equal(r.text, '20');
});
