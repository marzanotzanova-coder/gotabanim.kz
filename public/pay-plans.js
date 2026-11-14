// Subscription plans on every payment card: 1 month / 6 months / 1 year, plus a no-refund warning
(function () {
  const PLANS = [
    { months: 1, price: 4990, label: '1 ай' },
    { months: 6, price: 25000, label: '6 ай' },
    { months: 12, price: 45000, label: '1 жыл', best: true }];
  const money = n => n.toLocaleString('ru-RU').replace(/ |,/g, ' ') + ' ₸';
  let chosen = PLANS[0];
  window.PAY_PLANS = PLANS;
  window.payPlan = () => chosen;
  window.payPlanText = () => `Тариф: ${chosen.label} — ${money(chosen.price)}`;

  const CSS = `@property --pp-a{syntax:'<angle>';inherits:false;initial-value:0deg}
.pp-warn{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 12px;padding:0 36px;color:#dc2626;font-size:12px;font-weight:700;line-height:1.35;text-align:center}
.pp-warn svg{width:14px;height:14px;flex-shrink:0}
.pp-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.pp-tab{position:relative;padding:10px 4px 8px;border-radius:14px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;font-family:inherit;color:#0f172a;min-height:58px;transition:transform .2s,box-shadow .2s}
.pp-tab:hover{transform:translateY(-2px)}
.pp-tab b{display:block;font-size:14px;font-weight:800}.pp-tab span{display:block;font-size:11px;font-weight:700;color:#64748b;margin-top:2px}
/* 1 month: calm */
.pp-tab[data-m="1"].on{border-color:#1a56db;background:rgba(26,86,219,.07);box-shadow:0 4px 12px rgba(26,86,219,.15)}.pp-tab[data-m="1"].on b{color:#1a56db}
/* 6 months: violet-pink running border with a soft glow */
.pp-tab[data-m="6"]{border:2px solid transparent;background:linear-gradient(#fff,#fdf4ff) padding-box,conic-gradient(from var(--pp-a),#8b5cf6,#ec4899,#6366f1,#d946ef,#8b5cf6) border-box;animation:pp-spin 4s linear infinite,pp-glow6 2.2s ease-in-out infinite alternate}
.pp-tab[data-m="6"] b{background:linear-gradient(90deg,#7c3aed,#db2777);-webkit-background-clip:text;background-clip:text;color:transparent}
.pp-tab[data-m="6"].on{background:linear-gradient(135deg,#f5f3ff,#fce7f3) padding-box,conic-gradient(from var(--pp-a),#8b5cf6,#ec4899,#6366f1,#d946ef,#8b5cf6) border-box}
/* 1 year: rainbow-gold running border, the brightest glow and a shine */
.pp-tab[data-m="12"]{border:2px solid transparent;background:linear-gradient(110deg,transparent 35%,rgba(255,236,170,.9) 50%,transparent 65%) padding-box,linear-gradient(#fffdf5,#fff4dc) padding-box,conic-gradient(from var(--pp-a),#fbbf24,#a855f7,#22d3ee,#34d399,#facc15,#fbbf24) border-box;background-size:250% 100%,100% 100%,100% 100%;animation:pp-spin 2.6s linear infinite,pp-glow12 1.8s ease-in-out infinite alternate,pp-sweep 3.2s ease-in-out infinite}
.pp-tab[data-m="12"] b{background:linear-gradient(90deg,#d97706,#9333ea,#0891b2,#d97706);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:pp-text 3s linear infinite}
.pp-tab[data-m="12"] span{color:#b45309}
.pp-tab[data-m="12"].on{background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.95) 50%,transparent 65%) padding-box,linear-gradient(135deg,#fef9c3,#fde68a 45%,#e9d5ff 75%,#cffafe) padding-box,conic-gradient(from var(--pp-a),#fbbf24,#a855f7,#22d3ee,#34d399,#facc15,#fbbf24) border-box;background-size:250% 100%,100% 100%,100% 100%}
.pp-tab.on{transform:translateY(-2px) scale(1.03)}
.pp-tab i{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-style:normal;font-size:9.5px;font-weight:900;letter-spacing:.3px;background:linear-gradient(90deg,#f59e0b,#a855f7,#06b6d4,#f59e0b);background-size:200% 100%;color:#fff;border-radius:99px;padding:2px 8px;white-space:nowrap;animation:pp-badge 1.6s ease-in-out infinite alternate,pp-text 3s linear infinite}
/* the big price follows the chosen plan */
[data-pp] .pp-amount{transition:color .3s}
[data-pp][data-plan="6"]{box-shadow:0 0 0 1.5px rgba(168,85,247,.35),0 0 22px rgba(236,72,153,.18)}
[data-pp][data-plan="6"] .pp-amount{background:linear-gradient(90deg,#7c3aed,#db2777);-webkit-background-clip:text;background-clip:text;color:transparent}
[data-pp][data-plan="12"]{box-shadow:0 0 0 1.5px rgba(245,158,11,.5),0 0 28px rgba(245,158,11,.3)}
[data-pp][data-plan="12"] .pp-amount{background:linear-gradient(90deg,#d97706,#9333ea,#0891b2,#059669,#d97706);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:pp-text 3s linear infinite;filter:drop-shadow(0 0 10px rgba(245,158,11,.35))}
/* the WhatsApp receipt button: running light border, shine and a soft green glow */
button.btn-whatsapp{position:relative;overflow:hidden;border:2px solid transparent;background:linear-gradient(135deg,#25d366,#16a34a) padding-box,conic-gradient(from var(--pp-a),#dcfce7,#22c55e,#fef08a,#4ade80,#dcfce7) border-box;animation:pp-spin 3s linear infinite,pp-wa 1.8s ease-in-out infinite alternate;transition:transform .2s}
button.btn-whatsapp::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);transform:translateX(-120%);animation:pp-shine 2.8s ease-in-out infinite;pointer-events:none}
button.btn-whatsapp:hover{opacity:1;transform:translateY(-2px)}
button.btn-whatsapp:disabled{animation:none;box-shadow:none}button.btn-whatsapp:disabled::after{display:none}
/* the whole payment card: running light border in the chosen plan's colours */
.pp-card{border:3px solid transparent!important;background:linear-gradient(#fff,#fff) padding-box,conic-gradient(from var(--pp-a),var(--pp-c1),var(--pp-c2),var(--pp-c3),var(--pp-c4),var(--pp-c1)) border-box!important;animation:pp-spin 4s linear infinite,pp-cardglow 2s ease-in-out infinite alternate;--pp-c1:#93c5fd;--pp-c2:#1a56db;--pp-c3:#60a5fa;--pp-c4:#2563eb;--pp-g1:rgba(26,86,219,.18);--pp-g2:rgba(26,86,219,.32)}
.pp-card[data-plan="6"]{--pp-c1:#c084fc;--pp-c2:#ec4899;--pp-c3:#6366f1;--pp-c4:#d946ef;--pp-g1:rgba(168,85,247,.25);--pp-g2:rgba(236,72,153,.4)}
.pp-card[data-plan="12"]{--pp-c1:#fbbf24;--pp-c2:#a855f7;--pp-c3:#22d3ee;--pp-c4:#34d399;--pp-g1:rgba(251,191,36,.3);--pp-g2:rgba(168,85,247,.45);animation-duration:2.6s,1.6s}
@keyframes pp-cardglow{from{box-shadow:0 20px 50px rgba(15,23,42,.18),0 0 18px var(--pp-g1)}to{box-shadow:0 20px 50px rgba(15,23,42,.18),0 0 44px var(--pp-g2),0 0 90px var(--pp-g1)}}
@keyframes pp-spin{to{--pp-a:360deg}}
@keyframes pp-glow6{from{box-shadow:0 0 8px rgba(139,92,246,.25)}to{box-shadow:0 0 18px rgba(236,72,153,.45)}}
@keyframes pp-glow12{from{box-shadow:0 0 12px rgba(245,158,11,.35)}to{box-shadow:0 0 24px rgba(168,85,247,.4),0 0 40px rgba(34,211,238,.25)}}
@keyframes pp-sweep{0%,55%{background-position:120% 0,0 0,0 0}100%{background-position:-20% 0,0 0,0 0}}
@keyframes pp-badge{from{box-shadow:0 0 4px rgba(245,158,11,.5)}to{box-shadow:0 0 12px rgba(168,85,247,.7)}}
@keyframes pp-text{to{background-position:200% 0}}
@keyframes pp-wa{from{box-shadow:0 4px 14px rgba(34,197,94,.3)}to{box-shadow:0 6px 26px rgba(34,197,94,.6),0 0 0 4px rgba(34,197,94,.12)}}
@keyframes pp-shine{0%,50%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
@media (prefers-reduced-motion:reduce){.pp-card,.pp-tab,.pp-tab i,[data-pp] .pp-amount,button.btn-whatsapp,button.btn-whatsapp::after{animation:none!important}}`;
  const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

  function paint() {
    // tabs sit right before each price box
    document.querySelectorAll('[data-pp="tag"], [data-pp="wall"]').forEach(box => {
      box.previousElementSibling.querySelectorAll('.pp-tab').forEach(t => t.classList.toggle('on', +t.dataset.m === chosen.months));
      box.querySelector('.pp-amount').textContent = money(chosen.price);
      box.dataset.plan = chosen.months;
      const card = box.closest('.modal-box, .pay-wall-box'); if (card) { card.classList.add('pp-card'); card.dataset.plan = chosen.months; }
    });
  }
  // turn each price box (.price-tag on materials pages, .pay-wall-price on games/labs) into a plan picker
  window.mountPayPlans = function () {
    if (!document.getElementById('ppCss')) document.head.insertAdjacentHTML('beforeend', `<style id="ppCss">${CSS}</style>`);
    document.querySelectorAll('.price-tag:not([data-pp]), .pay-wall-price:not([data-pp])').forEach(box => {
      const wall = box.classList.contains('pay-wall-price'), amt = wall ? 'pay-wall-amount' : 'price-amount';
      box.dataset.pp = wall ? 'wall' : 'tag';
      box.insertAdjacentHTML('beforebegin', '<div class="pp-tabs">' + PLANS.map(p => `<button type="button" class="pp-tab" data-m="${p.months}">${p.best ? '<i>Тиімді</i>' : ''}<b>${p.label}</b><span>${money(p.price)}</span></button>`).join('') + '</div>');
      box.innerHTML = `<div class="${amt} pp-amount"></div>`;
      box.previousElementSibling.addEventListener('click', e => { const t = e.target.closest('.pp-tab'); if (!t) return; chosen = PLANS.find(p => p.months === +t.dataset.m); paint(); });
      const card = box.closest('.modal-box, .pay-wall-box');
      if (card && !card.querySelector('.pp-warn')) { const close = card.querySelector('.modal-close, .lab-payment-close, .pay-wall-close');
        const w = `<div class="pp-warn">${WARN}Жақсылап тексеріп алыңыз! Төлем жасаған соң қайтарылмайды.</div>`;
        close ? close.insertAdjacentHTML('afterend', w) : card.insertAdjacentHTML('afterbegin', w); }
    });
    paint();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.mountPayPlans); else window.mountPayPlans();
})();
