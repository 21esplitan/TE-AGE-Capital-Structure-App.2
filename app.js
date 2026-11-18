// app.js: reads the CSV files in data/ and draws the page.
// All the math lives in capstruct.js. Nothing is sent to any other website.

(function () {
  'use strict';
  var CS = window.CapStruct;

  // ---------- Formatting (round half up, then show) ----------
  function fix(x, d) { return CS.roundHalfUp(x, d).toFixed(d); }
  function dollars(x) {
    var r = CS.roundHalfUp(x, 0);
    var s = Math.abs(r).toLocaleString('en-US');
    return (r < 0 ? '−$' : '$') + s;
  }
  function price(x) { return (x < 0 ? '−$' : '$') + fix(Math.abs(x), 2); }
  function pct(x) { return fix(x * 100, 2) + '%'; }
  function mult(x) { return x === null ? 'n/a' : fix(x, 2) + '×'; }
  function shares(x) { return Number(fix(x, 2)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function rate(x) { return x === null ? '—' : pct(x); }

  // ---------- Loading ----------
  function load(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('Could not read ' + path + ' (' + r.status + ')');
      return r.text();
    }).then(CS.parseCSV);
  }

  Promise.all([
    load('data/cdss.csv'),
    load('data/assumptions.csv'),
    load('data/banker_schedule.csv'),
    load('data/example_firms.csv'),
    load('data/ebit_scenarios.csv')
  ]).then(function (r) {
    var inputs = CS.buildInputs({
      cdss: r[0], assumptions: r[1], schedule: r[2], example: r[3], scenarios: r[4]
    });
    document.getElementById('status').remove();
    renderFirms(inputs);
    renderCdss(inputs);
  }).catch(function (err) {
    document.getElementById('status').textContent =
      'Something went wrong loading the data: ' + err.message +
      '. If you opened index.html straight from your files, the browser blocks reading the CSVs; use the published address instead.';
  });

  // ---------- Firm U and Firm L ----------
  function firmTable(title, f, withDebt) {
    var y = f.years;
    function row(label, cells, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + label + '</th>' +
        cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
    }
    function stat(label, value) {
      return '<tr class="stat"><th scope="row">' + label + '</th><td colspan="3">' + value + '</td></tr>';
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
    html += stat('E(ROE)', pct(f.eRoe));
    html += stat('σ(ROE)', pct(f.sdRoe));
    html += stat('CV(ROE)', fix(f.cvRoe, 2));
    html += stat('E(TIE)', mult(f.eTie));
    html += stat('σ(TIE)', mult(f.sdTie));
    return html + '</tbody></table>';
  }

  function renderFirms(inputs) {
    var ex = inputs.example, T = inputs.T;
    var u = CS.firmStatement(inputs.scenarios, ex.assets, 0, ex.rate, T);
    var l = CS.firmStatement(inputs.scenarios, ex.assets, ex.firmLDebt, ex.rate, T);
    document.getElementById('firm-u').innerHTML = firmTable('Firm U (no debt)', u);
    document.getElementById('firm-l').innerHTML =
      firmTable('Firm L (' + dollars(ex.firmLDebt) + ' of debt at ' + pct(ex.rate) + ')', l);
  }

  // ---------- CDSS ----------
  // Build one table: a card/row per amount of debt. "cols" lists the columns.
  function cdssTable(rows, cols, bestCols) {
    var head = '<tr>' + cols.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r, i) {
      return '<tr>' + cols.map(function (c) {
        var best = bestCols && bestCols[c.key] === i ? ' class="best"' : '';
        return '<td data-label="' + c.label + '"' + best + '>' + c.fmt(r) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table class="cdss-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  function renderCdss(inputs) {
    var t = CS.cdssTable(inputs);
    var T = inputs.T;

    // Highest price and lowest WACC under each method (ties go to less debt).
    var best = {
      casePrice: CS.bestIndex(t.caseRows, function (r) { return r.price; }, true),
      caseWacc: CS.bestIndex(t.caseRows, function (r) { return r.wacc; }, false),
      newPrice: CS.bestIndex(t.newRows, function (r) { return r.price; }, true),
      newWacc: CS.bestIndex(t.newRows, function (r) { return r.wacc; }, false)
    };

    var common = [
      { key: 'debt', label: 'Debt', fmt: function (r) { return dollars(r.debt); } },
      { key: 'rd', label: 'r<sub>d</sub>', fmt: function (r) { return rate(r.rd); } },
      { key: 'rs', label: 'r<sub>s</sub>', fmt: function (r) { return pct(r.rs); } },
      { key: 'repurchased', label: 'Shares repurchased', fmt: function (r) { return shares(r.repurchased); } },
      { key: 'remaining', label: 'Shares remaining', fmt: function (r) { return shares(r.remaining); } },
      { key: 'eps', label: 'EPS', fmt: function (r) { return price(r.eps); } },
      { key: 'tie', label: 'TIE', fmt: function (r) { return mult(r.tie); } },
      { key: 'price', label: 'Share price', fmt: function (r) { return price(r.price); } },
      { key: 'wacc', label: 'WACC', fmt: function (r) { return pct(r.wacc); } }
    ];

    document.getElementById('case-table').innerHTML = cdssTable(t.caseRows, common, {
      price: best.casePrice, wacc: best.caseWacc
    });
    document.getElementById('new-table').innerHTML = cdssTable(t.newRows, common, {
      price: best.newPrice, wacc: best.newWacc
    });

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
    document.getElementById('warnings').innerHTML = warn;

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
    s += '<p class="note">Green cells mark the best amount in each column. Tax rate: ' + pct(T) +
      '. Every figure comes from the files in data/.</p>';
    document.getElementById('summary').innerHTML = s;
  }
})();
