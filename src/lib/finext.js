/* Extended finance toolkit: pure functions, rates are percentages unless a name says "Per" / "decimal". */
import { recurring } from './finmath.js';

export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Level payment for `principal` over `n` periods at periodic rate `i` (decimal). */
export function payment(principal, i, n) {
  if (n <= 0) throw new Error('Number of periods must be above zero');
  return i === 0 ? principal / n : (principal * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

/** Largest loan a given instalment can service. */
export function affordableLoan(pmt, annualRate, years) {
  const n = Math.round(years * 12);
  const i = annualRate / 1200;
  return i === 0 ? pmt * n : (pmt * (Math.pow(1 + i, n) - 1)) / (i * Math.pow(1 + i, n));
}

/**
 * Loan / mortgage schedule with optional extra payments.
 * opts: { extraMonthly, lumpSum, lumpMonth }. Stops when the balance reaches zero.
 */
export function mortgage(principal, annualRate, years, opts = {}) {
  const extraMonthly = opts.extraMonthly || 0;
  const lumpSum = opts.lumpSum || 0;
  const lumpMonth = opts.lumpMonth || 0;
  const n = Math.max(1, Math.round(years * 12));
  const i = annualRate / 1200;
  const pmt = payment(principal, i, n);
  const hasExtra = extraMonthly > 0 || lumpSum > 0;
  let balance = principal;
  let totalInterest = 0;
  const schedule = [];
  for (let m = 1; m <= n && balance > 0.005; m++) {
    const interest = balance * i;
    let princ = pmt - interest + extraMonthly + (m === lumpMonth ? lumpSum : 0);
    if (princ > balance || (m === n && !hasExtra)) princ = balance;
    if (princ < 0) princ = 0;
    balance -= princ;
    totalInterest += interest;
    schedule.push({ month: m, payment: princ + interest, principal: princ, interest, balance: Math.max(0, balance) });
  }
  const base = hasExtra ? mortgage(principal, annualRate, years) : null;
  return {
    payment: pmt, months: schedule.length, totalInterest, totalPaid: principal + totalInterest, schedule,
    interestSaved: base ? base.totalInterest - totalInterest : 0, monthsSaved: base ? base.months - schedule.length : 0,
  };
}

/** Future value of a lump sum plus level payments (end of period unless timing is 'start'). */
export function futureValue(pv, pmt, ratePerPeriod, n, timing = 'end') {
  if (ratePerPeriod === 0) return pv + pmt * n;
  const g = Math.pow(1 + ratePerPeriod, n);
  const annuity = (pmt * (g - 1)) / ratePerPeriod;
  return pv * g + (timing === 'start' ? annuity * (1 + ratePerPeriod) : annuity);
}
export function presentValue(fv, ratePerPeriod, n) { return fv / Math.pow(1 + ratePerPeriod, n); }

/** Net present value; flows[0] occurs now. */
export function npv(ratePct, flows) {
  const r = ratePct / 100;
  return flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
}
/** Internal rate of return (percent) by bisection; NaN when no sign change exists. */
export function irr(flows) {
  const f = (r) => flows.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 10;
  let flo = f(lo);
  const fhi = f(hi);
  if (!(flo * fhi < 0)) return NaN;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; }
  }
  return ((lo + hi) / 2) * 100;
}

export function cagr(begin, end, years) {
  if (begin <= 0 || end <= 0 || years <= 0) throw new Error('Values and years must be above zero');
  return (Math.pow(end / begin, 1 / years) - 1) * 100;
}
export function inflationValue(amount, ratePct, years) { return amount * Math.pow(1 + ratePct / 100, years); }
export function rule72(ratePct) {
  if (ratePct <= 0) throw new Error('Rate must be above zero');
  return { rule72: 72 / ratePct, exact: Math.log(2) / Math.log(1 + ratePct / 100) };
}

export function breakEven(fixed, price, variable) {
  const margin = price - variable;
  if (margin <= 0) throw new Error('Price must be higher than the variable cost per unit');
  const units = fixed / margin;
  const whole = Math.ceil(units - 1e-9);
  return { margin, units, unitsCeil: whole, revenue: whole * price, marginPct: (margin / price) * 100 };
}

/** GST / VAT / sales tax. mode 'add' treats amount as net, 'remove' as gross. */
export function salesTax(amount, ratePct, mode) {
  const r = ratePct / 100;
  if (mode === 'remove') { const net = amount / (1 + r); return { net, tax: amount - net, gross: amount }; }
  return { net: amount, tax: amount * r, gross: amount * (1 + r) };
}

export function discount(price, pct1, pct2 = 0) {
  const final = price * (1 - pct1 / 100) * (1 - pct2 / 100);
  return { final, saved: price - final, effectivePct: price ? ((price - final) / price) * 100 : 0 };
}
export function markup(cost, pct) { const price = cost * (1 + pct / 100); return { price, profit: price - cost, margin: price ? ((price - cost) / price) * 100 : 0 }; }
export function marginFrom(cost, price) { return { profit: price - cost, margin: price ? ((price - cost) / price) * 100 : 0, markup: cost ? ((price - cost) / cost) * 100 : 0 }; }
export function priceForMargin(cost, marginPct) { if (marginPct >= 100) throw new Error('Margin must be below 100%'); return cost / (1 - marginPct / 100); }

export function tipSplit(bill, tipPct, people) {
  const tip = bill * (tipPct / 100);
  const total = bill + tip;
  return { tip, total, perPerson: total / people, tipPerPerson: tip / people };
}

export function hourlyToSalary(rate, hoursPerWeek, weeksPerYear) {
  const yearly = rate * hoursPerWeek * weeksPerYear;
  return { hourly: rate, daily: (rate * hoursPerWeek) / 5, weekly: rate * hoursPerWeek, monthly: yearly / 12, yearly };
}
export function salaryToHourly(yearly, hoursPerWeek, weeksPerYear) { return hourlyToSalary(yearly / (hoursPerWeek * weeksPerYear), hoursPerWeek, weeksPerYear); }

/** Progressive income tax. slabs: [{ upTo: number|null, rate: pct }] ascending (null = no upper limit). */
export function slabTax(income, slabs) {
  let prev = 0, tax = 0;
  const rows = [];
  for (const s of slabs) {
    const top = s.upTo == null ? Infinity : s.upTo;
    const part = Math.max(0, Math.min(income, top) - prev);
    const t = (part * s.rate) / 100;
    rows.push({ from: prev, to: s.upTo, rate: s.rate, taxable: part, tax: t });
    tax += t;
    prev = top;
    if (income <= top) break;
  }
  return { tax, rows, effective: income ? (tax / income) * 100 : 0 };
}

export function depreciation(cost, salvage, life, method = 'sl', factor = 2) {
  if (cost < salvage) throw new Error('Salvage value cannot exceed cost');
  const rows = [];
  let book = cost;
  for (let y = 1; y <= life; y++) {
    let d;
    if (method === 'sl') d = (cost - salvage) / life;
    else if (method === 'syd') d = ((cost - salvage) * (life - y + 1)) / ((life * (life + 1)) / 2);
    else { d = Math.min(book * (factor / life), book - salvage); if (y === life) d = book - salvage; }
    d = Math.max(0, d);
    book -= d;
    rows.push({ year: y, depreciation: d, accumulated: cost - book, book });
  }
  return rows;
}

/** Monthly saving needed to reach a target (end-of-month deposits, monthly compounding). */
export function savingsGoal(target, current, annualRate, years) {
  const n = Math.round(years * 12), i = annualRate / 1200;
  const need = target - current * Math.pow(1 + i, n);
  if (need <= 0) return 0;
  return i === 0 ? need / n : (need * i) / (Math.pow(1 + i, n) - 1);
}

/** Systematic withdrawal: how long a corpus lasts and the balance at the horizon. */
export function withdrawals(corpus, monthly, annualRate, years, annualStepUpPct = 0) {
  const i = annualRate / 1200;
  let bal = corpus, w = monthly, m = 0;
  const yearly = [{ year: 0, balance: corpus }];
  const max = Math.round(years * 12);
  while (m < max && bal > 0) {
    bal = bal * (1 + i) - w;
    m++;
    if (m % 12 === 0) { w *= 1 + annualStepUpPct / 100; yearly.push({ year: m / 12, balance: Math.max(0, bal) }); }
  }
  if (m % 12 !== 0) yearly.push({ year: m / 12, balance: Math.max(0, bal) });
  return { months: m, lasted: bal > 0, endBalance: Math.max(0, bal), yearly };
}

export function creditCardPayoff(balance, aprPct, monthlyPayment) {
  const i = aprPct / 1200;
  if (monthlyPayment <= balance * i + 1e-9) throw new Error(`The payment must be higher than the monthly interest (${round2(balance * i).toFixed(2)})`);
  let b = balance, interest = 0, m = 0;
  while (b > 0.005 && m < 1200) {
    const it = b * i;
    interest += it;
    b = b + it - Math.min(monthlyPayment, b + it);
    m++;
  }
  return { months: m, interest, total: balance + interest };
}

/** Retirement planner: expenses are inflated to retirement day, corpus needed = annual expenses / withdrawal rate. */
export function retirement({ age, retireAge, current, monthlySave, returnPct, inflationPct, monthlyExpenseToday, withdrawPct }) {
  const years = retireAge - age;
  if (years <= 0) throw new Error('Retirement age must be above current age');
  const n = years * 12, i = returnPct / 1200;
  const corpus = current * Math.pow(1 + i, n) + (i === 0 ? monthlySave * n : (monthlySave * (Math.pow(1 + i, n) - 1)) / i);
  const expenseAtRetirement = monthlyExpenseToday * Math.pow(1 + inflationPct / 100, years);
  const needed = (expenseAtRetirement * 12) / (withdrawPct / 100);
  const todayValue = corpus / Math.pow(1 + inflationPct / 100, years);
  const gap = needed - corpus;
  const extra = gap <= 0 ? 0 : i === 0 ? gap / n : (gap * i) / (Math.pow(1 + i, n) - 1);
  return { years, corpus, needed, expenseAtRetirement, todayValue, gap, extraMonthly: extra, onTrack: gap <= 0 };
}

/** Years until financial independence: FIRE number = annual expenses / withdrawal rate. */
export function fire({ current, annualSave, annualExpenses, returnPct, withdrawPct }) {
  const target = annualExpenses / (withdrawPct / 100);
  const r = returnPct / 100;
  let bal = current, y = 0;
  const series = [{ year: 0, balance: current }];
  while (bal < target && y < 100) { bal = bal * (1 + r) + annualSave; y++; series.push({ year: y, balance: bal }); }
  return { target, years: bal >= target ? y : Infinity, series };
}

export function lumpVsSip(lump, monthly, annualRate, years) {
  const n = Math.round(years * 12), i = annualRate / 1200;
  const lumpFv = lump * Math.pow(1 + i, n);
  const sipFv = recurring(monthly, annualRate, years, 'start').total;
  return { lumpFv, sipFv, lumpInvested: lump, sipInvested: monthly * n };
}
