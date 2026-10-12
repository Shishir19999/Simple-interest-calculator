/* Integer (BigInt) expression evaluator for the programmer calculator. */

export class ProgError extends Error {}

function tokens(src) {
  const out = [];
  const s = src.trim();
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    let m;
    if ((m = /^(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)/i.exec(s.slice(i)))) { out.push({ t: 'n', v: m[0] }); i += m[0].length; continue; }
    if ((m = /^(<<|>>>|>>)/.exec(s.slice(i)))) { out.push({ t: 'o', v: m[0] }); i += m[0].length; continue; }
    if ((m = /^(and|or|xor|not|mod)\b/i.exec(s.slice(i)))) { out.push({ t: 'o', v: { and: '&', or: '|', xor: '^', not: '~', mod: '%' }[m[0].toLowerCase()] }); i += m[0].length; continue; }
    if ('+-*/%&|^~()'.includes(c)) { out.push({ t: 'o', v: c }); i += 1; continue; }
    throw new ProgError(`Unexpected "${c}"`);
  }
  return out;
}

/** Evaluate to an unbounded BigInt. `bits` is used for the logical shift >>> and NOT is plain two's complement (-x - 1). */
export function evalProg(src, bits = 32) {
  const toks = tokens(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...v) => peek() && peek().t === 'o' && v.includes(peek().v);
  const mask = (1n << BigInt(bits)) - 1n;
  function level(next, ops, apply) {
    return () => { let l = next(); while (isOp(...ops)) { const op = toks[p++].v; if (!peek()) throw new ProgError('Incomplete expression'); l = apply(op, l, next()); } return l; };
  }
  const unary = () => {
    if (isOp('-')) { p++; return -unary(); }
    if (isOp('~')) { p++; return ~unary(); }
    if (isOp('+')) { p++; return unary(); }
    if (isOp('(')) { p++; const v = or(); if (!isOp(')')) throw new ProgError('Expected ")"'); p++; return v; }
    const t = toks[p++];
    if (!t) throw new ProgError('Incomplete expression');
    if (t.t !== 'n') throw new ProgError(`Unexpected "${t.v}"`);
    return BigInt(t.v.toLowerCase());
  };
  const mul = level(unary, ['*', '/', '%'], (op, a, b) => {
    if (op === '*') return a * b;
    if (b === 0n) throw new ProgError('Division by zero');
    return op === '/' ? a / b : a % b;
  });
  const add = level(mul, ['+', '-'], (op, a, b) => (op === '+' ? a + b : a - b));
  const shift = level(add, ['<<', '>>', '>>>'], (op, a, b) => {
    if (b < 0n || b > 1024n) throw new ProgError('Shift amount out of range');
    return op === '<<' ? a << b : op === '>>' ? a >> b : (a & mask) >> b;
  });
  const and = level(shift, ['&'], (_, a, b) => a & b);
  const xor = level(and, ['^'], (_, a, b) => a ^ b);
  const or = level(xor, ['|'], (_, a, b) => a | b);
  const v = or();
  if (p < toks.length) throw new ProgError(`Unexpected "${toks[p].v}"`);
  return v;
}

/** Wrap to a word size and return all views of the value. */
export function view(value, bits) {
  const size = BigInt(bits), mod = 1n << size;
  const u = ((value % mod) + mod) % mod;
  const signed = u >= mod >> 1n ? u - mod : u;
  const overflow = value >= mod || value < -(mod >> 1n);
  return {
    unsigned: u, signed, overflow,
    bin: u.toString(2).padStart(bits, '0'), oct: u.toString(8), hex: u.toString(16).toUpperCase().padStart(bits / 4, '0'),
    ones: [...u.toString(2)].filter((c) => c === '1').length,
  };
}
export const groupBin = (s) => s.replace(/(.{4})(?=.)/g, '$1 ');
