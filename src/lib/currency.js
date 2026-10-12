/*
 * Currency rates. A bundled snapshot (indicative only, units per 1 USD) works offline.
 * An optional live fetch from a free, keyless reference-rate API replaces it when available.
 */
import { D } from './expr.js';
import { registerCurrencies } from './units.js';

export const SNAPSHOT_LABEL = 'Indicative sample rates (bundled snapshot, not live). Do not use for transactions.';

export const CURRENCY_NAMES = {
  USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', INR: 'Indian rupee', JPY: 'Japanese yen', AUD: 'Australian dollar', CAD: 'Canadian dollar',
  CHF: 'Swiss franc', CNY: 'Chinese yuan', SGD: 'Singapore dollar', AED: 'UAE dirham', SAR: 'Saudi riyal', NZD: 'New Zealand dollar', SEK: 'Swedish krona',
  NOK: 'Norwegian krone', DKK: 'Danish krone', HKD: 'Hong Kong dollar', KRW: 'South Korean won', MXN: 'Mexican peso', BRL: 'Brazilian real',
  ZAR: 'South African rand', TRY: 'Turkish lira', THB: 'Thai baht', IDR: 'Indonesian rupiah', MYR: 'Malaysian ringgit', PHP: 'Philippine peso',
  PKR: 'Pakistani rupee', BDT: 'Bangladeshi taka', LKR: 'Sri Lankan rupee', NPR: 'Nepalese rupee', EGP: 'Egyptian pound', NGN: 'Nigerian naira',
  KES: 'Kenyan shilling', PLN: 'Polish zloty', CZK: 'Czech koruna', HUF: 'Hungarian forint', ILS: 'Israeli shekel', QAR: 'Qatari riyal', KWD: 'Kuwaiti dinar',
};

// Units of currency per 1 USD (sample values for offline use).
export const SNAPSHOT = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 84, JPY: 150, AUD: 1.52, CAD: 1.36, CHF: 0.88, CNY: 7.2, SGD: 1.34, AED: 3.6725, SAR: 3.75, NZD: 1.65,
  SEK: 10.5, NOK: 10.7, DKK: 6.9, HKD: 7.8, KRW: 1350, MXN: 17.5, BRL: 5.0, ZAR: 18.3, TRY: 32, THB: 36, IDR: 15800, MYR: 4.7, PHP: 57,
  PKR: 278, BDT: 117, LKR: 300, NPR: 134, EGP: 48, NGN: 1500, KES: 130, PLN: 4.0, CZK: 23, HUF: 360, ILS: 3.7, QAR: 3.64, KWD: 0.307,
};
export const SNAPSHOT_DATE = 'sample data';

registerCurrencies(Object.keys(SNAPSHOT));

let live = null; // {rates, date, fetchedAt}
const CACHE_KEY = 'hub.fx';

export function currentRates() {
  return { rates: { ...SNAPSHOT, ...(live ? live.rates : {}) }, live: !!live, date: live ? live.date : SNAPSHOT_DATE, label: live ? `Live reference rates (${live.date})` : SNAPSHOT_LABEL, liveCodes: live ? new Set(Object.keys(live.rates)) : new Set() };
}

export function convertCurrency(amount, from, to, rates = currentRates().rates) {
  if (!(from in rates) || !(to in rates)) throw new Error('Unknown currency');
  return new D(amount).div(String(rates[from])).mul(String(rates[to]));
}

export function loadCachedRates() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.rates && Date.now() - c.fetchedAt < 7 * 864e5) live = c;
  } catch { /* ignore */ }
  return live;
}

/** Fetch live reference rates (ECB-based, no key). Resolves to null on any failure so callers fall back silently. */
export async function fetchLiveRates(timeoutMs = 6000) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch('https://api.frankfurter.app/latest?from=USD', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || !j.rates || typeof j.rates !== 'object') return null;
    const rates = { USD: 1 };
    for (const [k, v] of Object.entries(j.rates)) if (typeof v === 'number' && v > 0) rates[k] = v;
    live = { rates, date: j.date || new Date().toISOString().slice(0, 10), fetchedAt: Date.now() };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(live)); } catch { /* ignore */ }
    return live;
  } catch {
    return null;
  }
}
