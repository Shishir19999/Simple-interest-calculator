import { finance } from './finance.js';
import { maths } from './maths.js';
import { life } from './life.js';
import { CATEGORIES as UNIT_CATEGORIES } from '../lib/units.js';

export const CATEGORIES = [
  { id: 'tools', name: 'Smart and scientific', blurb: 'Type anything, scientific keypad, programmer mode and graphing.', icon: 'M5 3h14v18H5z M8 7h8 M8 12h2 M12 12h2 M8 16h2 M12 16h2' },
  { id: 'finance', name: 'Finance', blurb: 'Loans, investments, tax, savings and business maths.', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v10 M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5' },
  { id: 'converters', name: 'Converters', blurb: 'Units, currency, number systems and cooking.', icon: 'M4 8h14l-3-3 M20 16H6l3 3' },
  { id: 'equations', name: 'Algebra and solvers', blurb: 'Equations, systems, matrices and complex numbers.', icon: 'M6 6l12 12M18 6L6 18' },
  { id: 'statistics', name: 'Statistics and probability', blurb: 'Descriptive stats, regression, distributions, combinatorics.', icon: 'M5 20V10 M12 20V4 M19 20v-7' },
  { id: 'geometry', name: 'Geometry and trigonometry', blurb: 'Areas, volumes, triangles, coordinates and trig.', icon: 'M12 4l9 16H3z' },
  { id: 'numbers', name: 'Number theory', blurb: 'Primes, GCD/LCM, fractions, Roman numerals and sequences.', icon: 'M9 4L7 20 M17 4l-2 16 M4 9h16 M3 15h16' },
  { id: 'health', name: 'Health and fitness', blurb: 'BMI, calories, body fat, heart rate, pregnancy and more.', icon: 'M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z' },
  { id: 'dates', name: 'Date and time', blurb: 'Age, date differences, working days, countdowns, time zones.', icon: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4' },
  { id: 'percent', name: 'Percentages, ratios and grades', blurb: 'Every percentage question, ratios, averages, GPA.', icon: 'M6 18L18 6 M8 8h.01 M16 16h.01' },
  { id: 'everyday', name: 'Everyday and home', blurb: 'Fuel, electricity, paint, tiles, concrete, shopping, cooking.', icon: 'M4 11l8-7 8 7 M6 10v10h12V10' },
  { id: 'science', name: 'Physics and chemistry', blurb: "Ohm's law, motion, gases, decay, molar mass, pH.", icon: 'M9 3h6 M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3' },
];

const special = [
  { id: 'smart', cat: 'tools', view: 'smart', title: 'Smart calculator', desc: 'Type anything: expressions, "20% of 350", "5 km to miles", "today + 90 days". Live result, history and variables.', keywords: 'calculator expression type anything natural language percent units convert history ans variable basic' },
  { id: 'scientific', cat: 'tools', view: 'scientific', title: 'Scientific calculator', desc: 'Keypad with trigonometry, logs, powers, factorial, nPr/nCr and degree, radian, gradian modes.', keywords: 'scientific calculator trig sin cos tan log ln factorial keypad casio' },
  { id: 'programmer', cat: 'tools', view: 'programmer', title: 'Programmer calculator', desc: 'Binary, octal, decimal and hex with bitwise operations and two\'s complement word sizes.', keywords: 'programmer binary hex octal bitwise and or xor shift twos complement bits bytes' },
  { id: 'graph', cat: 'tools', view: 'graph', title: 'Graphing calculator', desc: 'Plot several functions, zoom and pan, find roots and intercepts, and view a table of values.', keywords: 'graph plot function desmos roots intercepts table of values zoom pan curve' },
  { id: 'currency', cat: 'converters', view: 'currency', title: 'Currency converter', desc: 'Convert between 39 currencies. Works offline with sample rates and can fetch live reference rates.', keywords: 'currency exchange rate converter usd eur inr gbp forex money' },
];

const converters = UNIT_CATEGORIES.map((c) => ({
  id: `convert-${c.id}`, cat: 'converters', view: 'converter', unitCat: c.id, title: `${c.name} converter`,
  desc: `Convert between ${c.units.slice(0, 5).map((u) => u.label.toLowerCase()).join(', ')} and more.`,
  keywords: `${c.name} convert unit conversion ${c.units.map((u) => u.id).join(' ')}`,
}));

export const CALCS = [...special, ...finance, ...converters, ...maths, ...life].map((c) => ({ ...c, view: c.view || 'form' }));
const index = new Map(CALCS.map((c) => [c.id, c]));
export const getCalc = (id) => index.get(id);
export const getCategory = (id) => CATEGORIES.find((c) => c.id === id);
export const calcsIn = (catId) => CALCS.filter((c) => c.cat === catId);

/** Score-based search over title, keywords and category name. */
export function search(query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const out = [];
  for (const c of CALCS) {
    const title = c.title.toLowerCase(), hay = `${title} ${c.keywords || ''} ${getCategory(c.cat).name.toLowerCase()} ${c.desc || ''}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title === t) score += 100;
      else if (title.startsWith(t)) score += 40;
      else if (title.includes(t)) score += 25;
      else if (hay.includes(t)) score += 10;
      else { score = -1; break; }
    }
    if (score > 0) out.push([score, c]);
  }
  return out.sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title)).slice(0, limit).map((x) => x[1]);
}
