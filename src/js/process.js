// Process: the step nearest the middle of the screen is active; the sticky frame wipes up to the
// screenshot that step belongs to.
export function initProcess() {
  const steps = [...document.querySelectorAll('[data-process-steps] li')];
  const frames = [...document.querySelectorAll('[data-process-media] .process__frame')];
  const caption = document.querySelector('[data-process-caption]');
  if (!steps.length || !frames.length) return;
  let current = -1;
  const activate = (i) => {
    if (i === current) return;
    current = i;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    const f = Number(steps[i].dataset.frame);
    frames.forEach((fr, k) => {
      fr.classList.toggle('is-active', k === f);
      fr.classList.toggle('is-past', k < f);
    });
    if (caption) caption.textContent = steps[i].dataset.name;
  };
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) activate(steps.indexOf(e.target));
  }, { rootMargin: '-48% 0px -48% 0px' });
  steps.forEach((s) => io.observe(s));
  activate(0);
}
