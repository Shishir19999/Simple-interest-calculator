/* Calendar maths on whole dates. A date is represented as a UTC-midnight timestamp, so DST never shifts a day. */
export const DAY = 86400000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const utc = (y, m, d) => Date.UTC(y, m - 1, d); // m is 1-based
export function parts(ts) { const x = new Date(ts); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; }
export function todayTs(now = new Date()) { return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()); }

/** Parse YYYY-MM-DD (strict calendar check) to a timestamp, or NaN. */
export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ts = utc(y, mo, d);
  const p = parts(ts);
  return p.y === y && p.m === mo && p.d === d ? ts : NaN;
}
export const toISO = (ts) => { const p = parts(ts); return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
export const weekday = (ts) => WEEKDAYS[new Date(ts).getUTCDay()];
export const monthName = (m) => MONTHS[m - 1];
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function formatLong(ts) { const p = parts(ts); return `${weekday(ts)}, ${p.d} ${MONTHS[p.m - 1]} ${p.y}`; }

export const addDays = (ts, n) => ts + n * DAY;
/** Add months, clamping the day to the end of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(ts, n) {
  const p = parts(ts);
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12), m = (total % 12 + 12) % 12 + 1;
  return utc(y, m, Math.min(p.d, daysInMonth(y, m)));
}
export const addYears = (ts, n) => addMonths(ts, n * 12);
export const diffDays = (a, b) => Math.round((b - a) / DAY);

/** Exact calendar difference between two dates as years, months, days (a <= b). */
export function ymd(a, b) {
  if (a > b) [a, b] = [b, a];
  const pa = parts(a), pb = parts(b);
  let years = pb.y - pa.y, months = pb.m - pa.m, days = pb.d - pa.d;
  if (days < 0) { months--; const prev = pb.m === 1 ? 12 : pb.m - 1; const py = pb.m === 1 ? pb.y - 1 : pb.y; days += daysInMonth(py, prev); }
  if (months < 0) { years--; months += 12; }
  return { years, months, days };
}

/** Count working days from a to b inclusive of both ends, skipping weekend days (array of 0-6) and holiday timestamps. */
export function workingDays(a, b, weekend = [0, 6], holidays = []) {
  if (a > b) [a, b] = [b, a];
  const hs = new Set(holidays);
  let n = 0;
  for (let t = a; t <= b; t += DAY) if (!weekend.includes(new Date(t).getUTCDay()) && !hs.has(t)) n++;
  return n;
}
/** Add working days (positive or negative) skipping weekends and holidays. */
export function addWorkingDays(ts, n, weekend = [0, 6], holidays = []) {
  const hs = new Set(holidays);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  while (left > 0) {
    ts += step * DAY;
    if (!weekend.includes(new Date(ts).getUTCDay()) && !hs.has(ts)) left--;
  }
  return ts;
}

/** Offset (minutes) of an IANA zone from UTC at an instant. */
export function zoneOffsetMin(zone, instantMs) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const o = {};
  for (const p of f.formatToParts(new Date(instantMs))) o[p.type] = Number(p.value);
  const asUtc = Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second);
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60000);
}
/** Convert a wall-clock time in a zone (ms as if UTC) to the real instant. */
export function wallToInstant(wallMs, zone) {
  let guess = wallMs - zoneOffsetMin(zone, wallMs) * 60000;
  guess = wallMs - zoneOffsetMin(zone, guess) * 60000;
  return guess;
}
export function formatInZone(instantMs, zone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(new Date(instantMs));
}
