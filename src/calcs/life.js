import * as L from '../lib/life.js';
import * as T from '../lib/dates.js';
import { smartPct } from './pctutil.js';
import { money, num, int, pct, text, fnum, fint, fselect, farea, ftext, fdate, fcheck, need } from './helpers.js';

const SEX = [['male', 'Male'], ['female', 'Female']];
const H = 'health', DT = 'dates', P = 'percent', E = 'everyday', S = 'science';
const ZONES = ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'America/Toronto', 'America/Mexico_City', 'Pacific/Honolulu'];
const lenHint = 'cm';
const dayLabel = (n) => `${n} day${n === 1 ? '' : 's'}`;
const parseWeekend = (s) => (s === 'fri-sat' ? [5, 6] : s === 'sun' ? [0] : s === 'none' ? [] : [0, 6]);

export const life = [
  /* ---------- health ---------- */
  {
    id: 'bmi', cat: H, title: 'BMI', desc: 'Body mass index and the healthy weight range for your height. BMI is a screening tool, not a diagnosis.', keywords: 'bmi body mass index weight height obesity overweight',
    inputs: [fnum('kg', 'Weight', 70, { unit: 'kg', min: 1, max: 700, step: 'any' }), fnum('cm', 'Height', 175, { unit: lenHint, min: 30, max: 275, step: 'any' })],
    run(v, env) {
      const r = L.bmi(v.kg, v.cm);
      return { stats: [num('BMI', r.value, { primary: true, sub: r.category, digits: 1 }), text('WHO category', r.category), text('South/East Asian cut-offs', r.asian, { sub: 'overweight from 23, obese from 27.5' }), text('Healthy weight range', `${env.num(r.healthyMin)} to ${env.num(r.healthyMax)} kg`)], steps: [`BMI = weight (kg) / height (m)^2 = ${v.kg} / ${(v.cm / 100).toFixed(2)}^2 = ${env.num(r.value)}`], note: 'BMI ignores muscle mass, age and body shape. Cut-offs differ for children and some populations.' };
    },
  },
  {
    id: 'bmr-tdee', cat: H, title: 'BMR and daily calories (TDEE)', desc: 'Resting energy use and daily calories from three formulas. Estimates vary by about 10%.', keywords: 'bmr tdee calories basal metabolic rate maintenance mifflin harris katch daily calorie',
    inputs: [fselect('sex', 'Sex', SEX), fint('age', 'Age', 30, { unit: 'years', min: 10, max: 110 }), fnum('kg', 'Weight', 70, { unit: 'kg', min: 1, max: 700, step: 'any' }), fnum('cm', 'Height', 175, { unit: 'cm', min: 30, max: 275, step: 'any' }), fselect('act', 'Activity level', L.ACTIVITY.map((a) => [String(a.value), a.label]), '1.375'), fnum('bf', 'Body fat (for Katch-McArdle, optional)', 0, { unit: '%', min: 0, max: 69, step: 'any' })],
    run(v) {
      const m = L.bmr('mifflin', v.sex, v.kg, v.cm, v.age), h = L.bmr('harris', v.sex, v.kg, v.cm, v.age), a = Number(v.act);
      const stats = [num('BMR (Mifflin-St Jeor)', m, { primary: true, u: 'kcal/day', digits: 0 }), num('Maintenance calories (TDEE)', m * a, { u: 'kcal/day', digits: 0 }), num('BMR (Harris-Benedict, revised)', h, { u: 'kcal/day', digits: 0 })];
      if (v.bf >= 2) stats.push(num('BMR (Katch-McArdle)', L.bmr('katch', v.sex, v.kg, v.cm, v.age, v.bf), { u: 'kcal/day', digits: 0 }));
      stats.push(num('To lose about 0.5 kg per week', m * a - 500, { u: 'kcal/day', digits: 0 }), num('To gain about 0.5 kg per week', m * a + 500, { u: 'kcal/day', digits: 0 }));
      return { stats, steps: ['Mifflin-St Jeor: 10 x kg + 6.25 x cm - 5 x age + 5 (male) or - 161 (female)', 'TDEE = BMR x activity factor'], note: 'Do not eat below about 1200 (women) or 1500 (men) kcal a day without medical supervision.' };
    },
  },
  {
    id: 'body-fat', cat: H, title: 'Body fat', desc: 'Estimate body fat with the U.S. Navy circumference method or a BMI-based formula.', keywords: 'body fat percentage navy method lean mass',
    inputs: [fselect('sex', 'Sex', SEX), fnum('cm', 'Height', 180, { unit: 'cm', min: 100, max: 250, step: 'any' }), fnum('neck', 'Neck', 38, { unit: 'cm', min: 10, max: 80, step: 'any' }), fnum('waist', 'Waist (at navel)', 90, { unit: 'cm', min: 30, max: 250, step: 'any' }), fnum('hip', 'Hip (women)', 98, { unit: 'cm', min: 30, max: 250, step: 'any', showIf: (v) => v.sex === 'female' }), fnum('kg', 'Weight', 80, { unit: 'kg', min: 1, max: 700, step: 'any' })],
    run(v) {
      const bf = L.bodyFatNavy(v.sex, v.cm, v.neck, v.waist, v.hip);
      need(bf > 0 && bf < 70, 'Those measurements give an unrealistic result: check them');
      return { stats: [pct('Body fat (Navy method)', bf, { primary: true }), text('Category', L.bodyFatCategory(v.sex, bf)), num('Fat mass', (v.kg * bf) / 100, { u: 'kg' }), num('Lean mass', v.kg * (1 - bf / 100), { u: 'kg' })], note: 'The Navy method is typically within 3 to 4 percentage points of DEXA scans.' };
    },
  },
  {
    id: 'ideal-weight', cat: H, title: 'Ideal weight', desc: 'Four classic formulas (Devine, Robinson, Miller, Hamwi).', keywords: 'ideal weight healthy devine robinson miller hamwi',
    inputs: [fselect('sex', 'Sex', SEX), fnum('cm', 'Height', 175, { unit: 'cm', min: 100, max: 250, step: 'any' })],
    run(v) { const w = L.idealWeights(v.sex, v.cm); return { stats: Object.entries(w).map(([k, x], i) => num(k, x, { u: 'kg', primary: i === 0 })), note: 'These formulas were built for adults of average frame. They are rough guides only.' }; },
  },
  {
    id: 'heart-rate', cat: H, title: 'Heart rate zones', desc: 'Training zones using the heart rate reserve (Karvonen) method and Tanaka maximum heart rate.', keywords: 'heart rate zones maximum karvonen tanaka training cardio',
    inputs: [fint('age', 'Age', 35, { min: 10, max: 100 }), fint('rest', 'Resting heart rate', 60, { unit: 'bpm', min: 30, max: 120 })],
    run(v) { const z = L.heartZones(v.age, v.rest), mh = L.maxHeartRate(v.age); return { stats: [int('Max heart rate (Tanaka)', Math.round(mh.tanaka), { primary: true, u: 'bpm' }), int('Max heart rate (220 - age)', mh.classic, { u: 'bpm' })], table: { title: 'Zones', cols: ['Zone', 'From (bpm)', 'To (bpm)'], kinds: ['text', 'int', 'int'], rows: z.map((x) => [x.name, x.low, x.high]) } }; },
  },
  {
    id: 'calories-burned', cat: H, title: 'Calories burned', desc: 'Energy used by an activity from its MET value: kcal = MET x kg x hours.', keywords: 'calories burned exercise met walking running cycling workout',
    inputs: [fselect('a', 'Activity', [['3.5', 'Walking (5 km/h) - 3.5'], ['8.3', 'Running (8 km/h) - 8.3'], ['9.8', 'Running (10 km/h) - 9.8'], ['7.5', 'Cycling (20 km/h) - 7.5'], ['6', 'Swimming (easy) - 6'], ['3', 'Yoga - 3'], ['5', 'Dancing - 5'], ['6.5', 'Hiking - 6.5'], ['4', 'Weight training - 4'], ['2.3', 'Housework - 2.3']], '3.5'), fnum('kg', 'Weight', 70, { unit: 'kg', min: 1, max: 700, step: 'any' }), fnum('min', 'Duration', 45, { unit: 'minutes', min: 1, max: 1440, step: 'any' })],
    run(v) { const k = L.caloriesBurned(Number(v.a), v.kg, v.min); return { stats: [num('Calories burned', k, { primary: true, u: 'kcal', digits: 0 }), num('Equivalent in kJ', k * 4.184, { digits: 0 })], note: 'MET values are averages from the Compendium of Physical Activities.' }; },
  },
  {
    id: 'water-intake', cat: H, title: 'Daily water intake', desc: 'A rough guide: about 33 ml per kg of body weight plus exercise and heat.', keywords: 'water intake hydration drink daily litres',
    inputs: [fnum('kg', 'Weight', 70, { unit: 'kg', min: 1, max: 700, step: 'any' }), fnum('ex', 'Exercise per day', 30, { unit: 'minutes', min: 0, max: 600 }), fcheck('hot', 'Hot climate', false)],
    run(v) { const ml = L.waterIntakeMl(v.kg, v.ex, v.hot); return { stats: [num('Per day', ml / 1000, { primary: true, u: 'litres' }), num('Glasses of 250 ml', ml / 250, { digits: 1 })], note: 'Needs vary with health, diet and medication. Food supplies part of your water.' }; },
  },
  {
    id: 'macros', cat: H, title: 'Macronutrient split', desc: 'Grams of carbs, protein and fat for a calorie target.', keywords: 'macros macronutrients protein carbs fat grams diet',
    inputs: [fnum('k', 'Daily calories', 2000, { unit: 'kcal', min: 500, max: 10000 }), fnum('c', 'Carbs', 50, { unit: '%', min: 0, max: 100 }), fnum('p', 'Protein', 25, { unit: '%', min: 0, max: 100 }), fnum('f', 'Fat', 25, { unit: '%', min: 0, max: 100 })],
    run(v) { const m = L.macros(v.k, v.c, v.p, v.f); return { stats: [num('Carbohydrate', m.carbsG, { u: 'g', digits: 0, primary: true }), num('Protein', m.proteinG, { u: 'g', digits: 0 }), num('Fat', m.fatG, { u: 'g', digits: 0 })], steps: ['Carbs and protein provide 4 kcal per gram, fat 9 kcal per gram'] }; },
  },
  {
    id: 'due-date', cat: H, title: 'Pregnancy due date', desc: 'Estimated due date from the first day of the last period (Naegele rule). Only an estimate; follow your doctor.', keywords: 'pregnancy due date calculator lmp conception gestational age weeks trimester',
    inputs: [fdate('lmp', 'First day of last period', '@today-84'), fint('cycle', 'Cycle length', 28, { unit: 'days', min: 21, max: 45 })],
    run(v, env) {
      const r = L.dueDate(v.lmp, v.cycle), today = env.today, days = T.diffDays(v.lmp, today);
      const weeks = Math.floor(days / 7), tri = weeks < 14 ? 'First' : weeks < 28 ? 'Second' : 'Third';
      return { stats: [text('Estimated due date', T.formatLong(r.due), { primary: true }), text('Estimated conception', T.formatLong(r.conception)), text('Today you are', days < 0 ? 'before the start date' : days > 294 ? 'past 42 weeks' : `${weeks} weeks ${days % 7} days`, { sub: days >= 0 && days <= 294 ? `${tri} trimester` : '' }), int('Days to go', Math.max(0, T.diffDays(today, r.due)))] };
    },
  },
  {
    id: 'pace', cat: H, title: 'Running pace', desc: 'Pace per km and mile, speed and projected race times.', keywords: 'running pace speed marathon 5k 10k race time',
    inputs: [fnum('d', 'Distance', 10, { unit: 'km', min: 0.01, step: 'any' }), ftext('t', 'Time (h:mm:ss or m:ss)', '50:00')],
    run(v) {
      const min = L.clockToMinutes(v.t), p = L.pace(v.d, min);
      return { stats: [text('Pace per km', `${L.minutesToClock(p.perKm)} /km`, { primary: true }), text('Pace per mile', `${L.minutesToClock(p.perMile)} /mi`), num('Speed', p.speedKmh, { u: 'km/h' })], table: { title: 'Projected race times at this pace', cols: ['Race', 'Time'], kinds: ['text', 'text'], rows: [['5 km', 5], ['10 km', 10], ['Half marathon (21.0975 km)', 21.0975], ['Marathon (42.195 km)', 42.195]].map(([n, k]) => [n, L.minutesToClock(p.perKm * k)]) } };
    },
  },
  {
    id: 'sleep', cat: H, title: 'Sleep cycles', desc: 'Bed or wake times that fit whole 90-minute sleep cycles.', keywords: 'sleep cycles bedtime wake up time rem',
    inputs: [ftext('wake', 'I want to wake up at (HH:MM, 24 h)', '06:30'), fint('fall', 'Minutes to fall asleep', 15, { min: 0, max: 90 })],
    run(v) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(v.wake.trim());
      need(m && Number(m[1]) < 24 && Number(m[2]) < 60, 'Use 24-hour time such as 06:30');
      const wake = Number(m[1]) * 60 + Number(m[2]);
      const clock = (x) => { x = ((x % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
      const rows = [6, 5, 4, 3].map((c) => [`${c} cycles (${c * 1.5} h)`, clock(wake - c * 90 - v.fall)]);
      return { stats: [text('Best bedtime', rows[0][1], { primary: true, sub: '6 cycles, 9 hours' }), text('Also good', rows[1][1], { sub: '5 cycles, 7.5 hours' })], table: { title: 'Go to bed at', cols: ['Sleep', 'Bedtime'], kinds: ['text', 'text'], rows } };
    },
  },
  /* ---------- dates ---------- */
  {
    id: 'age', cat: DT, title: 'Age calculator', desc: 'Exact age in years, months and days, plus the next birthday.', keywords: 'age calculator birthday date of birth how old',
    inputs: [fdate('dob', 'Date of birth', '1995-06-15'), fdate('on', 'Age on', '@today')],
    run(v) {
      need(v.on >= v.dob, 'The date must be after the birth date');
      const a = T.ymd(v.dob, v.on), p = T.parts(v.dob), po = T.parts(v.on);
      let next = T.utc(po.y, p.m, Math.min(p.d, T.daysInMonth(po.y, p.m)));
      if (next < v.on) next = T.utc(po.y + 1, p.m, Math.min(p.d, T.daysInMonth(po.y + 1, p.m)));
      const days = T.diffDays(v.dob, v.on);
      return { stats: [text('Age', `${a.years} years, ${a.months} months, ${a.days} days`, { primary: true }), int('Total days', days), int('Total weeks', Math.floor(days / 7)), int('Total months', a.years * 12 + a.months), int('Total hours', days * 24), text('Next birthday', `${T.formatLong(next)} (in ${dayLabel(T.diffDays(v.on, next))})`), text('Born on a', T.weekday(v.dob))] };
    },
  },
  {
    id: 'date-difference', cat: DT, title: 'Date difference', desc: 'Time between two dates in years, months, weeks and days.', keywords: 'date difference days between dates duration how many days',
    inputs: [fdate('a', 'From', '2026-01-01'), fdate('b', 'To', '@today+100'), fcheck('inc', 'Count the end date too', false)],
    run(v) {
      const n = Math.abs(T.diffDays(v.a, v.b)) + (v.inc ? 1 : 0), x = T.ymd(v.a, v.b);
      return { stats: [int('Days', n, { primary: true }), text('Years, months, days', `${x.years}y ${x.months}m ${x.days}d`), text('Weeks and days', `${Math.floor(n / 7)} weeks ${n % 7} days`), int('Hours', n * 24), int('Weekdays (Mon-Fri)', T.workingDays(Math.min(v.a, v.b), Math.max(v.a, v.b)) - (v.inc ? 0 : 0))] };
    },
  },
  {
    id: 'add-dates', cat: DT, title: 'Add or subtract time from a date', desc: 'Date plus or minus years, months, weeks and days.', keywords: 'add days to date subtract date plus minus calendar after before',
    inputs: [fdate('d', 'Start date', '@today'), fselect('op', 'Operation', [['+', 'Add'], ['-', 'Subtract']]), fint('y', 'Years', 0, { min: 0, max: 1000 }), fint('m', 'Months', 0, { min: 0, max: 12000 }), fint('w', 'Weeks', 0, { min: 0, max: 50000 }), fint('dd', 'Days', 90, { min: 0, max: 400000 })],
    run(v) {
      const s = v.op === '-' ? -1 : 1;
      let t = T.addMonths(v.d, s * (v.y * 12 + v.m));
      t = T.addDays(t, s * (v.w * 7 + v.dd));
      return { stats: [text('Result', T.formatLong(t), { primary: true }), text('ISO date', T.toISO(t)), int('Total days from start', Math.abs(T.diffDays(v.d, t)))] };
    },
  },
  {
    id: 'working-days', cat: DT, title: 'Working days', desc: 'Business days between dates, or a date N working days away. Add holidays as YYYY-MM-DD.', keywords: 'working days business days workdays weekdays holidays deadline',
    inputs: [fdate('a', 'Start date', '@today'), fselect('mode', 'Find', [['between', 'Working days up to an end date'], ['add', 'Date after N working days']]), fdate('b', 'End date', '@today+30', { showIf: (v) => v.mode === 'between' }), fint('n', 'Working days to add', 10, { min: -5000, max: 5000, showIf: (v) => v.mode === 'add' }), fselect('we', 'Weekend', [['sat-sun', 'Saturday and Sunday'], ['fri-sat', 'Friday and Saturday'], ['sun', 'Sunday only'], ['none', 'No weekend']]), farea('h', 'Holidays (optional, one per line)', '', { rows: 3, optional: true })],
    run(v) {
      const holidays = v.h.split(/[\s,;]+/).filter(Boolean).map(T.parseISO);
      need(holidays.every((x) => !Number.isNaN(x)), 'Holidays must be dates like 2026-12-25');
      const we = parseWeekend(v.we);
      if (v.mode === 'add') { const t = T.addWorkingDays(v.a, v.n, we, holidays); return { stats: [text('Result', T.formatLong(t), { primary: true }), text('ISO date', T.toISO(t))] }; }
      const n = T.workingDays(v.a, v.b, we, holidays);
      return { stats: [int('Working days (inclusive)', n, { primary: true }), int('Calendar days', Math.abs(T.diffDays(v.a, v.b)) + 1), int('Non-working days', Math.abs(T.diffDays(v.a, v.b)) + 1 - n)] };
    },
  },
  {
    id: 'countdown', cat: DT, title: 'Countdown to a date', desc: 'Days, weeks and months until (or since) an event.', keywords: 'countdown days until event deadline holiday christmas',
    inputs: [fdate('d', 'Event date', '@today+45'), ftext('name', 'Event name', 'My event', { optional: true })],
    run(v, env) {
      const n = T.diffDays(env.today, v.d), a = Math.abs(n), x = T.ymd(env.today, v.d);
      return { stats: [text(n >= 0 ? 'Time to go' : 'Time since', n === 0 ? 'Today!' : dayLabel(a), { primary: true, sub: v.name || '' }), text('In years, months, days', `${x.years}y ${x.months}m ${x.days}d`), int('Weeks', Math.floor(a / 7)), int('Hours', a * 24), text('Falls on', T.formatLong(v.d))] };
    },
  },
  {
    id: 'time-zones', cat: DT, title: 'Time zone converter', desc: 'Convert a local date and time between world time zones, daylight saving included.', keywords: 'time zone converter world clock utc gmt est pst ist meeting planner',
    inputs: [fdate('d', 'Date', '@today'), ftext('t', 'Time (HH:MM)', '09:00'), fselect('from', 'From zone', ZONES.map((z) => [z, z.replace(/_/g, ' ')]), 'Asia/Kolkata'), fselect('to', 'To zone', ZONES.map((z) => [z, z.replace(/_/g, ' ')]), 'America/New_York')],
    run(v) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(v.t.trim());
      need(m && Number(m[1]) < 24 && Number(m[2]) < 60, 'Use 24-hour time such as 09:00');
      const wall = v.d + (Number(m[1]) * 60 + Number(m[2])) * 60000;
      const inst = T.wallToInstant(wall, v.from);
      const rows = ['UTC', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'America/New_York', 'America/Los_Angeles'].map((z) => [z.replace(/_/g, ' '), T.formatInZone(inst, z)]);
      return { stats: [text(v.to.replace(/_/g, ' '), T.formatInZone(inst, v.to), { primary: true }), text('UTC', T.formatInZone(inst, 'UTC'))], table: { title: 'Same moment elsewhere', cols: ['Zone', 'Local time'], kinds: ['text', 'text'], rows } };
    },
  },
  {
    id: 'day-of-week', cat: DT, title: 'Day of the week and calendar facts', desc: 'Which weekday a date falls on, day of year, week number and leap year.', keywords: 'day of week weekday date calendar leap year week number day of year',
    inputs: [fdate('d', 'Date', '2026-12-25')],
    run(v) {
      const p = T.parts(v.d), doy = T.diffDays(T.utc(p.y, 1, 1), v.d) + 1;
      const dow = (new Date(v.d).getUTCDay() + 6) % 7; // Monday = 0
      const th = v.d + (3 - dow) * T.DAY, ft = T.parts(th).y, w1 = T.utc(ft, 1, 4);
      const week = 1 + Math.floor((th - (w1 - ((new Date(w1).getUTCDay() + 6) % 7) * T.DAY)) / (7 * T.DAY));
      return { stats: [text('Weekday', T.weekday(v.d), { primary: true }), int('Day of the year', doy), int('ISO week number', week), text('Leap year?', T.isLeap(p.y) ? 'Yes' : 'No'), int('Days in this month', T.daysInMonth(p.y, p.m))] };
    },
  },
  /* ---------- percentages and ratios ---------- */
  {
    id: 'percentage', cat: P, title: 'Percentage calculator', desc: 'All the common percentage questions in one place.', keywords: 'percentage percent calculator of what is increase decrease change difference reverse',
    inputs: [fselect('mode', 'What do you want to find?', [['of', 'X% of Y'], ['whatpct', 'X is what % of Y'], ['change', '% change from X to Y'], ['inc', 'Increase X by Y%'], ['dec', 'Decrease X by Y%'], ['reverse', 'X is Y% of what number'], ['diff', '% difference between X and Y']]), fnum('x', 'X', 15, { step: 'any' }), fnum('y', 'Y', 200, { step: 'any' })],
    run: smartPct,
  },
  {
    id: 'ratio', cat: P, title: 'Ratio and proportion', desc: 'Simplify a ratio or solve a : b = c : d with one box left empty.', keywords: 'ratio proportion simplify scale cross multiply',
    inputs: [fselect('mode', 'Mode', [['simplify', 'Simplify a ratio'], ['solve', 'Solve a : b = c : d']]), ftext('r', 'Ratio parts (e.g. 12 18 24)', '12 18 24', { showIf: (v) => v.mode === 'simplify' }), fnum('a', 'a', 2, { optional: true, step: 'any', showIf: (v) => v.mode === 'solve' }), fnum('b', 'b', 3, { optional: true, step: 'any', showIf: (v) => v.mode === 'solve' }), fnum('c', 'c', 8, { optional: true, step: 'any', showIf: (v) => v.mode === 'solve' }), fnum('d', 'd (leave empty to solve)', null, { optional: true, step: 'any', showIf: (v) => v.mode === 'solve' })],
    run(v) {
      if (v.mode === 'simplify') { const parts = L.simplifyRatio(require_parts(v.r)); return { stats: [text('Simplified ratio', parts.join(' : '), { primary: true })] }; }
      const x = L.solveProportion(v.a, v.b, v.c, v.d);
      return { stats: [num('Missing value', x, { primary: true })], steps: ['a / b = c / d, so cross-multiply: a x d = b x c'] };
    },
  },
  {
    id: 'average', cat: P, title: 'Average and weighted average', desc: 'Mean of a list, or a weighted mean from value, weight pairs.', keywords: 'average mean weighted average sum count',
    inputs: [fselect('mode', 'Type', [['plain', 'Simple average'], ['weighted', 'Weighted average']]), farea('d', 'Values (plain) or "value, weight" per line (weighted)', '85\n90\n78\n92', { rows: 5 })],
    run(v) {
      if (v.mode === 'plain') { const ns = require_parts(v.d); return { stats: [num('Average', ns.reduce((a, b) => a + b, 0) / ns.length, { primary: true }), num('Sum', ns.reduce((a, b) => a + b, 0)), int('Count', ns.length)] }; }
      const pairs = v.d.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,;]+/).map(Number));
      need(pairs.length && pairs.every((p) => p.length === 2 && p.every(Number.isFinite)), 'Each line needs "value, weight"');
      return { stats: [num('Weighted average', L.weightedAverage(pairs), { primary: true }), num('Total weight', pairs.reduce((s, p) => s + p[1], 0))] };
    },
  },
  {
    id: 'gpa', cat: P, title: 'GPA calculator', desc: 'Grade point average on the 4.0 scale from letter grades and credits.', keywords: 'gpa grade point average college university letter grades credits',
    inputs: [farea('d', 'One course per line: grade, credits (e.g. A-, 3)', 'A, 4\nB+, 3\nA-, 3\nB, 2', { rows: 6 })],
    run(v) {
      const rows = v.d.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [g, c] = l.split(/[\s,;]+/); return [String(g).toUpperCase(), Number(c)]; });
      need(rows.length && rows.every(([g, c]) => g in L.GRADE_POINTS && c > 0), 'Use grades A+, A, A-, B+ ... F and positive credits');
      const credits = rows.reduce((s, r) => s + r[1], 0), points = rows.reduce((s, r) => s + L.GRADE_POINTS[r[0]] * r[1], 0);
      return { stats: [num('GPA', points / credits, { primary: true, digits: 2 }), num('Total credits', credits), num('Quality points', points)], note: 'A+ is counted as 4.0. Some schools use 4.3 for A+ or different plus/minus values.' };
    },
  },
  {
    id: 'cgpa', cat: P, title: 'CGPA and percentage', desc: 'Cumulative GPA from semester GPAs and credits, with an approximate percentage.', keywords: 'cgpa sgpa percentage convert cbse university grade',
    inputs: [farea('d', 'One semester per line: SGPA, credits', '8.2, 22\n8.6, 24\n7.9, 20', { rows: 5 }), fnum('f', 'Percentage factor (CBSE uses 9.5)', 9.5, { min: 1, max: 20, step: 'any' })],
    run(v) {
      const rows = v.d.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,;]+/).map(Number));
      need(rows.length && rows.every((r) => r.length === 2 && r[0] >= 0 && r[1] > 0), 'Each line needs "SGPA, credits"');
      const cg = rows.reduce((s, r) => s + r[0] * r[1], 0) / rows.reduce((s, r) => s + r[1], 0);
      return { stats: [num('CGPA', cg, { primary: true, digits: 2 }), pct('Approximate percentage', cg * v.f)], note: 'Conversion rules differ between universities. Use your institution\'s official formula.' };
    },
  },
  /* ---------- everyday ---------- */
  {
    id: 'fuel-cost', cat: E, title: 'Fuel cost and trip cost', desc: 'Fuel needed and cost for a trip.', keywords: 'fuel cost trip petrol diesel gas mileage mpg km per litre travel',
    inputs: [fnum('d', 'Distance', 450, { unit: 'km', min: 0.01, step: 'any' }), fselect('mode', 'Efficiency given as', [['perUnit', 'Distance per litre (km/L)'], ['per100', 'Litres per 100 km']]), fnum('e', 'Efficiency', 15, { min: 0.01, step: 'any' }), fnum('p', 'Fuel price per litre', 100, { min: 0, step: 'any' }), fint('n', 'People sharing', 1, { min: 1, max: 50 })],
    run(v) { const r = L.fuelCost(v.d, v.e, v.p, v.mode); return { stats: [money('Trip fuel cost', r.cost, { primary: true }), num('Fuel needed', r.litres, { u: 'litres' }), money('Cost per km', r.costPerUnit), money('Per person', r.cost / v.n)] }; },
  },
  {
    id: 'electricity', cat: E, title: 'Electricity bill', desc: 'Energy use and cost of appliances. One appliance per line: name, watts, hours per day, quantity.', keywords: 'electricity bill power consumption kwh appliances cost units',
    inputs: [farea('a', 'Name, watts, hours per day, quantity', 'LED bulb, 9, 6, 8\nFan, 75, 10, 3\nRefrigerator, 150, 8, 1\nAC 1.5 ton, 1500, 6, 1', { rows: 6 }), fnum('rate', 'Price per kWh (unit)', 8, { min: 0, step: 'any' }), fint('days', 'Days', 30, { min: 1, max: 366 })],
    run(v) {
      const items = v.a.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const p = l.split(','); return { name: p[0].trim(), watts: Number(p[1]), hours: Number(p[2]), qty: p[3] === undefined || p[3].trim() === '' ? 1 : Number(p[3]) }; });
      need(items.length && items.every((i) => [i.watts, i.hours, i.qty].every(Number.isFinite) && i.watts >= 0 && i.hours >= 0 && i.hours <= 24), 'Each line needs: name, watts, hours per day (0-24), quantity');
      const r = L.electricity(items, v.rate, v.days);
      return { stats: [money('Estimated bill', r.cost, { primary: true }), num('Energy used', r.kwh, { u: 'kWh' }), money('Per day', r.cost / v.days)], table: { title: 'By appliance', cols: ['Appliance', 'kWh', 'Cost'], kinds: ['text', 'num', 'money'], rows: r.rows.map((x) => [x.name, x.kwh, x.cost]) }, note: 'Ignores fixed charges, slabs and taxes on your bill.' };
    },
  },
  {
    id: 'paint', cat: E, title: 'Paint estimator', desc: 'Litres of paint for the walls of a room.', keywords: 'paint estimator walls room litres coverage coats',
    inputs: [fnum('l', 'Room length', 5, { unit: 'm', min: 0.1, step: 'any' }), fnum('w', 'Room width', 4, { unit: 'm', min: 0.1, step: 'any' }), fnum('h', 'Wall height', 2.7, { unit: 'm', min: 0.1, step: 'any' }), fnum('o', 'Doors and windows area', 4, { unit: 'm2', min: 0, step: 'any' }), fint('c', 'Coats', 2, { min: 1, max: 6 }), fnum('cov', 'Coverage', 10, { unit: 'm2 per litre', min: 1, step: 'any' })],
    run(v) { const r = L.paint(v.l, v.w, v.h, v.o, v.c, v.cov); return { stats: [num('Paint needed', r.litres, { primary: true, u: 'litres' }), num('Paintable wall area', r.wallArea, { u: 'm2' }), int('Cans of 4 litres', Math.ceil(r.litres / 4))], note: 'Add 5 to 10% for waste. Coverage depends on the paint and surface.' }; },
  },
  {
    id: 'tiles', cat: E, title: 'Tile estimator', desc: 'Number of tiles for a floor or wall, with wastage.', keywords: 'tiles flooring estimator how many tiles area waste',
    inputs: [fnum('a', 'Area to cover', 20, { unit: 'm2', min: 0.01, step: 'any' }), fnum('tl', 'Tile length', 0.6, { unit: 'm', min: 0.01, step: 'any' }), fnum('tw', 'Tile width', 0.6, { unit: 'm', min: 0.01, step: 'any' }), fnum('waste', 'Wastage', 10, { unit: '%', min: 0, max: 50 })],
    run(v) { const r = L.tiles(v.a, v.tl, v.tw, v.waste); return { stats: [int('Tiles to buy', r.withWaste, { primary: true }), num('Exact tile count', r.exact), num('Area per tile', r.tileArea, { u: 'm2' })], note: 'Diagonal layouts and patterns need about 15% waste.' }; },
  },
  {
    id: 'concrete', cat: E, title: 'Concrete estimator', desc: 'Volume of a slab and the number of pre-mixed bags.', keywords: 'concrete slab volume bags cement estimator cubic metres',
    inputs: [fnum('l', 'Length', 4, { unit: 'm', min: 0.01, step: 'any' }), fnum('w', 'Width', 3, { unit: 'm', min: 0.01, step: 'any' }), fnum('t', 'Thickness', 0.1, { unit: 'm', min: 0.001, step: 'any' }), fnum('y', 'Bag yield (about 0.017 m3 for a 36 kg bag)', 0.017, { unit: 'm3', min: 0.001, step: 'any' }), fnum('waste', 'Wastage', 10, { unit: '%', min: 0, max: 50 })],
    run(v) { const r = L.concrete(v.l, v.w, v.t, v.y, v.waste); return { stats: [num('Volume needed', r.volume, { primary: true, u: 'm3' }), int('Bags', r.bags)] }; },
  },
  {
    id: 'download-time', cat: E, title: 'Download time', desc: 'How long a file takes to transfer at a given speed.', keywords: 'download time file size internet speed mbps transfer upload',
    inputs: [fnum('s', 'File size', 4.7, { min: 0.0001, step: 'any' }), fselect('u', 'Size unit', [['1e6', 'MB'], ['1e9', 'GB'], ['1e12', 'TB'], ['1e3', 'KB']], '1e9'), fnum('mbps', 'Speed', 100, { unit: 'Mbps', min: 0.001, step: 'any' })],
    run(v) { const sec = L.dataTransferSeconds(v.s * Number(v.u), v.mbps); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60); return { stats: [text('Time', `${h ? `${h} h ` : ''}${m ? `${m} min ` : ''}${s} s`.trim(), { primary: true }), num('Seconds', sec)], note: 'Real speeds are lower because of protocol overhead and congestion.' }; },
  },
  {
    id: 'unit-price', cat: E, title: 'Unit price comparison', desc: 'Which pack is cheaper per unit? One line per option: name, price, quantity.', keywords: 'unit price compare best buy cheaper per kg per litre shopping',
    inputs: [farea('d', 'Name, price, quantity', 'Small, 40, 250\nMedium, 70, 500\nLarge, 120, 1000', { rows: 5 })],
    run(v, env) {
      const rows = v.d.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const p = l.split(','); return [p[0].trim(), Number(p[1]), Number(p[2])]; });
      need(rows.length >= 2 && rows.every((r) => r[1] >= 0 && r[2] > 0 && Number.isFinite(r[1]) && Number.isFinite(r[2])), 'Enter at least two lines: name, price, quantity');
      const unit = rows.map((r) => r[1] / r[2]), best = unit.indexOf(Math.min(...unit));
      return { stats: [text('Best value', rows[best][0], { primary: true }), num('Price per unit', unit[best], { digits: 4 })], table: { title: 'Compared', cols: ['Option', 'Price', 'Quantity', 'Per unit', 'vs best'], kinds: ['text', 'money', 'num', 'num', 'text'], rows: rows.map((r, i) => [r[0], r[1], r[2], unit[i], i === best ? 'Best' : `+${env.num((unit[i] / unit[best] - 1) * 100)}%`]) } };
    },
  },
  {
    id: 'ingredient-convert', cat: E, title: 'Cooking: cups to grams', desc: 'Approximate weight of common ingredients by volume.', keywords: 'cooking baking cups to grams flour sugar butter ingredient weight conversion recipe',
    inputs: [fselect('i', 'Ingredient', [['120', 'All-purpose flour'], ['200', 'Granulated sugar'], ['227', 'Butter'], ['237', 'Water'], ['245', 'Milk'], ['340', 'Honey'], ['185', 'Uncooked rice'], ['218', 'Vegetable oil'], ['90', 'Cocoa powder'], ['125', 'Powdered sugar'], ['100', 'Rolled oats']]), fnum('n', 'Amount', 1, { min: 0, step: 'any' }), fselect('u', 'Unit', [['236.588', 'US cup'], ['14.787', 'Tablespoon'], ['4.929', 'Teaspoon'], ['1', 'Millilitre']], '236.588')],
    run(v) { const grams = (v.n * Number(v.u) * Number(v.i)) / 236.588; return { stats: [num('Weight', grams, { primary: true, u: 'g' }), num('In ounces', grams / 28.349523, { u: 'oz' })], note: 'Densities vary with how an ingredient is packed. Weigh baking ingredients when you can.' }; },
  },
  /* ---------- science ---------- */
  {
    id: 'ohms-law', cat: S, title: "Ohm's law and power", desc: 'Enter any two of voltage, current, resistance and power to get the other two.', keywords: 'ohm law voltage current resistance power watts electrical',
    inputs: [fnum('v', 'Voltage', 12, { unit: 'V', optional: true, step: 'any' }), fnum('i', 'Current', null, { unit: 'A', optional: true, step: 'any' }), fnum('r', 'Resistance', 4, { unit: 'ohm', optional: true, step: 'any' }), fnum('p', 'Power', null, { unit: 'W', optional: true, step: 'any' })],
    run(v) { const o = L.ohm(v); return { stats: [num('Voltage', o.v, { u: 'V', primary: true }), num('Current', o.i, { u: 'A' }), num('Resistance', o.r, { u: 'ohm' }), num('Power', o.p, { u: 'W' })], steps: ['V = I x R,  P = V x I = I^2 R = V^2 / R'] }; },
  },
  {
    id: 'projectile', cat: S, title: 'Projectile motion', desc: 'Range, flight time and maximum height (no air resistance).', keywords: 'projectile motion range height time of flight launch angle physics kinematics',
    inputs: [fnum('v', 'Launch speed', 20, { unit: 'm/s', min: 0, step: 'any' }), fnum('a', 'Launch angle', 45, { unit: 'deg', min: 0, max: 90, step: 'any' }), fnum('h', 'Launch height', 0, { unit: 'm', min: 0, step: 'any' }), fnum('g', 'Gravity', L.G, { unit: 'm/s2', min: 0.1, step: 'any' })],
    run(v) { const r = L.projectile(v.v, v.a, v.h, v.g); return { stats: [num('Range', r.range, { u: 'm', primary: true }), num('Time of flight', r.flight, { u: 's' }), num('Maximum height', r.maxHeight, { u: 'm' }), num('Impact speed', r.impactSpeed, { u: 'm/s' })], steps: ['Range = v cos(theta) x t, with t from y = h + v sin(theta) t - g t^2 / 2'] }; },
  },
  {
    id: 'motion', cat: S, title: 'Speed, distance and time', desc: 'Find the missing one of speed, distance or time.', keywords: 'speed distance time velocity average motion formula',
    inputs: [fnum('s', 'Speed', 60, { unit: 'km/h', optional: true, step: 'any' }), fnum('d', 'Distance', null, { unit: 'km', optional: true, step: 'any' }), fnum('t', 'Time', 2.5, { unit: 'hours', optional: true, step: 'any' })],
    run(v) {
      const known = [v.s, v.d, v.t].filter((x) => x !== null && !Number.isNaN(x)).length;
      need(known === 2, 'Fill in exactly two of the three boxes');
      if (v.s === null) { need(v.t > 0, 'Time must be above zero'); return { stats: [num('Speed', v.d / v.t, { u: 'km/h', primary: true })] }; }
      if (v.d === null) return { stats: [num('Distance', v.s * v.t, { u: 'km', primary: true })] };
      need(v.s > 0, 'Speed must be above zero');
      const h = v.d / v.s;
      return { stats: [num('Time', h, { u: 'hours', primary: true }), text('As hours and minutes', `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`)] };
    },
  },
  {
    id: 'ideal-gas', cat: S, title: 'Ideal gas law', desc: 'PV = nRT in SI units. Leave one box empty to solve for it.', keywords: 'ideal gas law pressure volume temperature moles chemistry pv nrt',
    inputs: [fnum('P', 'Pressure', 101325, { unit: 'Pa', optional: true, step: 'any' }), fnum('V', 'Volume', null, { unit: 'm3', optional: true, step: 'any' }), fnum('n', 'Amount', 1, { unit: 'mol', optional: true, step: 'any' }), fnum('T', 'Temperature', 273.15, { unit: 'K', optional: true, step: 'any' })],
    run(v) { const r = L.idealGas(v.P, v.V, v.n, v.T); const [k, x] = Object.entries(r)[0]; const u = { P: 'Pa', V: 'm3', n: 'mol', T: 'K' }[k]; return { stats: [num(k, x, { u, primary: true }), ...(k === 'V' ? [num('In litres', x * 1000, { u: 'L' })] : [])], note: 'R = 8.314462618 J/(mol K). Temperature must be in kelvin.' }; },
  },
  {
    id: 'half-life', cat: S, title: 'Half-life and decay', desc: 'Remaining amount after a time, for radioactive decay or similar processes.', keywords: 'half life radioactive decay exponential carbon dating',
    inputs: [fnum('n0', 'Initial amount', 100, { min: 0, step: 'any' }), fnum('h', 'Half-life', 5730, { min: 1e-12, step: 'any' }), fnum('t', 'Elapsed time (same unit)', 10000, { min: 0, step: 'any' })],
    run(v) { const r = L.halfLife(v.n0, v.h, v.t); return { stats: [num('Remaining', r.remaining, { primary: true }), pct('Decayed', r.fractionDecayed * 100), num('Half-lives elapsed', v.t / v.h)] }; },
  },
  {
    id: 'molar-mass', cat: S, title: 'Molar mass', desc: 'Molar mass of a chemical formula, with element counts. Supports brackets, e.g. Ca(OH)2.', keywords: 'molar mass molecular weight chemistry formula grams per mole compound',
    inputs: [ftext('f', 'Formula', 'C6H12O6')],
    run(v) { const r = L.molarMass(v.f); return { stats: [num('Molar mass', r.mass, { primary: true, u: 'g/mol', digits: 3 })], table: { title: 'Composition', cols: ['Element', 'Atoms', 'Mass share %'], kinds: ['text', 'int', 'num'], rows: Object.entries(r.counts).map(([el, c]) => [el, c, ((L.ATOMIC_MASS[el] * c) / r.mass) * 100]) }, note: 'Uses standard atomic weights rounded to 3 decimals (not isotope-specific).' }; },
  },
  {
    id: 'ph', cat: S, title: 'pH calculator', desc: 'Convert between pH and hydrogen ion concentration.', keywords: 'ph acid base hydrogen ion concentration poh chemistry',
    inputs: [fselect('m', 'I know', [['ph', 'pH'], ['h', 'H+ concentration (mol/L)']]), fnum('x', 'Value', 7, { step: 'any', min: 0 })],
    run(v) { const ph = v.m === 'ph' ? v.x : L.pH.fromH(v.x); need(Number.isFinite(ph), 'Concentration must be above zero'); return { stats: [num('pH', ph, { primary: true }), num('pOH (at 25 C)', 14 - ph), text('H+ concentration', `${L.pH.toH(ph).toExponential(3)} mol/L`), text('Nature', ph < 7 ? 'Acidic' : ph > 7 ? 'Basic' : 'Neutral')] }; },
  },
];

function require_parts(s) {
  const ns = String(s).split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!ns.length || ns.some((x) => !Number.isFinite(x))) throw new Error('Enter numbers separated by spaces, commas or new lines');
  return ns;
}
void ZONES;
