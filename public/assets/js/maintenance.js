(() => {
  const form = document.querySelector('[data-maintenance-form]');
  if (!form) return;
  const email = form.querySelector('[name="email"]');
  const button = form.querySelector('[type="submit"]');
  const status = form.querySelector('[data-maintenance-status]');
  const label = button.innerHTML;
  let submitting = false;
  let subscribed = false;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || subscribed || !form.reportValidity()) return;
    submitting = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = form.dataset.loading;
    status.classList.remove('is-error');
    status.textContent = '';
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value.trim(), source: 'maintenance' }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        status.classList.add('is-error');
        status.textContent = result.code === 'invalid_email' ? form.dataset.invalidEmail : form.dataset.error;
        return;
      }
      subscribed = true;
      form.closest('.maintenance-signup').classList.add('is-subscribed');
      status.textContent = form.dataset.success;
      button.textContent = form.dataset.subscribed;
      email.readOnly = true;
    } catch {
      status.classList.add('is-error');
      status.textContent = form.dataset.error;
    } finally {
      submitting = false;
      button.removeAttribute('aria-busy');
      if (!subscribed) {
        button.disabled = false;
        button.innerHTML = label;
      }
    }
  });

  // Return to the live site without clearing an address someone is typing.
  window.setInterval(async () => {
    if (document.visibilityState !== 'visible' || submitting || (email.value && !subscribed)) return;
    try {
      const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
      if (response.ok) window.location.reload();
    } catch {
      // The page and signup remain usable during temporary connection failures.
    }
  }, 120_000);
})();

// Account notices remain visible when a sign-out returns to maintenance mode.
import('/assets/js/account-feedback.js').then(({ initAccountFeedback }) => initAccountFeedback()).catch(() => {});
