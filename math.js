/*
 * Finance maths shared by the browser UI and the node tests.
 * Pure functions only: no DOM, no storage, no globals other than the export.
 * Rates are annual percentages (8 means 8%); time is in years.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FinMath = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Compounding frequencies per year. 0 means continuous compounding. */
  var FREQUENCIES = [
    { value: 1, label: 'Annually' },
    { value: 2, label: 'Half-yearly' },
    { value: 4, label: 'Quarterly' },
    { value: 12, label: 'Monthly' },
    { value: 365, label: 'Daily' },
    { value: 0, label: 'Continuously' }
  ];

  /** Time points to plot: every whole year, plus the exact end when fractional. */
  function timePoints(years) {
    var pts = [];
    var whole = Math.floor(years + 1e-9);
    for (var i = 0; i <= whole; i++) pts.push(i);
    if (years - whole > 1e-9) pts.push(years);
    return pts;
  }

  function simpleAmount(principal, rate, t) {
    return principal * (1 + (rate / 100) * t);
  }

  function compoundAmount(principal, rate, t, freq) {
    var r = rate / 100;
    if (freq === 0) return principal * Math.exp(r * t);
    return principal * Math.pow(1 + r / freq, freq * t);
  }

  /** Effective annual rate (percent) for a nominal rate and frequency. */
  function effectiveRate(rate, freq) {
    var r = rate / 100;
    var e = freq === 0 ? Math.exp(r) - 1 : Math.pow(1 + r / freq, freq) - 1;
    return e * 100;
  }

  function simpleInterest(principal, rate, years) {
    var interest = (principal * rate * years) / 100;
    return { principal: principal, interest: interest, total: principal + interest };
  }

  function compoundInterest(principal, rate, years, freq) {
    var total = compoundAmount(principal, rate, years, freq);
    return {
      principal: principal,
      interest: total - principal,
      total: total,
      effectiveRate: effectiveRate(rate, freq)
    };
  }

  /** Year-by-year growth of simple and compound interest side by side. */
  function growthSeries(principal, rate, years, freq) {
    return timePoints(years).map(function (t) {
      var s = simpleAmount(principal, rate, t);
      var c = compoundAmount(principal, rate, t, freq);
      return { t: t, simple: s, compound: c, difference: c - s };
    });
  }

  /** Equated monthly instalment and the full amortization schedule. */
  function emi(principal, rate, years) {
    var n = Math.max(1, Math.round(years * 12));
    var i = rate / 1200;
    var payment = i === 0
      ? principal / n
      : (principal * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    var balance = principal;
    var schedule = [];
    for (var m = 1; m <= n; m++) {
      var interest = balance * i;
      var princ = m === n ? balance : payment - interest; // absorb drift in the last month
      balance = m === n ? 0 : balance - princ;
      schedule.push({
        month: m,
        payment: princ + interest,
        principal: princ,
        interest: interest,
        balance: Math.max(0, balance)
      });
    }
    return {
      months: n,
      emi: payment,
      total: payment * n,
      interest: payment * n - principal,
      principal: principal,
      schedule: schedule
    };
  }

  /**
   * Recurring monthly deposit (SIP / RD) compounded monthly.
   * timing: 'start' deposits at the start of each month, 'end' at month end.
   */
  function recurring(monthly, rate, years, timing) {
    var n = Math.max(1, Math.round(years * 12));
    var i = rate / 1200;
    function balanceAt(m) {
      if (i === 0) return monthly * m;
      var fv = (monthly * (Math.pow(1 + i, m) - 1)) / i;
      return timing === 'end' ? fv : fv * (1 + i);
    }
    var total = balanceAt(n);
    var yearly = [{ month: 0, t: 0, invested: 0, balance: 0, interest: 0 }];
    var ms = [];
    for (var k = 12; k < n; k += 12) ms.push(k);
    ms.push(n);
    ms.forEach(function (m) {
      var b = balanceAt(m);
      yearly.push({ month: m, t: m / 12, invested: monthly * m, balance: b, interest: b - monthly * m });
    });
    return {
      months: n,
      invested: monthly * n,
      total: total,
      interest: total - monthly * n,
      yearly: yearly
    };
  }

  /** Fixed deposit maturity (cumulative scheme, compounded `freq` times a year). */
  function fixedDeposit(principal, rate, years, freq) {
    var c = compoundInterest(principal, rate, years, freq);
    c.series = timePoints(years).map(function (t) {
      var b = compoundAmount(principal, rate, t, freq);
      return { t: t, balance: b, interest: b - principal };
    });
    return c;
  }

  /** Serialise rows (arrays of primitives) to RFC 4180 CSV. */
  function toCSV(rows) {
    return rows
      .map(function (row) {
        return row
          .map(function (cell) {
            var s = cell === null || cell === undefined ? '' : String(cell);
            return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          })
          .join(',');
      })
      .join('\r\n');
  }

  return {
    FREQUENCIES: FREQUENCIES,
    timePoints: timePoints,
    simpleAmount: simpleAmount,
    compoundAmount: compoundAmount,
    effectiveRate: effectiveRate,
    simpleInterest: simpleInterest,
    compoundInterest: compoundInterest,
    growthSeries: growthSeries,
    emi: emi,
    recurring: recurring,
    fixedDeposit: fixedDeposit,
    toCSV: toCSV
  };
});
