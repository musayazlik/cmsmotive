document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
if (menuButton && mobileNav) {
  const closeMenu = () => {
    mobileNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
  };
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    mobileNav.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
      menuButton.focus();
    }
  });
  const desktopQuery = window.matchMedia('(min-width: 901px)');
  if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', closeMenu);
  else desktopQuery.addListener(closeMenu);
}

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = motionPreference.matches;
const reveals = document.querySelectorAll('[data-reveal]');
if (reducedMotion || !('IntersectionObserver' in window)) {
  reveals.forEach(item => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  reveals.forEach(item => observer.observe(item));
}

document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(button.dataset.copy);
      } else {
        const field = document.createElement('textarea');
        field.value = button.dataset.copy;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Copy unavailable');
      }
      const before = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => { button.textContent = before; }, 1800);
    } catch {
      button.textContent = 'Select command above';
    }
  });
});

const customSelectClosers = [];
document.querySelectorAll('select[data-custom-select]').forEach(select => {
  const root = select.closest('.select-wrap');
  if (!root) return;
  const nativeOptions = [...select.options];
  const labelId = select.getAttribute('aria-labelledby');
  const trigger = document.createElement('button');
  const value = document.createElement('span');
  const chevron = document.createElement('span');
  const menu = document.createElement('div');
  let typeQuery = '';
  let typeTimer;

  trigger.type = 'button';
  trigger.id = `${select.id}-trigger`;
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${select.id}-options`);
  trigger.setAttribute('aria-labelledby', `${labelId} ${trigger.id}`);
  value.className = 'custom-select-value';
  chevron.className = 'custom-select-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(value, chevron);

  menu.id = `${select.id}-options`;
  menu.className = 'custom-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-labelledby', labelId);
  menu.hidden = true;
  const optionNodes = nativeOptions.map((nativeOption, index) => {
    const option = document.createElement('div');
    option.id = `${select.id}-option-${index}`;
    option.className = 'custom-select-option';
    option.setAttribute('role', 'option');
    option.setAttribute('tabindex', '-1');
    option.textContent = nativeOption.textContent;
    menu.append(option);
    return option;
  });

  const sync = () => {
    const selected = Math.max(select.selectedIndex, 0);
    value.textContent = nativeOptions[selected].textContent;
    optionNodes.forEach((option, index) => {
      option.setAttribute('aria-selected', String(index === selected));
    });
  };
  const focusOption = index => {
    optionNodes.forEach((option, optionIndex) => option.classList.toggle('is-active', optionIndex === index));
    optionNodes[index].focus();
  };
  const close = (returnFocus = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    root.classList.remove('is-open', 'opens-up');
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  };
  const open = (index = Math.max(select.selectedIndex, 0)) => {
    customSelectClosers.forEach(other => { if (other.root !== root) other.close(); });
    menu.hidden = false;
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    const roomBelow = window.innerHeight - root.getBoundingClientRect().bottom;
    const roomAbove = root.getBoundingClientRect().top;
    root.classList.toggle('opens-up', roomBelow < menu.getBoundingClientRect().height + 12 && roomAbove > roomBelow);
    focusOption(index);
  };
  const choose = index => {
    select.value = nativeOptions[index].value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    close(true);
  };
  const matchTypedOption = key => {
    window.clearTimeout(typeTimer);
    typeQuery += key.toLowerCase();
    let index = nativeOptions.findIndex(option => option.textContent.trim().toLowerCase().startsWith(typeQuery));
    if (index < 0) {
      typeQuery = key.toLowerCase();
      index = nativeOptions.findIndex(option => option.textContent.trim().toLowerCase().startsWith(typeQuery));
    }
    typeTimer = window.setTimeout(() => { typeQuery = ''; }, 650);
    if (index >= 0) {
      if (menu.hidden) open(index);
      else focusOption(index);
    }
  };

  trigger.addEventListener('click', () => menu.hidden ? open() : close(true));
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (menu.hidden) open(event.key === 'ArrowUp' ? nativeOptions.length - 1 : Math.max(select.selectedIndex, 0));
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      matchTypedOption(event.key);
    }
  });
  optionNodes.forEach((option, index) => {
    option.addEventListener('click', () => choose(index));
    option.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusOption((index + (event.key === 'ArrowDown' ? 1 : -1) + optionNodes.length) % optionNodes.length);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        focusOption(event.key === 'Home' ? 0 : optionNodes.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose(index);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        matchTypedOption(event.key);
      }
    });
  });
  document.addEventListener('pointerdown', event => {
    if (!root.contains(event.target)) close();
  });
  document.addEventListener('focusin', event => {
    if (!root.contains(event.target)) close();
  });
  select.addEventListener('change', sync);
  root.append(trigger, menu);
  customSelectClosers.push({ root, close });
  root.classList.add('custom-select-ready');
  sync();
});

const licenceSelect = document.querySelector('#licence-select');
const licencePrice = document.querySelector('#licence-price');
if (licenceSelect && licencePrice) {
  licenceSelect.addEventListener('change', () => {
    licencePrice.textContent = `€${licenceSelect.value}`;
  });
}

document.querySelectorAll('.faq-list').forEach(list => {
  const items = [...list.querySelectorAll('.faq-item')];
  const states = new WeakMap(items.map(item => [item, { expanded: item.open, animation: null }]));

  const setOpen = (item, expanded) => {
    const state = states.get(item);
    if (state.expanded === expanded) return;
    const startHeight = item.getBoundingClientRect().height;
    state.animation?.cancel();
    state.expanded = expanded;

    if (motionPreference.matches || typeof item.animate !== 'function') {
      item.open = expanded;
      item.style.removeProperty('height');
      state.animation = null;
      return;
    }

    item.style.height = `${startHeight}px`;
    item.open = true;
    const border = item.offsetHeight - item.clientHeight;
    const endHeight = expanded
      ? item.scrollHeight + border
      : item.querySelector('summary').getBoundingClientRect().height + border;
    const animation = item.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 320, easing: 'cubic-bezier(.22, .8, .24, 1)' }
    );
    state.animation = animation;
    animation.onfinish = () => {
      if (state.animation !== animation) return;
      item.open = state.expanded;
      item.style.removeProperty('height');
      state.animation = null;
    };
  };

  items.forEach(item => item.querySelector('summary').addEventListener('click', event => {
    event.preventDefault();
    const willOpen = !states.get(item).expanded;
    if (willOpen) items.filter(other => other !== item).forEach(other => setOpen(other, false));
    setOpen(item, willOpen);
  }));
});

const search = document.querySelector('#theme-search');
const industry = document.querySelector('#theme-industry');
const price = document.querySelector('#theme-price');
const version = document.querySelector('#theme-version');
if (search && industry && price && version) {
  const products = [...document.querySelectorAll('[data-product]')];
  const count = document.querySelector('#filter-count');
  const empty = document.querySelector('#empty-state');
  const update = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    products.forEach(product => {
      const matchesSearch = `${product.dataset.name} ${product.dataset.industry}`.includes(query);
      const matchesIndustry = industry.value === 'all' || product.dataset.industry.includes(industry.value);
      const numericPrice = Number(product.dataset.price);
      const matchesPrice = price.value === 'all' || (price.value === 'free' && numericPrice === 0) || (price.value === 'paid' && numericPrice > 0) || (price.value === 'roadmap' && numericPrice < 0);
      const matchesVersion = version.value === 'all' || product.dataset.version.split(' ').includes(version.value);
      const show = matchesSearch && matchesIndustry && matchesPrice && matchesVersion;
      product.hidden = !show;
      if (show) visible++;
    });
    count.textContent = `${visible} ${visible === 1 ? 'theme' : 'themes'} shown`;
    empty.classList.toggle('show', visible === 0);
  };
  [search, industry, price, version].forEach(control => control.addEventListener(control === search ? 'input' : 'change', update));
  document.querySelector('#clear-filters')?.addEventListener('click', () => {
    search.value = '';
    industry.value = 'all';
    price.value = 'all';
    version.value = 'all';
    [industry, price, version].forEach(control => control.dispatchEvent(new Event('change', { bubbles: true })));
    update();
    search.focus();
  });
  update();
}

document.querySelectorAll('[data-comments]').forEach(section => {
  const article = section.dataset.article;
  const storageKey = `cmsmotive-comments:v1:${article}`;
  const list = section.querySelector('[data-comment-list]');
  const count = section.querySelector('[data-comment-count]');
  const mainForm = section.querySelector('[data-comment-form]');
  const mainStatus = section.querySelector('[data-comment-status]');
  const examples = article === 'blog-typography.html' ? [
    { id: 'example-question', name: 'Example reader', message: 'How do you decide when display type needs its own component instead of another heading variant?', date: '2026-09-12T10:00:00.000Z', example: true },
    { id: 'example-answer', parentId: 'example-question', name: 'Example editorial reply', message: 'When its layout behavior changes as well as its visual role. We test that decision against real titles at several screen widths.', date: '2026-09-13T10:00:00.000Z', example: true }
  ] : [];
  let saved = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(parsed)) saved = parsed.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.message === 'string' && typeof item.date === 'string');
  } catch {
    mainStatus.textContent = 'Saved comments are unavailable in this browser.';
  }

  const make = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  };
  const displayDate = date => {
    const value = new Date(date);
    return Number.isNaN(value.getTime()) ? '' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
  };
  const commentNode = (item, reply = false) => {
    const row = make('div', 'comment-top');
    row.id = `comment-${item.id}`;
    row.tabIndex = -1;
    const avatar = make('span', 'comment-avatar', item.name.trim().charAt(0).toUpperCase() || '?');
    avatar.setAttribute('aria-hidden', 'true');
    const content = make('div', 'comment-content');
    const byline = make('div', 'comment-byline');
    byline.append(make('strong', '', item.name));
    const time = make('time', '', displayDate(item.date));
    time.dateTime = item.date;
    byline.append(time);
    if (item.example) byline.append(make('span', 'comment-example', 'Example'));
    content.append(byline, make('p', '', item.message));
    if (!reply) {
      const button = make('button', 'comment-reply-button', 'Reply');
      button.type = 'button';
      button.dataset.replyTo = item.id;
      button.setAttribute('aria-label', `Reply to ${item.name}`);
      content.append(button);
    }
    if (!item.example) {
      const remove = make('button', 'comment-remove-button', 'Remove');
      remove.type = 'button';
      remove.dataset.removeComment = item.id;
      remove.setAttribute('aria-label', `Remove comment by ${item.name}`);
      content.append(remove);
    }
    row.append(avatar, content);
    return row;
  };
  const render = () => {
    const all = [...saved, ...examples];
    count.textContent = String(all.length);
    list.replaceChildren();
    const roots = all.filter(item => !item.parentId);
    if (!roots.length) {
      list.append(make('p', 'comment-empty', 'No comments yet. Start the conversation.'));
      return;
    }
    roots.forEach(item => {
      const thread = make('article', 'comment-thread');
      thread.append(commentNode(item));
      const replies = all.filter(reply => reply.parentId === item.id);
      if (replies.length) {
        const repliesNode = make('div', 'comment-replies');
        repliesNode.setAttribute('aria-label', `Replies to ${item.name}`);
        replies.forEach(reply => repliesNode.append(commentNode(reply, true)));
        thread.append(repliesNode);
      }
      list.append(thread);
    });
  };
  const save = (form, parentId = null) => {
    if (!form.reportValidity()) return;
    const name = form.elements.name.value.trim();
    const message = form.elements.message.value.trim();
    if (name.length < 2 || message.length < 2) {
      mainStatus.textContent = 'Please enter your name and a comment.';
      return;
    }
    const item = { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, message, date: new Date().toISOString() };
    if (parentId) item.parentId = parentId;
    const next = [item, ...saved];
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      mainStatus.textContent = 'This browser could not save the comment. Please check its storage settings.';
      return;
    }
    saved = next;
    form.reset();
    render();
    mainStatus.textContent = parentId ? 'Reply saved in this browser.' : 'Comment saved in this browser.';
    document.getElementById(`comment-${item.id}`)?.focus();
  };

  mainForm.addEventListener('submit', event => {
    event.preventDefault();
    save(mainForm);
  });
  list.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-remove-comment]');
    if (removeButton) {
      const id = removeButton.dataset.removeComment;
      const next = saved.filter(item => item.id !== id && item.parentId !== id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        mainStatus.textContent = 'This browser could not remove the comment. Please check its storage settings.';
        return;
      }
      saved = next;
      render();
      mainStatus.textContent = 'Comment removed from this browser.';
      return;
    }
    const button = event.target.closest('[data-reply-to]');
    if (!button) return;
    const existing = list.querySelector('.reply-composer');
    if (existing) {
      const same = existing.dataset.parentId === button.dataset.replyTo;
      existing.remove();
      if (same) return;
    }
    const parentId = button.dataset.replyTo;
    const parent = [...saved, ...examples].find(item => item.id === parentId);
    if (!parent) return;
    const wrapper = make('div', 'reply-composer');
    wrapper.dataset.parentId = parentId;
    const heading = make('h4', '', `Reply to ${parent.name}`);
    const form = make('form', 'comment-form');
    const nameField = make('div', 'comment-field');
    const nameId = `reply-name-${parentId}`;
    const nameLabel = make('label', '', 'Your name');
    nameLabel.htmlFor = nameId;
    const nameInput = make('input');
    Object.assign(nameInput, { id: nameId, name: 'name', required: true, minLength: 2, maxLength: 60, placeholder: 'Your name', autocomplete: 'name' });
    nameField.append(nameLabel, nameInput);
    const messageField = make('div', 'comment-field');
    const messageId = `reply-message-${parentId}`;
    const messageLabel = make('label', '', 'Your reply');
    messageLabel.htmlFor = messageId;
    const messageInput = make('textarea');
    Object.assign(messageInput, { id: messageId, name: 'message', required: true, minLength: 2, maxLength: 2000, rows: 3, placeholder: 'Write a reply...' });
    messageField.append(messageLabel, messageInput);
    const actions = make('div', 'comment-form-bottom');
    const cancel = make('button', 'comment-cancel', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => { wrapper.remove(); button.focus(); });
    const submit = make('button', 'btn btn-primary', 'Post reply');
    submit.type = 'submit';
    actions.append(cancel, submit);
    form.append(nameField, messageField, actions);
    form.addEventListener('submit', submitEvent => {
      submitEvent.preventDefault();
      save(form, parentId);
    });
    wrapper.append(heading, form);
    button.closest('.comment-top').after(wrapper);
    nameInput.focus();
  });
  render();
});

document.querySelectorAll('[data-contact-form]').forEach(form => {
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const name = String(fields.get('name') || '').trim();
    const email = String(fields.get('email') || '').trim();
    const topic = String(fields.get('topic') || 'Website enquiry');
    const message = String(fields.get('message') || '').trim();
    const status = form.querySelector('[data-contact-status]');
    if (status) {
      status.textContent = form.dataset.message;
      status.hidden = false;
    }
    const subject = encodeURIComponent(`${topic} — ${name} via cmsmotive.com`);
    const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`);
    window.location.href = `mailto:hello@cmsmotive.com?subject=${subject}&body=${body}`;
  });
});
