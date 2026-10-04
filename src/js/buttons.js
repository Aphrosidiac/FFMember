// Pill buttons: on hover the label rolls up to a copy of itself and a lighter fill grows from the
// point where the pointer came in (and shrinks back towards where it left).
export function setButtonText(btn, text) {
  const label = btn.querySelector('.btn__roll > span');
  if (!label) { btn.textContent = text; return; }
  label.textContent = text;
  label.dataset.text = text;
}

function wrapLabel(btn) {
  if (btn.querySelector('.btn__roll')) return;
  const node = [...btn.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (!node) return;
  const text = node.textContent.trim();
  const roll = document.createElement('span');
  roll.className = 'btn__roll';
  const label = document.createElement('span');
  label.textContent = text;
  label.dataset.text = text;
  roll.append(label);
  node.replaceWith(roll);
}

export function initButtons(root = document) {
  root.querySelectorAll('.btn').forEach(wrapLabel);
  const origin = (e) => {
    const btn = e.target.closest?.('.btn');
    if (!btn || btn.contains(e.relatedTarget)) return; // only on entering or leaving the button itself
    const r = btn.getBoundingClientRect();
    btn.style.setProperty('--x', `${((e.clientX - r.left) / r.width) * 100}%`);
    btn.style.setProperty('--y', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  document.addEventListener('pointerover', origin);
  document.addEventListener('pointerout', origin);
}
