import * as L from '../lib/life.js';
import { num, pct } from './helpers.js';

/** Runner for the multi-mode percentage calculator. */
export function smartPct(v, env) {
  const { x, y } = v, f = env.num;
  switch (v.mode) {
    case 'of': { const r = L.pctOf(x, y); return { stats: [num(`${f(x)}% of ${f(y)}`, r, { primary: true })], steps: [`${f(x)} / 100 x ${f(y)} = ${f(r)}`] }; }
    case 'whatpct': { const r = L.whatPct(x, y); return { stats: [pct(`${f(x)} as a share of ${f(y)}`, r, { primary: true })], steps: [`${f(x)} / ${f(y)} x 100 = ${f(r)}%`] }; }
    case 'change': { const r = L.pctChange(x, y); return { stats: [pct(r >= 0 ? 'Increase' : 'Decrease', r, { primary: true }), num('Absolute change', y - x)], steps: [`(${f(y)} - ${f(x)}) / ${f(Math.abs(x))} x 100 = ${f(r)}%`] }; }
    case 'inc': { const r = x * (1 + y / 100); return { stats: [num('Result', r, { primary: true }), num('Amount added', r - x)], steps: [`${f(x)} x (1 + ${f(y)}/100) = ${f(r)}`] }; }
    case 'dec': { const r = x * (1 - y / 100); return { stats: [num('Result', r, { primary: true }), num('Amount removed', x - r)], steps: [`${f(x)} x (1 - ${f(y)}/100) = ${f(r)}`] }; }
    case 'reverse': { const r = L.reversePct(x, y); return { stats: [num('The whole number', r, { primary: true })], steps: [`${f(x)} / (${f(y)} / 100) = ${f(r)}`] }; }
    default: { const r = L.pctDifference(x, y); return { stats: [pct('Percentage difference', r, { primary: true })], steps: ['|X - Y| / ((|X| + |Y|) / 2) x 100'] }; }
  }
}
