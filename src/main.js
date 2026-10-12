import './style.css';
import './hub.css';
import { h, svg, icon, announce } from './ui/dom.js';
import { getCalc, getCategory } from './calcs/registry.js';
import { makeEnv } from './core/format.js';
import { getSettings, setSettings, onChange, addRecent, isFavorite, toggleFavorite } from './core/store.js';
import { CURRENCY_NAMES } from './lib/currency.js';
import { renderFormCalc } from './ui/form-view.js';
import { mountSmart } from './ui/smart.js';
import { mountProgrammer } from './ui/programmer.js';
import { mountGraph } from './ui/graph.js';
import { mountConverter, mountCurrency } from './ui/converter.js';
import { homePage, categoryPage, historyPage, settingsPage, notFound } from './ui/pages.js';
import { setupPalette } from './ui/palette.js';

const main = document.getElementById('main');
let current = null;
let lastPath = null;

/* ---------- theme ---------- */
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function resolveTheme() {
  const t = getSettings().theme;
  return t === 'light' || t === 'dark' ? t : mq && mq.matches ? 'dark' : 'light';
}
function applyTheme() {
  const t = resolveTheme();
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('theme');
  if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
const toggleTheme = () => setSettings({ theme: resolveTheme() === 'dark' ? 'light' : 'dark' });
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (getSettings().theme === 'auto') applyTheme(); });

/* ---------- routing ---------- */
function parseRoute() {
  const hash = location.hash.replace(/^#/, '');
  const path = hash.split('?')[0].split('/').filter(Boolean);
  if (!path.length) return { page: 'home', key: 'home' };
  if (path[0] === 'c' && path[1]) return { page: 'calc', id: path[1], key: `c/${path[1]}` };
  if (path[0] === 'cat' && path[1]) return { page: 'cat', id: path[1], key: `cat/${path[1]}` };
  if (path[0] === 'history') return { page: 'history', key: 'history' };
  if (path[0] === 'settings') return { page: 'settings', key: 'settings' };
  return { page: 'none', key: 'none' };
}

const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function crumbs(calc) {
  const cat = getCategory(calc.cat);
  const fav = h('button', { type: 'button', class: 'btn btn-quiet fav', 'aria-pressed': String(isFavorite(calc.id)), onClick: () => { const on = toggleFavorite(calc.id); fav.setAttribute('aria-pressed', String(on)); fav.textContent = on ? 'Favourite saved' : 'Add to favourites'; announce(on ? 'Added to favourites' : 'Removed from favourites'); } }, isFavorite(calc.id) ? 'Favourite saved' : 'Add to favourites');
  return h('div', { class: 'crumb-row' }, h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/' }, 'Home'), ' / ', h('a', { href: `#/cat/${cat.id}` }, cat.name), ' / ', h('span', { 'aria-current': 'page' }, calc.title)), fav);
}

function render() {
  const route = parseRoute();
  const env = makeEnv(getSettings());
  if (current && current.destroy) { try { current.destroy(); } catch { /* ignore */ } }
  current = null;
  let node, title;
  const wrapPage = (...kids) => h('div', { class: 'wrap page' }, ...kids);
  if (route.page === 'home') { node = homePage(() => palette.open()); title = 'Calculator Hub: calculate anything'; }
  else if (route.page === 'cat') { node = categoryPage(route.id); const c = getCategory(route.id); title = c ? `${c.name} - Calculator Hub` : 'Not found'; }
  else if (route.page === 'history') { const r = historyPage(); node = r.el; current = r; title = 'History - Calculator Hub'; }
  else if (route.page === 'settings') { node = settingsPage(); title = 'Settings - Calculator Hub'; }
  else if (route.page === 'calc') {
    const calc = getCalc(route.id);
    if (!calc) { node = notFound(); title = 'Not found - Calculator Hub'; } else {
      addRecent(calc.id);
      title = `${calc.title} - Calculator Hub`;
      let view;
      if (calc.view === 'smart') view = mountSmart(calc, env);
      else if (calc.view === 'scientific') view = mountSmart(calc, env, { keypad: true });
      else if (calc.view === 'programmer') view = mountProgrammer(calc, env);
      else if (calc.view === 'graph') view = mountGraph(calc, env);
      else if (calc.view === 'converter') view = mountConverter(calc, env);
      else if (calc.view === 'currency') view = mountCurrency(calc, env);
      else view = { el: renderFormCalc(calc, env) };
      current = view;
      node = wrapPage(crumbs(calc), view.el);
    }
  } else { node = notFound(); title = 'Not found - Calculator Hub'; }
  main.replaceChildren(node);
  document.title = title;
  document.body.dataset.page = route.page;
  if (route.key !== lastPath) {
    window.scrollTo(0, 0);
    const target = main.querySelector('#panel-title, #page-title, #hero-title');
    if (target) target.focus({ preventScroll: true });
    announce(title.replace(' - Calculator Hub', ''));
  }
  lastPath = route.key;
  parallax();
}

/* ---------- parallax (transform only) ---------- */
const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
let ticking = false;
function parallax() {
  const els = document.querySelectorAll('[data-parallax]');
  if (!els.length) return;
  const on = !reduce.matches && window.innerWidth > 720;
  const y = window.scrollY;
  els.forEach((el) => { el.style.transform = on && y < 900 ? `translate3d(0, ${(y * Number(el.dataset.parallax)).toFixed(1)}px, 0)` : ''; });
  ticking = false;
}
window.addEventListener('scroll', () => { if (!ticking && document.querySelector('[data-parallax]')) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });

/* ---------- header ---------- */
function buildHeader() {
  const s = getSettings();
  const cur = h('select', { id: 'currency', class: 'control', 'aria-label': 'Currency', onChange: (e) => setSettings({ currency: e.target.value }) }, Object.entries(CURRENCY_NAMES).map(([c, n]) => h('option', { value: c, selected: c === s.currency }, `${c} - ${n}`)));
  const header = document.getElementById('site-header');
  header.replaceChildren(h('div', { class: 'wrap header-row' },
    h('a', { class: 'brand', href: '#/', 'aria-label': 'Calculator Hub home' }, svg('svg', { class: 'brand-mark', viewBox: '0 0 32 32', 'aria-hidden': 'true', focusable: 'false', html: '<rect width="32" height="32" rx="8" fill="currentColor"/><path d="M7 22l6-7 4 4 8-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' }), h('span', null, 'Calculator Hub')),
    h('nav', { class: 'header-nav', 'aria-label': 'Main' }, h('a', { href: '#/cat/finance' }, 'Finance'), h('a', { href: '#/cat/converters' }, 'Converters'), h('a', { href: '#/history' }, 'History'), h('a', { href: '#/settings' }, 'Settings')),
    h('div', { class: 'header-tools' },
      h('button', { type: 'button', class: 'btn', id: 'open-palette', 'aria-label': 'Search calculators (Control K)', onClick: () => palette.open() }, icon('M11 4a7 7 0 100 14 7 7 0 000-14z M21 21l-5-5', 18), h('span', { class: 'hide-sm' }, ' Search '), h('kbd', { class: 'hide-sm' }, 'Ctrl K')),
      h('div', { class: 'select-wrap' }, h('label', { for: 'currency', class: 'tool-label' }, 'Currency'), cur),
      h('button', { type: 'button', class: 'btn btn-icon', id: 'help', 'aria-label': 'Keyboard shortcuts', title: 'Keyboard shortcuts (?)', onClick: () => palette.openHelp() }, '?'),
      h('button', { type: 'button', id: 'theme', class: 'btn btn-icon', title: 'Toggle theme (t)', onClick: toggleTheme },
        svg('svg', { class: 'icon-moon', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', html: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor"/>' }),
        svg('svg', { class: 'icon-sun', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', html: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g>' })))));
}

const palette = setupPalette({ go, toggleTheme });
buildHeader();
applyTheme();
onChange((what) => {
  if (what === 'settings') { applyTheme(); const c = document.getElementById('currency'); if (c) c.value = getSettings().currency; render(); }
  else if (what === 'favorites' && parseRoute().page === 'home') render();
});
window.addEventListener('hashchange', render);
render();

/* ---------- offline support ---------- */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* offline support is optional */ }); });
}
