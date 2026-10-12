import { h, icon, copyText, download, toast } from './dom.js';
import { CATEGORIES, CALCS, getCalc, calcsIn, getCategory, search } from '../calcs/registry.js';
import { getFavorites, getRecents, getHistory, removeHistory, clearHistory, getSettings, setSettings, onChange, toggleFavorite } from '../core/store.js';
import { LOCALES } from '../core/format.js';
import { CURRENCY_NAMES } from '../lib/currency.js';
import { toCSV } from '../lib/finmath.js';

const cardLink = (c) => h('li', null, h('a', { class: 'calc-link', href: `#/c/${c.id}` }, h('span', { class: 'calc-link-title' }, c.title), h('span', { class: 'calc-link-cat muted small' }, getCategory(c.cat).name)));
const catCard = (cat) => h('li', null, h('a', { class: 'cat-card', href: `#/cat/${cat.id}` }, h('span', { class: 'cat-icon' }, icon(cat.icon, 26)), h('span', { class: 'cat-body' }, h('span', { class: 'cat-name' }, cat.name), h('span', { class: 'cat-blurb muted' }, cat.blurb), h('span', { class: 'cat-count small' }, `${calcsIn(cat.id).length} calculators`))));

export function homePage(openPalette) {
  const favs = getFavorites().map(getCalc).filter(Boolean), recents = getRecents().map(getCalc).filter(Boolean).slice(0, 6);
  const input = h('input', { id: 'home-search', class: 'home-search', type: 'search', placeholder: 'Search every calculator: "mortgage", "bmi", "mpg", "quadratic"...', 'aria-label': 'Search calculators', autocomplete: 'off' });
  const results = h('ul', { class: 'link-grid', 'aria-label': 'Search results' });
  const live = h('p', { class: 'muted small', role: 'status', 'aria-live': 'polite' });
  input.addEventListener('input', () => {
    const hits = search(input.value, 18);
    results.replaceChildren(...hits.map(cardLink));
    live.textContent = input.value.trim() ? `${hits.length} calculator${hits.length === 1 ? '' : 's'} found` : '';
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const hit = search(input.value, 1)[0]; if (hit) location.hash = `#/c/${hit.id}`; } });
  return h('div', { class: 'home' },
    h('section', { class: 'hero', 'aria-labelledby': 'hero-title' },
      h('div', { class: 'hero-bg', 'data-parallax': '0.18', 'aria-hidden': 'true' }), h('div', { class: 'hero-orb hero-orb-a', 'data-parallax': '0.32', 'aria-hidden': 'true' }), h('div', { class: 'hero-orb hero-orb-b', 'data-parallax': '0.12', 'aria-hidden': 'true' }),
      h('div', { class: 'wrap hero-inner' },
        h('p', { class: 'eyebrow' }, `${CALCS.length} calculators and converters`),
        h('h1', { id: 'hero-title', tabindex: '-1' }, 'Calculate anything'),
        h('p', { class: 'lead' }, 'From a quick sum to a 30-year mortgage: type it, solve it, plot it, convert it. Fast, private and works offline.'),
        h('div', { class: 'search-row' }, input, h('button', { type: 'button', class: 'btn', onClick: openPalette }, 'Command palette ', h('kbd', null, 'Ctrl K'))),
        live, results)),
    h('div', { class: 'wrap home-body' },
      h('section', { 'aria-labelledby': 'quick' }, h('h2', { id: 'quick' }, 'Start here'),
        h('ul', { class: 'link-grid' }, ['smart', 'scientific', 'emi', 'compound-interest', 'bmi', 'percentage', 'convert-length', 'graph'].map(getCalc).map(cardLink))),
      favs.length ? h('section', { 'aria-labelledby': 'favs' }, h('h2', { id: 'favs' }, 'Your favourites'), h('ul', { class: 'link-grid' }, favs.map(cardLink))) : null,
      recents.length ? h('section', { 'aria-labelledby': 'recent' }, h('h2', { id: 'recent' }, 'Recently used'), h('ul', { class: 'link-grid' }, recents.map(cardLink))) : null,
      h('section', { 'aria-labelledby': 'cats' }, h('h2', { id: 'cats' }, 'Browse by category'), h('ul', { class: 'cat-grid' }, CATEGORIES.map(catCard)))));
}

export function categoryPage(catId) {
  const cat = getCategory(catId);
  if (!cat) return notFound();
  return h('div', { class: 'wrap page' }, h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/' }, 'Home'), ' / ', cat.name),
    h('h1', { id: 'page-title', tabindex: '-1' }, cat.name), h('p', { class: 'muted lead-sm' }, cat.blurb),
    h('ul', { class: 'link-grid wide' }, calcsIn(catId).map((c) => h('li', null, h('a', { class: 'calc-link', href: `#/c/${c.id}` }, h('span', { class: 'calc-link-title' }, c.title), h('span', { class: 'muted small' }, c.desc))))));
}

export function historyPage() {
  const q = h('input', { class: 'control', type: 'search', id: 'hist-q', placeholder: 'Search history', 'aria-label': 'Search history' });
  const list = h('ul', { class: 'history-list' });
  const empty = h('p', { class: 'empty' }, 'Nothing saved yet. Use "Save to history" on any calculator, or press Enter in the smart calculator.');
  const fmt = (t) => new Date(t).toLocaleString();
  const paint = () => {
    const term = q.value.trim().toLowerCase();
    const items = getHistory().filter((x) => !term || `${x.title} ${x.summary}`.toLowerCase().includes(term));
    list.replaceChildren(...items.map((x) => h('li', { class: 'history-item' },
      h('div', { class: 'h-main' }, h('div', { class: 'h-title' }, x.calc === 'smart' ? x.title : x.title), h('div', { class: 'h-meta' }, `${x.summary} - ${fmt(x.ts)}`)),
      h('div', { class: 'h-actions' }, h('a', { class: 'btn', href: x.hash }, 'Open'), h('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `Delete ${x.title}`, onClick: () => { removeHistory(x.ts); } }, 'Delete')))));
    empty.hidden = getHistory().length > 0;
    list.hidden = !items.length;
  };
  q.addEventListener('input', paint);
  const off = onChange((w) => { if (w === 'history') paint(); });
  const page = h('div', { class: 'wrap page' }, h('h1', { id: 'page-title', tabindex: '-1' }, 'History'),
    h('p', { class: 'muted' }, 'Everything you saved, stored only in this browser.'),
    h('div', { class: 'toolbar' }, q,
      h('button', { type: 'button', class: 'btn', onClick: () => { const rows = getHistory(); if (!rows.length) return toast('Nothing to export'); download('history.csv', toCSV([['Time', 'Calculator', 'Entry', 'Result', 'Link'], ...rows.map((x) => [new Date(x.ts).toISOString(), x.calc, x.title, x.summary, x.hash])]), 'text/csv'); } }, 'Export CSV'),
      h('button', { type: 'button', class: 'btn', onClick: () => { const rows = getHistory(); if (!rows.length) return toast('Nothing to export'); download('history.json', JSON.stringify(rows, null, 2), 'application/json'); } }, 'Export JSON'),
      h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => { if (getHistory().length && confirm('Delete all saved history?')) clearHistory(); } }, 'Clear all')),
    empty, list);
  paint();
  return { el: page, destroy: off };
}

export function settingsPage() {
  const s = getSettings();
  const sel = (id, label, options, key, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), h('select', { id, class: 'control', onChange: (e) => setSettings({ [key]: e.target.value }) }, options.map(([v, l]) => h('option', { value: v, selected: String(s[key]) === String(v) }, l))), hint ? h('p', { class: 'muted small' }, hint) : null);
  const numField = (id, label, key, min, max, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, class: 'control', type: 'number', min, max, step: 1, value: s[key], onChange: (e) => { const n = Math.min(max, Math.max(min, Math.round(Number(e.target.value) || min))); setSettings({ [key]: n }); } }), h('p', { class: 'muted small' }, hint));
  return h('div', { class: 'wrap page' }, h('h1', { id: 'page-title', tabindex: '-1' }, 'Settings'), h('p', { class: 'muted' }, 'Saved in this browser and applied immediately.'),
    h('section', { class: 'card settings-grid' },
      sel('set-theme', 'Theme', [['auto', 'Follow system'], ['light', 'Light'], ['dark', 'Dark']], 'theme'),
      numField('set-dec', 'Decimal places in results', 'decimals', 0, 10, 'Used for non-money values. Money follows the currency\'s own format.'),
      numField('set-sig', 'Significant digits (smart calculator)', 'sig', 6, 30, 'Arithmetic is exact to 50 digits; this only controls what is shown.'),
      sel('set-angle', 'Angle unit', [['deg', 'Degrees'], ['rad', 'Radians'], ['grad', 'Gradians']], 'angle', 'Used by the smart and scientific calculators.'),
      sel('set-cur', 'Currency', Object.keys(CURRENCY_NAMES).map((c) => [c, `${c} - ${CURRENCY_NAMES[c]}`]), 'currency'),
      sel('set-loc', 'Number format', LOCALES, 'locale', 'Automatic picks the usual format for the currency (for example lakh grouping for INR).')),
    h('section', { class: 'card' }, h('h2', null, 'Your data'), h('p', { class: 'muted' }, 'History, favourites and settings never leave this device.'),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onClick: () => { clearHistory(); toast('History cleared'); } }, 'Clear history'), h('button', { type: 'button', class: 'btn', onClick: () => { for (const id of [...getFavorites()]) toggleFavorite(id); toast('Favourites cleared'); } }, 'Clear favourites'))));
}

export function notFound() {
  return h('div', { class: 'wrap page center' }, h('p', { class: 'code', 'aria-hidden': 'true' }, '404'), h('h1', { id: 'page-title', tabindex: '-1' }, 'That page could not be found'), h('p', { class: 'muted' }, 'The link may be mistyped or out of date.'), h('p', null, h('a', { class: 'btn btn-primary', href: '#/' }, 'Back to all calculators')));
}

export { copyText };
