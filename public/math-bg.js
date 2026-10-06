(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'mathBg';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');

  const SYMBOLS = [
    'π','∑','∫','√','∞','α','β','γ','Δ','θ',
    'λ','μ','σ','φ','ω','±','÷','×','≈','≠',
    'sin','cos','tan','log','f(x)','dy/dx',
    'a²+b²','∂','∇','∈','∀','∃',
    '2','3','5','7','11','13',
    '0.618','1.618','e','i',
    'x²','xⁿ','Σn','∫f dx',
  ];

  const COLORS = [
    'rgba(14,165,233,',   // sky blue
    'rgba(6,182,212,',    // cyan
    'rgba(139,92,246,',   // purple
    'rgba(16,185,129,',   // green
    'rgba(99,179,237,',   // light blue
    'rgba(167,139,250,',  // light purple
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

  function createParticle(x, y) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x: x !== undefined ? x : rand(0, W),
      y: y !== undefined ? y : rand(0, H),
      text: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      size: rand(11, 22),
      speedX: rand(-0.3, 0.3),
      speedY: rand(-0.6, -0.2),
      opacity: rand(0.06, 0.22),
      targetOpacity: rand(0.06, 0.22),
      color,
      fadeSpeed: rand(0.003, 0.008),
      fadeDir: 1,
      rotation: rand(-0.3, 0.3),
      rotSpeed: rand(-0.003, 0.003),
    };
  }

  function init() {
    const count = Math.floor((W * H) / 18000);
    particles = Array.from({ length: Math.min(count, 55) }, () => createParticle());
  }
  init();

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      // Fade in/out
      p.opacity += p.fadeSpeed * p.fadeDir;
      if (p.opacity >= p.targetOpacity) p.fadeDir = -1;
      if (p.opacity <= 0.02) {
        p.fadeDir = 1;
        p.targetOpacity = rand(0.08, 0.22);
      }

      // Move
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;

      // Reset when out of screen
      if (p.y < -40) {
        p.y = H + 20;
        p.x = rand(0, W);
        p.text = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
      if (p.x < -60) p.x = W + 20;
      if (p.x > W + 60) p.x = -20;

      // Draw
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Glow
      ctx.shadowColor = p.color + '0.6)';
      ctx.shadowBlur = 8;

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
