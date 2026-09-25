/* Cost calculator: distance, estimate ranges, email validation and lead submission.
   All figures come from CALC (built by gen_calc.py); nothing is fetched at runtime. */
(function () {
  'use strict';

  var countrySel = document.getElementById('country');
  var citySel = document.getElementById('city');
  var currencySel = document.getElementById('currency');
  var tbody = document.querySelector('#result tbody');
  var wrap = document.getElementById('result-wrap');
  var empty = document.getElementById('empty');
  var lead = document.getElementById('lead');
  var state = { origin: null, stage: null, rows: [] };

  function km(a, b) {
    var p = Math.PI / 180;
    var h = Math.pow(Math.sin((b[0] - a[0]) * p / 2), 2) +
      Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.pow(Math.sin((b[1] - a[1]) * p / 2), 2);
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  function flightRange(d) {
    for (var i = 0; i < CALC.flight_bands.length; i++) {
      if (d <= CALC.flight_bands[i][0]) return [CALC.flight_bands[i][1], CALC.flight_bands[i][2]];
    }
    return [0, 0];
  }

  function flightHours(d) {
    var h = d / 800 + 1;                       // cruise speed plus taxi and climb
    if (d > 4000) h += Math.floor(d / 6000);   // a stop on the long ones
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 15) * 15;
    if (mm === 60) { hh += 1; mm = 0; }
    return hh + ' h' + (mm ? ' ' + mm + ' m' : '');
  }

  function money(v) {
    var cur = currencySel.value;
    var x = v * CALC.rates[cur];
    var sym = { EUR: '€', USD: '$', GBP: '£' }[cur];
    return sym + Math.round(x / 10) * 10;
  }

  function range(lo, hi) {
    if (!lo && !hi) return '<span class="muted">' + TXT.included + '</span>';
    return money(lo) + '-' + money(hi);
  }

  function estimate(slug, dest) {
    var d = km(state.origin, dest.coord);
    var grafts = null;
    for (var i = 0; i < CALC.norwood.length; i++) {
      if (CALC.norwood[i].stage === state.stage) grafts = CALC.norwood[i].grafts;
    }
    var surgery = [grafts[0] * dest.graft[0], grafts[1] * dest.graft[1]];
    var flight = flightRange(d);
    var hotel = dest.hotel_in_package ? [0, 0]
      : [dest.hotel[0] * CALC.nights, dest.hotel[1] * CALC.nights];
    var extras = CALC.extras;
    return {
      slug: slug, km: d, flightHours: flightHours(d),
      surgery: surgery, flight: flight, hotel: hotel, extras: extras,
      total: [surgery[0] + flight[0] + hotel[0] + extras[0], surgery[1] + flight[1] + hotel[1] + extras[1]]
    };
  }

  function render() {
    if (!state.origin || !state.stage) { wrap.hidden = true; empty.hidden = false; lead.hidden = true; return; }
    var rows = Object.keys(CALC.dest).map(function (slug) { return estimate(slug, CALC.dest[slug]); });
    rows.sort(function (a, b) { return a.total[0] - b.total[0]; });
    state.rows = rows;
    tbody.innerHTML = rows.map(function (r) {
      return '<tr>' +
        '<td><strong>' + CALC.names[r.slug] + '</strong></td>' +
        '<td>' + Math.round(r.km / 50) * 50 + ' km<span class="addr">' +
          TXT.flight_time.replace('{h}', r.flightHours) + '</span></td>' +
        '<td>' + range(r.surgery[0], r.surgery[1]) + '</td>' +
        '<td>' + range(r.flight[0], r.flight[1]) + '</td>' +
        '<td>' + range(r.hotel[0], r.hotel[1]) +
          (r.hotel[1] ? '<span class="addr">' + TXT.nights.replace('{n}', CALC.nights) + '</span>' : '') + '</td>' +
        '<td>' + range(r.extras[0], r.extras[1]) + '</td>' +
        '<td class="total"><strong>' + range(r.total[0], r.total[1]) + '</strong></td>' +
        '<td><a class="more-link" href="' + CALC.prefix + '/' + r.slug + '/">' + TXT.see_clinics + ' →</a></td>' +
        '</tr>';
    }).join('');
    wrap.hidden = false;
    empty.hidden = true;
    lead.hidden = false;
  }

  countrySel.addEventListener('change', function () {
    var list = CALC.origins[countrySel.value] || [];
    citySel.innerHTML = '<option value="">' + citySel.options[0].textContent + '</option>' +
      list.map(function (a) { return '<option value="' + a.code + '">' + a.city + '</option>'; }).join('');
    citySel.disabled = !list.length;
    state.origin = null;
    render();
  });

  citySel.addEventListener('change', function () {
    var list = CALC.origins[countrySel.value] || [];
    var a = list.filter(function (x) { return x.code === citySel.value; })[0];
    state.origin = a ? [a.lat, a.lon] : null;
    if (a && window.gtag) gtag('event', 'calc_origin', { country: countrySel.value, city: a.city, language: LANG });
    render();
  });

  currencySel.addEventListener('change', render);

  Array.prototype.forEach.call(document.querySelectorAll('input[name=stage]'), function (input) {
    input.addEventListener('change', function () {
      state.stage = input.value;
      if (window.gtag) gtag('event', 'calc_stage', { stage: input.value, language: LANG });
      render();
    });
  });

  /* --- email --------------------------------------------------------------------------------------- */
  var TYPOS = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmaill.com': 'gmail.com',
    'gnail.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
    'yahho.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
    'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com'
  };
  var DISPOSABLE = ['mailinator.com', 'yopmail.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
    'temp-mail.org', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc'];

  function emailProblem(value) {
    var v = value.trim();
    if (!/^[^\s@,;]+@[^\s@.,;]+(\.[^\s@.,;]+)+$/.test(v)) return TXT.err_email;
    var domain = v.split('@')[1].toLowerCase();
    if (TYPOS[domain]) return TXT.err_typo.replace('{suggestion}', v.split('@')[0] + '@' + TYPOS[domain]);
    if (DISPOSABLE.indexOf(domain) !== -1) return TXT.err_disposable;
    return null;
  }

  var form = document.getElementById('lead-form');
  var emailInput = document.getElementById('email');
  var consentBox = document.getElementById('consent-box');
  var errorBox = document.getElementById('form-error');
  var sentBox = document.getElementById('sent');
  var button = form.querySelector('button');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
  }

  emailInput.addEventListener('input', function () { showError(''); });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var problem = emailProblem(emailInput.value);
    if (problem) { showError(problem); emailInput.focus(); return; }
    if (!consentBox.checked) { showError(TXT.err_consent); return; }

    var best = state.rows[0];
    var city = (CALC.origins[countrySel.value] || []).filter(function (x) { return x.code === citySel.value; })[0];
    var payload = {
      email: emailInput.value.trim(),
      country: countrySel.value,
      city: city ? city.city : '',
      airport: citySel.value,
      stage: state.stage,
      currency: currencySel.value,
      cheapest: best ? best.slug : '',
      total_low: best ? Math.round(best.total[0]) : '',
      total_high: best ? Math.round(best.total[1]) : '',
      rows: state.rows.map(function (r) {
        return r.slug + ':' + Math.round(r.total[0]) + '-' + Math.round(r.total[1]);
      }).join(', '),
      language: LANG,
      referrer: document.referrer || '',
      page: location.href
    };

    if (!ENDPOINT) { showError(TXT.err_send); return; }   // build published without the leads endpoint

    button.disabled = true;
    button.textContent = TXT.sending;
    showError('');

    var body = new FormData();               // a Google Form only accepts its own entry.* fields
    body.append(FIELDS.email, payload.email);
    body.append(FIELDS.country, payload.country);
    body.append(FIELDS.city, payload.city + ' (' + payload.airport + ')');
    body.append(FIELDS.details, [
      'stage: Norwood ' + payload.stage,
      'currency: ' + payload.currency,
      'cheapest: ' + payload.cheapest + ' ' + payload.total_low + '-' + payload.total_high,
      'all: ' + payload.rows,
      'language: ' + payload.language,
      'page: ' + payload.page,
      'referrer: ' + payload.referrer
    ].join('\n'));

    fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',                       // Google Forms sends no CORS headers; the response is opaque
      body: body
    }).then(function () {
      form.hidden = true;
      sentBox.hidden = false;
      if (window.gtag) gtag('event', 'calc_lead', { city: payload.cheapest, country: payload.country, language: LANG });
    }).catch(function () {
      button.disabled = false;
      button.textContent = TXT.send;
      showError(TXT.err_send);
    });
  });
})();
