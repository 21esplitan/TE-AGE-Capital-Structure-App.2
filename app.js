// app.js: reads the CSV files in data/ and draws the page.
// All the math lives in capstruct.js. Nothing is sent to any other website.

(function () {
  'use strict';
  var CS = window.CapStruct;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Formatting (round half up, then show) ----------
  function fix(x, d) { return CS.roundHalfUp(x, d).toFixed(d); }
  function dollars(x) {
    var r = CS.roundHalfUp(x, 0);
    return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US');
  }
  function price(x) { return (x < 0 ? '−$' : '$') + fix(Math.abs(x), 2); }
  function pct(x) { return fix(x * 100, 2) + '%'; }
  function mult(x) { return x === null ? 'n/a' : fix(x, 2) + '×'; }
  function shares(x) {
    return Number(fix(x, 2)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function rate(x) { return x === null ? '—' : pct(x); }

  // ---------- Loading ----------
  function load(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('Could not read ' + path + ' (' + r.status + ')');
      return r.text();
    }).then(CS.parseCSV);
  }

  // Page state
  var inputs, tables, firmU, cdssIdx = 0, firmDebt = 0;

  Promise.all([
    load('data/cdss.csv'),
    load('data/assumptions.csv'),
    load('data/banker_schedule.csv'),
    load('data/example_firms.csv'),
    load('data/ebit_scenarios.csv')
  ]).then(function (r) {
    inputs = CS.buildInputs({
      cdss: r[0], assumptions: r[1], schedule: r[2], example: r[3], scenarios: r[4]
    });
    $('status').remove();
    init();
  }).catch(function (err) {
    $('status').textContent =
      'Something went wrong loading the data: ' + err.message +
      '. If you opened index.html straight from your files, the browser blocks reading the CSVs; use the published address instead.';
  });

  function init() {
    var ex = inputs.example;
    tables = CS.cdssTable(inputs);
    firmU = CS.firmStatement(inputs.scenarios, ex.assets, 0, ex.rate, inputs.T);

    // CDSS slider: one stop per row of the banker's schedule, nothing in between.
    var cs = $('cdss-slider');
    cs.min = 0; cs.max = inputs.schedule.length - 1; cs.step = 1;
    $('cdss-ticks').innerHTML = inputs.schedule.map(function (r) {
      return '<span>' + dollars(r.debt) + '</span>';
    }).join('');
    cs.addEventListener('input', function () { setCdss(Number(cs.value)); clearPickNote(); });

    // Firm L slider: 0 to slider_max in steps of slider_step.
    var fs = $('firm-slider');
    fs.min = 0; fs.max = ex.sliderMax; fs.step = ex.sliderStep;
    var ticks = [];
    for (var d = 0; d <= ex.sliderMax; d += ex.sliderStep) ticks.push('<span>' + dollars(d) + '</span>');
    $('firm-ticks').innerHTML = ticks.join('');
    fs.addEventListener('input', function () { setFirm(Number(fs.value)); });

    // Buttons
    $('best-btn').addEventListener('click', function () { pick('price', 'highest share price'); });
    $('eps-btn').addEventListener('click', function () { pick('eps', 'highest EPS'); });
    $('case-btn').addEventListener('click', function () { setFirm(ex.firmLDebt); });
    $('best-toggle').addEventListener('change', function (e) {
      $('best-btn').hidden = !e.target.checked;
    });
    $('david-btn').addEventListener('click', davidR);

    renderCdssTables();
    setCdss(0);
    setFirm(ex.firmLDebt);
  }

  // ---------- Buttons ----------
  function clearPickNote() { $('pick-note').textContent = ''; $('david-note').textContent = ''; }

  // Best price / Highest EPS: if both methods agree, go there. If not, go to
  // the case method's amount and name both.
  function pick(metric, label) {
    var p = CS.pickBest(tables, metric);
    setCdss(p.index);
    var s = inputs.schedule;
    $('david-note').textContent = '';
    $('pick-note').textContent = p.same
      ? 'Both methods give the ' + label + ' at ' + dollars(s[p.index].debt) + '.'
      : 'The methods disagree on the ' + label + ': the case method picks ' + dollars(s[p.caseIdx].debt) +
        ' and the new-price method picks ' + dollars(s[p.newIdx].debt) + '. Showing the case method’s amount.';
  }

  // "David R.": every debt lever to $0.
  function davidR() {
    var zero = 0;
    inputs.schedule.forEach(function (r, i) { if (r.debt < inputs.schedule[zero].debt) zero = i; });
    setCdss(zero);
    setFirm(0);
    $('pick-note').textContent = '';
    var best = CS.pickBest(tables, 'price').index;
    var here = tables.caseRows[zero], top = tables.caseRows[best];
    $('david-note').textContent = 'Debt-free: CDSS’s share price is ' + price(here.price) +
      ' (case method). The highest is ' + price(top.price) + ' at ' + dollars(top.debt) + '.';
  }

  // ---------- CDSS lever ----------
  function setCdss(i) {
    cdssIdx = i;
    var row = inputs.schedule[i];
    $('cdss-slider').value = i;
    $('cdss-amount').textContent = dollars(row.debt);
    $('cdss-rates').innerHTML = 'The banker’s rates at this amount: cost of debt r<sub>d</sub> = ' +
      rate(row.rd) + ', cost of equity r<sub>s</sub> = ' + pct(row.rs) + '.';
    renderLever();
    document.querySelectorAll('.cdss-table tbody').forEach(function (tb) {
      Array.prototype.forEach.call(tb.rows, function (tr, k) { tr.classList.toggle('selected', k === i); });
    });
  }

  function stakeCell(st) {
    if (st.kind === 'sell') return 'Not possible';
    return pct(st.value);
  }

  function renderLever() {
    var c = tables.caseRows[cdssIdx], n = tables.newRows[cdssIdx];
    var cc = inputs.cdss;
    var cs = CS.managementStake(cc, c.repurchased), ns = CS.managementStake(cc, n.repurchased);

    function row(label, a, b) { return '<tr><th scope="row">' + label + '</th><td>' + a + '</td><td>' + b + '</td></tr>'; }
    var html = '<table class="lever-table"><thead><tr><th></th><th>Case: buy at $20</th><th>New-price method</th></tr></thead><tbody>' +
      row('Share price', price(c.price), price(n.price)) +
      row('Shares repurchased', shares(c.repurchased), shares(n.repurchased)) +
      row('Shares remaining', shares(c.remaining), shares(n.remaining)) +
      row('EPS', price(c.eps), price(n.eps)) +
      row('Dividends per share', price(c.dps), price(n.dps)) +
      row('TIE', mult(c.tie), mult(n.tie)) +
      row('WACC <span class="hint">(book | market weights)</span>', pct(c.wacc), pct(n.wacc)) +
      row('Management’s stake', stakeCell(cs), stakeCell(ns)) +
      '</tbody></table>';
    $('cdss-lever').innerHTML = html;

    // Notes for the two special cases.
    var notes = '';
    [['Case method', cs], ['New-price method', ns]].forEach(function (p) {
      if (p[1].kind === 'all') {
        notes += '<p class="note">' + p[0] + ': management would own 100.00%, because the buyback uses every outside share. No outside shareholders would be left.</p>';
      } else if (p[1].kind === 'sell') {
        notes += '<div class="warning">' + p[0] + ': the buyback is larger than the outside investors’ shares by ' +
          shares(p[1].excess) + ' shares, so management would have to sell. There is no stake to show.</div>';
      }
    });
    $('stake-notes').innerHTML = notes;
  }

  // ---------- Firm L lever ----------
  function setFirm(debt) {
    firmDebt = debt;
    var ex = inputs.example;
    $('firm-slider').value = debt;
    $('firm-amount').textContent = dollars(debt);
    var l = CS.firmStatement(inputs.scenarios, ex.assets, debt, ex.rate, inputs.T);

    // Side-by-side: ROE and TIE in each kind of year, then the summary measures.
    function yearLabel(y) { return 'EBIT ' + dollars(y.ebit) + ' (' + fix(y.prob * 100, 0) + '%)'; }
    function row(label, a, b) { return '<tr><th scope="row">' + label + '</th><td>' + a + '</td><td>' + b + '</td></tr>'; }
    function stat(label, a, b) { return '<tr class="stat"><th scope="row">' + label + '</th><td>' + a + '</td><td>' + b + '</td></tr>'; }
    var html = '<table class="firm-compare"><thead><tr><th></th><th>Firm U<br><span class="hint">no debt</span></th>' +
      '<th>Firm L<br><span class="hint">' + dollars(debt) + ' of debt</span></th></tr></thead><tbody>';
    firmU.years.forEach(function (y, i) {
      html += row('ROE, ' + yearLabel(y), pct(y.roe), pct(l.years[i].roe));
    });
    firmU.years.forEach(function (y, i) {
      html += row('TIE, ' + yearLabel(y), mult(y.tie), mult(l.years[i].tie));
    });
    html += stat('E(ROE)', pct(firmU.eRoe), pct(l.eRoe));
    html += stat('σ(ROE)', pct(firmU.sdRoe), pct(l.sdRoe));
    html += stat('CV', fix(firmU.cvRoe, 2), fix(l.cvRoe, 2));
    html += stat('E(TIE)', mult(firmU.eTie), mult(l.eTie));
    html += stat('σ(TIE)', mult(firmU.sdTie), mult(l.sdTie));
    $('firm-compare').innerHTML = html + '</tbody></table>';

    $('firm-u').innerHTML = firmTable('Firm U (no debt)', firmU);
    $('firm-l').innerHTML = firmTable('Firm L (' + dollars(debt) + ' of debt at ' + pct(ex.rate) + ')', l);
  }

  // Income statement for one firm, one column per kind of year.
  function firmTable(title, f) {
    var y = f.years;
    function row(label, cells) {
      return '<tr><th scope="row">' + label + '</th>' +
        cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
    }
    var html = '<h4>' + title + '</h4><table><thead><tr><th></th>' +
      y.map(function (_, i) { return '<th>Year ' + (i + 1) + '</th>'; }).join('') + '</tr></thead><tbody>';
    html += row('Assets', y.map(function () { return dollars(f.assets); }));
    html += row('Equity', y.map(function () { return dollars(f.equity); }));
    html += row('Probability', y.map(function (v) { return fix(v.prob, 2); }));
    html += row('Sales', y.map(function (v) { return dollars(v.sales); }));
    html += row('Oper. costs', y.map(function (v) { return '(' + dollars(v.opCosts) + ')'; }));
    html += row('EBIT', y.map(function (v) { return dollars(v.ebit); }));
    html += row('Interest', y.map(function (v) { return '(' + dollars(v.interest) + ')'; }));
    html += row('EBT', y.map(function (v) { return dollars(v.ebt); }));
    html += row('Taxes', y.map(function (v) { return '(' + dollars(v.taxes) + ')'; }));
    html += row('Net income', y.map(function (v) { return dollars(v.netIncome); }));
    html += row('ROE', y.map(function (v) { return pct(v.roe); }));
    html += row('TIE', y.map(function (v) { return mult(v.tie); }));
    return html + '</tbody></table>';
  }

  // ---------- CDSS: every amount in the schedule ----------
  function cdssTable(rows, cols, bestCols) {
    var head = '<tr>' + cols.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r, i) {
      return '<tr>' + cols.map(function (c) {
        var best = bestCols && bestCols[c.key] === i ? ' class="best"' : '';
        // data-label is shown by CSS on phones and can't hold HTML, so use plain text.
        return '<td data-label="' + (c.plain || c.label) + '"' + best + '>' + c.fmt(r) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table class="cdss-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  function renderCdssTables() {
    var t = tables, T = inputs.T;

    // Highest price and lowest WACC under each method (ties go to less debt).
    var best = {
      casePrice: CS.bestIndex(t.caseRows, function (r) { return r.price; }, true),
      caseWacc: CS.bestIndex(t.caseRows, function (r) { return r.wacc; }, false),
      newPrice: CS.bestIndex(t.newRows, function (r) { return r.price; }, true),
      newWacc: CS.bestIndex(t.newRows, function (r) { return r.wacc; }, false)
    };

    var common = [
      { key: 'debt', label: 'Debt', fmt: function (r) { return dollars(r.debt); } },
      { key: 'rd', label: 'r<sub>d</sub>', plain: 'Cost of debt (r_d)', fmt: function (r) { return rate(r.rd); } },
      { key: 'rs', label: 'r<sub>s</sub>', plain: 'Cost of equity (r_s)', fmt: function (r) { return pct(r.rs); } },
      { key: 'repurchased', label: 'Shares repurchased', fmt: function (r) { return shares(r.repurchased); } },
      { key: 'remaining', label: 'Shares remaining', fmt: function (r) { return shares(r.remaining); } },
      { key: 'eps', label: 'EPS', fmt: function (r) { return price(r.eps); } },
      { key: 'tie', label: 'TIE', fmt: function (r) { return mult(r.tie); } },
      { key: 'price', label: 'Share price', fmt: function (r) { return price(r.price); } },
      { key: 'wacc', label: 'WACC', fmt: function (r) { return pct(r.wacc); } }
    ];

    $('case-table').innerHTML = cdssTable(t.caseRows, common, { price: best.casePrice, wacc: best.caseWacc });
    $('new-table').innerHTML = cdssTable(t.newRows, common, { price: best.newPrice, wacc: best.newWacc });

    // Warnings and checks: shown, never hidden.
    var warn = '';
    var base = CS.baselineCheck(inputs);
    if (!base.ok) {
      warn += '<div class="warning">Check failed: with no debt, EPS / r<sub>s</sub> is ' +
        (base.impliedPrice === undefined ? 'unavailable' : price(base.impliedPrice)) +
        (base.filePrice === undefined ? '' : ', but the share price in cdss.csv is ' + price(base.filePrice)) +
        '. ' + (base.reason || '') + '</div>';
    } else {
      warn += '<p class="ok-note">Check passed: with no debt, EPS / r<sub>s</sub> = ' +
        price(base.impliedPrice) + ', matching the share price in cdss.csv.</p>';
    }
    t.newRows.forEach(function (r) {
      if (!r.epsCheck) warn += '<div class="warning">New-price check failed at ' + dollars(r.debt) +
        ': EPS does not equal r<sub>s</sub> × price.</div>';
      if (!r.waccCheck) warn += '<div class="warning">New-price check failed at ' + dollars(r.debt) +
        ': market-weight WACC does not equal EBIT × (1 − T) / V.</div>';
    });
    $('warnings').innerHTML = warn;

    // Which amount wins under each method? Say so, and say when they disagree.
    function amt(rows, i) { return dollars(rows[i].debt); }
    var s = '<h3>Which amount of debt wins?</h3><ul>' +
      '<li>Case method: highest price at ' + amt(t.caseRows, best.casePrice) +
      ' (' + price(t.caseRows[best.casePrice].price) + '); lowest book-weight WACC at ' +
      amt(t.caseRows, best.caseWacc) + ' (' + pct(t.caseRows[best.caseWacc].wacc) + ').</li>' +
      '<li>New-price method: highest price at ' + amt(t.newRows, best.newPrice) +
      ' (' + price(t.newRows[best.newPrice].price) + '); lowest market-weight WACC at ' +
      amt(t.newRows, best.newWacc) + ' (' + pct(t.newRows[best.newWacc].wacc) + ').</li></ul>';
    var all = [best.casePrice, best.caseWacc, best.newPrice, best.newWacc];
    var agree = all.every(function (i) { return t.caseRows[i].debt === t.caseRows[all[0]].debt; });
    s += agree
      ? '<p class="ok-note">All four measures point to the same amount of debt.</p>'
      : '<div class="warning">The four measures do not all point to the same amount of debt. Compare them before picking one.</div>';
    s += '<p class="note">Green cells mark the best amount in each column; the yellow row is the amount on the slider. Tax rate: ' +
      pct(T) + '. Every figure comes from the files in data/.</p>';
    $('summary').innerHTML = s;
  }
})();
