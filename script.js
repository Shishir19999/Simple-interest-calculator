(function () {
  'use strict';

  var M = window.FinMath;
  var doc = document;
  var $ = function (id) { return doc.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------------------------------------------------------- storage */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  /* --------------------------------------------------------------- currency */
  var CURRENCIES = [
    ['INR', 'en-IN', 'Indian rupee (INR)'],
    ['USD', 'en-US', 'US dollar (USD)'],
    ['EUR', 'de-DE', 'Euro (EUR)'],
    ['GBP', 'en-GB', 'Pound sterling (GBP)'],
    ['JPY', 'ja-JP', 'Japanese yen (JPY)'],
    ['AUD', 'en-AU', 'Australian dollar (AUD)'],
    ['CAD', 'en-CA', 'Canadian dollar (CAD)'],
    ['CHF', 'de-CH', 'Swiss franc (CHF)'],
    ['AED', 'en-AE', 'UAE dirham (AED)'],
    ['SGD', 'en-SG', 'Singapore dollar (SGD)']
  ];
  var currency = CURRENCIES[0];
  var fmtCache = {};

  function nf(key, opts) {
    var k = currency[0] + key;
    if (!fmtCache[k]) fmtCache[k] = new Intl.NumberFormat(currency[1], opts);
    return fmtCache[k];
  }
  function money(v) { return nf('m', { style: 'currency', currency: currency[0] }).format(v); }
  function compact(v) { return nf('c', { notation: 'compact', maximumFractionDigits: 1 }).format(v); }
  function plain(v) { return nf('n', { maximumFractionDigits: 4 }).format(v); }
  function pct(v) { return nf('p', { maximumFractionDigits: 2 }).format(v) + '%'; }
  function currencySymbol() {
    var parts = nf('m', { style: 'currency', currency: currency[0] }).formatToParts(0);
    for (var i = 0; i < parts.length; i++) if (parts[i].type === 'currency') return parts[i].value;
    return currency[0];
  }
  function yearsText(y) { return plain(y) + (y === 1 ? ' year' : ' years'); }

  /* ------------------------------------------------------------ definitions */
  var FREQ_OPTIONS = M.FREQUENCIES.map(function (f) { return { value: String(f.value), label: f.label }; });

  function fPrincipal(o) {
    return Object.assign({ id: 'p', label: 'Principal amount', kind: 'money', min: 1, max: 1e10,
      smin: 1000, smax: 1000000, sstep: 1000, def: 10000 }, o || {});
  }
  function fRate(o) {
    return Object.assign({ id: 'r', label: 'Annual interest rate', kind: 'pct', min: 0, max: 100,
      smin: 0, smax: 30, sstep: 0.1, def: 8 }, o || {});
  }
  function fYears(o) {
    return Object.assign({ id: 'y', label: 'Time period', kind: 'years', min: 0.1, max: 100,
      smin: 1, smax: 40, sstep: 0.5, def: 3 }, o || {});
  }
  function fFreq(def, label) {
    return { id: 'n', label: label || 'Compounding frequency', kind: 'select', options: FREQ_OPTIONS, def: def };
  }

  function addMonths(years) {
    var d = new Date();
    d.setMonth(d.getMonth() + Math.round(years * 12));
    return new Intl.DateTimeFormat(currency[1], { month: 'long', year: 'numeric' }).format(d);
  }
  function freqLabel(v) {
    for (var i = 0; i < FREQ_OPTIONS.length; i++) if (FREQ_OPTIONS[i].value === String(v)) return FREQ_OPTIONS[i].label.toLowerCase();
    return '';
  }
  function pointsOf(years, fn) { return M.timePoints(years).map(function (t) { return [t, fn(t)]; }); }

  var TABS = [
    {
      id: 'simple', label: 'Simple interest',
      desc: 'Interest is earned on the original amount only, so growth is a straight line.',
      fields: [fPrincipal(), fRate(), fYears()],
      run: function (v) {
        var r = M.simpleInterest(v.p, v.r, v.y);
        return {
          headline: 'Total ' + money(r.total) + ' (interest ' + money(r.interest) + ')',
          stats: [
            { label: 'Total amount', value: money(r.total), primary: true, sub: 'after ' + yearsText(v.y) },
            { label: 'Interest earned', value: money(r.interest) },
            { label: 'Principal', value: money(r.principal) }
          ],
          note: 'Matures around ' + addMonths(v.y) + '. Interest = principal x rate x time / 100.',
          series: [
            { name: 'Total with simple interest', pts: pointsOf(v.y, function (t) { return M.simpleAmount(v.p, v.r, t); }) },
            { name: 'Principal', pts: pointsOf(v.y, function () { return v.p; }), dashed: true, color: 3 }
          ],
          tableTitle: 'Year by year',
          table: {
            head: ['Year', 'Interest earned', 'Balance'], types: ['n', 'm', 'm'],
            rows: M.timePoints(v.y).map(function (t) { return [t, M.simpleAmount(v.p, v.r, t) - v.p, M.simpleAmount(v.p, v.r, t)]; })
          }
        };
      }
    },
    {
      id: 'compound', label: 'Compound interest',
      desc: 'Interest is added to the balance at each compounding step, so it earns interest too.',
      fields: [fPrincipal(), fRate(), fYears(), fFreq('1')],
      run: function (v) {
        var f = Number(v.n);
        var r = M.compoundInterest(v.p, v.r, v.y, f);
        return {
          headline: 'Total ' + money(r.total) + ' (interest ' + money(r.interest) + ')',
          stats: [
            { label: 'Total amount', value: money(r.total), primary: true, sub: freqLabel(v.n) + ' compounding' },
            { label: 'Interest earned', value: money(r.interest) },
            { label: 'Effective annual rate', value: pct(r.effectiveRate), sub: 'nominal ' + pct(v.r) }
          ],
          note: 'Matures around ' + addMonths(v.y) + '. The dashed line shows what simple interest would give.',
          series: [
            { name: 'Compound interest', pts: pointsOf(v.y, function (t) { return M.compoundAmount(v.p, v.r, t, f); }) },
            { name: 'Simple interest', pts: pointsOf(v.y, function (t) { return M.simpleAmount(v.p, v.r, t); }), dashed: true }
          ],
          tableTitle: 'Year by year',
          table: {
            head: ['Year', 'Simple balance', 'Compound balance', 'Extra from compounding'], types: ['n', 'm', 'm', 'm'],
            rows: M.growthSeries(v.p, v.r, v.y, f).map(function (g) { return [g.t, g.simple, g.compound, g.difference]; })
          }
        };
      }
    },
    {
      id: 'emi', label: 'EMI / Loan',
      desc: 'Fixed monthly instalment for a loan, with a full month-by-month amortization table.',
      fields: [
        fPrincipal({ label: 'Loan amount', smin: 50000, smax: 10000000, sstep: 50000, def: 1000000 }),
        fRate({ def: 8.5, smax: 25, sstep: 0.05 }),
        fYears({ label: 'Loan tenure', min: 0.25, max: 40, smax: 30, sstep: 0.25, def: 20 })
      ],
      run: function (v) {
        var e = M.emi(v.p, v.r, v.y);
        var yearly = [[0, v.p, 0]];
        var cum = 0;
        e.schedule.forEach(function (row) {
          cum += row.interest;
          if (row.month % 12 === 0 || row.month === e.months) yearly.push([row.month / 12, row.balance, cum]);
        });
        return {
          headline: 'EMI ' + money(e.emi) + ' x ' + e.months + ' months (interest ' + money(e.interest) + ')',
          stats: [
            { label: 'Monthly EMI', value: money(e.emi), primary: true, sub: 'for ' + e.months + ' months' },
            { label: 'Total interest', value: money(e.interest) },
            { label: 'Total payment', value: money(e.total), sub: 'principal + interest' }
          ],
          note: 'Loan ends around ' + addMonths(v.y) + '. Interest share of total payment: ' + pct(e.total ? (e.interest / e.total) * 100 : 0) + '.',
          series: [
            { name: 'Outstanding balance', pts: yearly.map(function (y) { return [y[0], y[1]]; }) },
            { name: 'Interest paid so far', pts: yearly.map(function (y) { return [y[0], y[2]]; }), dashed: true }
          ],
          tableTitle: 'Amortization schedule',
          table: {
            head: ['Month', 'Payment', 'Principal', 'Interest', 'Balance'], types: ['n', 'm', 'm', 'm', 'm'],
            rows: e.schedule.map(function (s) { return [s.month, s.payment, s.principal, s.interest, s.balance]; })
          }
        };
      }
    },
    {
      id: 'sip', label: 'SIP / Recurring deposit',
      desc: 'Invest a fixed amount every month at an expected annual return, compounded monthly.',
      fields: [
        fPrincipal({ id: 'm', label: 'Monthly deposit', smin: 500, smax: 100000, sstep: 500, def: 5000, max: 1e8 }),
        fRate({ def: 12, smax: 25, sstep: 0.1 }),
        fYears({ def: 10, min: 0.25, smax: 40, sstep: 1 }),
        { id: 't', label: 'Deposit timing', kind: 'select', def: 'start',
          options: [{ value: 'start', label: 'Start of each month' }, { value: 'end', label: 'End of each month' }] }
      ],
      run: function (v) {
        var r = M.recurring(v.m, v.r, v.y, v.t);
        return {
          headline: 'Maturity ' + money(r.total) + ' (invested ' + money(r.invested) + ')',
          stats: [
            { label: 'Maturity value', value: money(r.total), primary: true, sub: 'after ' + r.months + ' deposits' },
            { label: 'Amount invested', value: money(r.invested) },
            { label: 'Estimated gains', value: money(r.interest) }
          ],
          note: 'Matures around ' + addMonths(v.y) + '. Market-linked returns are not guaranteed; this assumes a constant rate.',
          series: [
            { name: 'Portfolio value', pts: r.yearly.map(function (y) { return [y.t, y.balance]; }) },
            { name: 'Amount invested', pts: r.yearly.map(function (y) { return [y.t, y.invested]; }), dashed: true, color: 3 }
          ],
          tableTitle: 'Year by year',
          table: {
            head: ['Year', 'Invested', 'Gains', 'Value'], types: ['n', 'm', 'm', 'm'],
            rows: r.yearly.map(function (y) { return [y.t, y.invested, y.interest, y.balance]; })
          }
        };
      }
    },
    {
      id: 'fd', label: 'FD maturity',
      desc: 'Maturity value of a fixed deposit where interest is added back to the deposit (cumulative scheme).',
      fields: [
        fPrincipal({ label: 'Deposit amount', def: 100000, smax: 2000000, sstep: 5000 }),
        fRate({ def: 7, smax: 15, sstep: 0.05 }),
        fYears({ label: 'Tenure', def: 5, min: 0.25, max: 30, smax: 15, sstep: 0.25 }),
        fFreq('4', 'Interest compounded')
      ],
      run: function (v) {
        var f = M.fixedDeposit(v.p, v.r, v.y, Number(v.n));
        return {
          headline: 'Maturity ' + money(f.total) + ' (interest ' + money(f.interest) + ')',
          stats: [
            { label: 'Maturity amount', value: money(f.total), primary: true, sub: 'after ' + yearsText(v.y) },
            { label: 'Interest earned', value: money(f.interest) },
            { label: 'Effective yield', value: pct(f.effectiveRate), sub: 'per year, ' + freqLabel(v.n) }
          ],
          note: 'Matures around ' + addMonths(v.y) + '. Tax on interest and premature withdrawal penalties are not included.',
          series: [
            { name: 'Deposit value', pts: f.series.map(function (s) { return [s.t, s.balance]; }) },
            { name: 'Deposit amount', pts: f.series.map(function (s) { return [s.t, v.p]; }), dashed: true, color: 3 }
          ],
          tableTitle: 'Year by year',
          table: {
            head: ['Year', 'Interest earned', 'Balance'], types: ['n', 'm', 'm'],
            rows: f.series.map(function (s) { return [s.t, s.interest, s.balance]; })
          }
        };
      }
    },
    {
      id: 'compare', label: 'Simple vs compound',
      desc: 'Put both methods side by side to see how much compounding adds over time.',
      fields: [fPrincipal(), fRate(), fYears({ def: 10 }), fFreq('12')],
      run: function (v) {
        var f = Number(v.n);
        var s = M.simpleInterest(v.p, v.r, v.y);
        var c = M.compoundInterest(v.p, v.r, v.y, f);
        var diff = c.total - s.total;
        return {
          headline: 'Simple ' + money(s.total) + ' vs compound ' + money(c.total) + ' (+' + money(diff) + ')',
          stats: [
            { label: 'Simple interest total', value: money(s.total), sub: 'interest ' + money(s.interest) },
            { label: 'Compound total', value: money(c.total), sub: 'interest ' + money(c.interest) },
            { label: 'Extra from compounding', value: money(diff), primary: true, sub: pct(s.interest ? (diff / s.interest) * 100 : 0) + ' more interest' }
          ],
          note: 'Compounded ' + freqLabel(v.n) + ' over ' + yearsText(v.y) + '.',
          series: [
            { name: 'Compound interest', pts: pointsOf(v.y, function (t) { return M.compoundAmount(v.p, v.r, t, f); }) },
            { name: 'Simple interest', pts: pointsOf(v.y, function (t) { return M.simpleAmount(v.p, v.r, t); }), dashed: true }
          ],
          tableTitle: 'Year by year',
          table: {
            head: ['Year', 'Simple balance', 'Compound balance', 'Difference'], types: ['n', 'm', 'm', 'm'],
            rows: M.growthSeries(v.p, v.r, v.y, f).map(function (g) { return [g.t, g.simple, g.compound, g.difference]; })
          }
        };
      }
    }
  ];

  function tabById(id) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i];
    return null;
  }

  /* ------------------------------------------------------------------ state */
  var state = { tab: TABS[0], values: {}, result: null, valid: false };
  TABS.forEach(function (t) {
    state.values[t.id] = {};
    t.fields.forEach(function (f) { state.values[t.id][f.id] = String(f.def); });
  });

  /* ------------------------------------------------------------- validation */
  function validateField(f, raw) {
    if (f.kind === 'select') {
      var ok = f.options.some(function (o) { return o.value === raw; });
      return ok ? { value: raw } : { error: 'Choose one of the options.' };
    }
    var s = String(raw).trim();
    if (s === '') return { error: f.label + ' is required.' };
    var n = Number(s);
    if (!isFinite(n)) return { error: 'Enter a valid number.' };
    if (n < f.min || n > f.max) {
      return { error: f.label + ' must be between ' + plain(f.min) + ' and ' + plain(f.max) + '.' };
    }
    return { value: n };
  }

  function validateAll() {
    var vals = state.values[state.tab.id];
    var out = {}, errors = {}, any = false;
    state.tab.fields.forEach(function (f) {
      var r = validateField(f, vals[f.id]);
      if (r.error) { errors[f.id] = r.error; any = true; } else out[f.id] = r.value;
    });
    return { values: out, errors: errors, ok: !any };
  }

  /* ------------------------------------------------------------------- tabs */
  var tabsEl = $('tabs');
  function buildTabs() {
    TABS.forEach(function (t, i) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.id = 'tab-' + t.id;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'panel');
      b.textContent = t.label; b.dataset.tab = t.id;
      b.addEventListener('click', function () { selectTab(t.id, true); });
      b.addEventListener('keydown', function (e) {
        var idx = i, k = e.key;
        if (k === 'ArrowRight') idx = (i + 1) % TABS.length;
        else if (k === 'ArrowLeft') idx = (i - 1 + TABS.length) % TABS.length;
        else if (k === 'Home') idx = 0;
        else if (k === 'End') idx = TABS.length - 1;
        else return;
        e.preventDefault();
        selectTab(TABS[idx].id, true);
      });
      tabsEl.appendChild(b);
    });
  }

  function selectTab(id, focus) {
    state.tab = tabById(id) || TABS[0];
    Array.prototype.forEach.call(tabsEl.children, function (b) {
      var on = b.dataset.tab === state.tab.id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on) {
        $('panel').setAttribute('aria-labelledby', b.id);
        if (focus) b.focus();
        if (b.scrollIntoView && focus) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
    $('panel-title').textContent = state.tab.label;
    $('panel-desc').textContent = state.tab.desc;
    buildForm();
    recalc();
  }

  /* ------------------------------------------------------------------- form */
  var inputs = {}; // id -> {num, range, err, wrap}

  function buildForm() {
    var host = $('fields');
    host.textContent = '';
    inputs = {};
    var vals = state.values[state.tab.id];
    state.tab.fields.forEach(function (f) {
      var wrap = doc.createElement('div'); wrap.className = 'field';
      var errId = 'err-' + f.id, inId = 'in-' + f.id;
      var label = doc.createElement('label'); label.htmlFor = inId; label.textContent = f.label;
      wrap.appendChild(label);
      var rec = { wrap: wrap };

      if (f.kind === 'select') {
        var sel = doc.createElement('select'); sel.id = inId; sel.className = 'control';
        f.options.forEach(function (o) {
          var op = doc.createElement('option'); op.value = o.value; op.textContent = o.label; sel.appendChild(op);
        });
        sel.value = vals[f.id];
        sel.addEventListener('change', function () { vals[f.id] = sel.value; recalc(); });
        wrap.appendChild(sel);
        rec.num = sel;
      } else {
        var group = doc.createElement('div'); group.className = 'input-group';
        var num = doc.createElement('input');
        num.type = 'number'; num.id = inId; num.step = 'any'; num.inputMode = 'decimal';
        num.min = f.min; num.max = f.max; num.value = vals[f.id];
        num.setAttribute('aria-describedby', errId);
        if (f.kind === 'money') {
          var pre = doc.createElement('span'); pre.className = 'affix currency-affix'; pre.textContent = currencySymbol();
          pre.setAttribute('aria-hidden', 'true'); group.appendChild(pre);
        }
        group.appendChild(num);
        if (f.kind !== 'money') {
          var suf = doc.createElement('span'); suf.className = 'affix'; suf.setAttribute('aria-hidden', 'true');
          suf.textContent = f.kind === 'pct' ? '% p.a.' : 'years'; group.appendChild(suf);
        }
        wrap.appendChild(group);

        var range = doc.createElement('input');
        range.type = 'range'; range.className = 'slider';
        range.min = f.smin; range.max = f.smax; range.step = f.sstep;
        range.value = vals[f.id];
        range.setAttribute('aria-label', f.label + ' slider');
        range.addEventListener('input', function () {
          vals[f.id] = range.value; num.value = range.value; recalc();
        });
        num.addEventListener('input', function () {
          vals[f.id] = num.value;
          if (num.value !== '' && isFinite(Number(num.value))) range.value = num.value;
          recalc();
        });
        wrap.appendChild(range);
        rec.num = num; rec.range = range;
      }
      var err = doc.createElement('div'); err.className = 'field-error'; err.id = errId;
      wrap.appendChild(err);
      rec.err = err;
      inputs[f.id] = rec;
      host.appendChild(wrap);
    });
  }

  function refreshCurrencyAffix() {
    var els = doc.querySelectorAll('.currency-affix');
    for (var i = 0; i < els.length; i++) els[i].textContent = currencySymbol();
  }

  function showErrors(errors) {
    state.tab.fields.forEach(function (f) {
      var rec = inputs[f.id]; if (!rec) return;
      var msg = errors[f.id] || '';
      rec.err.textContent = msg;
      rec.wrap.classList.toggle('invalid', !!msg);
      if (msg) rec.num.setAttribute('aria-invalid', 'true'); else rec.num.removeAttribute('aria-invalid');
    });
  }

  /* ------------------------------------------------------------ calculation */
  var srTimer = null;
  function recalc() {
    var v = validateAll();
    showErrors(v.errors);
    var results = doc.querySelector('.results');
    var box = $('error-box');
    state.valid = v.ok;
    if (!v.ok) {
      state.result = null;
      var msgs = Object.keys(v.errors).map(function (k) { return v.errors[k]; });
      box.hidden = false;
      box.textContent = 'Please fix the highlighted fields: ' + msgs.join(' ');
      results.classList.add('has-error');
      $('save').disabled = true; $('share').disabled = true; $('csv').disabled = true;
      return;
    }
    var res;
    try { res = state.tab.run(v.values); } catch (e) { res = null; }
    var finite = res && res.table.rows.every(function (r) { return r.every(isFinite); }) &&
      res.stats.every(function (s) { return s.value.indexOf('NaN') === -1 && s.value.indexOf('∞') === -1; });
    if (!finite) {
      state.result = null; state.valid = false;
      box.hidden = false;
      box.textContent = 'These values give a result too large to display. Try a smaller amount, rate or time period.';
      results.classList.add('has-error');
      $('save').disabled = true; $('share').disabled = true; $('csv').disabled = true;
      return;
    }
    box.hidden = true; box.textContent = '';
    results.classList.remove('has-error');
    $('save').disabled = false; $('share').disabled = false; $('csv').disabled = false;
    res.numeric = v.values;
    state.result = res;
    renderStats(res);
    renderChart();
    renderTable(res);
    $('print-inputs').textContent = state.tab.label + ': ' + summarize(state.tab, v.values);
    syncUrl();
    clearTimeout(srTimer);
    srTimer = setTimeout(function () { $('sr-status').textContent = res.headline; }, 700);
  }

  function summarize(tab, numeric) {
    return tab.fields.map(function (f) {
      var raw = numeric[f.id], txt;
      if (f.kind === 'money') txt = money(raw);
      else if (f.kind === 'pct') txt = pct(raw);
      else if (f.kind === 'years') txt = yearsText(raw);
      else txt = f.options.filter(function (o) { return o.value === String(raw); })[0].label;
      return f.label + ' ' + txt;
    }).join(', ');
  }

  /* ----------------------------------------------------------------- render */
  function renderStats(res) {
    var host = $('stats');
    host.textContent = '';
    host.setAttribute('aria-busy', 'false');
    res.stats.forEach(function (s) {
      var d = doc.createElement('div'); d.className = 'stat' + (s.primary ? ' primary' : '');
      var l = doc.createElement('div'); l.className = 'stat-label'; l.textContent = s.label;
      var val = doc.createElement('div'); val.className = 'stat-value'; val.textContent = s.value;
      d.appendChild(l); d.appendChild(val);
      if (s.sub) { var sub = doc.createElement('div'); sub.className = 'stat-sub'; sub.textContent = s.sub; d.appendChild(sub); }
      host.appendChild(d);
    });
    $('stat-note').textContent = res.note;
  }

  function cell(type, v) {
    if (type === 'm') return money(v);
    return plain(v);
  }

  function renderTable(res) {
    $('table-title').textContent = res.tableTitle;
    var t = $('table');
    t.textContent = '';
    var cap = doc.createElement('caption'); cap.className = 'sr-only';
    cap.textContent = res.tableTitle + ' for ' + state.tab.label; t.appendChild(cap);
    var thead = doc.createElement('thead'), tr = doc.createElement('tr');
    res.table.head.forEach(function (h) {
      var th = doc.createElement('th'); th.scope = 'col'; th.textContent = h; tr.appendChild(th);
    });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = doc.createElement('tbody');
    var frag = doc.createDocumentFragment();
    res.table.rows.forEach(function (row) {
      var r = doc.createElement('tr');
      row.forEach(function (v, i) {
        var td = doc.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) td.scope = 'row';
        td.textContent = cell(res.table.types[i], v);
        r.appendChild(td);
      });
      frag.appendChild(r);
    });
    tb.appendChild(frag); t.appendChild(tb);
  }

  /* ------------------------------------------------------------------ chart */
  var chartIdx = null;

  function el(tag, attrs, parent) {
    var n = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  function seriesColor(s, i) { return 'var(--c' + ((s.color || (i + 1))) + ')'; }

  function renderChart() {
    var res = state.result;
    var host = $('chart');
    if (!res) return;
    var width = host.clientWidth;
    if (!width) return;
    host.textContent = '';
    var small = width < 480;
    var height = small ? 240 : 320;
    var m = { l: small ? 46 : 56, r: 14, t: 12, b: 34 };
    var iw = width - m.l - m.r, ih = height - m.t - m.b;

    var series = res.series;
    var maxY = 0;
    series.forEach(function (s) { s.pts.forEach(function (p) { if (p[1] > maxY) maxY = p[1]; }); });
    if (maxY <= 0) maxY = 1;
    var step = niceStep(maxY / 4);
    var top = Math.ceil(maxY / step - 1e-9) * step;
    var xs = series[0].pts.map(function (p) { return p[0]; });
    var xmax = xs[xs.length - 1] || 1;
    var X = function (x) { return m.l + (x / xmax) * iw; };
    var Y = function (y) { return m.t + ih - (y / top) * ih; };

    var svg = el('svg', { width: width, height: height, viewBox: '0 0 ' + width + ' ' + height, role: 'img',
      'aria-label': 'Line chart of ' + series.map(function (s) { return s.name; }).join(' and ') + ' over ' + plain(xmax) + ' years. A table with the same data follows.' }, null);

    for (var v = 0; v <= top + step / 2; v += step) {
      el('line', { x1: m.l, x2: width - m.r, y1: Y(v), y2: Y(v), 'class': 'grid-line' }, svg);
      var tl = el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', 'class': 'axis-text' }, svg);
      tl.textContent = compact(v);
    }
    var xticks = [];
    if (xmax <= 1) { xticks = [0, xmax]; } else {
      var xs2 = niceStep(xmax / (small ? 4 : 8));
      for (var x = 0; x <= xmax + 1e-9; x += xs2) xticks.push(x);
    }
    xticks.forEach(function (x) {
      var t = el('text', { x: X(x), y: height - 12, 'text-anchor': 'middle', 'class': 'axis-text' }, svg);
      t.textContent = plain(Math.round(x * 100) / 100);
    });
    var xl = el('text', { x: m.l + iw, y: height - 1, 'text-anchor': 'end', 'class': 'axis-text' }, svg);
    xl.textContent = 'years';

    function path(pts) {
      return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join('');
    }
    var s0 = series[0];
    el('path', { d: path(s0.pts) + 'L' + X(xmax) + ',' + Y(0) + 'L' + X(0) + ',' + Y(0) + 'Z', fill: seriesColor(s0, 0), opacity: '.1' }, svg);
    series.slice().reverse().forEach(function (s) {
      var i = series.indexOf(s);
      var a = { d: path(s.pts), fill: 'none', stroke: seriesColor(s, i), 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      if (s.dashed) a['stroke-dasharray'] = '7 5';
      el('path', a, svg);
    });

    var guide = el('line', { y1: m.t, y2: m.t + ih, 'class': 'guide', visibility: 'hidden' }, svg);
    var dots = series.map(function (s, i) {
      return el('circle', { r: 5, fill: seriesColor(s, i), stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
    });
    var overlay = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);
    host.appendChild(svg);

    var tip = doc.createElement('div'); tip.className = 'tooltip'; tip.hidden = true; host.appendChild(tip);

    function show(idx) {
      chartIdx = idx;
      var x = X(xs[idx]);
      guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('visibility', 'visible');
      tip.textContent = '';
      var h = doc.createElement('strong');
      h.textContent = (xs[idx] === 0 ? 'Start' : 'Year ' + plain(Math.round(xs[idx] * 100) / 100));
      tip.appendChild(h);
      series.forEach(function (s, i) {
        dots[i].setAttribute('cx', x); dots[i].setAttribute('cy', Y(s.pts[idx][1])); dots[i].setAttribute('visibility', 'visible');
        var row = doc.createElement('div');
        var name = doc.createElement('span');
        var sw = doc.createElement('i'); sw.style.background = seriesColor(s, i);
        name.appendChild(sw); name.appendChild(doc.createTextNode(s.name));
        var val = doc.createElement('span'); val.textContent = money(s.pts[idx][1]);
        row.appendChild(name); row.appendChild(val); tip.appendChild(row);
      });
      tip.hidden = false;
      var tw = tip.offsetWidth;
      var left = x + 14;
      if (left + tw > width) left = x - tw - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = (m.t + 6) + 'px';
    }
    function hide() {
      chartIdx = null; tip.hidden = true; guide.setAttribute('visibility', 'hidden');
      dots.forEach(function (d) { d.setAttribute('visibility', 'hidden'); });
    }
    function nearest(evt) {
      var r = svg.getBoundingClientRect();
      var px = evt.clientX - r.left - m.l;
      var xv = (px / iw) * xmax, best = 0, bd = Infinity;
      xs.forEach(function (x, i) { var d = Math.abs(x - xv); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    overlay.addEventListener('pointermove', function (e) { show(nearest(e)); });
    overlay.addEventListener('pointerdown', function (e) { show(nearest(e)); });
    overlay.addEventListener('pointerleave', hide);
    host.onkeydown = function (e) {
      var i = chartIdx === null ? -1 : chartIdx, k = e.key;
      if (k === 'ArrowRight') i = Math.min(xs.length - 1, i + 1);
      else if (k === 'ArrowLeft') i = Math.max(0, i < 0 ? 0 : i - 1);
      else if (k === 'Home') i = 0;
      else if (k === 'End') i = xs.length - 1;
      else if (k === 'Escape') { hide(); return; }
      else return;
      e.preventDefault();
      show(i);
      $('sr-status').textContent = tip.textContent;
    };
    host.onblur = hide;

    var legend = $('legend'); legend.textContent = '';
    series.forEach(function (s, i) {
      var li = doc.createElement('li');
      var sv = el('svg', { viewBox: '0 0 28 8', 'aria-hidden': 'true' }, null);
      var ln = { x1: 1, x2: 27, y1: 4, y2: 4, stroke: seriesColor(s, i), 'stroke-width': 3, 'stroke-linecap': 'round' };
      if (s.dashed) ln['stroke-dasharray'] = '6 4';
      el('line', ln, sv);
      li.appendChild(sv); li.appendChild(doc.createTextNode(s.name));
      legend.appendChild(li);
    });
  }

  var lastW = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      var w = $('chart').clientWidth;
      if (w !== lastW) { lastW = w; renderChart(); }
    }).observe($('chart'));
  } else {
    window.addEventListener('resize', renderChart);
  }

  /* ------------------------------------------------------------------ toast */
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------------------------------------------------------------- history */
  var HKEY = 'sic.history.v1', HMAX = 30;
  function loadHistory() {
    try {
      var a = JSON.parse(store.get(HKEY) || '[]');
      return Array.isArray(a) ? a.filter(function (e) { return e && tabById(e.tab) && e.values; }) : [];
    } catch (e) { return []; }
  }
  function saveHistory(list) { return store.set(HKEY, JSON.stringify(list)); }

  function renderHistory() {
    var list = loadHistory();
    var ul = $('history-list');
    ul.textContent = '';
    $('history-empty').hidden = list.length > 0;
    $('clear-history').hidden = list.length === 0;
    list.forEach(function (e) {
      var tab = tabById(e.tab);
      var li = doc.createElement('li'); li.className = 'history-item';
      var main = doc.createElement('div'); main.className = 'h-main';
      var title = doc.createElement('div'); title.className = 'h-title'; title.textContent = tab.label + ': ' + e.headline;
      var meta = doc.createElement('div'); meta.className = 'h-meta';
      meta.textContent = e.summary + ' - ' + new Date(e.ts).toLocaleString(currency[1], { dateStyle: 'medium', timeStyle: 'short' });
      main.appendChild(title); main.appendChild(meta);
      var act = doc.createElement('div'); act.className = 'h-actions';
      var restore = doc.createElement('button'); restore.type = 'button'; restore.className = 'btn'; restore.textContent = 'Restore';
      restore.setAttribute('aria-label', 'Restore ' + tab.label + ' calculation from ' + new Date(e.ts).toLocaleString(currency[1]));
      restore.addEventListener('click', function () { restoreEntry(e); });
      var del = doc.createElement('button'); del.type = 'button'; del.className = 'btn btn-quiet'; del.textContent = 'Delete';
      del.setAttribute('aria-label', 'Delete ' + tab.label + ' calculation from ' + new Date(e.ts).toLocaleString(currency[1]));
      del.addEventListener('click', function () {
        saveHistory(loadHistory().filter(function (x) { return x.id !== e.id; }));
        renderHistory(); toast('Entry deleted');
        if (!loadHistory().length) $('save').focus();
      });
      act.appendChild(restore); act.appendChild(del);
      li.appendChild(main); li.appendChild(act); ul.appendChild(li);
    });
  }

  function restoreEntry(e) {
    setCurrency(e.cur, false);
    Object.keys(e.values).forEach(function (k) { state.values[e.tab][k] = String(e.values[k]); });
    selectTab(e.tab, false);
    $('panel').scrollIntoView({ behavior: 'auto', block: 'start' });
    toast('Calculation restored');
  }

  function saveCurrent() {
    if (!state.result) return;
    var list = loadHistory();
    list.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(), tab: state.tab.id, cur: currency[0],
      values: state.result.numeric, headline: state.result.headline,
      summary: summarize(state.tab, state.result.numeric)
    });
    if (list.length > HMAX) list.length = HMAX;
    if (saveHistory(list)) { renderHistory(); toast('Saved to history'); }
    else toast('Could not save: browser storage is unavailable');
  }

  var clearArmed = false, clearTimer = null;
  function clearHistory() {
    var b = $('clear-history');
    if (!clearArmed) {
      clearArmed = true; b.textContent = 'Click again to confirm';
      clearTimer = setTimeout(disarm, 4000); return;
    }
    disarm(); saveHistory([]); renderHistory(); toast('History cleared');
    $('save').focus();
  }
  function disarm() { clearArmed = false; clearTimeout(clearTimer); $('clear-history').textContent = 'Clear all'; }

  /* ------------------------------------------------------------ share / URL */
  function buildQuery() {
    var p = new URLSearchParams();
    p.set('t', state.tab.id); p.set('c', currency[0]);
    var vals = state.values[state.tab.id];
    state.tab.fields.forEach(function (f) { p.set(f.id, vals[f.id]); });
    return p.toString();
  }
  function shareUrl() { return location.origin === 'null' || location.protocol === 'file:' ? location.href.split('?')[0].split('#')[0] + '?' + buildQuery()
    : location.origin + location.pathname + '?' + buildQuery(); }
  function syncUrl() {
    try { history.replaceState(null, '', '?' + buildQuery()); } catch (e) { /* file:// or sandboxed */ }
  }
  function copyShare() {
    var url = shareUrl();
    function fallback() {
      var ta = doc.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; doc.body.appendChild(ta); ta.select();
      var ok = false; try { ok = doc.execCommand('copy'); } catch (e) {}
      doc.body.removeChild(ta);
      toast(ok ? 'Link copied' : 'Copy failed. Copy the address bar link instead.');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () { toast('Link copied'); }, fallback);
    } else fallback();
  }
  function applyQuery() {
    var p = new URLSearchParams(location.search);
    var c = p.get('c');
    if (c) setCurrency(c, false);
    var tab = tabById(p.get('t'));
    if (!tab) return TABS[0].id;
    tab.fields.forEach(function (f) {
      var raw = p.get(f.id);
      if (raw !== null && !validateField(f, raw).error) state.values[tab.id][f.id] = raw;
    });
    return tab.id;
  }

  /* -------------------------------------------------------------------- CSV */
  function exportCsv() {
    var res = state.result; if (!res) return;
    var rows = [[state.tab.label], ['Currency', currency[0]]];
    state.tab.fields.forEach(function (f) { rows.push([f.label, state.result.numeric[f.id]]); });
    res.stats.forEach(function (s) { rows.push([s.label, s.value]); });
    rows.push([]);
    rows.push(res.table.head);
    res.table.rows.forEach(function (r) {
      rows.push(r.map(function (v, i) { return res.table.types[i] === 'm' ? v.toFixed(2) : Math.round(v * 100) / 100; }));
    });
    var blob = new Blob([M.toCSV(rows)], { type: 'text/csv;charset=utf-8' });
    var a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'finance-toolkit-' + state.tab.id + '.csv';
    doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('CSV downloaded');
  }

  /* ---------------------------------------------------------- currency pick */
  function setCurrency(code, rerender) {
    var found = CURRENCIES.filter(function (c) { return c[0] === code; })[0];
    if (!found) return;
    currency = found;
    $('currency').value = code;
    store.set('sic.currency', code);
    refreshCurrencyAffix();
    if (rerender) { recalc(); renderHistory(); }
  }

  /* ------------------------------------------------------------------ theme */
  var themeBtn = $('theme');
  function applyTheme(t, persist) {
    doc.documentElement.setAttribute('data-theme', t);
    if (persist) store.set('sic.theme', t);
    themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeBtn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  }
  themeBtn.addEventListener('click', function () {
    applyTheme(doc.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function (e) { var s = store.get('sic.theme'); if (s !== 'light' && s !== 'dark') applyTheme(e.matches ? 'dark' : 'light', false); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme);
  }

  /* ------------------------------------------------- motion: reveal, parallax */
  var rm = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function initReveal() {
    var items = doc.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || rm.matches) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('static');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -5% 0px' });
    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  var parallax = (function () {
    var layers = Array.prototype.slice.call(doc.querySelectorAll('[data-parallax]'));
    var hero = doc.querySelector('.hero');
    var active = false, visible = true, ticking = false, io = null;
    var narrow = window.matchMedia ? matchMedia('(max-width: 699px)') : { matches: false };

    function allowed() {
      var conn = navigator.connection;
      var lowPower = (conn && conn.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
      return !rm.matches && !narrow.matches && !lowPower && !!hero;
    }
    function apply() {
      ticking = false;
      var y = Math.min(window.scrollY, hero.offsetHeight + 200);
      layers.forEach(function (l) {
        l.style.transform = 'translate3d(0,' + (y * parseFloat(l.dataset.parallax)).toFixed(1) + 'px,0)';
      });
    }
    function onScroll() {
      if (active && visible && !ticking) { ticking = true; requestAnimationFrame(apply); }
    }
    function reset() { layers.forEach(function (l) { l.style.transform = ''; }); }
    function update() {
      var want = allowed();
      if (want === active) return;
      active = want;
      doc.documentElement.setAttribute('data-parallax', active ? 'on' : 'off');
      if (active) { apply(); } else reset();
    }
    function init() {
      if (!hero) return;
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) onScroll(); });
        io.observe(hero);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', update);
      [rm, narrow].forEach(function (q) { if (q.addEventListener) q.addEventListener('change', update); });
      doc.documentElement.setAttribute('data-parallax', 'off');
      update();
    }
    return { init: init };
  })();

  /* ------------------------------------------------------------------- init */
  function init() {
    CURRENCIES.forEach(function (c) {
      var o = doc.createElement('option'); o.value = c[0]; o.textContent = c[2]; $('currency').appendChild(o);
    });
    var savedCur = store.get('sic.currency');
    if (savedCur) setCurrency(savedCur, false);
    $('currency').value = currency[0];
    $('currency').addEventListener('change', function () { setCurrency(this.value, true); });

    applyTheme(doc.documentElement.getAttribute('data-theme') || 'light', false);

    buildTabs();
    var startTab = applyQuery();
    selectTab(startTab, false);

    $('save').addEventListener('click', saveCurrent);
    $('share').addEventListener('click', copyShare);
    $('csv').addEventListener('click', exportCsv);
    $('print').addEventListener('click', function () { window.print(); });
    $('clear-history').addEventListener('click', clearHistory);
    $('reset').addEventListener('click', function () {
      state.tab.fields.forEach(function (f) { state.values[state.tab.id][f.id] = String(f.def); });
      buildForm(); recalc(); toast('Reset to defaults');
    });
    $('calc').addEventListener('submit', function (e) { e.preventDefault(); });

    renderHistory();
    initReveal();
    parallax.init();
  }

  init();
})();
