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
    'rgba(14,165,233,',
    'rgba(6,182,212,',
    'rgba(139,92,246,',
    'rgba(99,179,237,',
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

  function createParticle() {
    const op = rand(0.07, 0.16);
    return {
      x: rand(0, W),
      y: rand(0, H),
      text: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      size: rand(12, 20),
      speedX: rand(-0.08, 0.08),
      speedY: rand(-0.18, -0.07),  // баяу жоғарыға
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

    for (const p of particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;

      if (p.y < -40) {
        p.y = H + 20;
        p.x = rand(0, W);
        p.text = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
      if (p.x < -60) p.x = W + 20;
      if (p.x > W + 60) p.x = -20;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color + p.opacity + ')';
      ctx.font = `500 ${p.size}px 'Inter', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }
  draw();
})();
