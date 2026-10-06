(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'mathBg';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');

  const SYMBOLS = [
    'π','∑','∫','√','∞','α','β','γ','Δ','θ',
    'λ','μ','σ','φ','ω','±','sin','cos','tan',
    'log','f(x)','dy/dx','a²+b²','∂','∇','x²','e',
  ];

  const COLORS = [
    'rgba(26,86,219,',
    'rgba(8,145,178,',
    'rgba(99,102,241,',
    'rgba(14,165,233,',
  ];

  let particles = [];
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); init(); });

  function rand(min, max) { return Math.random() * (max - min) + min; }

  // ── Wave shapes (like the GoTAB brand image) ──
  function drawWaves() {
    // Back wave — lighter, higher up
    const g1 = ctx.createLinearGradient(0, H * 0.4, W, H);
    g1.addColorStop(0, 'rgba(26,86,219,0.13)');
    g1.addColorStop(1, 'rgba(8,145,178,0.07)');

    ctx.beginPath();
    ctx.moveTo(-100, H * 0.68);
    ctx.bezierCurveTo(
      W * 0.12, H * 0.44,
      W * 0.40, H * 0.80,
      W * 0.65, H * 0.57
    );
    ctx.bezierCurveTo(
      W * 0.86, H * 0.40,
      W * 1.05, H * 0.64,
      W + 100,  H * 0.50
    );
    ctx.lineTo(W + 100, H + 50);
    ctx.lineTo(-100, H + 50);
    ctx.closePath();
    ctx.fillStyle = g1;
    ctx.fill();

    // Front wave — slightly darker, lower
    const g2 = ctx.createLinearGradient(0, H * 0.55, W, H);
    g2.addColorStop(0, 'rgba(26,86,219,0.16)');
    g2.addColorStop(1, 'rgba(8,145,178,0.10)');

    ctx.beginPath();
    ctx.moveTo(-100, H * 0.82);
    ctx.bezierCurveTo(
      W * 0.20, H * 0.58,
      W * 0.48, H * 0.94,
      W * 0.76, H * 0.70
    );
    ctx.bezierCurveTo(
      W * 0.94, H * 0.55,
      W * 1.08, H * 0.78,
      W + 100,  H * 0.63
    );
    ctx.lineTo(W + 100, H + 50);
    ctx.lineTo(-100, H + 50);
    ctx.closePath();
    ctx.fillStyle = g2;
    ctx.fill();
  }

  // ── Particles ──
  function createParticle() {
    const op = rand(0.06, 0.14);
    return {
      x: rand(0, W),
      y: rand(0, H),
      text: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      size: rand(13, 22),
      speedX: rand(-0.08, 0.08),
      speedY: rand(-0.18, -0.07),
      opacity: op,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: rand(-0.2, 0.2),
      rotSpeed: rand(-0.0005, 0.0005),
    };
  }

  function init() {
    const count = Math.min(Math.floor((W * H) / 22000), 40);
    particles = Array.from({ length: count }, createParticle);
  }
  init();

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw waves first (background)
    drawWaves();

    // Draw floating symbols on top
    for (const p of particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;

      if (p.y < -40) { p.y = H + 20; p.x = rand(0, W); p.text = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }
      if (p.x < -60) p.x = W + 20;
      if (p.x > W + 60) p.x = -20;

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
