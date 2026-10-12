/*
 * Safe expression engine (no eval, no Function).
 * Tokenizer + recursive-descent parser -> AST -> two evaluators:
 *   evalDecimal: arbitrary precision (decimal.js) for the smart calculator, so 0.1 + 0.2 = 0.3
 *   evalNum:     IEEE doubles for fast plotting, tables and root finding
 */
import Decimal from 'decimal.js';

export const D = Decimal.clone({ precision: 50, rounding: 4, toExpNeg: -60, toExpPos: 60 });

export class ExprError extends Error {
  constructor(message, atEnd = false) {
    super(message);
    this.atEnd = atEnd;
  }
}

const FUNC_ALIASES = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', lg: 'log', log10: 'log', ln: 'ln', sqr: 'sqrt', fact: 'factorial', npr: 'npr', ncr: 'ncr', mean: 'avg', average: 'avg', power: 'pow', modulo: 'mod' };
const CONSTS = { pi: 'pi', e: 'e', tau: 'tau', phi: 'phi', infinity: 'inf' };

/* ---------------- tokenizer ---------------- */
export function tokenize(src) {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, ' pi ').replace(/τ/g, ' tau ').replace(/φ/g, ' phi ');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    let m;
    if ((m = /^(0x[0-9a-f]+|0b[01]+|0o[0-7]+)/i.exec(s.slice(i)))) {
      out.push({ t: 'num', v: m[0], pos: i }); i += m[0].length; continue;
    }
    if ((m = /^(\d[\d_]*(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i)))) {
      // do not swallow the "e" of Euler's constant: 2e is not an exponent unless digits follow (regex enforces)
      out.push({ t: 'num', v: m[0].replace(/_/g, ''), pos: i }); i += m[0].length; continue;
    }
    if ((m = /^[A-Za-z_][A-Za-z_0-9]*/.exec(s.slice(i)))) {
      out.push({ t: 'id', v: m[0], pos: i }); i += m[0].length; continue;
    }
    if (s.startsWith('**', i)) { out.push({ t: 'op', v: '^', pos: i }); i += 2; continue; }
    if (c === '²') { out.push({ t: 'op', v: '^', pos: i }, { t: 'num', v: '2', pos: i }); i++; continue; }
    if (c === '³') { out.push({ t: 'op', v: '^', pos: i }, { t: 'num', v: '3', pos: i }); i++; continue; }
    if ('+-*/^%!(),=√'.includes(c)) { out.push({ t: 'op', v: c, pos: i }); i++; continue; }
    throw new ExprError(`Unexpected character "${c}"`);
  }
  return out;
}

/* ---------------- parser ---------------- */
const KNOWN_FUNCS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sec', 'csc', 'cot', 'ln', 'log', 'log2', 'exp', 'sqrt', 'cbrt', 'abs', 'floor', 'ceil', 'round', 'trunc', 'sign',
  'factorial', 'ncr', 'npr', 'min', 'max', 'gcd', 'lcm', 'mod', 'pow', 'hypot', 'root', 'avg', 'atan2', 'rad', 'deg', 'sum', 'fract'
]);
export const FUNCTION_NAMES = [...KNOWN_FUNCS];

export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => toks[p] && toks[p].t === 'op' && toks[p].v === v;
  const end = () => new ExprError('Incomplete expression', true);
  const startsPrimary = (t) => t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && (t.v === '(' || t.v === '√')));

  function parseAdd() {
    let left = parseMul();
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].v;
      if (!peek()) throw end();
      left = { t: 'bin', op, a: left, b: parseMul() };
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.t === 'op' && (t.v === '*' || t.v === '/')) {
        p++;
        if (!peek()) throw end();
        left = { t: 'bin', op: t.v, a: left, b: parseUnary() };
      } else if (t.t === 'id' && (t.v.toLowerCase() === 'mod' || t.v.toLowerCase() === 'ncr' || t.v.toLowerCase() === 'npr')) {
        p++;
        if (!peek()) throw end();
        const name = t.v.toLowerCase();
        left = name === 'mod' ? { t: 'bin', op: 'mod', a: left, b: parseUnary() } : { t: 'call', name, args: [left, parseUnary()] };
      } else if (startsPrimary(t)) {
        left = { t: 'bin', op: '*', a: left, b: parsePower(), implicit: true };
      } else break;
    }
    return left;
  }
  function parseUnary() {
    if (isOp('-')) { p++; if (!peek()) throw end(); return { t: 'neg', a: parseUnary() }; }
    if (isOp('+')) { p++; if (!peek()) throw end(); return parseUnary(); }
    return parsePower();
  }
  function parsePower() {
    const base = parsePostfix();
    if (isOp('^')) {
      p++;
      if (!peek()) throw end();
      return { t: 'bin', op: '^', a: base, b: parseUnary() };
    }
    return base;
  }
  function parsePostfix() {
    let node = parsePrimary();
    for (;;) {
      if (isOp('!')) { p++; node = { t: 'call', name: 'factorial', args: [node] }; }
      else if (isOp('%') && !startsPrimary(toks[p + 1])) { p++; node = { t: 'pct', a: node }; }
      else if (isOp('%')) break; // "a % b" is not supported: use mod
      else break;
    }
    return node;
  }
  function parsePrimary() {
    const t = toks[p];
    if (!t) throw end();
    if (t.t === 'num') { p++; return { t: 'num', v: t.v }; }
    if (t.t === 'op' && t.v === '(') {
      p++;
      const e = parseAdd();
      if (!isOp(')')) throw peek() ? new ExprError('Expected ")"') : end();
      p++;
      return e;
    }
    if (t.t === 'op' && t.v === '√') {
      p++;
      if (!peek()) throw end();
      return { t: 'call', name: 'sqrt', args: [parsePower()] };
    }
    if (t.t === 'id') {
      p++;
      let name = t.v.toLowerCase();
      name = Object.hasOwn(FUNC_ALIASES, name) ? FUNC_ALIASES[name] : name;
      if (KNOWN_FUNCS.has(name)) {
        if (isOp('(')) {
          p++;
          const args = [];
          if (!isOp(')')) {
            for (;;) {
              args.push(parseAdd());
              if (isOp(',')) { p++; continue; }
              break;
            }
          }
          if (!isOp(')')) throw peek() ? new ExprError('Expected ")"') : end();
          p++;
          return { t: 'call', name, args };
        }
        if (!peek()) throw end();
        return { t: 'call', name, args: [parseUnaryArg()] };
      }
      const lower = t.v.toLowerCase();
      if (Object.hasOwn(CONSTS, lower)) return { t: 'const', name: CONSTS[lower] };
      return { t: 'var', name: lower === 'ans' ? 'ans' : t.v };
    }
    throw new ExprError(`Unexpected "${t.v}"`);
  }
  function parseUnaryArg() {
    if (isOp('-')) { p++; return { t: 'neg', a: parseUnaryArg() }; }
    return parsePower();
  }

  if (!toks.length) throw new ExprError('Empty expression', true);
  const ast = parseAdd();
  if (p < toks.length) {
    const t = toks[p];
    throw new ExprError(`Unexpected "${t.v}"`);
  }
  return ast;
}

/** Parse "name = expression" statements; returns {name, ast} or {ast}. */
export function parseStatement(src) {
  const m = /^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=(?!=)\s*(.*)$/.exec(src);
  if (m) {
    const lower = m[1].toLowerCase();
    if (Object.hasOwn(CONSTS, lower) || KNOWN_FUNCS.has(lower) || lower === 'ans') throw new ExprError(`"${m[1]}" is reserved`);
    return { name: m[1], ast: parse(m[2]) };
  }
  return { ast: parse(src) };
}

/* ---------------- decimal evaluator ---------------- */
const dPi = () => D.acos(-1);
function angleToRad(x, mode) {
  if (mode === 'deg') return x.mul(dPi()).div(180);
  if (mode === 'grad') return x.mul(dPi()).div(200);
  return x;
}
function radToAngle(x, mode) {
  if (mode === 'deg') return x.mul(180).div(dPi());
  if (mode === 'grad') return x.mul(200).div(dPi());
  return x;
}
function needInt(x, name) {
  if (!x.isInteger() || x.isNegative()) throw new ExprError(`${name} needs a non-negative whole number`);
  return x.toNumber();
}
export function dFactorial(x) {
  const n = needInt(x, 'Factorial');
  if (n > 3000) throw new ExprError('Factorial is too large (max 3000!)');
  let r = new D(1);
  for (let i = 2; i <= n; i++) r = r.mul(i);
  return r;
}
function dNcr(nn, rr) {
  const n = needInt(nn, 'nCr'), k0 = needInt(rr, 'nCr');
  if (k0 > n) throw new ExprError('r cannot be larger than n');
  const k = Math.min(k0, n - k0);
  let r = new D(1);
  for (let i = 1; i <= k; i++) r = r.mul(n - k + i).div(i);
  return r.toDecimalPlaces(0);
}
function dNpr(nn, rr) {
  const n = needInt(nn, 'nPr'), k = needInt(rr, 'nPr');
  if (k > n) throw new ExprError('r cannot be larger than n');
  let r = new D(1);
  for (let i = 0; i < k; i++) r = r.mul(n - i);
  return r;
}
function dGcd(a, b) {
  a = a.abs(); b = b.abs();
  if (!a.isInteger() || !b.isInteger()) throw new ExprError('gcd needs whole numbers');
  while (!b.isZero()) { const t = a.mod(b); a = b; b = t; }
  return a;
}
const arity = (name, args, min, max = min) => {
  if (args.length < min || args.length > max) throw new ExprError(`${name}() takes ${min === max ? min : `${min} to ${max}`} argument${max === 1 ? '' : 's'}`);
};

function dCall(name, a, ctx) {
  const mode = ctx.angle || 'deg';
  const x = a[0];
  switch (name) {
    case 'sin': case 'cos': case 'tan': case 'sec': case 'csc': case 'cot': {
      arity(name, a, 1);
      if (mode !== 'rad') {
        const turn = mode === 'deg' ? 180 : 200;
        const q = x.mod(turn);
        const half = new D(turn).div(2);
        if ((name === 'tan' || name === 'sec') && q.abs().eq(half)) throw new ExprError(`${name}() is undefined here`);
        if ((name === 'cot' || name === 'csc') && q.isZero()) throw new ExprError(`${name}() is undefined here`);
        if (name === 'sin' && q.isZero()) return new D(0);
        if (name === 'cos' && q.abs().eq(half)) return new D(0);
      }
      const r = angleToRad(x, mode);
      if (name === 'sin') return D.sin(r);
      if (name === 'cos') return D.cos(r);
      if (name === 'tan') return D.tan(r);
      if (name === 'sec') return new D(1).div(D.cos(r));
      if (name === 'csc') return new D(1).div(D.sin(r));
      return new D(1).div(D.tan(r));
    }
    case 'asin': case 'acos': arity(name, a, 1);
      if (x.abs().gt(1)) throw new ExprError(`${name}() needs a value between -1 and 1`);
      return radToAngle(name === 'asin' ? D.asin(x) : D.acos(x), mode);
    case 'atan': arity(name, a, 1); return radToAngle(D.atan(x), mode);
    case 'atan2': arity(name, a, 2); return radToAngle(D.atan2(a[0], a[1]), mode);
    case 'sinh': arity(name, a, 1); return D.sinh(x);
    case 'cosh': arity(name, a, 1); return D.cosh(x);
    case 'tanh': arity(name, a, 1); return D.tanh(x);
    case 'asinh': arity(name, a, 1); return D.asinh(x);
    case 'acosh': arity(name, a, 1); if (x.lt(1)) throw new ExprError('acosh() needs x >= 1'); return D.acosh(x);
    case 'atanh': arity(name, a, 1); if (x.abs().gte(1)) throw new ExprError('atanh() needs |x| < 1'); return D.atanh(x);
    case 'ln': arity(name, a, 1); if (x.lte(0)) throw new ExprError('ln() needs a positive number'); return D.ln(x);
    case 'log': arity(name, a, 1, 2);
      if (x.lte(0)) throw new ExprError('log() needs a positive number');
      if (a.length === 2) { if (a[1].lte(0) || a[1].eq(1)) throw new ExprError('Invalid log base'); return D.ln(x).div(D.ln(a[1])); }
      return D.log10(x);
    case 'log2': arity(name, a, 1); if (x.lte(0)) throw new ExprError('log2() needs a positive number'); return D.log2(x);
    case 'exp': arity(name, a, 1); return D.exp(x);
    case 'sqrt': arity(name, a, 1); if (x.isNegative()) throw new ExprError('Square root of a negative number is not real'); return D.sqrt(x);
    case 'cbrt': arity(name, a, 1); return D.cbrt(x);
    case 'root': arity(name, a, 2); {
      if (a[1].isZero()) throw new ExprError('Root degree cannot be zero');
      if (x.isNegative()) { if (!a[1].isInteger() || a[1].mod(2).isZero()) throw new ExprError('Even root of a negative number is not real'); return D.pow(x.neg(), new D(1).div(a[1])).neg(); }
      return D.pow(x, new D(1).div(a[1]));
    }
    case 'abs': arity(name, a, 1); return x.abs();
    case 'floor': arity(name, a, 1); return x.floor();
    case 'ceil': arity(name, a, 1); return x.ceil();
    case 'trunc': arity(name, a, 1); return x.trunc();
    case 'fract': arity(name, a, 1); return x.minus(x.trunc());
    case 'sign': arity(name, a, 1); return new D(x.isZero() ? 0 : x.isNegative() ? -1 : 1);
    case 'round': arity(name, a, 1, 2);
      return a.length === 2 ? x.toDecimalPlaces(needInt(a[1], 'round'), D.ROUND_HALF_UP) : x.toDecimalPlaces(0, D.ROUND_HALF_UP);
    case 'factorial': arity(name, a, 1); return dFactorial(x);
    case 'ncr': arity(name, a, 2); return dNcr(a[0], a[1]);
    case 'npr': arity(name, a, 2); return dNpr(a[0], a[1]);
    case 'min': arity(name, a, 1, 99); return D.min(...a);
    case 'max': arity(name, a, 1, 99); return D.max(...a);
    case 'sum': arity(name, a, 1, 999); return a.reduce((s, v) => s.plus(v), new D(0));
    case 'avg': arity(name, a, 1, 999); return a.reduce((s, v) => s.plus(v), new D(0)).div(a.length);
    case 'gcd': arity(name, a, 2); return dGcd(a[0], a[1]);
    case 'lcm': arity(name, a, 2); { const g = dGcd(a[0], a[1]); return g.isZero() ? g : a[0].mul(a[1]).abs().div(g); }
    case 'mod': arity(name, a, 2); if (a[1].isZero()) throw new ExprError('Division by zero'); return a[0].mod(a[1]);
    case 'pow': arity(name, a, 2); return dPow(a[0], a[1]);
    case 'hypot': arity(name, a, 2, 99); return D.hypot(...a);
    case 'rad': arity(name, a, 1); return x.mul(dPi()).div(180);
    case 'deg': arity(name, a, 1); return x.mul(180).div(dPi());
    default: throw new ExprError(`Unknown function ${name}()`);
  }
}
function dPow(a, b) {
  if (a.isZero() && b.isNegative()) throw new ExprError('Division by zero');
  if (a.isNegative() && !b.isInteger()) {
    // odd roots such as (-8)^(1/3) are real
    const inv = new D(1).div(b);
    if (inv.isInteger() && !inv.mod(2).isZero()) return D.pow(a.neg(), b).neg();
    throw new ExprError('Result is not a real number');
  }
  return D.pow(a, b);
}

export function evalDecimal(ast, ctx = {}) {
  const vars = ctx.vars || {};
  const ev = (n) => {
    switch (n.t) {
      case 'num': return new D(n.v);
      case 'const':
        if (n.name === 'pi') return dPi();
        if (n.name === 'e') return new D(1).exp();
        if (n.name === 'tau') return dPi().mul(2);
        if (n.name === 'phi') return new D(1).plus(new D(5).sqrt()).div(2);
        return new D(Infinity);
      case 'var': {
        if (n.name === 'ans') {
          if (ctx.ans === undefined) throw new ExprError('No previous answer yet');
          return new D(ctx.ans);
        }
        if (Object.prototype.hasOwnProperty.call(vars, n.name)) return new D(vars[n.name]);
        throw new ExprError(`Unknown name "${n.name}"`);
      }
      case 'neg': return ev(n.a).neg();
      case 'pct': return ev(n.a).div(100);
      case 'call': return dCall(n.name, n.args.map(ev), ctx);
      case 'bin': {
        const a = ev(n.a);
        if ((n.op === '+' || n.op === '-') && n.b.t === 'pct') {
          const r = ev(n.b.a).div(100);
          return n.op === '+' ? a.plus(a.mul(r)) : a.minus(a.mul(r));
        }
        const b = ev(n.b);
        switch (n.op) {
          case '+': return a.plus(b);
          case '-': return a.minus(b);
          case '*': return a.mul(b);
          case '/': if (b.isZero()) throw new ExprError('Division by zero'); return a.div(b);
          case 'mod': if (b.isZero()) throw new ExprError('Division by zero'); return a.mod(b);
          case '^': return dPow(a, b);
          default: throw new ExprError('Bad operator');
        }
      }
      default: throw new ExprError('Bad expression');
    }
  };
  const r = ev(ast);
  if (r.isNaN()) throw new ExprError('Undefined result');
  return r;
}

/* ---------------- number evaluator (graphing, tables, solvers) ---------------- */
const numFact = (n) => { if (n < 0 || !Number.isInteger(n)) return NaN; if (n > 170) return Infinity; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const toRad = (x, m) => (m === 'deg' ? (x * Math.PI) / 180 : m === 'grad' ? (x * Math.PI) / 200 : x);
const fromRad = (x, m) => (m === 'deg' ? (x * 180) / Math.PI : m === 'grad' ? (x * 200) / Math.PI : x);
const numGcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const NUM = {
  sin: (x, m) => Math.sin(toRad(x, m)), cos: (x, m) => Math.cos(toRad(x, m)), tan: (x, m) => Math.tan(toRad(x, m)),
  sec: (x, m) => 1 / Math.cos(toRad(x, m)), csc: (x, m) => 1 / Math.sin(toRad(x, m)), cot: (x, m) => 1 / Math.tan(toRad(x, m)),
  asin: (x, m) => fromRad(Math.asin(x), m), acos: (x, m) => fromRad(Math.acos(x), m), atan: (x, m) => fromRad(Math.atan(x), m),
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  ln: Math.log, log: (x, m, b) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b)), log2: Math.log2, exp: Math.exp,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc, sign: Math.sign,
  fract: (x) => x - Math.trunc(x),
  round: (x, m, d = 0) => { const k = 10 ** d; return Math.round((x + Number.EPSILON) * k) / k; },
  factorial: numFact,
  rad: (x) => (x * Math.PI) / 180, deg: (x) => (x * 180) / Math.PI,
};
function numCall(name, a, mode) {
  if (NUM[name]) return NUM[name](a[0], mode, a[1]);
  switch (name) {
    case 'atan2': return fromRad(Math.atan2(a[0], a[1]), mode);
    case 'root': return a[0] < 0 && a[1] % 2 !== 0 ? -Math.pow(-a[0], 1 / a[1]) : Math.pow(a[0], 1 / a[1]);
    case 'ncr': { const n = a[0], k = Math.min(a[1], a[0] - a[1]); if (k < 0) return NaN; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); }
    case 'npr': { let r = 1; for (let i = 0; i < a[1]; i++) r *= a[0] - i; return r; }
    case 'min': return Math.min(...a);
    case 'max': return Math.max(...a);
    case 'sum': return a.reduce((s, v) => s + v, 0);
    case 'avg': return a.reduce((s, v) => s + v, 0) / a.length;
    case 'gcd': return numGcd(a[0], a[1]);
    case 'lcm': return Math.abs(a[0] * a[1]) / numGcd(a[0], a[1]);
    case 'mod': return a[0] % a[1];
    case 'pow': return Math.pow(a[0], a[1]);
    case 'hypot': return Math.hypot(...a);
    default: return NaN;
  }
}
/** Evaluate with plain numbers. Never throws for domain errors; returns NaN / +-Infinity instead. */
export function evalNum(ast, scope = {}, mode = 'rad') {
  const ev = (n) => {
    switch (n.t) {
      case 'num': return Number(n.v);
      case 'const': return n.name === 'pi' ? Math.PI : n.name === 'e' ? Math.E : n.name === 'tau' ? 2 * Math.PI : n.name === 'phi' ? (1 + Math.sqrt(5)) / 2 : Infinity;
      case 'var': { if (Object.hasOwn(scope, n.name)) return scope[n.name]; throw new ExprError(`Unknown name "${n.name}"`); }
      case 'neg': return -ev(n.a);
      case 'pct': return ev(n.a) / 100;
      case 'call': return numCall(n.name, n.args.map(ev), mode);
      case 'bin': {
        const a = ev(n.a);
        if ((n.op === '+' || n.op === '-') && n.b.t === 'pct') { const r = ev(n.b.a) / 100; return n.op === '+' ? a * (1 + r) : a * (1 - r); }
        const b = ev(n.b);
        switch (n.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b;
          case 'mod': return a % b;
          case '^': return a < 0 && !Number.isInteger(b) && Number.isInteger(1 / b) && (1 / b) % 2 !== 0 ? -Math.pow(-a, b) : Math.pow(a, b);
          default: return NaN;
        }
      }
      default: return NaN;
    }
  };
  return ev(ast);
}

/** Names of free variables used by an AST (excluding ans). */
export function freeVars(ast, out = new Set()) {
  if (!ast) return out;
  if (ast.t === 'var') out.add(ast.name);
  if (ast.a) freeVars(ast.a, out);
  if (ast.b) freeVars(ast.b, out);
  if (ast.args) ast.args.forEach((x) => freeVars(x, out));
  return out;
}

/* ---------------- display ---------------- */
/** Format a Decimal to `sig` significant digits as a plain or exponent string. */
export function formatDecimal(d, sig = 12) {
  if (!d.isFinite()) return d.isNaN() ? 'NaN' : d.isNegative() ? '-Infinity' : 'Infinity';
  if (d.isZero()) return '0';
  const r = d.isInteger() && d.e < 21 ? d : d.toSignificantDigits(sig);
  const e = r.e;
  if (e >= 21 || e < -7) {
    const [m, ex] = r.toExponential().split('e');
    return `${m}e${ex.replace('+', '')}`;
  }
  return r.toFixed();
}
/** Insert thousands separators in a plain numeric string for a locale. */
export function groupDigits(str, locale) {
  if (/e/i.test(str) || !/^-?\d/.test(str)) return str;
  let group = ',', decimal = '.';
  try {
    const parts = new Intl.NumberFormat(locale || undefined).formatToParts(1234567.5);
    group = (parts.find((x) => x.type === 'group') || { value: ',' }).value;
    decimal = (parts.find((x) => x.type === 'decimal') || { value: '.' }).value;
  } catch { /* keep defaults */ }
  const neg = str.startsWith('-');
  const [i, f] = (neg ? str.slice(1) : str).split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (neg ? '-' : '') + g + (f ? decimal + f : '');
}

/** Convenience: evaluate a string and return a Decimal (supports `name = expr`). */
export function calc(src, ctx = {}) {
  const st = parseStatement(src);
  return evalDecimal(st.ast, ctx);
}
