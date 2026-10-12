import { h, copyText, toast, announce, download } from './dom.js';
import { smartEval } from '../lib/nlq.js';
import { ExprError, groupDigits } from '../lib/expr.js';
import { getHistory, addHistory, clearHistory, removeHistory, setSettings, getSettings, loadPref, savePref, onChange } from '../core/store.js';
import { urlParams } from './form-view.js';

const EXAMPLES = ['0.1 + 0.2', '20% of 350', '15% tip on 84', '5 km to miles', '2 pi 6370', 'sin(30) + cos(60)', 'today + 90 days', '100 usd to inr', 'nCr(52, 5)', '200 + 10%', '72 f to c', '2^10 mod 7'];

const KEYS = [
  ['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['asin(', 'sin⁻¹'], ['acos(', 'cos⁻¹'], ['atan(', 'tan⁻¹'],
  ['ln(', 'ln'], ['log(', 'log'], ['sqrt(', '√'], ['^2', 'x²'], ['^', 'xʸ'], ['!', 'n!'],
  ['pi', 'π'], ['e', 'e'], ['abs(', '|x|'], ['nCr(', 'nCr'], ['nPr(', 'nPr'], ['ans', 'Ans'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['(', '('], [')', ')'], ['%', '%'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['*', '×'], ['/', '÷'], ['DEL', 'DEL'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['+', '+'], ['-', '−'], ['AC', 'AC'],
  ['0', '0'], ['.', '.'], [',', ','], ['EXP', 'EXP'], ['=', '='],
];

export function mountSmart(calc, env, opts = {}) {
  const vars = {};
  let ans;
  let angle = getSettings().angle;
  let session = [];
  let recall = -1;
  const sig = Number(getSettings().sig) || 12;
  const ctx = () => ({ angle, vars, ans, sig, now: new Date(), locale: env.locale });

  const input = h('input', { id: 'smart-input', class: 'smart-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: opts.keypad ? 'none' : 'text', 'aria-label': 'Expression', placeholder: 'Type a calculation, e.g. 15% tip on 84' });
  const live = h('div', { class: 'smart-live', 'aria-live': 'polite', role: 'status' });
  const stepsEl = h('p', { class: 'muted small smart-steps' });
  const histEl = h('ol', { class: 'smart-history', 'aria-label': 'Calculation history' });
  const varsEl = h('p', { class: 'muted small' });
  const angleBtns = ['deg', 'rad', 'grad'].map((a) => h('button', { type: 'button', class: 'seg', 'aria-pressed': String(angle === a), onClick: () => { angle = a; setSettings({ angle: a }); sync(); } }, a === 'deg' ? 'DEG' : a === 'rad' ? 'RAD' : 'GRAD'));
  let current = null;

  function evaluate(src) {
    try { return { ok: true, r: smartEval(src, ctx()) }; } catch (e) {
      if (e instanceof ExprError || e instanceof Error) return { ok: false, msg: e.message, partial: !!e.atEnd };
      return { ok: false, msg: 'Cannot calculate this', partial: false };
    }
  }
  const display = (r) => (r.kind === 'number' ? groupDigits(r.text, env.locale) : r.text);

  function sync() {
    angleBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(['deg', 'rad', 'grad'][i] === angle)));
    const src = input.value;
    stepsEl.textContent = '';
    if (!src.trim()) { live.textContent = ''; live.className = 'smart-live'; current = null; return; }
    const e = evaluate(src);
    if (e.ok) {
      current = e.r;
      live.className = 'smart-live ok';
      live.textContent = `= ${display(e.r)}`;
      stepsEl.textContent = [e.r.steps && e.r.steps[0], e.r.note].filter(Boolean).join('  |  ');
    } else {
      current = null;
      live.className = `smart-live${e.partial ? '' : ' bad'}`;
      live.textContent = e.partial ? '' : e.msg;
    }
  }

  function commit() {
    const src = input.value.trim();
    if (!src) return;
    const e = evaluate(src);
    if (!e.ok) { announce(e.msg); live.className = 'smart-live bad'; live.textContent = e.msg; return; }
    const r = e.r;
    if (r.value && r.value.toString) { ans = r.value.toString(); }
    if (r.assigned && r.value) vars[r.assigned] = r.value.toString();
    const entry = { expr: src, text: display(r), copy: r.copy || r.text };
    session = [entry, ...session].slice(0, 100);
    addHistory({ calc: 'smart', title: src, summary: `= ${entry.text}`, hash: `#/c/smart?q=${encodeURIComponent(src)}` });
    announce(`${src} equals ${entry.text}`);
    recall = -1;
    input.value = '';
    renderHistory();
    sync();
    varsEl.textContent = Object.keys(vars).length ? `Variables: ${Object.entries(vars).map(([k, v]) => `${k} = ${groupDigits(String(Number(v).toPrecision(12)).replace(/\.?0+$/, ''), env.locale)}`).join(', ')}` : '';
    live.className = 'smart-live ok';
    live.textContent = `= ${entry.text}`;
  }

  function renderHistory() {
    const items = getHistory().filter((x) => x.calc === 'smart').slice(0, 60);
    histEl.replaceChildren(...items.map((x) => {
      const expr = x.title, res = x.summary.replace(/^= /, '');
      return h('li', { class: 'smart-hist-item' },
        h('button', { type: 'button', class: 'hist-expr', title: 'Put this expression back in the input', onClick: () => { input.value = expr; input.focus(); sync(); } }, expr),
        h('button', { type: 'button', class: 'hist-res', title: 'Use this result in the input', onClick: () => { const clean = res.replace(/,/g, ''); input.value += /^-?[\d.]+(e-?\d+)?$/.test(clean) ? clean : ''; input.focus(); sync(); } }, `= ${res}`),
        h('button', { type: 'button', class: 'btn btn-quiet btn-sm', 'aria-label': `Delete ${expr} from history`, onClick: () => removeHistory(x.ts) }, '×'));
    }));
    if (!items.length) histEl.replaceChildren(h('li', { class: 'empty' }, 'Your calculations will appear here (stored only in this browser).'));
  }

  input.addEventListener('input', () => { recall = -1; sync(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const items = getHistory().filter((x) => x.calc === 'smart');
      if (!items.length) return;
      e.preventDefault();
      recall = Math.max(-1, Math.min(items.length - 1, recall + (e.key === 'ArrowUp' ? 1 : -1)));
      input.value = recall < 0 ? '' : items[recall].title;
      sync();
    } else if (e.key === 'Escape') { input.value = ''; sync(); }
  });

  const insert = (txt) => {
    const s = input.selectionStart ?? input.value.length, en = input.selectionEnd ?? s;
    input.value = input.value.slice(0, s) + txt + input.value.slice(en);
    const pos = s + txt.length;
    input.setSelectionRange(pos, pos);
    input.focus();
    sync();
  };
  const press = (k) => {
    if (k === 'AC') { input.value = ''; sync(); input.focus(); }
    else if (k === 'DEL') { const s = input.selectionStart ?? input.value.length; if (s > 0) { input.value = input.value.slice(0, s - 1) + input.value.slice(s); input.setSelectionRange(s - 1, s - 1); } input.focus(); sync(); }
    else if (k === '=') commit();
    else if (k === 'EXP') insert('e');
    else insert(k);
  };
  const keypad = h('div', { class: 'keypad', role: 'group', 'aria-label': 'Calculator keypad' }, KEYS.map(([k, label]) => h('button', { type: 'button', class: `key${/^\d$|^\.$/.test(k) ? ' key-num' : k === '=' ? ' key-eq' : /^(AC|DEL)$/.test(k) ? ' key-danger' : ''}`, 'aria-label': ({ '*': 'times', '/': 'divided by', '-': 'minus', '^2': 'square', '^': 'power', '!': 'factorial', DEL: 'delete', AC: 'clear all', '=': 'equals', ',': 'comma', EXP: 'times ten to the power of', pi: 'pi', 'sqrt(': 'square root', 'ans': 'previous answer' })[k] || null, onClick: () => press(k) }, label)));

  const init = urlParams().get('q');
  if (init) input.value = init;
  const unsub = onChange((w) => { if (w === 'history') renderHistory(); });
  const showPad = h('button', { type: 'button', class: 'btn', 'aria-expanded': String(opts.keypad || loadPref('keypad', false)), 'aria-controls': 'smart-keypad', onClick: (e) => { const open = keypadWrap.hidden; keypadWrap.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open)); e.currentTarget.textContent = open ? 'Hide keypad' : 'Show keypad'; input.inputMode = open ? 'none' : 'text'; savePref('keypad', open); } }, 'Show keypad');
  const keypadWrap = h('div', { id: 'smart-keypad', hidden: !(opts.keypad || loadPref('keypad', false)) }, keypad);
  if (!keypadWrap.hidden) showPad.textContent = 'Hide keypad';

  const page = h('div', { class: 'calc-page smart' },
    h('section', { class: 'card', 'aria-labelledby': 'panel-title' },
      h('div', { class: 'card-head' }, h('h1', { id: 'panel-title', tabindex: '-1' }, calc.title), h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Angle unit' }, angleBtns)),
      h('p', { class: 'muted' }, calc.desc),
      h('div', { class: 'smart-box' }, input, live),
      stepsEl, varsEl,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', onClick: commit }, 'Calculate and save'), h('button', { type: 'button', class: 'btn', onClick: () => { if (current) copyText(current.copy || current.text, 'Result copied'); else toast('Nothing to copy yet'); } }, 'Copy result'), h('button', { type: 'button', class: 'btn', onClick: () => { const q = input.value.trim(); history.replaceState(null, '', `#/c/${calc.id}${q ? `?q=${encodeURIComponent(q)}` : ''}`); copyText(location.href, 'Link copied'); } }, 'Copy share link'), showPad),
      keypadWrap,
      h('div', { class: 'examples' }, h('span', { class: 'muted small' }, 'Try: '), EXAMPLES.map((x) => h('button', { type: 'button', class: 'chip', onClick: () => { input.value = x; input.focus(); sync(); } }, x)))),
    h('section', { class: 'card', 'aria-labelledby': 'hist-title' }, h('div', { class: 'card-head' }, h('h2', { id: 'hist-title' }, 'History'), h('div', { class: 'actions actions-inline' },
      h('button', { type: 'button', class: 'btn', onClick: () => { const rows = getHistory().filter((x) => x.calc === 'smart'); if (!rows.length) return toast('No history yet'); download('calculator-history.txt', rows.map((x) => `${x.title} ${x.summary}`).join('\n')); } }, 'Export'),
      h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => { clearHistory('smart'); session = []; } }, 'Clear'))), histEl,
    h('p', { class: 'muted small' }, 'Tips: use ans for the previous answer, x = 5 to store a variable, and the up and down arrows to recall earlier input. Percent works naturally: 200 + 10% = 220.')));
  renderHistory();
  sync();
  setTimeout(() => { if (!opts.keypad) input.focus({ preventScroll: true }); }, 0);
  return { el: page, destroy: unsub };
}
