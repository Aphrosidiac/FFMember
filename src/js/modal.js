// Membership and plan-detail dialogs. Focus is trapped inside, Escape and the veil close them,
// and focus returns to the control that opened them. The join form validates locally and then
// prepares an email draft — nothing on this page sends data anywhere.
import { setButtonText } from './buttons.js';
import { lockScroll, coarse } from './motion.js';

export const PLANS = {
  care: { name: 'Care', month: 59, items: ['Managed hosting, SSL and CDN', 'Uptime monitoring', 'Backups or version recovery appropriate to the stack', 'Security and dependency maintenance', 'Fixes for defects in FF-delivered work', 'No routine content changes'] },
  maintain: { name: 'Maintain', month: 149, items: ['Everything in Care', 'Up to 60 minutes of minor content or visual changes per month', 'Priority WhatsApp support', 'Basic monthly health check'] },
  evolve: { name: 'Evolve', month: 299, items: ['Everything in Maintain', 'Up to three hours of iterative improvements per month', 'Basic analytics review', 'One quarterly improvement recommendation', 'Priority scheduling for small enhancements'] },
};
const rm = (n) => 'RM' + n.toLocaleString('en-MY');

let openModal = null;
let opener = null;

function focusables(el) {
  return [...el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((n) => n.offsetParent !== null || n === document.activeElement);
}

function open(modal, from) {
  if (openModal) close(openModal, false);
  opener = from || document.activeElement;
  modal.hidden = false;
  document.querySelectorAll('body > :not(.modal):not(script)').forEach((n) => (n.inert = true));
  // flush styles so the closed state is committed and the entrance still transitions, without
  // waiting a frame (a busy WebGL frame can hold rAF long enough to lose the open state)
  void modal.offsetWidth;
  modal.classList.add('is-open');
  // On a touch screen focusing a field throws the keyboard up over the dialog before it is read, so
  // focus goes to the dialog's title instead (screen readers still start inside the dialog).
  let first = modal.querySelector('input, select, [data-plan-join], [data-done-title]') || focusables(modal)[0];
  if (coarse && first?.matches('input, select, textarea')) {
    first = modal.querySelector('h2');
    first?.setAttribute('tabindex', '-1');
  }
  first?.focus({ preventScroll: true });
  lockScroll(true);
  openModal = modal;
}

function close(modal, restore = true) {
  modal.classList.remove('is-open');
  document.querySelectorAll('[inert]').forEach((n) => { if (!n.matches('[data-menu]')) n.inert = false; });
  const done = () => { if (!modal.classList.contains('is-open')) modal.hidden = true; };
  setTimeout(done, 600);
  lockScroll(false);
  openModal = null;
  if (restore && opener?.isConnected) opener.focus({ preventScroll: true });
}

export function initModals() {
  const join = document.querySelector('[data-modal="join"]');
  const plan = document.querySelector('[data-modal="plan"]');

  document.addEventListener('click', (e) => {
    const j = e.target.closest('[data-join]');
    if (j && join) {
      e.preventDefault();
      const pick = j.getAttribute('data-join');
      if (pick) join.querySelector('#j-plan').value = pick;
      const billing = document.querySelector('[data-billing]:checked')?.value;
      if (billing) join.querySelector(`[name="period"][value="${billing === 'year' ? 'yearly' : 'monthly'}"]`).checked = true;
      showStep(join, 'form');
      open(join, j);
      return;
    }
    const d = e.target.closest('[data-plan-detail]');
    if (d && plan) { fillPlan(plan, d.getAttribute('data-plan-detail')); open(plan, d); return; }
    if (e.target.closest('[data-close]') && openModal) close(openModal);
  });

  addEventListener('keydown', (e) => {
    if (!openModal) return;
    if (e.key === 'Escape') { close(openModal); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(openModal);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  if (plan) {
    plan.querySelector('[data-plan-join]').addEventListener('click', () => {
      const key = plan.dataset.current;
      close(plan, false);
      join.querySelector('#j-plan').value = key;
      showStep(join, 'form');
      open(join, opener);
    });
  }
  if (join) initJoinForm(join);
}

function fillPlan(modal, key) {
  const p = PLANS[key];
  modal.dataset.current = key;
  modal.querySelector('[data-plan-name]').textContent = p.name;
  modal.querySelector('[data-plan-eyebrow]').textContent = 'Plan · ' + rm(p.month) + ' / month';
  modal.querySelector('[data-fee-month]').textContent = rm(p.month) + ' / month';
  modal.querySelector('[data-fee-year]').textContent = rm(p.month * 10) + ' / year';
  modal.querySelector('[data-fee-save]').textContent = rm(p.month * 2);
  const list = modal.querySelector('[data-plan-list]');
  list.replaceChildren(...p.items.map((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    if (t.startsWith('No ')) li.className = 'is-off';
    return li;
  }));
  setButtonText(modal.querySelector('[data-plan-join]'), 'Choose ' + p.name);
}

function showStep(modal, step) {
  modal.querySelectorAll('[data-step]').forEach((s) => (s.hidden = s.dataset.step !== step));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SITE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

function initJoinForm(modal) {
  const form = modal.querySelector('[data-join-form]');
  const err = (name, msg) => {
    const field = form.elements[name].closest('.field');
    field.classList.toggle('is-invalid', !!msg);
    field.querySelector('.field__error').textContent = msg || '';
    form.elements[name].setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const check = () => {
    const v = Object.fromEntries(new FormData(form));
    const errors = {};
    if (!v.name?.trim()) errors.name = 'Please tell us your name.';
    else if (v.name.trim().length > 120) errors.name = 'That name is longer than 120 characters.';
    if (!v.email?.trim()) errors.email = 'We need an email to reply to.';
    else if (!EMAIL.test(v.email.trim())) errors.email = 'That email does not look complete.';
    if (v.site?.trim() && !SITE.test(v.site.trim())) errors.site = 'Use a web address like example.com.';
    if (!v.plan) errors.plan = 'Pick a plan, or “Not sure yet”.';
    for (const n of ['name', 'email', 'site', 'plan']) err(n, errors[n]);
    const consent = form.elements.consent.checked;
    form.querySelector('[data-consent-error]').textContent = consent ? '' : 'Please agree so we can reply.';
    return { ok: !Object.keys(errors).length && consent, v, errors };
  };
  form.addEventListener('input', (e) => {
    if (e.target.closest('.field.is-invalid') || e.target.name === 'consent') check();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { ok, v, errors } = check();
    if (!ok) {
      const first = ['name', 'email', 'site', 'plan'].find((n) => errors[n]);
      (first ? form.elements[first] : form.elements.consent).focus();
      return;
    }
    const plan = v.plan === 'unsure' ? 'Not sure yet' : PLANS[v.plan].name;
    const price = v.plan === 'unsure' ? '' : v.period === 'yearly' ? rm(PLANS[v.plan].month * 10) + ' / year' : rm(PLANS[v.plan].month) + ' / month';
    const rows = [['Name', v.name.trim()], ['Email', v.email.trim()], ['Website', v.site?.trim() || '—'], ['Plan', plan + (price ? ' · ' + price : '')], ['Billing', v.period === 'yearly' ? 'Yearly' : 'Monthly']];
    if (v.note?.trim()) rows.push(['Note', v.note.trim()]);
    const dl = modal.querySelector('[data-summary]');
    dl.replaceChildren(...rows.map(([k, val]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = val;
      d.append(dt, dd);
      return d;
    }));
    const body = rows.map(([k, val]) => `${k}: ${val}`).join('\n');
    modal.querySelector('[data-mailto]').href = 'mailto:hello@ffdev.studio?subject=' + encodeURIComponent('FF Member — ' + plan) + '&body=' + encodeURIComponent(body + '\n');
    showStep(modal, 'done');
    modal.querySelector('[data-done-title]').focus();
  });
  modal.querySelector('[data-back]').addEventListener('click', () => { showStep(modal, 'form'); form.elements.name.focus(); });
}
