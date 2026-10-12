/*
 * Smart input layer on top of the expression engine: percentages in words, tips and discounts,
 * unit conversion ("5 km to miles"), currency ("100 usd to eur") and simple date arithmetic.
 * Anything that is not recognised falls through to the plain expression evaluator.
 */
import { D, ExprError, parseStatement, evalDecimal, formatDecimal, groupDigits } from './expr.js';
import { convert, findUnit, getCategory } from './units.js';
import { convertCurrency, currentRates } from './currency.js';
import { parseISO, toISO, todayTs, addDays, addMonths, addYears, diffDays, formatLong, ymd } from './dates.js';

const num = (s, ctx) => evalDecimal(parseStatement(s).ast, ctx);
const fmt = (d, ctx) => formatDecimal(d, ctx.sig || 12);
const money = (d) => d.toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2);

function unitSplit(text) {
  // Find the longest trailing run of words that is a known unit; the rest is the numeric expression.
  const t = text.trim();
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (!/[A-Za-z°µ'"]/.test(c)) continue;
    if (i > 0 && /[A-Za-z0-9_.]/.test(t[i - 1]) && !/[0-9)]/.test(t[i - 1])) continue;
    const head = t.slice(0, i).trim();
    const tail = t.slice(i).trim();
    const u = findUnit(tail);
    if (u && head) return { head, unit: u, tail };
  }
  return null;
}

function dateWord(s, ctx) {
  const w = s.trim().toLowerCase();
  const today = todayTs(ctx.now || new Date());
  if (w === 'today' || w === 'now' || w === 'date') return today;
  if (w === 'tomorrow') return addDays(today, 1);
  if (w === 'yesterday') return addDays(today, -1);
  return parseISO(w);
}

function tryDates(raw, ctx) {
  const low = raw.toLowerCase().trim();
  let m = /^(today|now|date|tomorrow|yesterday|\d{4}-\d{2}-\d{2})\s*([+-])\s*(.+?)\s*(day|days|week|weeks|month|months|year|years)$/.exec(low);
  if (m) {
    const base = dateWord(m[1], ctx);
    if (Number.isNaN(base)) throw new ExprError('That is not a valid date (use YYYY-MM-DD)');
    const n = Number(num(m[3], ctx).toString()) * (m[2] === '-' ? -1 : 1);
    if (!Number.isInteger(n)) throw new ExprError('Use a whole number of days, weeks, months or years');
    const unit = m[4].replace(/s$/, '');
    const r = unit === 'day' ? addDays(base, n) : unit === 'week' ? addDays(base, n * 7) : unit === 'month' ? addMonths(base, n) : addYears(base, n);
    return { kind: 'date', text: formatLong(r), copy: toISO(r), steps: [`${toISO(base)} ${m[2]} ${Math.abs(n)} ${unit}${Math.abs(n) === 1 ? '' : 's'} = ${toISO(r)}`] };
  }
  m = /^(?:days\s+(?:between|from)\s+)?(today|now|date|tomorrow|yesterday|\d{4}-\d{2}-\d{2})\s*(?:-|to|and)\s*(today|now|date|tomorrow|yesterday|\d{4}-\d{2}-\d{2})$/.exec(low);
  if (m) {
    const a = dateWord(m[1], ctx), b = dateWord(m[2], ctx);
    if (Number.isNaN(a) || Number.isNaN(b)) throw new ExprError('That is not a valid date (use YYYY-MM-DD)');
    const n = diffDays(b, a);
    const x = ymd(a, b);
    return { kind: 'text', text: `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`, steps: [`${x.years} years, ${x.months} months, ${x.days} days between ${toISO(Math.min(a, b))} and ${toISO(Math.max(a, b))}`] };
  }
  return null;
}

/**
 * Evaluate smart input. Returns {kind, text, value?, steps?, copy?, assigned?}.
 * Throws ExprError for invalid input (error.atEnd means "still typing").
 */
export function smartEval(input, ctx = {}) {
  const raw = input.trim();
  if (!raw) throw new ExprError('Empty expression', true);
  const low = raw.toLowerCase().replace(/\s+/g, ' ');

  const dt = tryDates(raw, ctx);
  if (dt) return dt;

  let m = /^(.+?)\s+is\s+what\s*(?:%|percent)\s+of\s+(.+)$/.exec(low);
  if (m) {
    const a = num(m[1], ctx), b = num(m[2], ctx);
    if (b.isZero()) throw new ExprError('Division by zero');
    const r = a.div(b).mul(100);
    return { kind: 'number', value: r, text: `${fmt(r, ctx)}%`, copy: fmt(r, ctx), steps: [`${fmt(a, ctx)} / ${fmt(b, ctx)} x 100 = ${fmt(r, ctx)}%`] };
  }

  m = /^(.+?)\s*%\s*of\s+(.+)$/.exec(low);
  if (m) {
    const p = num(m[1], ctx), y = num(m[2], ctx), r = y.mul(p).div(100);
    return { kind: 'number', value: r, text: fmt(r, ctx), steps: [`${fmt(p, ctx)}% of ${fmt(y, ctx)} = ${fmt(y, ctx)} x ${fmt(p, ctx)} / 100 = ${fmt(r, ctx)}`] };
  }
  m = /^(.+?)\s*%\s*tip\s*(?:on|for|of)\s+(.+)$/.exec(low);
  if (m) {
    const p = num(m[1], ctx), bill = num(m[2], ctx), tip = bill.mul(p).div(100), total = bill.plus(tip);
    return { kind: 'text', value: tip, text: `Tip ${money(tip)}, total ${money(total)}`, copy: money(total), steps: [`Tip = ${fmt(bill, ctx)} x ${fmt(p, ctx)}% = ${money(tip)}`, `Total = ${fmt(bill, ctx)} + ${money(tip)} = ${money(total)}`] };
  }
  m = /^(.+?)\s*%\s*(?:off|discount\s+(?:on|off))\s+(.+)$/.exec(low);
  if (m) {
    const p = num(m[1], ctx), price = num(m[2], ctx), save = price.mul(p).div(100), final = price.minus(save);
    return { kind: 'text', value: final, text: `Pay ${money(final)} (save ${money(save)})`, copy: money(final), steps: [`Discount = ${fmt(price, ctx)} x ${fmt(p, ctx)}% = ${money(save)}`, `Price = ${fmt(price, ctx)} - ${money(save)} = ${money(final)}`] };
  }
  // unit / currency conversion: "<expr> <unit> to|in|into|as <unit>"
  for (const sep of raw.matchAll(/\s(?:to|in|into|as)(?=\s)/gi)) {
    const left = unitSplit(raw.slice(0, sep.index));
    const target = findUnit(raw.slice(sep.index + sep[0].length + 1));
    if (!left || !target) continue;
    if (left.unit.cat !== target.cat) throw new ExprError(`Cannot convert ${left.unit.cat} to ${target.cat}`);
    const v = num(left.head, ctx);
    if (target.cat === 'currency') {
      const r = convertCurrency(v, left.unit.unit.toUpperCase(), target.unit.toUpperCase());
      const cur = currentRates();
      const shown = money(r);
      return { kind: 'text', value: r, text: `${groupDigits(shown, ctx.locale)} ${target.unit.toUpperCase()}`, copy: shown, note: cur.live ? `Live reference rate (${cur.date})` : 'Indicative sample rate, not live', steps: [`${fmt(v, ctx)} ${left.unit.unit.toUpperCase()} at the ${cur.live ? 'live' : 'sample'} rate`] };
    }
    const r = convert(left.unit.cat, v, left.unit.unit, target.unit);
    return { kind: 'text', value: r, text: `${fmt(r, ctx)} ${target.label.toLowerCase()}`, copy: fmt(r, ctx), steps: [`${fmt(v, ctx)} ${left.unit.label.toLowerCase()} to ${target.label.toLowerCase()} (${getCategory(left.unit.cat).name.toLowerCase()})`] };
  }

  const st = parseStatement(raw);
  const value = evalDecimal(st.ast, ctx);
  return { kind: 'number', value, text: fmt(value, ctx), assigned: st.name, copy: fmt(value, ctx) };
}
