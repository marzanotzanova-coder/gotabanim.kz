// Glitter in the greeting banner: moving the mouse or a finger scatters tiny twinkling sparkles
// (gold, silver, pink, cyan, violet) that spin, drift down and fade. Idle when nothing moves.
(function () {
  const hero = document.querySelector('.hero');
  if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'hero-fx';
  cv.setAttribute('aria-hidden', 'true');
  hero.prepend(cv);
  const g = cv.getContext('2d');
  // [hue, saturation, lightness]
  const COLORS = [[45, 100, 62], [48, 100, 75], [0, 0, 96], [330, 95, 75], [190, 95, 70], [270, 90, 78]];
  let W = 0, H = 0, bits = [], last = null, running = false;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2); W = hero.clientWidth; H = hero.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(size).observe(hero); size();

  function spawn(x, y, dx, dy) {
    const n = 3 + Math.min(6, Math.round(Math.hypot(dx, dy) / 8));
    for (let i = 0; i < n; i++) {
      const c = COLORS[Math.floor(Math.random() * COLORS.length)], big = Math.random() < .3;
      bits.push({ x: x + (Math.random() - .5) * 18, y: y + (Math.random() - .5) * 18,
        vx: dx * .12 + (Math.random() - .5) * 2.4, vy: dy * .12 + (Math.random() - .5) * 2.4 - .6,
        s: big ? 5 + Math.random() * 5 : 1.4 + Math.random() * 2.4, star: big, rot: Math.random() * 6.3, vr: (Math.random() - .5) * .25,
        c, ph: Math.random() * 6.3, life: 1, decay: .008 + Math.random() * .012 });
    }
    if (bits.length > 320) bits.splice(0, bits.length - 320);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  hero.addEventListener('pointermove', e => {
    const rc = hero.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    if (last) spawn(x, y, x - last.x, y - last.y); last = { x, y };
  });
  hero.addEventListener('pointerleave', () => { last = null; });

  // four-pointed sparkle
  function sparkle(s) {
    g.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .22 : s, a = i * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  function frame(t) {
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const b of bits) {
      b.vx *= .97; b.vy = b.vy * .97 + .045; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life -= b.decay;
      if (b.life <= 0) continue;
      const tw = .45 + .55 * Math.abs(Math.sin(t * .012 + b.ph)), a = b.life * tw, [h, s, l] = b.c;
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot);
      if (b.star) {
        g.fillStyle = `hsla(${h},${s}%,${l}%,${a * .35})`; sparkle(b.s * 1.9);   // soft halo
        g.fillStyle = `hsla(${h},${s}%,${Math.min(96, l + 15)}%,${a})`; sparkle(b.s);
      } else {
        g.fillStyle = `hsla(${h},${s}%,${l}%,${a})`; g.fillRect(-b.s / 2, -b.s / 2, b.s, b.s); // a flake of glitter
      }
      g.restore();
    }
    bits = bits.filter(b => b.life > 0 && b.y < H + 20);
    if (bits.length) requestAnimationFrame(frame); else { g.clearRect(0, 0, W, H); running = false; }
  }
})();
