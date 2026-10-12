import { h, copyText, download, toast, debounce } from './dom.js';
import { renderChart } from './chart.js';
import { defaults, runCalc, resultText, summaryLine } from '../core/runner.js';
import { addHistory } from '../core/store.js';
import { toCSV } from '../lib/finmath.js';
import { calcsIn, getCategory } from '../calcs/registry.js';

export const urlParams = () => { const q = location.hash.split('?')[1] || ''; return new URLSearchParams(q); };
export function writeParams(id, raw, defs) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    const val = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
    const dv = typeof defs[k] === 'boolean' ? (defs[k] ? '1' : '0') : String(defs[k]);
    if (val !== dv) p.set(k, val);
  }
  const q = p.toString();
  history.replaceState(null, '', `#/c/${id}${q ? `?${q}` : ''}`);
}

function currencySymbol(env) {
  try { return new Intl.NumberFormat(env.locale, { style: 'currency', currency: env.currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency').value; } catch { return env.currency; }
}

export function buildField(inp, env, state, onInput) {
  const id = `f-${inp.id}`;
  const err = h('div', { class: 'field-error', id: `${id}-err`, 'aria-live': 'polite' });
  let control;
  const handle = () => {
    state[inp.id] = inp.type === 'checkbox' ? control.checked : control.value;
    onInput();
  };
  if (inp.type === 'select') {
    control = h('select', { id, class: 'control', 'aria-describedby': err.id, onChange: handle }, inp.options.map(([v, l]) => h('option', { value: v, selected: String(state[inp.id]) === String(v) }, l)));
  } else if (inp.type === 'textarea') {
    control = h('textarea', { id, class: 'control area', rows: inp.rows || 4, spellcheck: 'false', 'aria-describedby': err.id, onInput: handle });
    control.value = state[inp.id];
  } else if (inp.type === 'checkbox') {
    control = h('input', { id, type: 'checkbox', checked: state[inp.id], onChange: handle });
    const wrap = h('div', { class: 'field field-check', 'data-field': inp.id }, h('label', { for: id }, control, ' ', inp.label), err);
    return { wrap, control, err };
  } else if (inp.type === 'date') {
    control = h('input', { id, type: 'date', class: 'control', 'aria-describedby': err.id, onInput: handle });
    control.value = state[inp.id];
  } else if (inp.type === 'text') {
    control = h('input', { id, type: 'text', class: 'control', spellcheck: 'false', autocomplete: 'off', 'aria-describedby': err.id, onInput: handle });
    control.value = state[inp.id];
  } else {
    control = h('input', { id, type: 'text', inputmode: inp.integer || inp.min >= 0 ? 'decimal' : 'text', autocomplete: 'off', 'aria-describedby': err.id, onInput: handle });
    control.value = state[inp.id];
    const group = h('div', { class: 'input-group' }, inp.type === 'money' ? h('span', { class: 'affix', 'aria-hidden': 'true' }, currencySymbol(env)) : null, control, inp.unit ? h('span', { class: 'affix', 'aria-hidden': 'true' }, inp.unit) : null);
    const label = h('label', { for: id }, inp.label, inp.unit ? h('span', { class: 'sr-only' }, ` in ${inp.unit}`) : null);
    return { wrap: h('div', { class: 'field', 'data-field': inp.id }, label, group, err), control, err };
  }
  return { wrap: h('div', { class: 'field', 'data-field': inp.id }, h('label', { for: id }, inp.label), control, err), control, err };
}

function renderTable(t, env, id) {
  const fmtCell = (kind, v) => (kind === 'text' || typeof v === 'string' ? String(v) : env.kind(kind === 'money' ? 'money' : kind, v, kind === 'num' ? undefined : undefined));
  const cap = h('h2', { id: `${id}-t` }, t.title);
  const tbl = h('table', null,
    h('thead', null, h('tr', null, t.cols.map((c, i) => h('th', { scope: 'col', class: i === 0 ? 'first' : null }, c)))),
    h('tbody', null, t.rows.slice(0, 1200).map((r) => h('tr', null, r.map((cell, i) => h(i === 0 && t.kinds[0] !== 'money' ? 'th' : 'td', i === 0 && t.kinds[0] !== 'money' ? { scope: 'row' } : null, fmtCell(t.kinds[i], cell)))))));
  return { cap, wrap: h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-labelledby': cap.id }, tbl) };
}

export function csvOf(t) {
  return toCSV([t.cols, ...t.rows.map((r) => r.map((c, i) => (typeof c === 'number' ? (t.kinds[i] === 'money' ? Math.round(c * 100) / 100 : Number(c.toFixed(6))) : c)))]);
}

export function renderFormCalc(calc, env) {
  const defs = defaults(calc, env);
  const state = { ...defs };
  const q = urlParams();
  for (const inp of calc.inputs) if (q.has(inp.id)) state[inp.id] = inp.type === 'checkbox' ? q.get(inp.id) === '1' : q.get(inp.id);

  const fields = new Map();
  const fieldsEl = h('div', { class: 'fields' });
  const status = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const errorBox = h('div', { class: 'notice notice-error', role: 'alert', hidden: true });
  const statsEl = h('div', { class: 'stats' });
  const printInputs = h('p', { class: 'print-only' });
  const noteEl = h('p', { class: 'muted note' });
  const stepsEl = h('details', { class: 'card steps', hidden: true });
  const chartCard = h('div', { class: 'card chart-card', hidden: true });
  const chartHead = h('div', { class: 'card-head' });
  const chartEl = h('div', { class: 'chart' });
  chartCard.append(chartHead, chartEl);
  const tableCard = h('div', { class: 'card table-card', hidden: true });
  const extraCard = h('details', { class: 'card table-card', hidden: true });
  let last = null;

  const recalc = () => {
    // visibility pass
    for (const inp of calc.inputs) { const f = fields.get(inp.id); if (f) f.wrap.hidden = inp.showIf ? !inp.showIf(state) : false; }
    const r = runCalc(calc, state, env);
    for (const f of fields.values()) { f.err.textContent = ''; f.control.removeAttribute('aria-invalid'); f.wrap.classList.remove('invalid'); }
    if (!r.ok) {
      if (r.errors) {
        let first = null;
        for (const [k, msg] of Object.entries(r.errors)) { const f = fields.get(k); if (f) { f.err.textContent = msg; f.control.setAttribute('aria-invalid', 'true'); f.wrap.classList.add('invalid'); first = first || msg; } }
        errorBox.textContent = 'Check the highlighted fields to see the result.';
      } else errorBox.textContent = r.error;
      errorBox.hidden = false;
      resultsWrap.classList.add('has-error');
      status.textContent = errorBox.textContent;
      last = null;
      return;
    }
    errorBox.hidden = true;
    resultsWrap.classList.remove('has-error');
    last = r;
    const res = r.result;
    statsEl.replaceChildren(...res.stats.map((s) => h('div', { class: `stat${s.primary ? ' primary' : ''}` },
      h('div', { class: 'stat-label' }, s.label),
      h('div', { class: 'stat-value' }, env.kind(s.k, s.v, s.digits), s.u ? h('span', { class: 'stat-unit' }, ` ${s.u}`) : null),
      s.sub ? h('div', { class: 'stat-sub' }, s.sub) : null)));
    statsEl.setAttribute('aria-busy', 'false');
    noteEl.textContent = res.note || '';
    status.textContent = summaryLine(res, env);
    printInputs.textContent = calc.inputs.filter((i) => !i.showIf || i.showIf(state)).map((i) => `${i.label}: ${state[i.id]}`).join(' | ');
    // steps
    if (res.steps && res.steps.filter(Boolean).length) {
      stepsEl.hidden = false;
      const open = stepsEl.open;
      stepsEl.replaceChildren(h('summary', null, 'Show the working'), h('ol', { class: 'steps-list' }, res.steps.filter(Boolean).map((s) => h('li', null, s))),
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => copyText(res.steps.filter(Boolean).join('\n'), 'Steps copied') }, 'Copy steps'));
      stepsEl.open = open;
    } else stepsEl.hidden = true;
    // chart
    if (res.chart) {
      chartCard.hidden = false;
      chartHead.replaceChildren(h('h2', null, res.chart.title || 'Chart'));
      renderChart(chartEl, res.chart, env);
    } else chartCard.hidden = true;
    // tables
    if (res.table) {
      const t = renderTable(res.table, env, `${calc.id}-a`);
      tableCard.hidden = false;
      tableCard.replaceChildren(h('div', { class: 'card-head' }, t.cap, h('button', { type: 'button', class: 'btn', onClick: () => { download(`${calc.id}.csv`, csvOf(res.table), 'text/csv'); toast('CSV downloaded'); } }, 'Export CSV')), t.wrap);
    } else tableCard.hidden = true;
    if (res.extraTable) {
      const t = renderTable(res.extraTable, env, `${calc.id}-b`);
      extraCard.hidden = false;
      const wasOpen = extraCard.open;
      extraCard.replaceChildren(h('summary', null, res.extraTable.title), h('div', { class: 'card-head' }, h('span', { class: 'muted small' }, `${res.extraTable.rows.length} rows`), h('button', { type: 'button', class: 'btn', onClick: () => { download(`${calc.id}-schedule.csv`, csvOf(res.extraTable), 'text/csv'); toast('CSV downloaded'); } }, 'Export CSV')), t.wrap);
      extraCard.open = wasOpen;
    } else extraCard.hidden = true;
  };

  const persist = debounce(() => writeParams(calc.id, state, defs), 200);
  const onInput = () => { recalc(); persist(); };

  for (const inp of calc.inputs) {
    const f = buildField(inp, env, state, onInput);
    fields.set(inp.id, f);
    fieldsEl.append(f.wrap);
  }

  const form = h('form', { id: 'calc', novalidate: true, autocomplete: 'off', onSubmit: (e) => { e.preventDefault(); recalc(); } },
    fieldsEl,
    h('div', { class: 'actions' },
      calc.volatile ? h('button', { type: 'submit', class: 'btn btn-primary' }, 'Generate again') : null,
      h('button', { type: 'button', class: calc.volatile ? 'btn' : 'btn btn-primary', onClick: () => { if (!last) return toast('Fix the highlighted fields first'); addHistory({ calc: calc.id, title: calc.title, summary: summaryLine(last.result, env), hash: location.hash || `#/c/${calc.id}` }); toast('Saved to history'); } }, 'Save to history'),
      h('button', { type: 'button', class: 'btn', onClick: () => { writeParams(calc.id, state, defs); copyText(location.href, 'Link copied'); } }, 'Copy share link'),
      h('button', { type: 'button', class: 'btn', onClick: () => { if (last) copyText(resultText(calc, last.result, env), 'Result copied'); } }, 'Copy result'),
      h('button', { type: 'reset', class: 'btn btn-quiet', onClick: (e) => { e.preventDefault(); Object.assign(state, defs); for (const inp of calc.inputs) { const f = fields.get(inp.id); if (inp.type === 'checkbox') f.control.checked = !!defs[inp.id]; else f.control.value = defs[inp.id]; } history.replaceState(null, '', `#/c/${calc.id}`); recalc(); } }, 'Reset')));

  const resultsWrap = h('section', { class: 'results', 'aria-label': 'Results' }, status, errorBox, statsEl, printInputs, noteEl, stepsEl, chartCard, tableCard, extraCard);
  const related = calcsIn(calc.cat).filter((c) => c.id !== calc.id).slice(0, 6);
  const page = h('div', { class: 'calc-page' },
    h('div', { class: 'panel' },
      h('section', { class: 'card form-card', 'aria-labelledby': 'panel-title' }, h('h1', { id: 'panel-title', tabindex: '-1' }, calc.title), h('p', { class: 'muted' }, calc.desc), form),
      resultsWrap),
    related.length ? h('nav', { class: 'related', 'aria-label': 'Related calculators' }, h('h2', null, `More in ${getCategory(calc.cat).name}`), h('ul', { class: 'chip-list' }, related.map((c) => h('li', null, h('a', { class: 'chip', href: `#/c/${c.id}` }, c.title))))) : null);
  for (const inp of calc.inputs) { const f = fields.get(inp.id); if (inp.showIf) f.wrap.hidden = !inp.showIf(state); }
  recalc();
  return page;
}
