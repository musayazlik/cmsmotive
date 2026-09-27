document.querySelectorAll('[data-password-toggle]').forEach(button => {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!input) return;
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${input.closest('.auth-field').querySelector('label').textContent.toLowerCase()}`);
    button.setAttribute('aria-pressed', String(visible));
    input.focus();
  });
});

document.querySelectorAll('[data-auth-form]').forEach(form => {
  const password = form.querySelector('[name="password"]');
  const confirmation = form.querySelector('[name="confirm_password"]');
  if (password && confirmation) {
    const checkMatch = () => confirmation.setCustomValidity(
      confirmation.value && confirmation.value !== password.value ? 'Passwords do not match.' : ''
    );
    password.addEventListener('input', checkMatch);
    confirmation.addEventListener('input', checkMatch);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const status = form.querySelector('.auth-form-status');
    if (status) {
      status.textContent = form.dataset.message;
      status.hidden = false;
    }
    form.querySelectorAll('input[name="password"], input[name="confirm_password"]').forEach(input => {
      input.value = '';
      input.type = 'password';
    });
    form.querySelectorAll('[data-password-toggle]').forEach(button => {
      button.textContent = 'Show';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/^Hide /, 'Show '));
    });
  });
});
