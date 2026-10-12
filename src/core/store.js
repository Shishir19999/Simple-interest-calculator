/* Persistent state in localStorage. Every access is guarded: storage can be blocked or full. */
import { DEFAULT_SETTINGS } from './format.js';

const KEY = { settings: 'hub.settings', fav: 'hub.favorites', recent: 'hub.recent', history: 'hub.history' };
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (what) => listeners.forEach((fn) => fn(what));

let settings = { ...DEFAULT_SETTINGS, ...read(KEY.settings, {}) };
export const getSettings = () => settings;
export function setSettings(patch) {
  settings = { ...settings, ...patch };
  write(KEY.settings, settings);
  try { if (settings.theme === 'auto') localStorage.removeItem('sic.theme'); else localStorage.setItem('sic.theme', settings.theme); } catch { /* ignore */ }
  emit('settings');
}

let favs = read(KEY.fav, []);
export const getFavorites = () => favs;
export const isFavorite = (id) => favs.includes(id);
export function toggleFavorite(id) {
  favs = favs.includes(id) ? favs.filter((x) => x !== id) : [id, ...favs];
  write(KEY.fav, favs);
  emit('favorites');
  return favs.includes(id);
}

let recents = read(KEY.recent, []);
export const getRecents = () => recents;
export function addRecent(id) {
  recents = [id, ...recents.filter((x) => x !== id)].slice(0, 8);
  write(KEY.recent, recents);
}

let history = read(KEY.history, []);
export const getHistory = () => history;
/** Add an entry {calc, title, summary, hash}. Consecutive identical entries are merged. */
export function addHistory(entry) {
  const e = { ts: Date.now(), ...entry };
  if (history[0] && history[0].hash === e.hash && history[0].summary === e.summary) return false;
  history = [e, ...history].slice(0, 300);
  write(KEY.history, history);
  emit('history');
  return true;
}
export function removeHistory(ts) { history = history.filter((x) => x.ts !== ts); write(KEY.history, history); emit('history'); }
export function clearHistory(calc) { history = calc ? history.filter((x) => x.calc !== calc) : []; write(KEY.history, history); emit('history'); }

export function loadPref(key, def) { return read(`hub.pref.${key}`, def); }
export function savePref(key, val) { write(`hub.pref.${key}`, val); }
