import { h, copyText, toast } from './dom.js';
import { parse, evalNum, freeVars } from '../lib/expr.js';
import { findRoots } from '../lib/mathx.js';
import { niceTicks } from './chart.js';
import { urlParams } from './form-view.js';

const COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
const MAX_FN = 6;

export function mountGraph(calc, env) {
  const q = urlParams();
  const initial = q.getAll('f').length ? q.getAll('f') : ['sin(x)', 'x^2/4 - 2'];
  const view = { cx: Number(q.get('cx')) || 0, cy: Number(q.get('cy')) || 0, scale: Number(q.get('s')) || 40 }; // scale = pixels per unit
  const fns = initial.slice(0, MAX_FN).map((src) => ({ src, ast: null, err: '' }));
  const canvas = h('canvas', { class: 'graph-canvas', tabindex: '0', role: 'img', 'aria-label': 'Function graph. Arrow keys pan, plus and minus zoom.' });
  const ctx2 = canvas.getContext('2d');
  const listEl = h('ul', { class: 'fn-list' });
  const readout = h('p', { class: 'muted small graph-readout', 'aria-live': 'off' }, 'Hover or touch the graph to read values.');
  const pointsEl = h('div', { class: 'graph-points' });
  const tableEl = h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Table of values' });
  let tStart = -5, tStep = 1;
  let marks = [];
  let cssW = 600, cssH = 400;

  const compile = (f) => {
    f.err = ''; f.ast = null;
    const src = f.src.replace(/^\s*y\s*=\s*/i, '').replace(/^\s*f\(x\)\s*=\s*/i, '').trim();
    if (!src) return;
    try {
      const ast = parse(src);
      const bad = [...freeVars(ast)].filter((v) => v !== 'x');
      if (bad.length) throw new Error(`Unknown name "${bad[0]}": use x as the variable`);
      evalNum(ast, { x: 1 }, 'rad');
      f.ast = ast;
    } catch (e) { f.err = e.message; }
  };
  const fval = (f, x) => { try { return evalNum(f.ast, { x }, 'rad'); } catch { return NaN; } };
  const color = (i) => getComputedStyle(document.documentElement).getPropertyValue(COLORS[i % 6]).trim() || '#1d4ed8';
  const toX = (px) => view.cx + (px - cssW / 2) / view.scale;
  const toY = (py) => view.cy - (py - cssH / 2) / view.scale;
  const px = (x) => cssW / 2 + (x - view.cx) * view.scale;
  const py = (y) => cssH / 2 - (y - view.cy) * view.scale;

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(200, r.width); cssH = Math.max(200, r.height);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) { canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); }
    const g = ctx2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--surface').trim(), grid = cs.getPropertyValue('--grid').trim(), muted = cs.getPropertyValue('--muted').trim(), text = cs.getPropertyValue('--text').trim();
    g.fillStyle = bg; g.fillRect(0, 0, cssW, cssH);
    const x0 = toX(0), x1 = toX(cssW), y1 = toY(0), y0 = toY(cssH);
    g.font = '11px system-ui, sans-serif';
    const xt = niceTicks(x0, x1, Math.max(3, cssW / 90)), yt = niceTicks(y0, y1, Math.max(3, cssH / 70));
    g.lineWidth = 1; g.strokeStyle = grid; g.fillStyle = muted;
    g.beginPath();
    for (const t of xt) { const X = Math.round(px(t)) + 0.5; g.moveTo(X, 0); g.lineTo(X, cssH); }
    for (const t of yt) { const Y = Math.round(py(t)) + 0.5; g.moveTo(0, Y); g.lineTo(cssW, Y); }
    g.stroke();
    const ax = Math.min(Math.max(px(0), 0), cssW), ay = Math.min(Math.max(py(0), 0), cssH);
    g.strokeStyle = text; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(ax + 0.5, 0); g.lineTo(ax + 0.5, cssH); g.moveTo(0, ay + 0.5); g.lineTo(cssW, ay + 0.5); g.stroke(); g.globalAlpha = 1;
    g.textAlign = 'center';
    for (const t of xt) if (Math.abs(t) > 1e-9) g.fillText(String(Number(t.toPrecision(6))), px(t), Math.min(Math.max(ay + 14, 12), cssH - 4));
    g.textAlign = 'right';
    for (const t of yt) if (Math.abs(t) > 1e-9) g.fillText(String(Number(t.toPrecision(6))), Math.min(Math.max(ax - 5, 30), cssW - 4), py(t) + 4);
    fns.forEach((f, i) => {
      if (!f.ast) return;
      g.strokeStyle = color(i); g.lineWidth = 2.2; g.beginPath();
      let prev = null;
      const n = Math.ceil(cssW * 1.5);
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n, y = fval(f, x), Y = py(y);
        if (!Number.isFinite(y) || Math.abs(Y) > 1e5) { prev = null; continue; }
        if (prev !== null && Math.abs(Y - prev) > cssH * 1.5) { g.moveTo(px(x), Y); } else if (prev === null) g.moveTo(px(x), Y); else g.lineTo(px(x), Y);
        prev = Y;
      }
      g.stroke();
    });
    g.fillStyle = text;
    for (const m of marks) { if (m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue; g.beginPath(); g.arc(px(m.x), py(m.y), 4, 0, 7); g.fillStyle = color(m.i); g.fill(); g.strokeStyle = bg; g.lineWidth = 1.5; g.stroke(); }
  }

  function analyse() {
    const x0 = toX(0), x1 = toX(cssW);
    marks = [];
    const lines = [];
    const f2 = (v) => (Math.abs(v) < 1e-9 ? '0' : String(Number(v.toPrecision(7))));
    fns.forEach((f, i) => {
      if (!f.ast) return;
      const roots = findRoots((x) => fval(f, x), x0, x1, 800).slice(0, 12);
      roots.forEach((r) => marks.push({ x: r, y: 0, i }));
      const yi = fval(f, 0);
      if (Number.isFinite(yi)) marks.push({ x: 0, y: yi, i });
      lines.push(h('li', null, h('span', { class: 'swatch', style: `background:var(${COLORS[i % 6]})` }), h('strong', null, `y = ${f.src.replace(/^\s*y\s*=\s*/i, '')}`), ': ', roots.length ? `x-intercepts (roots) at x = ${roots.map(f2).join(', ')}` : 'no roots in view', Number.isFinite(yi) ? `; y-intercept at y = ${f2(yi)}` : '; no y-intercept'));
    });
    for (let a = 0; a < fns.length; a++) for (let b = a + 1; b < fns.length; b++) {
      if (!fns[a].ast || !fns[b].ast) continue;
      const xs = findRoots((x) => fval(fns[a], x) - fval(fns[b], x), x0, x1, 800).slice(0, 8);
      xs.forEach((x) => marks.push({ x, y: fval(fns[a], x), i: a }));
      if (xs.length) lines.push(h('li', null, h('strong', null, `Intersections of f${a + 1} and f${b + 1}`), ': ', xs.map((x) => `(${f2(x)}, ${f2(fval(fns[a], x))})`).join('  ')));
    }
    pointsEl.replaceChildren(h('h2', null, 'Roots, intercepts and intersections in view'), lines.length ? h('ul', { class: 'plain-list' }, lines) : h('p', { class: 'muted' }, 'Enter a function to see its key points.'));
  }

  function table() {
    const cols = fns.map((f, i) => (f.ast ? i : -1)).filter((i) => i >= 0);
    const rows = Array.from({ length: 21 }, (_, k) => tStart + k * tStep);
    tableEl.replaceChildren(h('table', null, h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'x'), cols.map((i) => h('th', { scope: 'col' }, `f${i + 1}(x)`)))),
      h('tbody', null, rows.map((x) => h('tr', null, h('th', { scope: 'row' }, env.num(Number(x.toPrecision(10)), 6)), cols.map((i) => { const y = fval(fns[i], x); return h('td', null, Number.isFinite(y) ? env.num(y, 6) : 'undefined'); }))))));
  }

  const syncUrl = () => {
    const p = new URLSearchParams();
    fns.forEach((f) => p.append('f', f.src));
    if (Math.abs(view.cx) > 1e-9) p.set('cx', String(Number(view.cx.toPrecision(6))));
    if (Math.abs(view.cy) > 1e-9) p.set('cy', String(Number(view.cy.toPrecision(6))));
    if (view.scale !== 40) p.set('s', String(Number(view.scale.toPrecision(6))));
    history.replaceState(null, '', `#/c/graph?${p.toString()}`);
  };
  let raf = 0;
  const redraw = (full = true) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { draw(); if (full) { analyse(); draw(); } }); };
  let settle;
  const afterMove = () => { redraw(false); clearTimeout(settle); settle = setTimeout(() => { analyse(); draw(); syncUrl(); }, 160); };

  function renderList() {
    listEl.replaceChildren(...fns.map((f, i) => {
      const id = `fn-${i}`, errId = `fn-${i}-err`;
      const inp = h('input', { id, class: 'control fn-input', type: 'text', value: f.src, spellcheck: 'false', autocomplete: 'off', 'aria-describedby': errId, 'aria-label': `f${i + 1}(x) =`, 'aria-invalid': f.err ? 'true' : null,
        onInput: (e) => { f.src = e.target.value; compile(f); errEl.textContent = f.err; inp.toggleAttribute('aria-invalid', !!f.err); table(); redraw(); syncUrl(); } });
      const errEl = h('span', { class: 'field-error', id: errId, 'aria-live': 'polite' }, f.err);
      return h('li', { class: 'fn-row' }, h('span', { class: 'swatch', style: `background:var(${COLORS[i % 6]})`, 'aria-hidden': 'true' }), h('label', { for: id, class: 'fn-label' }, `f${i + 1}(x) =`), inp,
        h('button', { type: 'button', class: 'btn btn-quiet btn-sm', 'aria-label': `Remove f${i + 1}`, onClick: () => { fns.splice(i, 1); renderList(); table(); redraw(); syncUrl(); } }, 'Remove'), errEl);
    }));
  }
  fns.forEach(compile);

  /* interaction */
  const pointers = new Map();
  let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; canvas.focus({ preventScroll: true }); });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const x = toX(mx);
    readout.textContent = `x = ${env.num(x, 4)}   ${fns.map((f, i) => (f.ast ? `f${i + 1} = ${Number.isFinite(fval(f, x)) ? env.num(fval(f, x), 4) : 'undefined'}` : '')).filter(Boolean).join('   ')}   (cursor y = ${env.num(toY(my), 4)})`;
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      const pts = [...pointers.values()], d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch) { view.scale = Math.min(1e5, Math.max(0.01, view.scale * (d / pinch))); afterMove(); }
      pinch = d;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    view.cx -= (e.clientX - p.x) / view.scale; view.cy += (e.clientY - p.y) / view.scale;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    afterMove();
  });
  const up = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const zoomAt = (factor, mx, my) => {
    const bx = toX(mx), by = toY(my);
    view.scale = Math.min(1e5, Math.max(0.01, view.scale * factor));
    view.cx = bx - (mx - cssW / 2) / view.scale; view.cy = by + (my - cssH / 2) / view.scale;
    afterMove();
  };
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const step = 40 / view.scale;
    if (e.key === 'ArrowLeft') view.cx -= step; else if (e.key === 'ArrowRight') view.cx += step; else if (e.key === 'ArrowUp') view.cy += step; else if (e.key === 'ArrowDown') view.cy -= step;
    else if (e.key === '+' || e.key === '=') return (e.preventDefault(), zoomAt(1.25, cssW / 2, cssH / 2));
    else if (e.key === '-') return (e.preventDefault(), zoomAt(0.8, cssW / 2, cssH / 2));
    else if (e.key === '0') { view.cx = 0; view.cy = 0; view.scale = 40; } else return;
    e.preventDefault(); afterMove();
  });

  const tInputs = [['Table start x', tStart, (v) => { tStart = v; }], ['Step', tStep, (v) => { tStep = v || 1; }]].map(([label, val, set], i) => {
    const id = `tbl-${i}`;
    return h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, class: 'control', type: 'text', inputmode: 'decimal', value: String(val), onInput: (e) => { const n = Number(e.target.value); if (Number.isFinite(n)) { set(n); table(); } } }));
  });

  const page = h('div', { class: 'calc-page' },
    h('section', { class: 'card', 'aria-labelledby': 'panel-title' },
      h('div', { class: 'card-head' }, h('h1', { id: 'panel-title', tabindex: '-1' }, calc.title)),
      h('p', { class: 'muted' }, 'Use x as the variable. Trigonometric functions use radians here. Drag to pan, scroll or pinch to zoom, or use the keyboard (arrow keys, + and -).'),
      listEl,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn', disabled: fns.length >= MAX_FN, onClick: (e) => { if (fns.length >= MAX_FN) return; fns.push({ src: '', ast: null, err: '' }); renderList(); document.getElementById(`fn-${fns.length - 1}`).focus(); e.currentTarget.disabled = fns.length >= MAX_FN; } }, 'Add function'),
        h('button', { type: 'button', class: 'btn', onClick: () => zoomAt(1.25, cssW / 2, cssH / 2) }, 'Zoom in'), h('button', { type: 'button', class: 'btn', onClick: () => zoomAt(0.8, cssW / 2, cssH / 2) }, 'Zoom out'),
        h('button', { type: 'button', class: 'btn', onClick: () => { view.cx = 0; view.cy = 0; view.scale = 40; afterMove(); } }, 'Reset view'),
        h('button', { type: 'button', class: 'btn', onClick: () => { syncUrl(); copyText(location.href, 'Link copied'); } }, 'Copy share link'),
        h('button', { type: 'button', class: 'btn', onClick: () => canvas.toBlob((b) => { if (!b) return; const a = h('a', { href: URL.createObjectURL(b), download: 'graph.png' }); a.click(); toast('Image saved'); }) }, 'Save image')),
      h('div', { class: 'graph-wrap' }, canvas), readout),
    h('section', { class: 'card' }, pointsEl),
    h('div', { class: 'card', role: 'group', 'aria-labelledby': 'tv-title' }, h('div', { class: 'card-head' }, h('h2', { id: 'tv-title' }, 'Table of values'), h('div', { class: 'inline-fields' }, tInputs)), tableEl));
  renderList(); table();
  const ro = new ResizeObserver(() => redraw());
  const mo = new MutationObserver(() => redraw());
  setTimeout(() => { ro.observe(canvas); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); redraw(); }, 0);
  return { el: page, destroy() { ro.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); } };
}
