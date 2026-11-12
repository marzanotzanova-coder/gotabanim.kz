// Colourful "water" trail inside the greeting banner: moving the mouse or a finger leaves glowing blobs
// that drift, swirl and fade. Drawn on a canvas under the banner's text; idle when nothing moves.
(function () {
  const hero = document.querySelector('.hero');
  if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'hero-fluid';
  cv.setAttribute('aria-hidden', 'true');
  hero.prepend(cv);
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, blobs = [], hue = 190, last = null, running = false;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = hero.clientWidth; H = hero.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(size).observe(hero); size();

  // each pointer move drops a few blobs that carry the pointer's speed
  function spawn(x, y, dx, dy) {
    const speed = Math.min(Math.hypot(dx, dy), 60);
    const n = 1 + Math.round(speed / 18);
    for (let i = 0; i < n; i++) {
      hue = (hue + 2.2) % 360;
      blobs.push({ x, y, vx: dx * .25 + (Math.random() - .5) * 1.6, vy: dy * .25 + (Math.random() - .5) * 1.6,
        r: 18 + Math.random() * 22 + speed * .5, h: hue, life: 1 });
    }
    if (blobs.length > 180) blobs.splice(0, blobs.length - 180);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  hero.addEventListener('pointermove', e => {
    const rc = hero.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    if (last) spawn(x, y, x - last.x, y - last.y); last = { x, y };
  });
  hero.addEventListener('pointerleave', () => { last = null; });

  function frame(t) {
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      // gentle swirl so the colours flow like water instead of moving in straight lines
      const a = Math.sin(b.x * .012 + t * .0011) + Math.cos(b.y * .014 - t * .0009);
      b.vx = b.vx * .955 + Math.cos(a) * .12; b.vy = b.vy * .955 + Math.sin(a) * .12;
      b.x += b.vx; b.y += b.vy; b.r += .9; b.life -= .012;
      if (b.life <= 0) continue;
      const grd = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      grd.addColorStop(0, `hsla(${b.h},95%,65%,${.38 * b.life})`);
      grd.addColorStop(.5, `hsla(${b.h + 30},95%,60%,${.16 * b.life})`);
      grd.addColorStop(1, `hsla(${b.h + 60},95%,55%,0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
    }
    blobs = blobs.filter(b => b.life > 0);
    if (blobs.length) requestAnimationFrame(frame); else { g.clearRect(0, 0, W, H); running = false; }
  }
})();
