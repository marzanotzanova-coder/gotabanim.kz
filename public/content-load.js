/* Catalog loading never waits for billing. Cached metadata grants no download access. */
window.GoTABLoad = (() => {
  function deadline(work, ms = 10000, controller) {
    let timer;
    return Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => { timer = setTimeout(() => {
        reject(new Error('Жүктеу уақыты аяқталды'));
        controller?.abort();
      }, ms); })
    ]).finally(() => clearTimeout(timer));
  }

  function catalog({ fetchRows, renderRows, status, storage, key, timeout = 8000 }) {
    let pending, rendered = null;
    function show(rows) {
      const next = JSON.stringify(rows);
      if (next !== rendered) { renderRows(rows); rendered = next; }
    }
    try {
      const cached = JSON.parse(storage?.getItem(key) || 'null');
      if (cached && Date.now() - cached.at < 600000 && Array.isArray(cached.rows)) show(cached.rows);
    } catch (_) { /* Storage can be unavailable in private browsing. */ }

    async function refresh() {
      status(rendered === null ? 'loading' : 'refreshing');
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        try {
          const result = await deadline(() => fetchRows(controller.signal), timeout, controller);
          if (result.error || !Array.isArray(result.data)) throw result.error || new Error('Invalid catalog');
          show(result.data);
          try { storage?.setItem(key, JSON.stringify({ at: Date.now(), rows: result.data })); } catch (_) {}
          status('ready');
          return true;
        } catch (_) {
          if (!attempt) status('retrying');
        }
      }
      status(rendered === null ? 'error' : 'stale');
      return false;
    }
    return { load() { return pending || (pending = refresh().finally(() => { pending = null; })); } };
  }

  let mediaObserver, videos = [];
  function visibleVideos(root) {
    mediaObserver?.disconnect();
    videos.forEach(video => video.pause());
    videos = Array.from(root.querySelectorAll('video[data-src]'));
    function play(video) {
      if (document.hidden || video.dataset.inView !== 'true') return;
      if (!video.getAttribute('src')) video.src = video.dataset.src;
      video.play()?.catch(() => {});
    }
    if (typeof IntersectionObserver === 'function') {
      mediaObserver = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting }) => {
        target.dataset.inView = String(isIntersecting);
        if (isIntersecting) play(target); else target.pause();
      }), { threshold: 0.05 });
      videos.forEach(video => mediaObserver.observe(video));
    } else {
      videos.forEach(video => { video.src = video.dataset.src; video.controls = true; });
    }
    document.onvisibilitychange = () => videos.forEach(video => document.hidden ? video.pause() : play(video));
  }
  return { deadline, catalog, visibleVideos };
})();
