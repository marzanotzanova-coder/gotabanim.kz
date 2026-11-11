// Subscription plans on every payment card: 1 month / 6 months / 1 year, plus a no-refund warning
(function () {
  const PLANS = [
    { months: 1, price: 4990, label: '1 ай', period: '1 айға жазылу' },
    { months: 6, price: 25000, label: '6 ай', period: '6 айға жазылу', note: 'айына ≈ 4 167 ₸' },
    { months: 12, price: 45000, label: '1 жыл', period: '1 жылға жазылу', note: 'айына 3 750 ₸', best: true }];
  const money = n => n.toLocaleString('ru-RU').replace(/ |,/g, ' ') + ' ₸';
  let chosen = PLANS[0];
  window.PAY_PLANS = PLANS;
  window.payPlan = () => chosen;
  window.payPlanText = () => `Тариф: ${chosen.label} — ${money(chosen.price)}`;

  const CSS = `.pp-warn{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 12px;padding:0 36px;color:#dc2626;font-size:12px;font-weight:700;line-height:1.35;text-align:center}
.pp-warn svg{width:14px;height:14px;flex-shrink:0}
.pp-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}
.pp-tab{position:relative;padding:10px 4px 8px;border-radius:12px;border:1.5px solid rgba(26,86,219,.18);background:#fff;cursor:pointer;font-family:inherit;color:#0f172a;min-height:56px}
.pp-tab b{display:block;font-size:14px;font-weight:800}.pp-tab span{display:block;font-size:11px;font-weight:600;color:#64748b;margin-top:2px}
.pp-tab.on{border-color:#1a56db;background:rgba(26,86,219,.08)}.pp-tab.on b{color:#1a56db}
.pp-tab i{position:absolute;top:-8px;left:50%;transform:translateX(-50%);font-style:normal;font-size:9px;font-weight:800;background:#10b981;color:#fff;border-radius:99px;padding:1px 7px;white-space:nowrap}
.pp-note{font-size:12px;color:#059669;font-weight:700;margin-top:2px;min-height:16px}`;
  const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

  function paint() {
    // tabs sit right before each price box
    document.querySelectorAll('[data-pp="tag"], [data-pp="wall"]').forEach(box => {
      box.previousElementSibling.querySelectorAll('.pp-tab').forEach(t => t.classList.toggle('on', +t.dataset.m === chosen.months));
      box.querySelector('.pp-amount').textContent = money(chosen.price);
      box.querySelector('.pp-period').textContent = chosen.period + (box.dataset.pp === 'wall' ? ' · барлық мүмкіндіктер' : '');
      box.querySelector('.pp-note').textContent = chosen.note || '';
    });
  }
  // turn each price box (.price-tag on materials pages, .pay-wall-price on games/labs) into a plan picker
  window.mountPayPlans = function () {
    if (!document.getElementById('ppCss')) document.head.insertAdjacentHTML('beforeend', `<style id="ppCss">${CSS}</style>`);
    document.querySelectorAll('.price-tag:not([data-pp]), .pay-wall-price:not([data-pp])').forEach(box => {
      const wall = box.classList.contains('pay-wall-price'), amt = wall ? 'pay-wall-amount' : 'price-amount', per = wall ? 'pay-wall-period' : 'price-period';
      box.dataset.pp = wall ? 'wall' : 'tag';
      box.insertAdjacentHTML('beforebegin', '<div class="pp-tabs">' + PLANS.map(p => `<button type="button" class="pp-tab" data-m="${p.months}">${p.best ? '<i>Тиімді</i>' : ''}<b>${p.label}</b><span>${money(p.price)}</span></button>`).join('') + '</div>');
      box.innerHTML = `<div class="${amt} pp-amount"></div><div class="${per} pp-period"></div><div class="pp-note"></div>`;
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
