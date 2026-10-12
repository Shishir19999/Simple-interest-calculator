import test from 'node:test';
import assert from 'node:assert/strict';
import { evalProg, view, ProgError } from '../src/lib/progcalc.js';

test('arithmetic and precedence', () => {
  assert.equal(evalProg('2 + 3 * 4'), 14n);
  assert.equal(evalProg('(2 + 3) * 4'), 20n);
  assert.equal(evalProg('17 / 5'), 3n);
  assert.equal(evalProg('-17 / 5'), -3n);
  assert.equal(evalProg('17 % 5'), 2n);
});
test('bitwise operators', () => {
  assert.equal(evalProg('0xFF & 0b1010'), 10n);
  assert.equal(evalProg('0xF0 | 0x0F'), 255n);
  assert.equal(evalProg('0b1100 ^ 0b1010'), 6n);
  assert.equal(evalProg('1 << 10'), 1024n);
  assert.equal(evalProg('256 >> 4'), 16n);
  assert.equal(evalProg('5 and 3'), 1n);
  assert.equal(evalProg('1 | 2 & 3'), 3n);
  assert.equal(evalProg('~0'), -1n);
});
test('logical vs arithmetic right shift', () => {
  assert.equal(evalProg('-8 >> 1', 8), -4n);
  assert.equal(evalProg('-8 >>> 1', 8), 124n);
});
test("two's complement views", () => {
  const v = view(-1n, 8);
  assert.equal(v.unsigned, 255n); assert.equal(v.signed, -1n); assert.equal(v.hex, 'FF'); assert.equal(v.bin, '11111111'); assert.equal(v.ones, 8);
  assert.equal(view(128n, 8).signed, -128n);
  assert.equal(view(127n, 8).signed, 127n);
  assert.ok(view(256n, 8).overflow); assert.ok(!view(255n, 8).overflow);
  assert.equal(view(1n << 63n, 64).signed, -(1n << 63n));
  assert.equal(view(0xDEADBEEFn, 32).hex, 'DEADBEEF');
});
test('errors', () => {
  assert.throws(() => evalProg('1 / 0'), ProgError);
  assert.throws(() => evalProg('2 +'), ProgError);
  assert.throws(() => evalProg('0xZZ'), ProgError);
  assert.throws(() => evalProg('(1'), ProgError);
});
