(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'mathBg';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');

  const SYMBOLS = [
    'π','∑','∫','√','∞','α','β','γ','Δ','θ',
    'λ','μ','σ','φ','ω','±','sin','cos','tan',
    'log','f(x)','dy/dx','a²+b²','∂','∇','x²','eˣ',
    '2x+1','x²+y²','∫dx','Σn','lim','Δx','∂f/∂x',
    '42','3.14','√2','2π','e²',
  ];

  const COLORS = [
    'rgba(15,58,180,',
    'rgba(6,100,160,',
    'rgba(67,56,202,',
    'rgba(10,120,200,',
  ];

  let particles = [];
  let stars = [];
  let W, H;
  let t = 0;

  let cardZone = null;

  function getCardZone() {
    const el = document.querySelector('.card, .auth-card');
    if (!el) { cardZone = null; return; }
    const r = el.getBoundingClientRect();
    const pad = 18;
    cardZone = { x: r.left - pad, y: r.top - pad, w: r.width + pad*2, h: r.height + pad*2 };
  }

  function inCard(x, y) {
    if (!cardZone) return false;
    return x >= cardZone.x && x <= cardZone.x + cardZone.w &&
           y >= cardZone.y && y <= cardZone.y + cardZone.h;
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    getCardZone();
  }
  resize();
  window.addEventListener('resize', () => { resize(); init(); });

  function rand(min, max) { return Math.random() * (max - min) + min; }

  // ── Blue stars ──
  function createStar() {
    return {
      x: rand(0, W),
      y: rand(0, H),
      r: rand(1, 2.8),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.004, 0.012),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      baseOp: rand(0.30, 0.60),
    };
  }

  // ── Floating math symbols ──
  function createParticle() {
    return {
      x: rand(0, W),
      y: rand(0, H),
      text: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      size: rand(11, 20),
      speedX: rand(-0.06, 0.06),
      speedY: rand(-0.14, -0.05),
      opacity: rand(0.14, 0.28),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: rand(-0.15, 0.15),
      rotSpeed: rand(-0.0004, 0.0004),
    };
  }

  function init() {
    const starCount   = Math.min(Math.floor((W * H) / 8000), 120);
    const symbolCount = Math.min(Math.floor((W * H) / 24000), 36);
    stars     = Array.from({ length: starCount },   createStar);
    particles = Array.from({ length: symbolCount }, createParticle);
  }
  init();

  // ── Waves ──
  function drawWaves() {
    const g1 = ctx.createLinearGradient(0, H * 0.4, W, H);
    g1.addColorStop(0, 'rgba(26,86,219,0.13)');
    g1.addColorStop(1, 'rgba(8,145,178,0.07)');
    ctx.beginPath();
    ctx.moveTo(-100, H * 0.68);
    ctx.bezierCurveTo(W*0.12, H*0.44, W*0.40, H*0.80, W*0.65, H*0.57);
    ctx.bezierCurveTo(W*0.86, H*0.40, W*1.05, H*0.64, W+100, H*0.50);
    ctx.lineTo(W+100, H+50); ctx.lineTo(-100, H+50);
    ctx.closePath(); ctx.fillStyle = g1; ctx.fill();

    const g2 = ctx.createLinearGradient(0, H * 0.55, W, H);
    g2.addColorStop(0, 'rgba(26,86,219,0.16)');
    g2.addColorStop(1, 'rgba(8,145,178,0.10)');
    ctx.beginPath();
    ctx.moveTo(-100, H * 0.82);
    ctx.bezierCurveTo(W*0.20, H*0.58, W*0.48, H*0.94, W*0.76, H*0.70);
    ctx.bezierCurveTo(W*0.94, H*0.55, W*1.08, H*0.78, W+100, H*0.63);
    ctx.lineTo(W+100, H+50); ctx.lineTo(-100, H+50);
    ctx.closePath(); ctx.fillStyle = g2; ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.008;

    // 1. Waves
    drawWaves();

    // 2. Twinkling blue stars
    getCardZone();
    for (const s of stars) {
      if (inCard(s.x, s.y)) continue;
      const op = s.baseOp * (0.5 + 0.5 * Math.sin(t * (s.speed / 0.008) + s.phase));
      ctx.save();
      ctx.globalAlpha = op;
      ctx.fillStyle = s.color + '1)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Floating math symbols
    for (const p of particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;

      if (p.y < -40) { p.y = H + 20; p.x = rand(0, W); p.text = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }
      if (p.x < -60) p.x = W + 20;
      if (p.x > W + 60) p.x = -20;

      if (inCard(p.x, p.y)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color + p.opacity + ')';
      ctx.font = `600 ${p.size}px 'Inter', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }
  draw();
})();
