// Kuala Lumpur local time in every [data-clock]; [data-seconds] adds seconds.
const short = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: false });
const long = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export function initClocks() {
  const els = [...document.querySelectorAll('[data-clock]')];
  if (!els.length) return;
  const tick = () => {
    const now = new Date();
    const a = short.format(now);
    const b = long.format(now);
    for (const el of els) el.textContent = el.hasAttribute('data-seconds') ? b : a;
  };
  tick();
  setInterval(tick, 1000);
}
