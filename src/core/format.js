/* Locale-aware formatting driven by the user's settings. */
import { todayTs } from '../lib/dates.js';

export const LOCALES = [['auto', 'Automatic (by currency)'], ['en-IN', 'English (India)'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['de-DE', 'German'], ['fr-FR', 'French'], ['es-ES', 'Spanish'], ['ja-JP', 'Japanese'], ['pt-BR', 'Portuguese (Brazil)']];
const CURRENCY_LOCALE = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP', AUD: 'en-AU', CAD: 'en-CA', CHF: 'de-CH', AED: 'en-AE', SGD: 'en-SG', BRL: 'pt-BR', CNY: 'zh-CN', KRW: 'ko-KR', MXN: 'es-MX', ZAR: 'en-ZA', PKR: 'en-PK', BDT: 'bn-BD', NPR: 'ne-NP', LKR: 'si-LK' };

export const DEFAULT_SETTINGS = { theme: 'auto', decimals: 4, sig: 12, angle: 'deg', locale: 'auto', currency: 'INR' };

export function resolveLocale(s) {
  if (s.locale && s.locale !== 'auto') return s.locale;
  return CURRENCY_LOCALE[s.currency] || 'en-US';
}

/** Build the formatting environment handed to every calculator's run(). */
export function makeEnv(settings, now = new Date()) {
  const locale = resolveLocale(settings);
  const dp = Math.min(10, Math.max(0, Number(settings.decimals) || 0));
  const cache = new Map();
  const nf = (key, opts) => {
    if (!cache.has(key)) { try { cache.set(key, new Intl.NumberFormat(locale, opts)); } catch { cache.set(key, new Intl.NumberFormat('en-US', opts)); } }
    return cache.get(key);
  };
  const clean = (x) => (Object.is(x, -0) || (Math.abs(x) < 1e-12 && x !== 0 && false) ? 0 : x);
  const num = (x, digits) => {
    if (x === null || x === undefined || Number.isNaN(x)) return '-';
    if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity';
    const d = digits === undefined ? dp : digits;
    const a = Math.abs(x);
    if (a !== 0 && (a >= 1e15 || a < 10 ** -Math.max(d, 4) / 2)) return x.toExponential(Math.min(8, Math.max(2, d))).replace('e+', 'e');
    return nf(`n${d}`, { maximumFractionDigits: d }).format(clean(Math.abs(x) < 1e-12 ? 0 : x));
  };
  const money = (x) => {
    if (!Number.isFinite(x)) return num(x);
    try { return nf(`c${settings.currency}`, { style: 'currency', currency: settings.currency }).format(Math.abs(x) < 0.005 ? 0 : x); } catch { return num(x, 2); }
  };
  const int = (x) => (Number.isFinite(x) ? nf('i', { maximumFractionDigits: 0 }).format(x) : num(x));
  const pct = (x, digits) => `${num(x, digits === undefined ? Math.min(dp, 2) : digits)}%`;
  const env = { settings, locale, dp, currency: settings.currency, num, money, int, pct, today: todayTs(now), now };
  env.kind = (k, v, digits) => {
    if (k === 'money') return money(v);
    if (k === 'pct') return pct(v, digits);
    if (k === 'int') return int(v);
    if (k === 'num') return num(v, digits);
    if (k === 'text' || typeof v === 'string') return String(v);
    return String(v);
  };
  return env;
}
