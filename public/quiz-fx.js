// Games page: moving the mouse or a finger over the "make your own quiz" banner releases glowing
// math symbols (+, ×, π, √, ∑ …) that float up, spin and fade. A click or tap pops a little burst of them.
(function () {
  const card = document.querySelector('.create-card');
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'create-fx';
  cv.setAttribute('aria-hidden', 'true');
  card.prepend(cv);
  const g = cv.getContext('2d');
  const SYMS = ['+', '−', '×', '÷', '=', 'π', '√', '∑', '∞', '%', '?', 'x²', '△', '★', '∫', 'α'];
  const HUES = [190, 210, 265, 290, 160, 45, 320];
  let W = 0, H = 0, bits = [], last = null, running = false, lastSpawn = 0;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2); W = card.clientWidth; H = card.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(size).observe(card); size();

  function add(x, y, burst) {
    const a = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - .5) * 1.2;
    const sp = burst ? 2 + Math.random() * 3.5 : .6 + Math.random() * 1.2;
    bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 13 + Math.random() * 15,
      t: SYMS[Math.floor(Math.random() * SYMS.length)], h: HUES[Math.floor(Math.random() * HUES.length)],
      rot: (Math.random() - .5) * .6, vr: (Math.random() - .5) * .06, life: 1, decay: .012 + Math.random() * .01, pop: 0 });
    if (bits.length > 140) bits.splice(0, bits.length - 140);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  card.addEventListener('pointermove', e => {
    const rc = card.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, now = performance.now();
    const moved = last ? Math.hypot(x - last.x, y - last.y) : 0;
    if (moved > 14 || now - lastSpawn > 120) { add(x, y, false); lastSpawn = now; last = { x, y }; }
    if (!last) last = { x, y };
  });
  card.addEventListener('pointerleave', () => { last = null; });
  card.addEventListener('pointerdown', e => {
    const rc = card.getBoundingClientRect();
    for (let i = 0; i < 12; i++) add(e.clientX - rc.left, e.clientY - rc.top, true);
  });

  function frame() {
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const b of bits) {
      b.vx *= .985; b.vy = b.vy * .985 - .02; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life -= b.decay;
      b.pop = Math.min(1, b.pop + .12);
      if (b.life <= 0) continue;
      const k = b.pop < 1 ? .4 + .6 * b.pop + .25 * Math.sin(b.pop * Math.PI) : 1;   // pops in, slightly overshooting
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.scale(k, k);
      g.font = `900 ${b.s}px Inter, system-ui, sans-serif`;
      g.shadowColor = `hsla(${b.h},100%,65%,${b.life})`; g.shadowBlur = 14;
      g.fillStyle = `hsla(${b.h},100%,${72 + 10 * b.life}%,${Math.min(1, b.life * 1.4)})`;
      g.fillText(b.t, 0, 0);
      g.restore();
    }
    bits = bits.filter(b => b.life > 0 && b.y > -40);
    if (bits.length) requestAnimationFrame(frame); else { g.clearRect(0, 0, W, H); running = false; }
  }
})();
