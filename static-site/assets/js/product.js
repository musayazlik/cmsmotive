// Product detail pages: tabs, guest reviews and reCAPTCHA v3.
// Reviews come from the Next.js /api/reviews endpoint; new reviews are stored
// as pending and only appear after an administrator approves them in /panel/reviews.
(() => {
  const LANG = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  const LOCALE_TAGS = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' };

  const STRINGS = {
    en: {
      reviews: (n) => (n === 1 ? '1 review' : `${n} reviews`),
      basedOn: (n) => (n === 1 ? 'Based on 1 review' : `Based on ${n} reviews`),
      noReviews: 'No reviews yet',
      outOf: (r) => `${r} out of 5 stars`,
      loadFailed: 'Reviews could not be loaded right now. Please try again later.',
      ratingHint: ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'],
      counter: (n) => `${n} / 2,000`,
      sending: 'Sending…',
      submit: 'Submit review',
      success: 'Thank you! Your review has been received and will appear here once it has been approved.',
      published: 'Thank you! Your review has been published.',
      errors: {
        'missing-rating': 'Please choose a star rating.',
        'invalid-identity': 'Please enter your full name and a valid email address.',
        'invalid-rating': 'Please choose a star rating.',
        'invalid-body': 'Your review must be between 10 and 2,000 characters.',
        captcha: 'Google reCAPTCHA could not verify you. Please try again.',
        'rate-limit': 'You have sent several reviews recently. Please try again later.',
        unavailable: 'Reviews cannot be sent at the moment. Please try again later.',
        server: 'Your review could not be saved. Please try again.',
      },
    },
    de: {
      reviews: (n) => (n === 1 ? '1 Bewertung' : `${n} Bewertungen`),
      basedOn: (n) => (n === 1 ? 'Basierend auf 1 Bewertung' : `Basierend auf ${n} Bewertungen`),
      noReviews: 'Noch keine Bewertungen',
      outOf: (r) => `${r} von 5 Sternen`,
      loadFailed: 'Die Bewertungen konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.',
      ratingHint: ['', 'Schwach', 'Okay', 'Gut', 'Sehr gut', 'Ausgezeichnet'],
      counter: (n) => `${n} / 2.000`,
      sending: 'Wird gesendet …',
      submit: 'Bewertung senden',
      success: 'Vielen Dank! Ihre Bewertung ist eingegangen und erscheint hier, sobald sie freigegeben wurde.',
      published: 'Vielen Dank! Ihre Bewertung wurde veröffentlicht.',
      errors: {
        'missing-rating': 'Bitte wählen Sie eine Sternebewertung.',
        'invalid-identity': 'Bitte geben Sie Ihren vollständigen Namen und eine gültige E-Mail-Adresse ein.',
        'invalid-rating': 'Bitte wählen Sie eine Sternebewertung.',
        'invalid-body': 'Ihre Bewertung muss zwischen 10 und 2.000 Zeichen lang sein.',
        captcha: 'Google reCAPTCHA konnte Sie nicht verifizieren. Bitte versuchen Sie es erneut.',
        'rate-limit': 'Sie haben kürzlich mehrere Bewertungen gesendet. Bitte versuchen Sie es später erneut.',
        unavailable: 'Bewertungen können gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.',
        server: 'Ihre Bewertung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
      },
    },
    tr: {
      reviews: (n) => `${n} değerlendirme`,
      basedOn: (n) => `${n} değerlendirmeye göre`,
      noReviews: 'Henüz değerlendirme yok',
      outOf: (r) => `5 üzerinden ${r} yıldız`,
      loadFailed: 'Değerlendirmeler şu anda yüklenemedi. Lütfen daha sonra tekrar deneyin.',
      ratingHint: ['', 'Zayıf', 'İdare eder', 'İyi', 'Çok iyi', 'Mükemmel'],
      counter: (n) => `${n} / 2.000`,
      sending: 'Gönderiliyor…',
      submit: 'Değerlendirmeyi gönder',
      success: 'Teşekkürler! Değerlendirmeniz alındı; onaylandıktan sonra burada yayınlanacak.',
      published: 'Teşekkürler! Değerlendirmeniz yayınlandı.',
      errors: {
        'missing-rating': 'Lütfen bir yıldız puanı seçin.',
        'invalid-identity': 'Lütfen adınızı soyadınızı ve geçerli bir e-posta adresi girin.',
        'invalid-rating': 'Lütfen bir yıldız puanı seçin.',
        'invalid-body': 'Değerlendirmeniz 10 ile 2.000 karakter arasında olmalıdır.',
        captcha: 'Google reCAPTCHA doğrulaması başarısız oldu. Lütfen tekrar deneyin.',
        'rate-limit': 'Kısa süre içinde birkaç değerlendirme gönderdiniz. Lütfen daha sonra tekrar deneyin.',
        unavailable: 'Değerlendirmeler şu anda gönderilemiyor. Lütfen daha sonra tekrar deneyin.',
        server: 'Değerlendirmeniz kaydedilemedi. Lütfen tekrar deneyin.',
      },
    },
  };
  const T = STRINGS[LANG] || STRINGS.en;
  const dateFormat = new Intl.DateTimeFormat(LOCALE_TAGS[LANG] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const numberFormat = new Intl.NumberFormat(LOCALE_TAGS[LANG] || 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  /* ---------------- tabs ---------------- */

  const tabsRoot = document.querySelector('[data-product-tabs]');
  let selectTabFor = () => null;

  if (tabsRoot) {
    const tabs = [...tabsRoot.querySelectorAll('[role="tab"]')];
    const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

    const select = (tab, { focus = false, updateHash = false } = {}) => {
      for (const other of tabs) {
        const active = other === tab;
        other.setAttribute('aria-selected', String(active));
        other.tabIndex = active ? 0 : -1;
        panelOf(other)?.classList.toggle('is-active', active);
      }
      if (focus) tab.focus();
      if (updateHash) history.replaceState(null, '', `#${tab.getAttribute('aria-controls')}`);
    };

    // "#a%E0" style hashes are malformed; treat them like no hash at all.
    const hashId = (hash) => {
      try {
        return decodeURIComponent(hash.slice(1));
      } catch {
        return '';
      }
    };

    // Opens the tab holding `id` (a panel or anything inside one) and returns
    // that element, or null when `id` is empty or outside the tabs.
    selectTabFor = (id) => {
      const target = id ? document.getElementById(id) : null;
      const panel = target?.closest('[role="tabpanel"]');
      const tab = panel && tabs.find((item) => item.getAttribute('aria-controls') === panel.id);
      if (!tab) return null;
      select(tab);
      return target;
    };

    tabsRoot.classList.add('is-tabbed');
    if (!selectTabFor(hashId(location.hash))) select(tabs[0]);

    tabsRoot.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
      const index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], { focus: true, updateHash: true });
    });
    for (const tab of tabs) tab.addEventListener('click', () => select(tab, { updateHash: true }));

    // In-page links such as the hero rating badge or "Write a review".
    document.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (!link) return;
      const target = selectTabFor(hashId(link.getAttribute('href')));
      if (!target) return;
      event.preventDefault();
      history.replaceState(null, '', link.getAttribute('href'));
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      // "Write a review" lands on the form card: put the cursor in its first field.
      if (target.querySelector('form')) target.querySelector('form input:not([type="hidden"])')?.focus({ preventScroll: true });
    });
    window.addEventListener('hashchange', () => selectTabFor(hashId(location.hash)));
  }

  /* ---------------- reviews ---------------- */

  const reviewsRoot = document.querySelector('[data-reviews]');
  if (!reviewsRoot) return;

  const product = reviewsRoot.dataset.product;
  // "theme" or "extension"; the API looks the product up by type and slug.
  const productType = reviewsRoot.dataset.productType || 'theme';
  const PAGE_SIZE = 5;
  const CAPTCHA_ACTION = 'product_review';
  const q = (selector) => document.querySelector(selector);
  const list = q('[data-review-list]');
  const empty = q('[data-review-empty]');
  const more = q('[data-review-more]');
  const form = q('[data-review-form]');
  const status = q('[data-review-status]');
  const submit = form?.querySelector('[type="submit"]');
  let reviews = [];
  let shown = 0;
  let siteKey = null;

  const setStars = (element, rating) => {
    element.style.setProperty('--rating', String(rating));
    element.setAttribute('aria-label', T.outOf(rating));
  };

  function renderSummary(summary) {
    const { count, average, distribution } = summary;
    const averageText = count ? numberFormat.format(average) : '–';
    for (const node of document.querySelectorAll('[data-review-average]')) node.textContent = averageText;
    for (const node of document.querySelectorAll('[data-review-average-stars]')) setStars(node, average);
    for (const node of document.querySelectorAll('[data-review-total]')) node.textContent = count ? T.basedOn(count) : T.noReviews;
    for (const node of document.querySelectorAll('[data-review-count]')) {
      node.textContent = String(count);
      node.hidden = count === 0;
    }
    for (const node of document.querySelectorAll('[data-review-badge]')) {
      node.hidden = count === 0;
      const label = node.querySelector('[data-review-badge-count]');
      if (label) label.textContent = T.reviews(count);
    }
    for (let stars = 1; stars <= 5; stars++) {
      const value = distribution[stars - 1] || 0;
      const bar = q(`[data-review-bar="${stars}"]`);
      if (bar) bar.style.width = count ? `${(value / count) * 100}%` : '0';
      const label = q(`[data-review-bar-count="${stars}"]`);
      if (label) label.textContent = String(value);
    }
  }

  function reviewItem(review) {
    const item = document.createElement('li');
    item.className = 'review-item';
    const header = document.createElement('header');
    const avatar = document.createElement('span');
    avatar.className = 'review-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (review.name[0] || '?').toUpperCase();
    const who = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = review.name;
    const time = document.createElement('time');
    time.dateTime = review.createdAt;
    time.textContent = dateFormat.format(new Date(review.createdAt));
    who.append(name, time);
    const stars = document.createElement('span');
    stars.className = 'review-stars';
    stars.setAttribute('role', 'img');
    setStars(stars, review.rating);
    header.append(avatar, who, stars);
    const body = document.createElement('p');
    body.textContent = review.body;
    item.append(header, body);
    return item;
  }

  function renderMore() {
    const next = reviews.slice(shown, shown + PAGE_SIZE);
    list.append(...next.map(reviewItem));
    shown += next.length;
    more.hidden = shown >= reviews.length;
  }

  async function loadReviews() {
    try {
      const response = await fetch(`/api/reviews?type=${encodeURIComponent(productType)}&product=${encodeURIComponent(product)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      siteKey = data.recaptchaSiteKey;
      reviews = data.reviews;
      renderSummary(data.summary);
      list.replaceChildren();
      shown = 0;
      empty.hidden = reviews.length > 0;
      renderMore();
    } catch (error) {
      console.error('reviews: loading failed', error);
      empty.hidden = false;
      empty.querySelector('p').textContent = T.loadFailed;
    }
  }

  more?.addEventListener('click', renderMore);
  loadReviews();

  if (!form) return;

  /* ---- form ---- */

  const textarea = form.querySelector('textarea');
  const counter = form.querySelector('[data-review-counter]');
  const hint = form.querySelector('[data-review-rating-hint]');
  const randomUUID = () =>
    crypto.randomUUID?.() ??
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  let requestKey = randomUUID();

  const updateCounter = () => {
    if (counter) counter.textContent = T.counter(textarea.value.length);
  };
  textarea.addEventListener('input', updateCounter);
  updateCounter();

  form.addEventListener('change', (event) => {
    if (event.target.name === 'rating' && hint) hint.textContent = T.ratingHint[Number(event.target.value)] || '';
  });

  const showStatus = (message, kind) => {
    status.textContent = message;
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-success', kind === 'success');
    status.hidden = false;
  };

  // reCAPTCHA is only fetched once someone starts writing a review.
  let captchaScript = null;
  function loadCaptcha() {
    if (!siteKey) return Promise.reject(new Error('recaptcha-not-configured'));
    captchaScript ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}&hl=${LANG}`;
      script.async = true;
      script.onload = () => window.grecaptcha.ready(resolve);
      script.onerror = () => {
        captchaScript = null;
        reject(new Error('recaptcha-load-failed'));
      };
      document.head.append(script);
    });
    return captchaScript;
  }
  form.addEventListener('focusin', () => loadCaptcha().catch(() => {}), { once: true });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.hidden = true;
    const data = new FormData(form);
    const rating = Number(data.get('rating'));
    if (!rating) {
      showStatus(T.errors['missing-rating'], 'error');
      form.querySelector('[name="rating"]').focus();
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submit.disabled = true;
    const label = submit.querySelector('.btn-label') || submit;
    label.textContent = T.sending;
    try {
      await loadCaptcha();
      const captchaToken = await window.grecaptcha.execute(siteKey, { action: CAPTCHA_ACTION });
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          type: productType,
          name: data.get('name'),
          email: data.get('email'),
          rating,
          body: data.get('body'),
          website: data.get('website'),
          locale: LANG,
          requestKey,
          captchaToken,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        showStatus(T.errors[result.code] || result.error || T.errors.server, 'error');
        return;
      }
      form.reset();
      if (hint) hint.textContent = '';
      updateCounter();
      requestKey = randomUUID();
      // Auto-approved reviews (Settings → Reviews) are live at once.
      if (result.status === 'approved') {
        showStatus(T.published, 'success');
        loadReviews();
      } else {
        showStatus(T.success, 'success');
      }
    } catch (error) {
      console.error('reviews: submit failed', error);
      showStatus(T.errors.unavailable, 'error');
    } finally {
      submit.disabled = false;
      label.textContent = T.submit;
    }
  });
})();
