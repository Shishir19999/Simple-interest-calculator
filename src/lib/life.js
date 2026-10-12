/* Health, everyday and science formulas. Pure functions. Metric inputs unless stated. */

/* ---------------- health ---------------- */
export function bmi(kg, cm) {
  if (!(kg > 0) || !(cm > 0)) throw new Error('Weight and height must be above zero');
  const m = cm / 100, value = kg / (m * m);
  const category = value < 18.5 ? 'Underweight' : value < 25 ? 'Normal weight' : value < 30 ? 'Overweight' : 'Obese';
  const asian = value < 18.5 ? 'Underweight' : value < 23 ? 'Normal weight' : value < 27.5 ? 'Overweight' : 'Obese';
  return { value, category, asian, healthyMin: 18.5 * m * m, healthyMax: 24.9 * m * m, prime: value / 25 };
}
export const ACTIVITY = [
  { value: 1.2, label: 'Sedentary (little or no exercise)' }, { value: 1.375, label: 'Light (1-3 days a week)' },
  { value: 1.55, label: 'Moderate (3-5 days a week)' }, { value: 1.725, label: 'Active (6-7 days a week)' }, { value: 1.9, label: 'Very active (hard training or physical job)' },
];
/** Basal metabolic rate in kcal/day. formula: mifflin | harris (revised 1984) | katch (needs body fat %). */
export function bmr(formula, sex, kg, cm, age, bodyFatPct = 0) {
  if (!(kg > 0) || !(cm > 0) || !(age > 0)) throw new Error('Weight, height and age must be above zero');
  const male = sex === 'male';
  if (formula === 'harris') return male ? 88.362 + 13.397 * kg + 4.799 * cm - 5.677 * age : 447.593 + 9.247 * kg + 3.098 * cm - 4.33 * age;
  if (formula === 'katch') {
    if (!(bodyFatPct >= 2 && bodyFatPct < 70)) throw new Error('Enter a body fat percentage between 2 and 70');
    return 370 + 21.6 * kg * (1 - bodyFatPct / 100);
  }
  return 10 * kg + 6.25 * cm - 5 * age + (male ? 5 : -161);
}
export function bodyFatNavy(sex, cm, neck, waist, hip = 0) {
  if (sex === 'male') {
    if (waist <= neck) throw new Error('Waist must be larger than neck');
    return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(cm)) - 450;
  }
  if (waist + hip <= neck) throw new Error('Waist plus hip must be larger than neck');
  return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(cm)) - 450;
}
export const bodyFatFromBmi = (bmiValue, age, sex) => 1.2 * bmiValue + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4;
export function bodyFatCategory(sex, pct) {
  const t = sex === 'male' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  return pct < t[0] ? 'Essential fat' : pct < t[1] ? 'Athletic' : pct < t[2] ? 'Fitness' : pct < t[3] ? 'Average' : 'Obese';
}
export function idealWeights(sex, cm) {
  const inchesOver = cm / 2.54 - 60;
  const m = sex === 'male';
  const f = (base, per) => Math.max(0, base + per * inchesOver);
  return { Devine: f(m ? 50 : 45.5, 2.3), Robinson: f(m ? 52 : 49, m ? 1.9 : 1.7), Miller: f(m ? 56.2 : 53.1, m ? 1.41 : 1.36), Hamwi: f(m ? 48 : 45.5, m ? 2.7 : 2.2) };
}
export function maxHeartRate(age) { return { classic: 220 - age, tanaka: 208 - 0.7 * age }; }
export function heartZones(age, resting) {
  const max = 208 - 0.7 * age, reserve = max - resting;
  return [['Warm-up / recovery', 0.5, 0.6], ['Fat burn / endurance', 0.6, 0.7], ['Aerobic / cardio', 0.7, 0.8], ['Threshold / hard', 0.8, 0.9], ['Maximum effort', 0.9, 1.0]]
    .map(([name, lo, hi]) => ({ name, low: Math.round(resting + reserve * lo), high: Math.round(resting + reserve * hi) }));
}
export const caloriesBurned = (met, kg, minutes) => met * kg * (minutes / 60);
export const waterIntakeMl = (kg, exerciseMin, hot) => kg * 33 + (exerciseMin / 30) * 350 + (hot ? 500 : 0);
export function macros(kcal, carbPct, proteinPct, fatPct) {
  if (Math.abs(carbPct + proteinPct + fatPct - 100) > 0.01) throw new Error('Carbs, protein and fat must add up to 100%');
  return { carbsG: (kcal * carbPct) / 400, proteinG: (kcal * proteinPct) / 400, fatG: (kcal * fatPct) / 900 };
}
/** Naegele's rule adjusted for cycle length: due date = LMP + 280 days + (cycle - 28). */
export function dueDate(lmpMs, cycleDays = 28) {
  const DAY = 86400000;
  return { due: lmpMs + (280 + (cycleDays - 28)) * DAY, conception: lmpMs + (14 + (cycleDays - 28)) * DAY };
}
export function pace(distanceKm, minutes) {
  if (!(distanceKm > 0) || !(minutes > 0)) throw new Error('Distance and time must be above zero');
  const perKm = minutes / distanceKm;
  return { perKm, perMile: perKm * 1.609344, speedKmh: (distanceKm / minutes) * 60 };
}
export function clockToMinutes(text) {
  const parts = String(text).trim().split(':').map(Number);
  if (parts.some((x) => !Number.isFinite(x) || x < 0) || parts.length > 3 || !parts.length) throw new Error('Use h:mm:ss, m:ss or minutes');
  return parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts.length === 2 ? parts[0] + parts[1] / 60 : parts[0];
}
export function minutesToClock(min) {
  const total = Math.round(min * 60), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/* ---------------- percentages, ratios, averages ---------------- */
export const pctOf = (p, y) => (p / 100) * y;
export const whatPct = (x, y) => { if (y === 0) throw new Error('The total cannot be zero'); return (x / y) * 100; };
export function pctChange(from, to) { if (from === 0) throw new Error('The starting value cannot be zero'); return ((to - from) / Math.abs(from)) * 100; }
export const pctDifference = (a, b) => { if (a + b === 0) throw new Error('The values cannot cancel out'); return (Math.abs(a - b) / ((Math.abs(a) + Math.abs(b)) / 2)) * 100; };
export const reversePct = (x, p) => { if (p === 0) throw new Error('The percentage cannot be zero'); return (x * 100) / p; };
export function simplifyRatio(parts) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const scale = 10 ** Math.max(...parts.map((p) => (String(p).split('.')[1] || '').length));
  const ints = parts.map((p) => Math.round(p * scale));
  const g = ints.reduce(gcd);
  return ints.map((v) => v / g);
}
export function solveProportion(a, b, c, d) {
  const unknown = [a, b, c, d].map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  if (unknown.length !== 1) throw new Error('Leave exactly one of the four boxes empty');
  const u = unknown[0];
  // a/b = c/d
  if (u === 0) { if (d === 0) throw new Error('Cannot divide by zero'); return (b * c) / d; }
  if (u === 1) { if (c === 0) throw new Error('Cannot divide by zero'); return (a * d) / c; }
  if (u === 2) { if (b === 0) throw new Error('Cannot divide by zero'); return (a * d) / b; }
  if (a === 0) throw new Error('Cannot divide by zero');
  return (b * c) / a;
}
export const weightedAverage = (pairs) => {
  const w = pairs.reduce((s, p) => s + p[1], 0);
  if (w === 0) throw new Error('Weights add up to zero');
  return pairs.reduce((s, p) => s + p[0] * p[1], 0) / w;
};
export const GRADE_POINTS = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, F: 0 };

/* ---------------- everyday estimators ---------------- */
export function paint(length, width, height, openingsArea, coats, coveragePerLitre) {
  const walls = 2 * (length + width) * height - openingsArea;
  if (walls <= 0) throw new Error('Openings are larger than the wall area');
  return { wallArea: walls, litres: (walls * coats) / coveragePerLitre };
}
export function tiles(roomArea, tileLength, tileWidth, wastePct) {
  const one = tileLength * tileWidth;
  if (!(one > 0)) throw new Error('Tile size must be above zero');
  const exact = roomArea / one;
  return { exact, withWaste: Math.ceil(exact * (1 + wastePct / 100)), tileArea: one };
}
export function concrete(length, width, thickness, bagYield, wastePct) {
  const volume = length * width * thickness * (1 + wastePct / 100);
  return { volume, bags: Math.ceil(volume / bagYield - 1e-9) };
}
export function electricity(items, ratePerKwh, days) {
  const rows = items.map((it) => { const kwhDay = (it.watts * it.hours * it.qty) / 1000; return { ...it, kwhDay, kwh: kwhDay * days, cost: kwhDay * days * ratePerKwh }; });
  return { rows, kwh: rows.reduce((s, r) => s + r.kwh, 0), cost: rows.reduce((s, r) => s + r.cost, 0) };
}
export function fuelCost(distance, efficiency, price, mode) {
  // mode: 'per100' (litres per 100 distance units) or 'perUnit' (distance per litre)
  const litres = mode === 'per100' ? (distance * efficiency) / 100 : distance / efficiency;
  return { litres, cost: litres * price, costPerUnit: (litres * price) / distance };
}
export const dataTransferSeconds = (sizeBytes, mbps) => (sizeBytes * 8) / (mbps * 1e6);

/* ---------------- science ---------------- */
export const G = 9.80665;
export function ohm({ v, i, r, p }) {
  const given = { v, i, r, p };
  const known = Object.entries(given).filter(([, x]) => x !== null && x !== undefined && !Number.isNaN(x));
  if (known.length !== 2) throw new Error('Enter exactly two of voltage, current, resistance and power');
  const k = Object.fromEntries(known);
  let V = k.v, I = k.i, R = k.r, P = k.p;
  if (V !== undefined && I !== undefined) { R = V / I; P = V * I; }
  else if (V !== undefined && R !== undefined) { I = V / R; P = (V * V) / R; }
  else if (V !== undefined && P !== undefined) { I = P / V; R = (V * V) / P; }
  else if (I !== undefined && R !== undefined) { V = I * R; P = I * I * R; }
  else if (I !== undefined && P !== undefined) { V = P / I; R = P / (I * I); }
  else { V = Math.sqrt(P * R); I = Math.sqrt(P / R); }
  return { v: V, i: I, r: R, p: P };
}
export function projectile(v0, angleDeg, h0 = 0, g = G) {
  const t = (angleDeg * Math.PI) / 180, vx = v0 * Math.cos(t), vy = v0 * Math.sin(t);
  const flight = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  return { flight, range: vx * flight, maxHeight: h0 + (vy * vy) / (2 * g), vx, vy, impactSpeed: Math.sqrt(vx * vx + (vy - g * flight) ** 2) };
}
export const R_GAS = 8.31446261815324;
/** Ideal gas PV = nRT with SI units (Pa, m3, mol, K). Pass null for the unknown. */
export function idealGas(P, V, n, T) {
  const nulls = [P, V, n, T].filter((x) => x === null).length;
  if (nulls !== 1) throw new Error('Leave exactly one value empty');
  if (P === null) return { P: (n * R_GAS * T) / V };
  if (V === null) return { V: (n * R_GAS * T) / P };
  if (n === null) return { n: (P * V) / (R_GAS * T) };
  return { T: (P * V) / (n * R_GAS) };
}
export const halfLife = (n0, halfLifeT, t) => ({ remaining: n0 * Math.pow(0.5, t / halfLifeT), fractionDecayed: 1 - Math.pow(0.5, t / halfLifeT) });
export const pH = { fromH: (h) => -Math.log10(h), toH: (ph) => Math.pow(10, -ph) };

export const ATOMIC_MASS = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085,
  P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078, Ti: 47.867, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546,
  Zn: 65.38, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Sr: 87.62, Mo: 95.95, Pd: 106.42, Ag: 107.87, Cd: 112.41, Sn: 118.71, I: 126.904, Xe: 131.29,
  Ba: 137.327, W: 183.84, Pt: 195.084, Au: 196.967, Hg: 200.59, Pb: 207.2, U: 238.029,
};
/** Molar mass of a formula such as Ca(OH)2 or C6H12O6. Returns {mass, counts}. */
export function molarMass(formula) {
  const s = String(formula).replace(/\s+/g, '');
  if (!s) throw new Error('Enter a chemical formula such as H2O');
  let i = 0;
  const parseGroup = () => {
    const counts = {};
    while (i < s.length && s[i] !== ')') {
      if (s[i] === '(') {
        i++;
        const inner = parseGroup();
        if (s[i] !== ')') throw new Error('Unbalanced parentheses');
        i++;
        const k = readNum();
        for (const [el, c] of Object.entries(inner)) counts[el] = (counts[el] || 0) + c * k;
      } else {
        const m = /^[A-Z][a-z]?/.exec(s.slice(i));
        if (!m) throw new Error(`Unexpected "${s[i]}" in the formula`);
        if (!(m[0] in ATOMIC_MASS)) throw new Error(`Unknown element "${m[0]}"`);
        i += m[0].length;
        counts[m[0]] = (counts[m[0]] || 0) + readNum();
      }
    }
    return counts;
  };
  const readNum = () => { const m = /^\d+/.exec(s.slice(i)); if (m) { i += m[0].length; return Number(m[0]); } return 1; };
  const counts = parseGroup();
  if (i < s.length) throw new Error('Unbalanced parentheses');
  return { counts, mass: Object.entries(counts).reduce((t, [el, c]) => t + ATOMIC_MASS[el] * c, 0) };
}
