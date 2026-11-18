// capstruct.js: the finance math for the AGE capital structure app.
// Plain functions only. Nothing here touches the page, so Node can check it.
//
// Notation: T = tax rate, D = amount borrowed, n = shares outstanding before
// any buyback, P0 = today's price, A = total book assets.

(function (root) {
  'use strict';

  // ---------- Rounding for display ----------
  // Round half up on the decimal value. toPrecision(12) first removes binary
  // noise (e.g. 3.4949999999999997 becomes 3.495) so that exact halves round up.
  function roundHalfUp(x, d) {
    return Math.round(Number((x * Math.pow(10, d)).toPrecision(12))) / Math.pow(10, d);
  }

  // ---------- Reading the CSV text ----------
  // Small CSV reader: handles quoted fields, returns an array of objects.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else { field += c; }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    var header = rows.shift().map(function (h) { return h.trim(); });
    return rows.map(function (r) {
      var o = {};
      header.forEach(function (h, i) { o[h] = (r[i] === undefined ? '' : r[i]).trim(); });
      return o;
    });
  }

  // An empty cell means "no value" (for example the $0 row has no cost of debt).
  function num(s) { return s === '' || s === undefined ? null : Number(s); }

  // ---------- Turning the parsed files into inputs ----------
  function buildInputs(files) {
    var cd = {};
    files.cdss.forEach(function (r) { cd[r.item] = Number(r.value); });
    var ex = {};
    files.example.forEach(function (r) { ex[r.item] = Number(r.value); });
    var as = {};
    files.assumptions.forEach(function (r) { as[r.assumption] = Number(r.value); });

    return {
      T: as.tax_rate,
      cdss: {
        sales: cd.sales,
        variableCostRate: cd.variable_cost_rate,
        fixedCosts: cd.fixed_costs,
        totalAssets: cd.total_assets,
        existingDebt: cd.debt,
        shares: cd.shares_outstanding,
        price: cd.share_price,
        managementShare: cd.management_share
      },
      schedule: files.schedule.map(function (r) {
        return { debt: Number(r.debt), rd: num(r.cost_of_debt), rs: Number(r.cost_of_equity) };
      }),
      example: {
        assets: ex.total_assets,
        firmLDebt: ex.firm_l_debt,
        rate: ex.interest_rate,
        sliderMax: ex.slider_max,
        sliderStep: ex.slider_step
      },
      scenarios: files.scenarios.map(function (r) {
        return { prob: Number(r.probability), sales: Number(r.sales), opCosts: Number(r.operating_costs) };
      })
    };
  }

  // ---------- Firm U and Firm L (question c) ----------
  // One firm: assets, debt, interest rate. Returns each year plus E(), sigma, CV.
  function firmStatement(scenarios, assets, debt, rate, T) {
    var equity = assets - debt;
    var interest = rate * debt;
    var years = scenarios.map(function (s) {
      var ebit = s.sales - s.opCosts;
      var ebt = ebit - interest;
      var taxes = T * ebt;
      var ni = ebt - taxes;
      return {
        prob: s.prob, sales: s.sales, opCosts: s.opCosts, ebit: ebit,
        interest: interest, ebt: ebt, taxes: taxes, netIncome: ni,
        roe: ni / equity,
        tie: interest === 0 ? null : ebit / interest   // no interest: TIE is n/a
      };
    });

    function expected(f) {
      return years.reduce(function (sum, y) { return sum + y.prob * f(y); }, 0);
    }
    function sd(f, mean) {
      return Math.sqrt(years.reduce(function (sum, y) {
        return sum + y.prob * Math.pow(f(y) - mean, 2);
      }, 0));
    }

    var eRoe = expected(function (y) { return y.roe; });
    var sdRoe = sd(function (y) { return y.roe; }, eRoe);
    var hasTie = interest !== 0;
    var eTie = hasTie ? expected(function (y) { return y.tie; }) : null;
    var sdTie = hasTie ? sd(function (y) { return y.tie; }, eTie) : null;

    return {
      assets: assets, debt: debt, equity: equity, interest: interest, years: years,
      eRoe: eRoe, sdRoe: sdRoe, cvRoe: sdRoe / eRoe,
      eTie: eTie, sdTie: sdTie
    };
  }

  // ---------- CDSS ----------
  function cdssEbit(c) {
    return c.sales * (1 - c.variableCostRate) - c.fixedCosts;
  }

  // Net income at debt D and cost of debt rd (rd is null when D is 0).
  function cdssNetIncome(ebit, D, rd, T) {
    var interest = rd === null ? 0 : rd * D;
    return (ebit - interest) * (1 - T);
  }

  // Case method (d3, d4): buy back at today's price P0. WACC uses book weights.
  function caseMethod(c, T, row) {
    var D = row.debt, rd = row.rd, rs = row.rs;
    var ebit = cdssEbit(c);
    var interest = rd === null ? 0 : rd * D;
    var ni = cdssNetIncome(ebit, D, rd, T);
    var repurchased = D / c.price;
    var remaining = c.shares - repurchased;
    var eps = ni / remaining;
    var price = eps / rs;
    var rdAfterTax = rd === null ? 0 : rd * (1 - T);
    var wacc = (D / c.totalAssets) * rdAfterTax + ((c.totalAssets - D) / c.totalAssets) * rs;
    return {
      debt: D, rd: rd, rs: rs, ebit: ebit, interest: interest, netIncome: ni,
      repurchased: repurchased, remaining: remaining,
      eps: eps, dps: eps,                       // all earnings are paid out
      tie: interest === 0 ? null : ebit / interest,
      price: price, wacc: wacc
    };
  }

  // New-price method: buy back at the price after the announcement.
  // WACC uses market weights.
  function newPriceMethod(c, T, row) {
    var D = row.debt, rd = row.rd, rs = row.rs;
    var ebit = cdssEbit(c);
    var interest = rd === null ? 0 : rd * D;
    var ni = cdssNetIncome(ebit, D, rd, T);
    var S = ni / rs;                 // value of equity
    var V = S + D;                   // value of the firm
    var price = V / c.shares;
    var repurchased = D / price;
    var remaining = c.shares - repurchased;
    var eps = ni / remaining;
    var rdAfterTax = rd === null ? 0 : rd * (1 - T);
    var wacc = (D / V) * rdAfterTax + (S / V) * rs;
    var tol = 1e-9;
    return {
      debt: D, rd: rd, rs: rs, ebit: ebit, interest: interest, netIncome: ni,
      equityValue: S, firmValue: V,
      repurchased: repurchased, remaining: remaining,
      eps: eps, dps: eps,
      tie: interest === 0 ? null : ebit / interest,
      price: price, wacc: wacc,
      // checks from CLAUDE.md
      epsCheck: Math.abs(eps - rs * price) < tol,
      waccCheck: Math.abs(wacc - ebit * (1 - T) / V) < tol
    };
  }

  // Every row of the banker's schedule, both ways.
  function cdssTable(inputs) {
    var c = inputs.cdss, T = inputs.T;
    return {
      caseRows: inputs.schedule.map(function (r) { return caseMethod(c, T, r); }),
      newRows: inputs.schedule.map(function (r) { return newPriceMethod(c, T, r); })
    };
  }

  // Index of the best row. better(a, b) is true when a beats b. Ties go to the
  // smaller debt (rows are checked in schedule order, and only strict wins replace).
  function bestIndex(rows, valueOf, higherIsBetter) {
    var best = 0;
    for (var i = 1; i < rows.length; i++) {
      var a = valueOf(rows[i]), b = valueOf(rows[best]);
      var strictlyBetter = higherIsBetter ? a > b : a < b;
      // treat differences below 1e-9 as a tie
      if (strictlyBetter && Math.abs(a - b) > 1e-9) best = i;
    }
    return best;
  }

  // Check: EPS / r_s with no debt should equal the share price in cdss.csv.
  function baselineCheck(inputs) {
    var zero = inputs.schedule.filter(function (r) { return r.debt === 0; })[0];
    if (!zero) return { ok: false, reason: 'The schedule has no $0 row.' };
    var m = caseMethod(inputs.cdss, inputs.T, zero);
    return {
      ok: Math.abs(m.price - inputs.cdss.price) < 0.005,
      impliedPrice: m.price,
      filePrice: inputs.cdss.price
    };
  }

  // Management's stake after the buyback. Management does not sell, so its
  // shares stay the same while the total shrinks:
  //   stake = management share * n / shares remaining.
  // If the buyback uses up exactly the outside investors' shares, management
  // owns 100% (kind 'all'). If it would need more than that, management would
  // have to sell (kind 'sell') and there is no stake to show.
  function managementStake(c, repurchased) {
    var outside = (1 - c.managementShare) * c.shares;
    var tol = 1e-6;
    if (repurchased > outside + tol) {
      return { kind: 'sell', value: null, excess: repurchased - outside };
    }
    if (Math.abs(repurchased - outside) <= tol) return { kind: 'all', value: 1 };
    return { kind: 'stake', value: c.managementShare * c.shares / (c.shares - repurchased) };
  }

  // Which amount of debt do the Best price / Highest EPS buttons pick?
  // metric is 'price' or 'eps'. Each method picks its own best amount (ties go
  // to the smaller debt). If they agree, go there. If not, use the case
  // method's amount and report both so the page can say so.
  function pickBest(tables, metric) {
    var get = function (r) { return r[metric]; };
    var caseIdx = bestIndex(tables.caseRows, get, true);
    var newIdx = bestIndex(tables.newRows, get, true);
    return { index: caseIdx, caseIdx: caseIdx, newIdx: newIdx, same: caseIdx === newIdx };
  }

  var api = {
    roundHalfUp: roundHalfUp, parseCSV: parseCSV, buildInputs: buildInputs,
    firmStatement: firmStatement, cdssEbit: cdssEbit,
    caseMethod: caseMethod, newPriceMethod: newPriceMethod,
    cdssTable: cdssTable, bestIndex: bestIndex, baselineCheck: baselineCheck,
    managementStake: managementStake, pickBest: pickBest
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CapStruct = api;
})(typeof self !== 'undefined' ? self : this);
