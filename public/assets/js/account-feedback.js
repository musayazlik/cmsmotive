/** Shared feedback for the React account area and the static public site. */
const NOTICE_KEY = 'cmsmotive:account-notice';
const NOTICE_LIFETIME = 30_000;

const messages = {
  en: { 'signed-in': 'You have signed in successfully.', 'signed-out': 'You have signed out successfully.', dismiss: 'Dismiss notification' },
  de: { 'signed-in': 'Sie wurden erfolgreich angemeldet.', 'signed-out': 'Sie wurden erfolgreich abgemeldet.', dismiss: 'Benachrichtigung schließen' },
  tr: { 'signed-in': 'Başarıyla giriş yaptınız.', 'signed-out': 'Başarıyla çıkış yaptınız.', dismiss: 'Bildirimi kapat' },
};

function strings() {
  return messages[document.documentElement.lang] || messages.en;
}

function ensureStyles() {
  if (document.querySelector('link[data-account-feedback]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/css/account-feedback.css';
  link.dataset.accountFeedback = '';
  document.head.append(link);
}

/** @param {string} message @param {'error' | 'success'} [tone] */
export function showAccountToast(message, tone = 'error') {
  ensureStyles();
  document.getElementById('account-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'account-toast';
  toast.className = `account-toast account-toast--${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-atomic', 'true');

  const icon = document.createElement('span');
  icon.className = 'account-toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = tone === 'success'
    ? '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg>';
  const text = document.createElement('p');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'account-toast__close';
  close.setAttribute('aria-label', strings().dismiss);
  close.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 6 8 8M6 14l8-8"/></svg>';
  toast.append(icon, text, close);
  document.body.append(toast);
  // Populate after the live region exists so assistive technology announces it.
  requestAnimationFrame(() => { text.textContent = message; });

  let timer;
  const dismiss = () => { clearTimeout(timer); toast.remove(); };
  const resume = () => { clearTimeout(timer); timer = setTimeout(dismiss, tone === 'error' ? 7000 : 5000); };
  close.addEventListener('click', dismiss);
  toast.addEventListener('keydown', (event) => { if (event.key === 'Escape') dismiss(); });
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => { if (!toast.contains(document.activeElement)) resume(); });
  toast.addEventListener('focusin', () => clearTimeout(timer));
  toast.addEventListener('focusout', (event) => { if (!toast.contains(event.relatedTarget)) resume(); });
  resume();
}

/** A one-time notice survives the full reload required by auth transitions.
 * @param {'signed-in' | 'signed-out'} event
 */
export function queueAccountNotice(event) {
  try {
    sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ event, createdAt: Date.now() }));
  } catch {
    // Storage restrictions must never prevent a successful account transition.
  }
}

export function initAccountFeedback() {
  if (document.documentElement.dataset.accountFeedbackReady) return;
  document.documentElement.dataset.accountFeedbackReady = 'true';
  ensureStyles();
  try {
    const stored = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    if (!stored) return;
    const notice = JSON.parse(stored);
    const age = Date.now() - notice.createdAt;
    if (notice.event !== 'signed-in' && notice.event !== 'signed-out') return;
    if (!Number.isFinite(age) || age < 0 || age > NOTICE_LIFETIME) return;
    showAccountToast(strings()[notice.event], 'success');
  } catch {
    // Malformed or unavailable storage is safely discarded.
  }
}

/** Both panel sign-out controls use the same checked response and notice. */
export async function signOutAccount() {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error('You could not be signed out. Please try again.');
  queueAccountNotice('signed-out');
  // A full load clears the panel's session-dependent client state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/');
}
