/* Input parsing, validation and execution for declarative calculators. No DOM. */
import { parseISO, toISO, addDays } from '../lib/dates.js';
import { InputError } from '../calcs/helpers.js';

const visible = (inp, values) => !inp.showIf || inp.showIf(values);

/** Resolve a default such as '@today+30' to an ISO date string. */
function resolveDefault(inp, env) {
  const d = inp.def;
  if (inp.type === 'date' && typeof d === 'string' && d.startsWith('@today')) {
    const m = /^@today([+-]\d+)?$/.exec(d);
    return toISO(addDays(env.today, m && m[1] ? Number(m[1]) : 0));
  }
  if (d === null || d === undefined) return '';
  return String(d);
}

export function defaults(calc, env) {
  const out = {};
  for (const inp of calc.inputs || []) out[inp.id] = inp.type === 'checkbox' ? !!inp.def : resolveDefault(inp, env);
  return out;
}

/** Turn raw (string) values into typed values and per-field errors. */
export function parseInputs(calc, raw) {
  const values = {}, errors = {};
  // first pass for visibility: use loosely typed values
  const loose = {};
  for (const inp of calc.inputs || []) loose[inp.id] = raw[inp.id];
  for (const inp of calc.inputs || []) {
    if (!visible(inp, loose)) continue;
    const r = raw[inp.id];
    if (inp.type === 'select') { values[inp.id] = r; if (!inp.options.some((o) => String(o[0]) === String(r))) errors[inp.id] = 'Choose an option'; continue; }
    if (inp.type === 'checkbox') { values[inp.id] = !!r; continue; }
    if (inp.type === 'text' || inp.type === 'textarea') {
      const s = String(r ?? '');
      if (!s.trim() && !inp.optional) errors[inp.id] = `${inp.label.split('(')[0].trim()} is required`;
      values[inp.id] = s;
      continue;
    }
    if (inp.type === 'date') {
      const ts = parseISO(String(r ?? ''));
      if (Number.isNaN(ts)) { if (inp.optional && !String(r ?? '').trim()) values[inp.id] = null; else errors[inp.id] = 'Enter a valid date'; } else values[inp.id] = ts;
      continue;
    }
    // number / money
    const s = String(r ?? '').trim().replace(/,/g, '');
    if (s === '') { if (inp.optional) { values[inp.id] = null; continue; } errors[inp.id] = 'Enter a value'; continue; }
    const x = Number(s);
    if (!Number.isFinite(x)) { errors[inp.id] = 'Enter a valid number'; continue; }
    if (inp.integer && !Number.isInteger(x)) { errors[inp.id] = 'Enter a whole number'; continue; }
    if (inp.min !== undefined && x < inp.min) { errors[inp.id] = `Must be at least ${inp.min}`; continue; }
    if (inp.max !== undefined && x > inp.max) { errors[inp.id] = `Must be at most ${inp.max}`; continue; }
    values[inp.id] = x;
  }
  return { values, errors };
}

/** Parse, validate and run. Returns {ok:true,result} | {ok:false,errors} | {ok:false,error}. */
export function runCalc(calc, raw, env) {
  const { values, errors } = parseInputs(calc, raw);
  if (Object.keys(errors).length) return { ok: false, errors };
  try {
    const result = calc.run(values, env);
    for (const s of result.stats) if (typeof s.v === 'number' && Number.isNaN(s.v)) throw new InputError('These inputs give no valid result. Please check the values.');
    return { ok: true, result, values };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Something went wrong with these values.' };
  }
}

/** Plain-text version of a result (for copy buttons and history). */
export function resultText(calc, result, env) {
  const lines = [calc.title];
  for (const s of result.stats) lines.push(`${s.label}: ${env.kind(s.k, s.v, s.digits)}${s.u ? ` ${s.u}` : ''}`);
  return lines.join('\n');
}
export function summaryLine(result, env) {
  const s = result.stats[0];
  return s ? `${s.label}: ${env.kind(s.k, s.v, s.digits)}${s.u ? ` ${s.u}` : ''}` : '';
}
