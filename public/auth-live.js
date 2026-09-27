const mode = window.location.pathname.split('/').pop();
const form = document.querySelector('[data-auth-form]');
const params = new URLSearchParams(window.location.search);

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!input) return;
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} password`);
  });
});

function status(message, isError = false) {
  const element = form?.querySelector('.auth-form-status');
  if (!element) return;
  element.hidden = false;
  element.textContent = message;
  element.style.color = isError ? '#b33838' : '#3040c5';
}

async function authPost(endpoint, body) {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error?.message || 'Please try again.');
  return data;
}

if (mode === 'verify-email') {
  const email = params.get('email') || sessionStorage.getItem('cmsmotive:verification-email');
  const copy = document.querySelector('.auth-verify-copy p');
  if (copy && email) copy.textContent = `We sent a verification link to ${email}. Open it to activate your workspace.`;
}

if (mode === 'reset-password' && !params.get('token')) {
  status(params.get('error') ? 'This reset link is invalid or expired. Request a new one.' : 'Open the link in your reset email to choose a new password.', true);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const fields = new FormData(form);
  const password = String(fields.get('password') || '');
  const confirmation = String(fields.get('confirm_password') || '');
  if (confirmation && confirmation !== password) {
    status('Passwords do not match.', true);
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  status('Please wait…');
  try {
    if (mode === 'register') {
      const email = String(fields.get('email') || '').trim();
      await authPost('sign-up/email', {
        name: String(fields.get('name') || '').trim(),
        email,
        password,
        callbackURL: '/panel',
      });
      sessionStorage.setItem('cmsmotive:verification-email', email);
      window.location.assign(`/auth/verify-email?email=${encodeURIComponent(email)}`);
    } else if (mode === 'login') {
      await authPost('sign-in/email', {
        email: String(fields.get('email') || '').trim(),
        password,
        rememberMe: fields.get('remember') === 'on',
        callbackURL: '/panel',
      });
      window.location.assign('/panel');
    } else if (mode === 'forgot-password') {
      await authPost('request-password-reset', {
        email: String(fields.get('email') || '').trim(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      status('If an account exists for that address, a reset link is on its way.');
    } else if (mode === 'reset-password') {
      const token = params.get('token');
      if (!token) throw new Error('Open the link in your reset email first.');
      await authPost('reset-password', { newPassword: password, token });
      window.location.assign('/auth/login?reset=success');
    } else if (mode === 'verify-email') {
      const email = params.get('email') || sessionStorage.getItem('cmsmotive:verification-email');
      if (!email) throw new Error('Enter your email from the registration page first.');
      await authPost('send-verification-email', { email, callbackURL: '/panel' });
      status('A new verification link has been sent.');
    }
  } catch (error) {
    status(error instanceof Error ? error.message : 'Please try again.', true);
  } finally {
    submit.disabled = false;
  }
});

if (mode === 'login' && params.get('reset') === 'success') {
  status('Your password has been updated. You can sign in now.');
}
