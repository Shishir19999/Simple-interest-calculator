/* Dependency-free SVG charts: line, scatter, bar and stacked bar, with hover/keyboard inspection. */
import { h, svg } from './dom.js';

const W = 640, H = 300, M = { l: 62, r: 14, t: 12, b: 38 };
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];

export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) { max = min + 1; if (min === 0) min = 0; }
  const span = max - min, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const start = Math.floor(min / step) * step, ticks = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

export function renderChart(container, spec, env) {
  container.replaceChildren();
  const series = spec.series.filter((s) => s.data.length);
  if (!series.length) return;
  const stacked = spec.type === 'stack', bars = spec.type === 'bar' || stacked;
  const xs = [...new Set(series.flatMap((s) => s.data.map((p) => p[0])))].sort((a, b) => a - b);
  const stackTotals = stacked ? xs.map((x) => series.reduce((t, s) => t + ((s.data.find((p) => p[0] === x) || [0, 0])[1]), 0)) : null;
  const allY = stacked ? stackTotals : series.flatMap((s) => s.data.map((p) => p[1])).filter(Number.isFinite);
  let yMin = Math.min(...allY, bars || spec.yKind === 'money' ? 0 : Infinity), yMax = Math.max(...allY);
  if (!Number.isFinite(yMin)) yMin = 0;
  const yt = niceTicks(yMin, yMax, 5);
  const y0 = yt[0], y1 = yt[yt.length - 1] || 1;
  let x0 = xs[0], x1 = xs[xs.length - 1];
  const pad = bars ? (x1 - x0 || 1) / Math.max(xs.length - 1, 1) / 2 + 0 : 0;
  x0 -= pad; x1 += pad;
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - ((y - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const compact = (v) => { try { return new Intl.NumberFormat(env.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v); } catch { return String(v); } };
  const fmtY = (v) => (spec.yKind === 'money' ? compact(v) : compact(v));
  const fmtVal = (v) => (spec.yKind === 'money' ? env.money(v) : env.num(v));

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
  for (const t of yt) {
    root.append(svg('line', { class: 'grid-line', x1: M.l, x2: W - M.r, y1: sy(t), y2: sy(t) }));
    root.append(svg('text', { class: 'axis-text', x: M.l - 8, y: sy(t) + 4, 'text-anchor': 'end' }, fmtY(t)));
  }
  const xt = xs.length <= 12 ? xs : niceTicks(xs[0], xs[xs.length - 1], 8).filter((v) => v >= xs[0] && v <= xs[xs.length - 1]);
  for (const t of xt) root.append(svg('text', { class: 'axis-text', x: sx(t), y: H - M.b + 18, 'text-anchor': 'middle' }, Number.isInteger(t) ? t : Number(t.toFixed(2))));
  if (spec.xLabel) root.append(svg('text', { class: 'axis-text', x: (M.l + W - M.r) / 2, y: H - 4, 'text-anchor': 'middle' }, spec.xLabel));
  if (y0 < 0 && y1 > 0) root.append(svg('line', { class: 'axis-line', x1: M.l, x2: W - M.r, y1: sy(0), y2: sy(0) }));

  series.forEach((s, i) => {
    const color = COLORS[i % COLORS.length];
    if (bars) {
      const bw = Math.max(2, Math.min(40, ((W - M.l - M.r) / Math.max(xs.length, 1)) * 0.7 / (stacked ? 1 : series.length)));
      s.data.forEach(([x, y]) => {
        const base = stacked ? series.slice(0, i).reduce((t, q) => t + ((q.data.find((p) => p[0] === x) || [0, 0])[1]), 0) : 0;
        const top = sy(base + y), bot = sy(base);
        const off = stacked ? -bw / 2 : (i - (series.length - 1) / 2) * bw - bw / 2;
        root.append(svg('rect', { x: sx(x) + off, y: Math.min(top, bot), width: bw, height: Math.abs(bot - top), fill: color, rx: 1.5 }));
      });
    } else if (spec.type === 'scatter' && !s.line) {
      s.data.forEach(([x, y]) => root.append(svg('circle', { cx: sx(x), cy: sy(y), r: 4, fill: color })));
    } else {
      const pts = s.data.filter((p) => Number.isFinite(p[1]));
      root.append(svg('path', { d: pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(''), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-dasharray': s.line && spec.type === 'scatter' ? '6 4' : null }));
      if (pts.length <= 40 && spec.type !== 'scatter') pts.forEach((p) => root.append(svg('circle', { cx: sx(p[0]), cy: sy(p[1]), r: 3, fill: color })));
    }
  });

  const guide = svg('line', { class: 'guide', y1: M.t, y2: H - M.b, x1: 0, x2: 0, visibility: 'hidden' });
  root.append(guide);
  const tip = h('div', { class: 'tooltip', hidden: true, role: 'status' });
  const legend = h('ul', { class: 'legend', 'aria-label': 'Chart legend' }, series.map((s, i) => h('li', null, svg('svg', { viewBox: '0 0 28 8', 'aria-hidden': 'true' }, svg('rect', { width: 28, height: 8, rx: 3, fill: COLORS[i % COLORS.length] })), s.name)));
  const wrap = h('div', { class: 'chart-inner', tabindex: '0', role: 'group', 'aria-label': `${spec.title || 'Chart'}. Use the left and right arrow keys to inspect values.` }, root, tip);
  container.append(legend, wrap);

  let idx = -1;
  const show = (i) => {
    idx = Math.max(0, Math.min(xs.length - 1, i));
    const x = xs[idx];
    guide.setAttribute('x1', sx(x)); guide.setAttribute('x2', sx(x)); guide.setAttribute('visibility', 'visible');
    tip.replaceChildren(h('strong', null, `${spec.xLabel || 'x'}: ${Number.isInteger(x) ? x : Number(x.toFixed(3))}`), ...series.map((s, k) => { const p = s.data.find((q) => q[0] === x); return p ? h('div', null, h('span', null, h('i', { style: `background:${COLORS[k % COLORS.length]}` }), s.name), h('span', null, fmtVal(p[1]))) : null; }));
    tip.hidden = false;
    const r = wrap.getBoundingClientRect(), px = (sx(x) / W) * r.width;
    tip.style.left = `${Math.min(Math.max(px + 12, 4), Math.max(4, r.width - 200))}px`;
    tip.style.top = '8px';
  };
  const hide = () => { tip.hidden = true; guide.setAttribute('visibility', 'hidden'); idx = -1; };
  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect(), x = x0 + (((e.clientX - r.left) / r.width) * W - M.l) / (W - M.l - M.r) * (x1 - x0);
    let best = 0;
    xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i; });
    show(best);
  });
  wrap.addEventListener('pointerleave', hide);
  wrap.addEventListener('blur', hide);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx < 0 ? 0 : idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(xs.length - 1); }
    else if (e.key === 'Escape') hide();
  });
}
