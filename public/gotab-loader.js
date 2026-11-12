// Loading screen with the GoTAB "GO" drawing animation. It appears only when a page (or the next page
// after a click) takes longer than a moment, so fast loads never flash it.
(function () {
  const css = `#gtLoader{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#f4f7fb;opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s}
#gtLoader.show{opacity:1;visibility:visible}
#gtLoader img{width:150px;height:auto}
#gtLoader span{font:700 14px/1.4 Inter,system-ui,sans-serif;color:#64748b}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const box = document.createElement('div'); box.id = 'gtLoader'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
  box.innerHTML = '<img src="gotab_go_loader.webp" alt=""><span>Жүктелуде…</span>';
  (document.body || document.documentElement).appendChild(box);
  let timer = null;
  const show = (delay) => { clearTimeout(timer); timer = setTimeout(() => box.classList.add('show'), delay); };
  const hide = () => { clearTimeout(timer); box.classList.remove('show'); };
  // while this page is still loading
  if (document.readyState !== 'complete') { show(400); addEventListener('load', hide, { once: true }); }
  // after a click on a link to another page of the site
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    show(350);
  });
  // coming back with the browser's Back button must not leave it on screen
  addEventListener('pageshow', hide);
})();
