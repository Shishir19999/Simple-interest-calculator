import { h } from './dom.js';
import { search, CATEGORIES, getCalc } from '../calcs/registry.js';
import { getFavorites, getRecents } from '../core/store.js';

const SHORTCUTS = [
  ['Ctrl K  or  /', 'Open the command palette (search every calculator)'], ['?', 'Show this shortcuts list'], ['g then h', 'Go to the home page'], ['g then y', 'Go to history'],
  ['g then s', 'Go to settings'], ['t', 'Toggle light and dark theme'], ['Enter', 'In the smart calculator: calculate and save to history'], ['Up / Down', 'In the smart calculator: recall earlier input'],
  ['Esc', 'Close a dialog or clear the smart input'], ['Arrow keys', 'In a chart or graph: inspect values or pan'], ['+  and  -', 'In the graph: zoom'], ['Tab', 'Move between controls; every action works from the keyboard'],
];

export function setupPalette({ go, toggleTheme }) {
  const dlg = h('dialog', { class: 'palette', 'aria-label': 'Command palette' });
  const input = h('input', { class: 'palette-input', type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', 'aria-label': 'Search calculators and actions', placeholder: 'Search calculators... (Esc to close)', autocomplete: 'off', spellcheck: 'false' });
  const list = h('ul', { class: 'palette-list', id: 'pal-list', role: 'listbox', 'aria-label': 'Results' });
  const status = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  dlg.append(input, list, status, h('p', { class: 'palette-foot muted small' }, 'Enter to open, Up and Down to move, Esc to close'));
  document.body.append(dlg);
  let items = [], active = 0;

  const actions = [
    { title: 'Toggle theme', run: toggleTheme, sub: 'Action' }, { title: 'Settings', run: () => go('#/settings'), sub: 'Action' }, { title: 'History', run: () => go('#/history'), sub: 'Action' }, { title: 'Keyboard shortcuts', run: () => openHelp(), sub: 'Action' }, { title: 'Home', run: () => go('#/'), sub: 'Action' },
  ];
  const calcItem = (c, sub) => ({ title: c.title, sub: sub || (CATEGORIES.find((k) => k.id === c.cat) || {}).name, run: () => go(`#/c/${c.id}`) });
  function compute() {
    const q = input.value.trim();
    if (!q) {
      const fav = getFavorites().map(getCalc).filter(Boolean).map((c) => calcItem(c, 'Favourite'));
      const rec = getRecents().map(getCalc).filter(Boolean).map((c) => calcItem(c, 'Recent'));
      const cats = CATEGORIES.map((k) => ({ title: k.name, sub: 'Category', run: () => go(`#/cat/${k.id}`) }));
      items = [...fav, ...rec, ...cats].filter((x, i, a) => a.findIndex((y) => y.title === x.title) === i).slice(0, 14);
    } else {
      items = [...search(q, 12).map((c) => calcItem(c)), ...actions.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()))];
    }
    active = 0;
    paint();
  }
  function paint() {
    list.replaceChildren(...items.map((it, i) => h('li', { id: `pal-${i}`, role: 'option', class: `palette-item${i === active ? ' active' : ''}`, 'aria-selected': String(i === active), onClick: () => choose(i) }, h('span', null, it.title), h('span', { class: 'muted small' }, it.sub))));
    if (!items.length) list.replaceChildren(h('li', { class: 'palette-empty muted', role: 'presentation' }, 'No match. Try another word such as "loan", "area" or "convert".'));
    input.setAttribute('aria-activedescendant', items.length ? `pal-${active}` : '');
    status.textContent = items.length ? `${items.length} results` : 'No results';
    const el = document.getElementById(`pal-${active}`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }
  function choose(i) { const it = items[i]; if (!it) return; close(); it.run(); }
  function open() { if (dlg.open) return; dlg.returnFocusTo = document.activeElement; input.value = ''; dlg.showModal(); compute(); input.focus(); }
  function close() { if (dlg.open) dlg.close(); }
  input.addEventListener('input', compute);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { const r = dlg.returnFocusTo; if (r && r.focus && document.contains(r)) r.focus(); });

  const help = h('dialog', { class: 'palette help', 'aria-labelledby': 'help-title' }, h('h2', { id: 'help-title' }, 'Keyboard shortcuts'),
    h('table', { class: 'shortcuts' }, h('tbody', null, SHORTCUTS.map(([k, d]) => h('tr', null, h('th', { scope: 'row' }, h('kbd', null, k)), h('td', null, d))))),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', onClick: () => help.close() }, 'Close')));
  help.addEventListener('click', (e) => { if (e.target === help) help.close(); });
  document.body.append(help);
  function openHelp() { if (!help.open) { help.returnFocusTo = document.activeElement; help.showModal(); } }
  help.addEventListener('close', () => { const r = help.returnFocusTo; if (r && r.focus && document.contains(r)) r.focus(); });

  let chord = 0;
  document.addEventListener('keydown', (e) => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? close() : open(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || dlg.open || help.open) return;
    if (e.key === '/') { e.preventDefault(); open(); }
    else if (e.key === '?') { e.preventDefault(); openHelp(); }
    else if (e.key === 't') toggleTheme();
    else if (e.key === 'g') { chord = Date.now(); }
    else if (chord && Date.now() - chord < 1200) { chord = 0; if (e.key === 'h') go('#/'); else if (e.key === 'y') go('#/history'); else if (e.key === 's') go('#/settings'); }
  });
  return { open, openHelp };
}
