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
