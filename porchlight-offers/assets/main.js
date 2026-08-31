/*!
 * Porchlight Offers — progressive enhancement only.
 * With JS disabled every form step is visible and the form is a plain POST.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'plo_lead_draft_v1';
  var dl = function (event, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: event }, data || {}));
  };

  /* ------------------------------------------------------------ nav */

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      nav.classList.toggle('is-open', !open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* --------------------------------------------------- click tracking */

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (!el) return;
    var name = el.getAttribute('data-track');
    dl(name.indexOf('call') > -1 ? 'phone_call_click' : 'cta_click', {
      cta_id: name,
      page_path: location.pathname,
    });
  });

  /* ------------------------------------------------------- lead forms */

  var drafts = {};
  try {
    drafts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (err) {
    drafts = {};
  }
  var saveDraft = function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch (err) {
      /* private mode — carry on without persistence */
    }
  };

  var PHONE_DIGITS = /\d/g;

  function setError(field, on, form) {
    var wrap = field.closest('.field') || field.closest('.consent');
    var msg = wrap && wrap.querySelector('.js-error');
    if (!msg && field.type === 'checkbox') msg = form.querySelector('.js-consent-error');
    if (msg) msg.hidden = !on;
    field.setAttribute('aria-invalid', on ? 'true' : 'false');
  }

  function validate(step, form) {
    var ok = true;
    var required = step.querySelectorAll('[required]');
    for (var i = 0; i < required.length; i++) {
      var f = required[i];
      var bad = false;
      if (f.type === 'checkbox') bad = !f.checked;
      else if (f.type === 'tel') bad = (f.value.match(PHONE_DIGITS) || []).length < 10;
      else if (f.type === 'email') bad = f.value !== '' && f.value.indexOf('@') < 1;
      else bad = f.value.trim().length < 3;
      setError(f, bad, form);
      if (bad && ok) {
        f.focus();
        ok = false;
      }
    }
    return ok;
  }

  document.querySelectorAll('.js-offer-form').forEach(function (form) {
    var stepEls = Array.prototype.slice.call(form.querySelectorAll('.js-step'));
    if (stepEls.length < 2) return;

    var pathField = form.querySelector('.js-page-path');
    if (pathField) pathField.value = location.pathname + location.search;

    var progress = form.querySelector('.js-progress');
    var fill = form.querySelector('.js-progress-fill');
    var num = form.querySelector('.js-step-num');
    var status = form.querySelector('.js-form-status');
    var source = form.getAttribute('data-source') || 'unknown';
    var current = 0;

    if (progress) progress.hidden = false;

    function show(index, focus) {
      current = Math.max(0, Math.min(index, stepEls.length - 1));
      stepEls.forEach(function (el, i) {
        el.hidden = i !== current;
      });
      if (fill) fill.style.width = ((current + 1) / stepEls.length) * 100 + '%';
      if (num) num.textContent = String(current + 1);
      if (focus) {
        var first = stepEls[current].querySelector('input, select, textarea, button');
        if (first) first.focus({ preventScroll: true });
      }
    }

    // Restore an abandoned draft so a returning visitor doesn't retype.
    Object.keys(drafts).forEach(function (name) {
      var field = form.elements[name];
      if (!field || !drafts[name]) return;
      if (field.length && field[0] && field[0].type === 'radio') {
        for (var i = 0; i < field.length; i++) {
          if (field[i].value === drafts[name]) field[i].checked = true;
        }
      } else if (field.type !== 'checkbox' && typeof field.value === 'string') {
        field.value = drafts[name];
      }
    });

    form.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.name || t.type === 'checkbox' || t.name === 'company') return;
      drafts[t.name] = t.value;
      saveDraft();
      if (t.getAttribute('aria-invalid') === 'true') setError(t, false, form);
    });
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.type === 'radio' || t.tagName === 'SELECT') {
        drafts[t.name] = t.value;
        saveDraft();
      }
    });

    form.querySelectorAll('.js-next').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!validate(stepEls[current], form)) return;
        dl('lead_form_step', {
          step: current + 1,
          lead_source: source,
          page_path: location.pathname,
        });
        show(current + 1, true);
      });
    });

    form.querySelectorAll('.js-back').forEach(function (btn) {
      btn.addEventListener('click', function () {
        show(current - 1, true);
      });
    });

    // Enter on a text input advances instead of submitting a partial form.
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
      if (current < stepEls.length - 1) {
        e.preventDefault();
        var next = stepEls[current].querySelector('.js-next');
        if (next) next.click();
      }
    });

    form.addEventListener('submit', function (e) {
      if (!validate(stepEls[current], form)) {
        e.preventDefault();
        return;
      }
      dl('generate_lead', {
        lead_source: source,
        page_path: location.pathname,
        form_id: form.id || 'cash-offer',
      });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        /* ignore */
      }

      // Netlify Forms handles a native POST. Anything else we send ourselves so
      // the visitor never sees a raw endpoint response.
      if (form.hasAttribute('data-netlify')) return;

      e.preventDefault();
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (status) {
        status.hidden = false;
        status.className = 'form-status js-form-status is-busy';
        status.textContent = 'Sending…';
      }

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed: ' + res.status);
          window.location.href = '/thank-you/';
        })
        .catch(function () {
          if (submitBtn) submitBtn.disabled = false;
          if (status) {
            var telLink = document.querySelector('a[href^="tel:"]');
            var tel = telLink ? telLink.getAttribute('href') : '';
            status.className = 'form-status js-form-status is-error';
            status.innerHTML =
              'Something went wrong sending that. Please ' +
              (tel ? '<a href="' + tel + '">call us</a>' : 'call us') +
              ' and we will take your details over the phone.';
          }
        });
    });

    show(0, false);
  });

  /* ------------------------------------------ hide mobile bar over forms */

  var bar = document.querySelector('.mobile-bar');
  var firstForm = document.querySelector('.js-offer-form');
  if (bar && firstForm && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          bar.style.transform = entry.isIntersecting ? 'translateY(120%)' : 'translateY(0)';
        });
      },
      { threshold: 0.35 },
    );
    document.querySelectorAll('.js-offer-form').forEach(function (f) {
      io.observe(f);
    });
    bar.style.transition = 'transform .25s ease';
  }
})();

/*!
 * Design layer: scroll reveals, stat counters, sticky-header state, and the
 * net-proceeds calculator. Everything here degrades to static content.
 */
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------- sticky header state */

  var header = document.getElementById('site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --------------------------------------------------------- reveals */

  var revealTargets = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealTargets.forEach(function (el) {
      el.classList.add('is-in');
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    revealTargets.forEach(function (el) {
      el.classList.add('is-armed');
      revealObserver.observe(el);
    });
  }

  /* -------------------------------------------------------- stat counters */

  function countUp(el) {
    var raw = el.getAttribute('data-count') || el.textContent;
    var match = raw.match(/^(\D*)(\d[\d,]*)(.*)$/);
    if (!match) return;
    var prefix = match[1];
    var target = Number(match[2].replace(/,/g, ''));
    var suffix = match[3];
    if (!target || reduceMotion) return;
    var start = null;
    var duration = 1100;
    var step = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString('en-US') + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var countObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          countObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.6 },
    );
    counters.forEach(function (el) {
      countObserver.observe(el);
    });
  }

  /* ----------------------------------------------------------- calculator */

  /*
   * Same arithmetic the offer desk uses:
   *   cash offer   = ARV − repairs − holding/selling (12%) − margin (12%)
   *   listing net  = ARV − repairs − commission & closing (8%)
   *                      − concessions & holding (4.2%)
   * It is meant to show listing winning on a tidy house. That is the truth,
   * and pretending otherwise would be both dishonest and transparent.
   */
  var CASH_COSTS = 0.24; // holding + selling + margin, as a share of ARV
  var LIST_FEES = 0.08; // commission + seller closing costs
  var LIST_CARRY = 0.042; // post-inspection concessions + ~5 months holding
  var CASH_CARRY = 0.0013; // days, not months

  var money = function (n) {
    return (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  };

  document.querySelectorAll('.section--calc').forEach(function (root) {
    var arvInput = root.querySelector('.js-calc-arv');
    var repairInput = root.querySelector('.js-calc-repairs');
    if (!arvInput || !repairInput) return;

    var out = function (sel) {
      return root.querySelector(sel);
    };
    var els = {
      arvOut: out('#calc-arv-out') || root.querySelector('output'),
      repairsOut: out('#calc-repairs-out'),
      cashNet: out('.js-calc-cash-net'),
      cashOffer: out('.js-calc-cash-offer'),
      cashHold: out('.js-calc-cash-hold'),
      cashBar: out('.js-calc-cash-bar'),
      listNet: out('.js-calc-list-net'),
      listPrice: out('.js-calc-list-price'),
      listRepairs: out('.js-calc-list-repairs'),
      listFees: out('.js-calc-list-fees'),
      listHold: out('.js-calc-list-hold'),
      listBar: out('.js-calc-list-bar'),
      verdict: out('.js-calc-verdict'),
    };

    // Range inputs inside one page must have unique ids; scope the outputs.
    var outputs = root.querySelectorAll('.calc__value');
    els.arvOut = outputs[0] || els.arvOut;
    els.repairsOut = outputs[1] || els.repairsOut;

    function paintTrack(input) {
      var pct =
        ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.background =
        'linear-gradient(90deg, rgba(246,166,35,.85) ' +
        pct +
        '%, rgba(255,255,255,.16) ' +
        pct +
        '%)';
    }

    function update() {
      var arv = Number(arvInput.value);
      var repairs = Math.min(Number(repairInput.value), arv);

      var cashOffer = Math.max(arv * (1 - CASH_COSTS) - repairs, 0);
      var cashHold = cashOffer > 0 ? arv * CASH_CARRY : 0;
      var cashNet = Math.max(cashOffer - cashHold, 0);

      var listFees = arv * LIST_FEES;
      var listCarry = arv * LIST_CARRY;
      var listNet = arv - repairs - listFees - listCarry;

      var max = Math.max(cashNet, listNet, 1);

      els.arvOut.textContent = money(arv);
      els.repairsOut.textContent = money(repairs);
      els.cashNet.textContent = money(cashNet);
      els.cashOffer.textContent = money(cashOffer);
      els.cashHold.textContent = money(-cashHold);
      els.cashBar.style.width = Math.max((cashNet / max) * 100, 2) + '%';
      els.listNet.textContent = money(Math.max(listNet, 0));
      els.listPrice.textContent = money(arv);
      els.listRepairs.textContent = money(-repairs);
      els.listFees.textContent = money(-listFees);
      els.listHold.textContent = money(-listCarry);
      els.listBar.style.width = Math.max((listNet / max) * 100, 2) + '%';

      var diff = listNet - cashNet;
      var text;
      if (cashOffer <= 0) {
        text =
          '<strong>At this repair level the work costs more than the house would be worth fixed up.</strong> ' +
          'Call us anyway — the lot may still have value, and we buy houses in exactly this position.';
      } else if (diff > arv * 0.05) {
        text =
          '<strong>Listing would likely net you about ' +
          money(diff) +
          ' more</strong> — if the house can compete, you can fund ' +
          money(repairs) +
          ' of repairs up front, and you can wait four to seven months. If any of those is not true, the gap closes fast.';
      } else if (diff > 0) {
        text =
          '<strong>These are close — about ' +
          money(diff) +
          ' apart.</strong> Once you count the months of holding costs, the repair bill you front, and the chance a financed buyer walks at inspection, a cash sale is usually the better trade here.';
      } else {
        text =
          '<strong>At this condition the cash offer nets you more</strong> — and you pay nothing up front, do no repairs, and pick the closing date.';
      }
      els.verdict.innerHTML = text;

      paintTrack(arvInput);
      paintTrack(repairInput);
    }

    [arvInput, repairInput].forEach(function (input) {
      input.addEventListener('input', update);
    });
    update();
  });
})();
