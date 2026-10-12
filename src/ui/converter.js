import { h, copyText, toast, announce, debounce } from './dom.js';
import { getCategory, convert } from '../lib/units.js';
import { formatDecimal, groupDigits, D } from '../lib/expr.js';
import { CURRENCY_NAMES, currentRates, convertCurrency, fetchLiveRates, loadCachedRates } from '../lib/currency.js';
import { urlParams } from './form-view.js';
import { addHistory } from '../core/store.js';

function build(calc, env, spec) {
  const q = urlParams();
  const state = { v: q.get('v') ?? '1', from: q.get('from') || spec.defFrom, to: q.get('to') || spec.defTo };
  if (!spec.units.some((u) => u.id === state.from)) state.from = spec.defFrom;
  if (!spec.units.some((u) => u.id === state.to)) state.to = spec.defTo;
  const status = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const err = h('div', { class: 'field-error', id: 'cv-err', 'aria-live': 'polite' });
  const big = h('div', { class: 'stat primary conv-result' });
  const allEl = h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'All units' });
  const opts = (sel) => spec.units.map((u) => h('option', { value: u.id, selected: u.id === sel }, u.label));
  const vIn = h('input', { id: 'cv-v', class: 'control', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: state.v, 'aria-describedby': 'cv-err' });
  const fromSel = h('select', { id: 'cv-from', class: 'control' }, opts(state.from));
  const toSel = h('select', { id: 'cv-to', class: 'control' }, opts(state.to));
  let last = null;

  const show = (d) => groupDigits(formatDecimal(d, Number(env.settings.sig) || 12), env.locale);
  function update() {
    state.v = vIn.value; state.from = fromSel.value; state.to = toSel.value;
    err.textContent = ''; vIn.removeAttribute('aria-invalid');
    const s = state.v.trim().replace(/,/g, '');
    if (!s || !Number.isFinite(Number(s))) { err.textContent = s ? 'Enter a valid number' : 'Enter a value'; vIn.setAttribute('aria-invalid', 'true'); big.replaceChildren(h('div', { class: 'stat-label' }, 'Result'), h('div', { class: 'stat-value' }, '-')); allEl.replaceChildren(); last = null; return; }
    try {
      const r = spec.convert(new D(s), state.from, state.to);
      const fl = spec.units.find((u) => u.id === state.from), tl = spec.units.find((u) => u.id === state.to);
      last = `${show(new D(s))} ${fl.label} = ${show(r)} ${tl.label}`;
      big.replaceChildren(h('div', { class: 'stat-label' }, `${fl.label} to ${tl.label}`), h('div', { class: 'stat-value' }, `${show(r)} `, h('span', { class: 'stat-unit' }, tl.short || tl.id)), h('div', { class: 'stat-sub' }, `${show(new D(s))} ${fl.short || fl.id} = ${show(r)} ${tl.short || tl.id}`));
      status.textContent = last;
      allEl.replaceChildren(h('table', null, h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Unit'), h('th', { scope: 'col' }, 'Value'))), h('tbody', null, spec.units.map((u) => { let cell; try { cell = show(spec.convert(new D(s), state.from, u.id)); } catch { cell = '-'; } return h('tr', { class: u.id === state.to ? 'hl' : null }, h('th', { scope: 'row' }, `${u.label} (${u.short || u.id})`), h('td', null, cell)); }))));
    } catch (e) { err.textContent = e.message; vIn.setAttribute('aria-invalid', 'true'); last = null; }
    const p = new URLSearchParams({ v: state.v, from: state.from, to: state.to });
    history.replaceState(null, '', `#/c/${calc.id}?${p}`);
  }
  const upd = debounce(update, 80);
  vIn.addEventListener('input', upd); fromSel.addEventListener('change', update); toSel.addEventListener('change', update);
  const swap = h('button', { type: 'button', class: 'btn', 'aria-label': 'Swap units', onClick: () => { const f = fromSel.value; fromSel.value = toSel.value; toSel.value = f; update(); announce('Units swapped'); } }, 'Swap');
  const body = [
    h('div', { class: 'conv-grid' },
      h('div', { class: 'field' }, h('label', { for: 'cv-v' }, 'Value'), vIn, err),
      h('div', { class: 'field' }, h('label', { for: 'cv-from' }, 'From'), fromSel),
      h('div', { class: 'field swap' }, swap),
      h('div', { class: 'field' }, h('label', { for: 'cv-to' }, 'To'), toSel)),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-primary', onClick: () => { if (last) { addHistory({ calc: calc.id, title: calc.title, summary: last, hash: location.hash }); toast('Saved to history'); } } }, 'Save to history'),
      h('button', { type: 'button', class: 'btn', onClick: () => { if (last) copyText(last, 'Result copied'); } }, 'Copy result'),
      h('button', { type: 'button', class: 'btn', onClick: () => { update(); copyText(location.href, 'Link copied'); } }, 'Copy share link')),
    status, big, h('h2', { class: 'mt' }, 'All units'), allEl];
  return { body, update };
}

export function mountConverter(calc, env) {
  const cat = getCategory(calc.unitCat);
  const short = (u) => u.id;
  const units = cat.units.map((u) => ({ id: u.id, label: u.label, short: short(u) }));
  const defs = { length: ['km', 'mi'], area: ['m2', 'ft2'], volume: ['L', 'gal'], mass: ['kg', 'lb'], temperature: ['C', 'F'], speed: ['km/h', 'mph'], pressure: ['bar', 'psi'], energy: ['kcal', 'kJ'], power: ['kW', 'hp'], time: ['h', 'min'], data: ['GB', 'MB'], angle: ['deg', 'rad'], fuel: ['km/L', 'mpg'], force: ['N', 'lbf'], frequency: ['MHz', 'GHz'], cooking: ['cup', 'mL'] }[cat.id] || [cat.units[0].id, cat.units[1].id];
  const { body, update } = build(calc, env, { units, defFrom: defs[0], defTo: defs[1], convert: (v, f, t) => convert(cat.id, v, f, t) });
  const note = cat.id === 'temperature' ? 'Differences between temperatures are not converted here, only absolute readings.' : cat.id === 'fuel' ? 'Fuel economy is inverse: a higher km/L means a lower L/100 km.' : cat.id === 'data' ? 'KB, MB, GB use powers of 1000. KiB, MiB, GiB use powers of 1024.' : cat.id === 'cooking' ? 'Cup sizes differ by country: US 236.6 mL, metric 250 mL, UK 284 mL.' : '';
  const page = h('div', { class: 'calc-page' }, h('section', { class: 'card', 'aria-labelledby': 'panel-title' }, h('h1', { id: 'panel-title', tabindex: '-1' }, calc.title), h('p', { class: 'muted' }, calc.desc), ...body, note ? h('p', { class: 'muted note' }, note) : null));
  update();
  return { el: page };
}

export function mountCurrency(calc, env) {
  loadCachedRates();
  const codes = Object.keys(CURRENCY_NAMES).filter((c) => c in currentRates().rates);
  const units = codes.map((c) => ({ id: c, label: `${c} - ${CURRENCY_NAMES[c]}`, short: c }));
  const banner = h('p', { class: 'notice notice-info', role: 'status', 'aria-live': 'polite' });
  const refreshBtn = h('button', { type: 'button', class: 'btn' }, 'Fetch live rates');
  const paint = () => { const c = currentRates(); banner.textContent = c.label; banner.classList.toggle('live', c.live); };
  const { body, update } = build(calc, env, { units, defFrom: env.currency in currentRates().rates ? env.currency : 'USD', defTo: env.currency === 'USD' ? 'EUR' : 'USD', convert: (v, f, t) => convertCurrency(v, f, t) });
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true; refreshBtn.textContent = 'Fetching...';
    const r = await fetchLiveRates();
    refreshBtn.disabled = false; refreshBtn.textContent = 'Fetch live rates';
    if (r) { toast('Live rates loaded'); announce('Live rates loaded'); } else { toast('Could not reach the rate service. Using the offline sample rates.'); announce('Live rates unavailable, using sample rates'); }
    paint(); update();
  });
  paint();
  const page = h('div', { class: 'calc-page' }, h('section', { class: 'card', 'aria-labelledby': 'panel-title' }, h('h1', { id: 'panel-title', tabindex: '-1' }, calc.title), h('p', { class: 'muted' }, calc.desc), banner, h('div', { class: 'actions' }, refreshBtn), ...body,
    h('p', { class: 'muted note' }, 'Reference rates are mid-market and exclude bank spreads and fees. The bundled sample rates are indicative only.')));
  update();
  return { el: page };
}
