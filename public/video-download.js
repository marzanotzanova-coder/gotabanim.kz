// Force a file download without navigating away from the lesson or video library.
(function () {
  function filename(source, title) {
    const url = new URL(source, location.href);
    const extension = url.pathname.match(/\.(mp4|webm|mov|m4v)$/i)?.[1]?.toLowerCase() || 'mp4';
    const name = String(title || decodeURIComponent(url.pathname.split('/').pop()) || 'GoTAB-анимация')
      .replace(/\.(mp4|webm|mov|m4v)$/i, '').replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').trim().slice(0,160);
    return (name || 'GoTAB-анимация') + '.' + extension;
  }
  function link(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function save(source, title) {
    const url = new URL(source, location.href), name = filename(source, title);
    if (!['https:', 'http:'].includes(url.protocol)) throw Error('Видео сілтемесі жарамсыз.');
    // Storage sets Content-Disposition: attachment. Unlike the download attribute,
    // this also applies across origins and streams large files without a RAM copy.
    if (/\/storage\/v1\/object\/(public|sign)\//.test(url.pathname) && /\.supabase\.(co|in)$/.test(url.hostname)) {
      url.searchParams.set('download', name);
      link(url.href, name); return;
    }
    if (url.origin === location.origin) { link(url.href, name); return; }
    // Other CORS-enabled video hosts: use a same-origin blob rather than opening a player.
    const response = await fetch(url.href);
    if (!response.ok) throw Error('Видеоны жүктеу мүмкін болмады. Қайталап көріңіз.');
    const blobUrl = URL.createObjectURL(await response.blob());
    link(blobUrl, name);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }
  window.GoTABVideoDownload = { save, filename };
})();
