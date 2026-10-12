import test from 'node:test';
import assert from 'node:assert/strict';
import { calc, formatDecimal, parse, evalNum, ExprError } from '../src/lib/expr.js';

const f = (s, ctx) => formatDecimal(calc(s, ctx));

test('decimal-correct arithmetic', () => {
  assert.equal(f('0.1+0.2'), '0.3');
  assert.equal(f('0.1*3'), '0.3');
  assert.equal(f('1.15*100'), '115');
  assert.equal(f('19.99*3'), '59.97');
});
test('precedence and associativity', () => {
  assert.equal(f('2+3*4'), '14');
  assert.equal(f('(2+3)*4'), '20');
  assert.equal(f('2^3^2'), '512');
  assert.equal(f('-2^2'), '-4');
  assert.equal(f('2^-2'), '0.25');
  assert.equal(f('10-4-3'), '3');
  assert.equal(f('100/10/5'), '2');
});
test('implicit multiplication', () => {
  assert.equal(f('2(3+4)'), '14');
  assert.equal(f('(1+1)(2+2)'), '8');
  assert.equal(f('2pi', { angle: 'rad' }), '6.28318530718');
  assert.equal(f('3x', { vars: { x: 4 } }), '12');
});
test('percent', () => {
  assert.equal(f('20%'), '0.2');
  assert.equal(f('200+10%'), '220');
  assert.equal(f('200-10%'), '180');
  assert.equal(f('50*10%'), '5');
});
test('factorial, nCr, nPr', () => {
  assert.equal(f('5!'), '120');
  assert.equal(f('20!'), '2432902008176640000');
  assert.equal(f('nCr(52,5)'), '2598960');
  assert.equal(f('10 nPr 3'), '720');
  assert.equal(f('0!'), '1');
  assert.throws(() => calc('(-1)!'), ExprError);
});
test('trig in degrees, radians, gradians', () => {
  assert.equal(f('sin(30)'), '0.5');
  assert.equal(f('cos(60)'), '0.5');
  assert.equal(f('tan(45)'), '1');
  assert.equal(f('sin(90)'), '1');
  assert.equal(f('cos(90)'), '0');
  assert.equal(f('sin(pi/2)', { angle: 'rad' }), '1');
  assert.equal(f('sin(100)', { angle: 'grad' }), '1');
  assert.equal(f('asin(0.5)'), '30');
  assert.equal(f('atan(1)'), '45');
  assert.throws(() => calc('tan(90)'), /undefined/);
});
test('logs, roots, rounding', () => {
  assert.equal(f('log(1000)'), '3');
  assert.equal(f('ln(e)'), '1');
  assert.equal(f('log(8,2)'), '3');
  assert.equal(f('sqrt(2)'), '1.41421356237');
  assert.equal(f('cbrt(-27)'), '-3');
  assert.equal(f('root(81,4)'), '3');
  assert.equal(f('round(2.675,2)'), '2.68');
  assert.equal(f('floor(-1.5)'), '-2');
  assert.equal(f('ceil(1.2)'), '2');
  assert.equal(f('abs(-3)'), '3');
  assert.equal(f('√16'), '4');
  assert.equal(f('5²'), '25');
});
test('variables and ans', () => {
  assert.equal(f('ans*2', { ans: '21' }), '42');
  assert.equal(f('x^2+1', { vars: { x: 3 } }), '10');
});
test('errors', () => {
  assert.throws(() => calc('1/0'), /Division by zero/);
  assert.throws(() => calc('sqrt(-4)'), /negative/);
  assert.throws(() => calc('foo+1'), /Unknown name/);
  assert.throws(() => calc('2+'), (e) => e.atEnd === true);
  assert.throws(() => calc('(1+2'), ExprError);
  assert.throws(() => calc('2 $ 3'), ExprError);
  assert.throws(() => calc('ln(0)'), ExprError);
});
test('no code execution surface', () => {
  assert.throws(() => calc('constructor'), ExprError);
  assert.throws(() => calc('__proto__'), ExprError);
  assert.throws(() => calc('alert(1)'), ExprError);
});
test('number evaluator for plotting', () => {
  const ast = parse('x^2 - 4');
  assert.equal(evalNum(ast, { x: 3 }), 5);
  assert.equal(evalNum(parse('sin(x)'), { x: 90 }, 'deg'), 1);
  assert.ok(Number.isNaN(evalNum(parse('sqrt(x)'), { x: -1 })));
});
test('large and small formatting', () => {
  assert.equal(f('2^100'), '1.26765060023e30');
  assert.equal(f('1/3'), '0.333333333333');
  assert.equal(f('1e-9*5'), '5e-9');
});
