import * as F from '../lib/finmath.js';
import * as X from '../lib/finext.js';
import { money, num, int, pct, text, fnum, fmoney, frate, fpct, fyears, fint, fselect, farea, need, lineChart } from './helpers.js';

const freqOptions = F.FREQUENCIES.map((f) => [String(f.value), f.label]);
const CAT = 'finance';
const yearRows = (series, cols) => series.map((p) => cols.map((c) => p[c]));

export const finance = [
  {
    id: 'simple-interest', cat: CAT, title: 'Simple interest', desc: 'Interest on the original principal only: I = P x r x t / 100.',
    keywords: 'simple interest principal rate time si',
    inputs: [fmoney('p', 'Principal', 10000), frate('r', 'Interest rate', 8), fyears('t', 'Time', 3)],
    run(v, env) {
      const r = F.simpleInterest(v.p, v.r, v.t);
      const g = F.growthSeries(v.p, v.r, v.t, 1);
      return {
        stats: [money('Interest earned', r.interest, { primary: true }), money('Total amount', r.total), money('Principal', r.principal)],
        steps: [`I = P x r x t / 100 = ${env.money(v.p)} x ${v.r} x ${v.t} / 100 = ${env.money(r.interest)}`, `Amount = P + I = ${env.money(r.total)}`],
        chart: lineChart('Growth over time', [{ name: 'Simple interest', data: g.map((p) => [p.t, p.simple]) }]),
        table: { title: 'Year by year', cols: ['Year', 'Amount'], kinds: ['int', 'money'], rows: g.map((p) => [p.t, p.simple]) },
      };
    },
  },
  {
    id: 'compound-interest', cat: CAT, title: 'Compound interest', desc: 'Interest on interest, with any compounding frequency, compared to simple interest.',
    keywords: 'compound interest compounding apy ear growth',
    inputs: [fmoney('p', 'Principal', 10000), frate('r', 'Interest rate', 8), fyears('t', 'Time', 3), fselect('f', 'Compounding', freqOptions, '12')],
    run(v, env) {
      const f = Number(v.f);
      const r = F.compoundInterest(v.p, v.r, v.t, f);
      const g = F.growthSeries(v.p, v.r, v.t, f);
      return {
        stats: [money('Total amount', r.total, { primary: true }), money('Interest earned', r.interest), pct('Effective annual rate', r.effectiveRate, { sub: 'APY / EAR' }), money('Simple interest would give', F.simpleAmount(v.p, v.r, v.t))],
        steps: [f === 0 ? `A = P x e^(r t) = ${env.money(v.p)} x e^(${v.r / 100} x ${v.t})` : `A = P (1 + r/n)^(n t) = ${env.money(v.p)} x (1 + ${v.r / 100}/${f})^(${f} x ${v.t})`, `A = ${env.money(r.total)}`],
        chart: lineChart('Compound vs simple', [{ name: 'Compound', data: g.map((p) => [p.t, p.compound]) }, { name: 'Simple', data: g.map((p) => [p.t, p.simple]) }]),
        table: { title: 'Year by year', cols: ['Year', 'Simple', 'Compound', 'Difference'], kinds: ['int', 'money', 'money', 'money'], rows: yearRows(g, ['t', 'simple', 'compound', 'difference']) },
      };
    },
  },
  {
    id: 'emi', cat: CAT, title: 'EMI / loan', desc: 'Monthly instalment, total interest and the full amortization schedule.',
    keywords: 'emi loan instalment installment amortization home car personal',
    inputs: [fmoney('p', 'Loan amount', 1000000), frate('r', 'Interest rate', 8.5), fyears('t', 'Tenure', 20)],
    run(v, env) {
      const e = F.emi(v.p, v.r, v.t);
      const yearly = [];
      for (let y = 1; y <= Math.ceil(e.months / 12); y++) {
        const rows = e.schedule.slice((y - 1) * 12, y * 12);
        yearly.push([y, rows.reduce((s, r) => s + r.principal, 0), rows.reduce((s, r) => s + r.interest, 0), rows[rows.length - 1].balance]);
      }
      return {
        stats: [money('Monthly EMI', e.emi, { primary: true }), money('Total interest', e.interest), money('Total payment', e.total), pct('Interest share', (e.interest / e.total) * 100)],
        steps: [`i = ${v.r}% / 12 = ${(v.r / 12).toFixed(4)}% per month, n = ${e.months} months`, 'EMI = P x i x (1+i)^n / ((1+i)^n - 1)', `EMI = ${env.money(e.emi)}`],
        chart: { type: 'stack', title: 'Principal and interest paid each year', xLabel: 'Year', yKind: 'money', series: [{ name: 'Principal', data: yearly.map((r) => [r[0], r[1]]) }, { name: 'Interest', data: yearly.map((r) => [r[0], r[2]]) }] },
        table: { title: 'Year by year amortization', cols: ['Year', 'Principal paid', 'Interest paid', 'Balance'], kinds: ['int', 'money', 'money', 'money'], rows: yearly },
        extraTable: { title: 'Monthly schedule', cols: ['Month', 'Payment', 'Principal', 'Interest', 'Balance'], kinds: ['int', 'money', 'money', 'money', 'money'], rows: e.schedule.map((r) => [r.month, r.payment, r.principal, r.interest, r.balance]) },
      };
    },
  },
  {
    id: 'mortgage', cat: CAT, title: 'Mortgage with extra payments', desc: 'See how extra monthly or one-time payments shorten a mortgage and save interest.',
    keywords: 'mortgage extra payment prepayment home loan payoff',
    inputs: [fmoney('p', 'Loan amount', 300000), frate('r', 'Interest rate', 6.5), fyears('t', 'Term', 30, { max: 50 }), fmoney('extra', 'Extra payment per month', 200), fmoney('lump', 'One-time extra payment', 0), fint('lumpM', 'One-time payment in month', 12, { min: 1, max: 600 })],
    run(v) {
      const m = X.mortgage(v.p, v.r, v.t, { extraMonthly: v.extra, lumpSum: v.lump, lumpMonth: v.lumpM });
      const base = X.mortgage(v.p, v.r, v.t);
      const bal = (s) => s.filter((r) => r.month % 12 === 0 || r.month === s.length).map((r) => [r.month / 12, r.balance]);
      return {
        stats: [money('Monthly payment (before extras)', m.payment, { primary: true }), int('Payoff time (months)', m.months, { sub: `${base.months} months without extras` }), money('Interest saved', m.interestSaved), money('Total interest', m.totalInterest, { sub: `${Math.round(base.totalInterest).toLocaleString()} without extras` }), int('Months saved', m.monthsSaved)],
        chart: lineChart('Remaining balance', [{ name: 'With extra payments', data: [[0, v.p], ...bal(m.schedule)] }, { name: 'Standard schedule', data: [[0, v.p], ...bal(base.schedule)] }]),
        table: { title: 'Monthly schedule', cols: ['Month', 'Payment', 'Principal', 'Interest', 'Balance'], kinds: ['int', 'money', 'money', 'money', 'money'], rows: m.schedule.map((r) => [r.month, r.payment, r.principal, r.interest, r.balance]) },
      };
    },
  },
  {
    id: 'loan-compare', cat: CAT, title: 'Loan comparison', desc: 'Compare two loan offers side by side.',
    keywords: 'compare loans offers better cheaper emi',
    inputs: [fmoney('p', 'Loan amount', 500000), frate('r1', 'Offer A rate', 9), fyears('t1', 'Offer A tenure', 10), fmoney('fee1', 'Offer A processing fee', 5000), frate('r2', 'Offer B rate', 8.5), fyears('t2', 'Offer B tenure', 12), fmoney('fee2', 'Offer B processing fee', 10000)],
    run(v, env) {
      const a = F.emi(v.p, v.r1, v.t1), b = F.emi(v.p, v.r2, v.t2);
      const costA = a.total + v.fee1, costB = b.total + v.fee2;
      return {
        stats: [text('Cheaper overall', costA <= costB ? 'Offer A' : 'Offer B', { primary: true, sub: `by ${env.money(Math.abs(costA - costB))}` }), money('A: monthly EMI', a.emi), money('B: monthly EMI', b.emi), money('A: total cost incl. fee', costA), money('B: total cost incl. fee', costB)],
        table: { title: 'Comparison', cols: ['Measure', 'Offer A', 'Offer B'], kinds: ['text', 'money', 'money'], rows: [['Monthly EMI', a.emi, b.emi], ['Total interest', a.interest, b.interest], ['Fees', v.fee1, v.fee2], ['Total cost', costA, costB]] },
        note: 'The cheaper loan overall is not always the one with the lower EMI. Compare total cost, not only the instalment.',
      };
    },
  },
  {
    id: 'affordability', cat: CAT, title: 'Loan affordability', desc: 'How large a loan can you afford for a given monthly payment?',
    keywords: 'affordability afford how much loan borrow budget',
    inputs: [fmoney('emi', 'Monthly payment you can afford', 25000), frate('r', 'Interest rate', 8.5), fyears('t', 'Tenure', 20)],
    run(v, env) {
      const p = X.affordableLoan(v.emi, v.r, v.t);
      return { stats: [money('Maximum loan', p, { primary: true }), money('Total you will pay', v.emi * Math.round(v.t * 12)), money('Interest portion', v.emi * Math.round(v.t * 12) - p)], steps: [`P = EMI x ((1+i)^n - 1) / (i x (1+i)^n) = ${env.money(p)}`] };
    },
  },
  {
    id: 'sip', cat: CAT, title: 'SIP / RD calculator', desc: 'Regular monthly investment or recurring deposit compounded monthly.',
    keywords: 'sip recurring deposit rd mutual fund monthly investment',
    inputs: [fmoney('m', 'Monthly investment', 5000), frate('r', 'Expected return', 12, { max: 60 }), fyears('t', 'Duration', 10), fselect('timing', 'Deposit at', [['start', 'Start of month'], ['end', 'End of month']])],
    run(v) {
      const r = F.recurring(v.m, v.r, v.t, v.timing);
      return {
        stats: [money('Maturity value', r.total, { primary: true }), money('Total invested', r.invested), money('Wealth gained', r.interest)],
        chart: lineChart('Invested vs value', [{ name: 'Value', data: r.yearly.map((p) => [p.t, p.balance]) }, { name: 'Invested', data: r.yearly.map((p) => [p.t, p.invested]) }]),
        table: { title: 'Year by year', cols: ['Year', 'Invested', 'Value', 'Gain'], kinds: ['num', 'money', 'money', 'money'], rows: r.yearly.map((p) => [p.t, p.invested, p.balance, p.interest]) },
      };
    },
  },
  {
    id: 'step-up-sip', cat: CAT, title: 'Step-up SIP', desc: 'A SIP whose monthly amount grows by a fixed percentage every year.',
    keywords: 'step up sip increase yearly top-up',
    inputs: [fmoney('m', 'Starting monthly investment', 5000), fpct('s', 'Yearly increase', 10), frate('r', 'Expected return', 12, { max: 60 }), fint('t', 'Years', 15, { min: 1, max: 60 })],
    run(v) {
      let bal = 0, invested = 0, m = v.m;
      const rows = [[0, 0, 0]], i = v.r / 1200;
      for (let y = 1; y <= v.t; y++) {
        for (let k = 0; k < 12; k++) { bal = (bal + m) * (1 + i); invested += m; }
        rows.push([y, invested, bal]);
        m *= 1 + v.s / 100;
      }
      return {
        stats: [money('Maturity value', bal, { primary: true }), money('Total invested', invested), money('Wealth gained', bal - invested)],
        chart: lineChart('Invested vs value', [{ name: 'Value', data: rows.map((r) => [r[0], r[2]]) }, { name: 'Invested', data: rows.map((r) => [r[0], r[1]]) }]),
        table: { title: 'Year by year', cols: ['Year', 'Invested', 'Value'], kinds: ['int', 'money', 'money'], rows },
      };
    },
  },
  {
    id: 'fd', cat: CAT, title: 'Fixed deposit', desc: 'Maturity amount of a cumulative fixed deposit.',
    keywords: 'fixed deposit fd maturity term deposit cd certificate',
    inputs: [fmoney('p', 'Deposit', 100000), frate('r', 'Interest rate', 7), fyears('t', 'Term', 5), fselect('f', 'Compounding', freqOptions, '4')],
    run(v) {
      const r = F.fixedDeposit(v.p, v.r, v.t, Number(v.f));
      return {
        stats: [money('Maturity amount', r.total, { primary: true }), money('Interest earned', r.interest), pct('Effective annual rate', r.effectiveRate)],
        chart: lineChart('Deposit growth', [{ name: 'Balance', data: r.series.map((p) => [p.t, p.balance]) }]),
        table: { title: 'Year by year', cols: ['Year', 'Balance', 'Interest so far'], kinds: ['num', 'money', 'money'], rows: r.series.map((p) => [p.t, p.balance, p.interest]) },
      };
    },
  },
  {
    id: 'lumpsum-vs-sip', cat: CAT, title: 'Lump sum vs SIP', desc: 'Compare investing once with investing monthly.',
    keywords: 'lumpsum lump sum vs sip compare invest',
    inputs: [fmoney('lump', 'Lump sum today', 100000), fmoney('m', 'Monthly SIP', 1000), frate('r', 'Expected return', 12, { max: 60 }), fyears('t', 'Duration', 10)],
    run(v) {
      const r = X.lumpVsSip(v.lump, v.m, v.r, v.t);
      return {
        stats: [money('Lump sum value', r.lumpFv, { primary: true, sub: `invested ${Math.round(r.lumpInvested).toLocaleString()}` }), money('SIP value', r.sipFv, { sub: `invested ${Math.round(r.sipInvested).toLocaleString()}` }), money('Difference', Math.abs(r.lumpFv - r.sipFv), { sub: r.lumpFv >= r.sipFv ? 'lump sum ahead' : 'SIP ahead' })],
        note: 'The two options invest different total amounts. Compare gains relative to what was put in.',
      };
    },
  },
  {
    id: 'savings-goal', cat: CAT, title: 'Savings goal', desc: 'How much to save each month to reach a target.',
    keywords: 'savings goal target how much to save monthly',
    inputs: [fmoney('g', 'Goal amount', 1000000), fmoney('c', 'Already saved', 50000), frate('r', 'Expected return', 7, { max: 60 }), fyears('t', 'Time to goal', 8)],
    run(v) {
      const m = X.savingsGoal(v.g, v.c, v.r, v.t);
      return { stats: [money('Save each month', m, { primary: true }), money('Total deposits', m * Math.round(v.t * 12)), money('Growth from returns', v.g - v.c - m * Math.round(v.t * 12))], note: m === 0 ? 'Your current savings alone will reach the goal.' : undefined };
    },
  },
  {
    id: 'future-value', cat: CAT, title: 'Present and future value', desc: 'Time value of money for a lump sum and regular payments.',
    keywords: 'future value present value fv pv annuity time value of money',
    inputs: [fmoney('pv', 'Present value', 10000), fmoney('pmt', 'Payment per period', 500), frate('r', 'Annual rate', 6), fyears('t', 'Years', 10), fselect('n', 'Periods per year', [['1', 'Yearly'], ['4', 'Quarterly'], ['12', 'Monthly']], '12'), fselect('timing', 'Payments at', [['end', 'End of period'], ['start', 'Start of period']])],
    run(v, env) {
      const n = Number(v.n), per = v.r / 100 / n, k = Math.round(v.t * n);
      const fv = X.futureValue(v.pv, v.pmt, per, k, v.timing);
      return { stats: [money('Future value', fv, { primary: true }), money('Total contributed', v.pv + v.pmt * k), money('Growth', fv - v.pv - v.pmt * k), money('Value of that future amount today', X.presentValue(fv, per, k))], steps: [`Per-period rate = ${(per * 100).toFixed(4)}%, periods = ${k}`, `FV = ${env.money(fv)}`] };
    },
  },
  {
    id: 'npv-irr', cat: CAT, title: 'NPV and IRR', desc: 'Evaluate an investment from its cash flows (first value is today, usually negative).',
    keywords: 'npv irr net present value internal rate of return cash flows',
    inputs: [fpct('r', 'Discount rate', 10), farea('flows', 'Cash flows (one per line or comma separated)', '-10000\n3000\n4000\n5000\n2000')],
    run(v) {
      const flows = v.flows.split(/[\s,;]+/).filter(Boolean).map(Number);
      need(flows.length >= 2 && flows.every(Number.isFinite), 'Enter at least two numeric cash flows');
      const irr = X.irr(flows);
      return { stats: [money('Net present value', X.npv(v.r, flows), { primary: true }), Number.isNaN(irr) ? text('IRR', 'Not defined', { sub: 'needs both negative and positive flows' }) : pct('IRR', irr), money('Total of flows', flows.reduce((a, b) => a + b, 0))], table: { title: 'Cash flows', cols: ['Period', 'Cash flow', 'Present value'], kinds: ['int', 'money', 'money'], rows: flows.map((f, t) => [t, f, f / Math.pow(1 + v.r / 100, t)]) } };
    },
  },
  {
    id: 'cagr', cat: CAT, title: 'CAGR', desc: 'Compound annual growth rate between two values.',
    keywords: 'cagr compound annual growth rate return investment',
    inputs: [fmoney('b', 'Beginning value', 10000, { min: 0.01 }), fmoney('e', 'Ending value', 25000, { min: 0.01 }), fyears('t', 'Years', 5)],
    run(v, env) { const c = X.cagr(v.b, v.e, v.t); return { stats: [pct('CAGR', c, { primary: true }), pct('Total growth', ((v.e - v.b) / v.b) * 100), num('Growth multiple', v.e / v.b, { u: 'x' })], steps: [`CAGR = (end / begin)^(1/years) - 1 = (${v.e} / ${v.b})^(1/${v.t}) - 1 = ${env.num(c)}%`] }; },
  },
  {
    id: 'roi', cat: CAT, title: 'ROI', desc: 'Return on investment, with optional holding period for the annualised figure.',
    keywords: 'roi return on investment profit gain',
    inputs: [fmoney('c', 'Amount invested', 50000, { min: 0.01 }), fmoney('r', 'Final value', 68000), fyears('t', 'Holding period', 2)],
    run(v) { const roi = ((v.r - v.c) / v.c) * 100; return { stats: [pct('ROI', roi, { primary: true }), money('Net profit', v.r - v.c), pct('Annualised (CAGR)', v.r > 0 ? X.cagr(v.c, v.r, v.t) : NaN)] }; },
  },
  {
    id: 'inflation', cat: CAT, title: 'Inflation', desc: 'Future cost of something, and the purchasing power of money today.',
    keywords: 'inflation purchasing power cost of living future price real value',
    inputs: [fmoney('a', 'Amount today', 100000), fpct('r', 'Inflation rate', 6, { max: 100 }), fyears('t', 'Years', 10)],
    run(v, env) {
      const f = X.inflationValue(v.a, v.r, v.t);
      return { stats: [money('Same goods cost then', f, { primary: true }), money(`${env.money(v.a)} will buy only`, v.a / Math.pow(1 + v.r / 100, v.t), { sub: 'in today\'s money' }), pct('Purchasing power lost', (1 - 1 / Math.pow(1 + v.r / 100, v.t)) * 100)], chart: lineChart('Cost of the same goods', [{ name: 'Cost', data: Array.from({ length: Math.ceil(v.t) + 1 }, (_, i) => [i, X.inflationValue(v.a, v.r, i)]) }]) };
    },
  },
  {
    id: 'rule-72', cat: CAT, title: 'Rule of 72', desc: 'Roughly how long it takes money to double.',
    keywords: 'rule of 72 doubling time double money',
    inputs: [fnum('r', 'Annual return', 8, { unit: '%', min: 0.01, max: 200, step: 0.1 })],
    run(v) { const r = X.rule72(v.r); return { stats: [num('Years to double (rule of 72)', r.rule72, { primary: true }), num('Exact years to double', r.exact)] }; },
  },
  {
    id: 'retirement', cat: CAT, title: 'Retirement planner', desc: 'Will your savings last? Inflation-adjusted corpus needed vs projected corpus.',
    keywords: 'retirement planner corpus pension nest egg',
    inputs: [fint('age', 'Current age', 30, { min: 15, max: 90 }), fint('ret', 'Retirement age', 60, { min: 20, max: 100 }), fmoney('cur', 'Current savings', 500000), fmoney('save', 'Monthly saving', 15000), frate('ror', 'Return before retirement', 10, { max: 40 }), fpct('inf', 'Inflation', 6, { max: 30 }), fmoney('exp', 'Monthly expenses today', 50000), fpct('wd', 'Withdrawal rate', 4, { min: 0.5, max: 15 })],
    run(v, env) {
      const r = X.retirement({ age: v.age, retireAge: v.ret, current: v.cur, monthlySave: v.save, returnPct: v.ror, inflationPct: v.inf, monthlyExpenseToday: v.exp, withdrawPct: v.wd });
      return {
        stats: [text('Status', r.onTrack ? 'On track' : 'Shortfall', { primary: true, sub: r.onTrack ? 'projected corpus covers your target' : `save ${env.money(r.extraMonthly)} more per month` }), money('Projected corpus', r.corpus), money('Corpus needed', r.needed), money('Projected corpus in today\'s money', r.todayValue), money('Monthly expenses at retirement', r.expenseAtRetirement)],
        steps: ['Needed corpus = (monthly expenses at retirement x 12) / withdrawal rate'], note: 'Estimates assume constant returns and inflation. Real markets vary.',
      };
    },
  },
  {
    id: 'fire', cat: CAT, title: 'FIRE number', desc: 'Financial independence target and years to reach it.',
    keywords: 'fire financial independence retire early 4 percent rule',
    inputs: [fmoney('cur', 'Current investments', 200000), fmoney('save', 'Saved per year', 30000), fmoney('exp', 'Annual expenses', 40000), frate('ror', 'Expected return', 7, { max: 40 }), fpct('wd', 'Safe withdrawal rate', 4, { min: 0.5, max: 15 })],
    run(v) {
      const r = X.fire({ current: v.cur, annualSave: v.save, annualExpenses: v.exp, returnPct: v.ror, withdrawPct: v.wd });
      return { stats: [money('FIRE number', r.target, { primary: true }), Number.isFinite(r.years) ? int('Years to reach it', r.years) : text('Years to reach it', 'Over 100'), pct('Savings as % of expenses', (v.save / v.exp) * 100)], chart: lineChart('Projected investments', [{ name: 'Investments', data: r.series.map((p) => [p.year, p.balance]) }, { name: 'FIRE number', data: [[0, r.target], [r.series[r.series.length - 1].year, r.target]] }]) };
    },
  },
  {
    id: 'swp', cat: CAT, title: 'Withdrawal plan (SWP)', desc: 'How long a corpus lasts when you withdraw regularly.',
    keywords: 'swp systematic withdrawal plan annuity retirement income drawdown',
    inputs: [fmoney('c', 'Starting corpus', 5000000), fmoney('w', 'Monthly withdrawal', 30000), frate('r', 'Expected return', 8, { max: 40 }), fint('t', 'Check horizon (years)', 30, { min: 1, max: 80 }), fpct('s', 'Yearly increase in withdrawal', 0, { max: 30 })],
    run(v) {
      const r = X.withdrawals(v.c, v.w, v.r, v.t, v.s);
      return { stats: [text('Result', r.lasted ? `Lasts the full ${v.t} years` : `Runs out in ${Math.floor(r.months / 12)}y ${r.months % 12}m`, { primary: true }), money('Balance at end', r.endBalance)], chart: lineChart('Corpus balance', [{ name: 'Balance', data: r.yearly.map((p) => [p.year, p.balance]) }]) };
    },
  },
  {
    id: 'credit-card', cat: CAT, title: 'Credit card payoff', desc: 'Months and interest to clear a card balance with a fixed payment.',
    keywords: 'credit card payoff debt balance minimum payment',
    inputs: [fmoney('b', 'Balance', 5000), frate('apr', 'APR', 18, { max: 100 }), fmoney('p', 'Monthly payment', 200)],
    run(v, env) { const r = X.creditCardPayoff(v.b, v.apr, v.p); return { stats: [int('Months to pay off', r.months, { primary: true, sub: `${(r.months / 12).toFixed(1)} years` }), money('Total interest', r.interest), money('Total paid', r.total)], steps: [`Monthly interest at the start = ${env.money((v.b * v.apr) / 1200)}`] }; },
  },
  {
    id: 'break-even', cat: CAT, title: 'Break-even', desc: 'Units and revenue needed to cover your costs.',
    keywords: 'break even breakeven business fixed cost contribution margin',
    inputs: [fmoney('fixed', 'Fixed costs', 50000), fmoney('price', 'Selling price per unit', 25), fmoney('var', 'Variable cost per unit', 15)],
    run(v, env) {
      const b = X.breakEven(v.fixed, v.price, v.var);
      return { stats: [int('Break-even units', b.unitsCeil, { primary: true, sub: `exactly ${env.num(b.units)}` }), money('Break-even revenue', b.revenue), money('Contribution per unit', b.margin), pct('Contribution margin', b.marginPct)], steps: ['Break-even units = fixed costs / (price - variable cost)'] };
    },
  },
  {
    id: 'sales-tax', cat: CAT, title: 'GST / VAT / sales tax', desc: 'Add tax to a net price or extract it from a gross price. Rates differ by country and item: check yours.',
    keywords: 'gst vat sales tax inclusive exclusive cgst sgst',
    inputs: [fmoney('a', 'Amount', 1000), fpct('r', 'Tax rate', 18, { max: 100 }), fselect('mode', 'Amount is', [['add', 'Before tax (add tax)'], ['remove', 'Including tax (remove tax)']])],
    run(v, env) {
      const r = X.salesTax(v.a, v.r, v.mode);
      return { stats: [money('Total with tax', r.gross, { primary: true }), money('Tax', r.tax), money('Price before tax', r.net), money('Half of tax (CGST/SGST split)', r.tax / 2)], steps: [v.mode === 'add' ? `Tax = ${env.money(v.a)} x ${v.r}% = ${env.money(r.tax)}` : `Net = gross / (1 + ${v.r}%) = ${env.money(r.net)}`] };
    },
  },
  {
    id: 'discount', cat: CAT, title: 'Discount', desc: 'Price after one or two successive discounts.',
    keywords: 'discount sale off price coupon savings',
    inputs: [fmoney('p', 'Original price', 2500), fpct('d1', 'Discount', 20), fpct('d2', 'Extra discount (optional)', 0)],
    run(v, env) { const r = X.discount(v.p, v.d1, v.d2); return { stats: [money('You pay', r.final, { primary: true }), money('You save', r.saved), pct('Effective discount', r.effectivePct)], steps: [`${env.money(v.p)} x (1 - ${v.d1}%) x (1 - ${v.d2}%) = ${env.money(r.final)}`] }; },
  },
  {
    id: 'markup-margin', cat: CAT, title: 'Markup and margin', desc: 'Price from cost and markup, or margin from cost and price.',
    keywords: 'markup margin profit selling price cost gross margin',
    inputs: [fmoney('cost', 'Cost', 80), fselect('mode', 'Known', [['markup', 'Markup %'], ['margin', 'Margin %'], ['price', 'Selling price']]), fnum('x', 'Value', 25, { min: 0, step: 0.01 })],
    run(v) {
      let price;
      if (v.mode === 'markup') price = v.cost * (1 + v.x / 100); else if (v.mode === 'margin') price = X.priceForMargin(v.cost, v.x); else price = v.x;
      const m = X.marginFrom(v.cost, price);
      return { stats: [money('Selling price', price, { primary: true }), money('Profit', m.profit), pct('Margin (of price)', m.margin), pct('Markup (of cost)', m.markup)], note: 'Margin is profit divided by price. Markup is profit divided by cost, so the two differ.' };
    },
  },
  {
    id: 'salary', cat: CAT, title: 'Salary and hourly pay', desc: 'Convert between hourly, weekly, monthly and yearly pay.',
    keywords: 'salary hourly wage pay convert annual monthly weekly',
    inputs: [fselect('mode', 'I know my', [['hourly', 'Hourly rate'], ['yearly', 'Yearly salary']]), fmoney('x', 'Amount', 25), fnum('h', 'Hours per week', 40, { min: 1, max: 100, unit: 'h' }), fnum('w', 'Weeks per year', 52, { min: 1, max: 52, unit: 'weeks' })],
    run(v) { const r = v.mode === 'hourly' ? X.hourlyToSalary(v.x, v.h, v.w) : X.salaryToHourly(v.x, v.h, v.w); return { stats: [money('Yearly', r.yearly, { primary: true }), money('Monthly', r.monthly), money('Weekly', r.weekly), money('Daily (5-day week)', r.daily), money('Hourly', r.hourly)] }; },
  },
  {
    id: 'tip-split', cat: CAT, title: 'Tip and bill split', desc: 'Tip and the share per person.',
    keywords: 'tip split bill restaurant gratuity people share',
    inputs: [fmoney('b', 'Bill', 84), fpct('t', 'Tip', 15, { max: 100 }), fint('n', 'People', 2, { min: 1, max: 100 })],
    run(v) { const r = X.tipSplit(v.b, v.t, v.n); return { stats: [money('Each person pays', r.perPerson, { primary: true }), money('Tip', r.tip), money('Total', r.total), money('Tip per person', r.tipPerPerson)] }; },
  },
  {
    id: 'depreciation', cat: CAT, title: 'Depreciation', desc: 'Straight-line, declining balance or sum-of-years digits.',
    keywords: 'depreciation asset straight line declining balance book value',
    inputs: [fmoney('c', 'Cost', 100000), fmoney('s', 'Salvage value', 10000), fint('n', 'Useful life (years)', 5, { min: 1, max: 60 }), fselect('m', 'Method', [['sl', 'Straight-line'], ['ddb', 'Double declining balance'], ['syd', 'Sum of years digits']])],
    run(v) {
      const rows = X.depreciation(v.c, v.s, v.n, v.m);
      return { stats: [money('First-year depreciation', rows[0].depreciation, { primary: true }), money('Total depreciation', v.c - v.s), money('Book value at end', rows[rows.length - 1].book)], chart: lineChart('Book value', [{ name: 'Book value', data: [[0, v.c], ...rows.map((r) => [r.year, r.book])] }]), table: { title: 'Schedule', cols: ['Year', 'Depreciation', 'Accumulated', 'Book value'], kinds: ['int', 'money', 'money', 'money'], rows: rows.map((r) => [r.year, r.depreciation, r.accumulated, r.book]) } };
    },
  },
  {
    id: 'income-tax', cat: CAT, title: 'Income tax (slab based)', desc: 'Progressive tax from slabs you define. Tax rules differ by country, year and regime, so edit the slabs to match yours. The sample slabs are illustrative only.',
    keywords: 'income tax slab brackets progressive effective rate regime',
    inputs: [fmoney('inc', 'Taxable income', 1000000), farea('slabs', 'Slabs: upper limit, rate % (last line "above, rate")', '300000, 0\n700000, 5\n1000000, 10\n1200000, 15\nabove, 20', { rows: 6 })],
    run(v, env) {
      const slabs = v.slabs.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [a, b] = l.split(/[,\s]+/); return { upTo: /^(above|rest|inf|max)/i.test(a) ? null : Number(a), rate: Number(b) }; });
      need(slabs.length && slabs.every((s) => (s.upTo === null || Number.isFinite(s.upTo)) && Number.isFinite(s.rate)), 'Each slab needs a limit and a rate, such as "700000, 5"');
      for (let i = 1; i < slabs.length; i++) need(slabs[i].upTo === null || slabs[i].upTo > slabs[i - 1].upTo, 'Slab limits must increase');
      const r = X.slabTax(v.inc, slabs);
      return { stats: [money('Total tax', r.tax, { primary: true }), pct('Effective rate', r.effective), money('Income after tax', v.inc - r.tax)], table: { title: 'Slab breakdown', cols: ['From', 'Up to', 'Rate %', 'Taxable', 'Tax'], kinds: ['money', 'text', 'num', 'money', 'money'], rows: r.rows.map((x) => [x.from, x.to == null ? 'above' : env.money(x.to), x.rate, x.taxable, x.tax]) }, note: 'Surcharges, cess, deductions and rebates are not modelled.' };
    },
  },
  {
    id: 'apr-apy', cat: CAT, title: 'APR to APY', desc: 'Convert a nominal rate to its effective annual yield.',
    keywords: 'apr apy ear effective annual rate nominal conversion',
    inputs: [frate('r', 'Nominal rate (APR)', 12), fselect('f', 'Compounding', freqOptions, '12')],
    run(v) { return { stats: [pct('Effective annual rate (APY)', F.effectiveRate(v.r, Number(v.f)), { primary: true }), pct('Difference', F.effectiveRate(v.r, Number(v.f)) - v.r)] }; },
  },
];
