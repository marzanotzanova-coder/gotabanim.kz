(function () {
  let libs;
  function script(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = src;
      s.onload = resolve; s.onerror = () => { s.remove(); reject(Error('ҚМЖ құралын жүктеу мүмкін болмады.')); };
      document.head.append(s);
    });
  }
  function dependencies() {
    if (!libs) libs = (async () => {
      if (!window.JSZip) await script('vendor/jszip-3.10.1.min.js');
      if (!window.docx) await script('vendor/docx-preview-0.3.7.min.js');
    })().catch(e => { libs = null; throw e; });
    return libs;
  }
  async function convert(file) {
    if (!/\.(docx|pdf)$/i.test(file.name || '')) throw Error('ҚМЖ суретін автоматты жасау үшін DOCX немесе PDF таңдаңыз.');
    if (!file.size || file.size > 30 * 1024 * 1024) throw Error('ҚМЖ 30 МБ-тан аспауы керек.');
    const data = await file.arrayBuffer();
    let canvas;
    if (/\.pdf$/i.test(file.name)) {
      if (!window.pdfjsLib) throw Error('PDF құралын жүктеу мүмкін болмады. Бетті жаңартыңыз.');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      try {
        const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 1.5 });
        canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      } finally { await pdf.destroy(); }
    } else {
      const [image] = await Promise.all([GoTABPptx.imageTools(), dependencies()]);
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-same-origin'); frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:900px;height:1200px;pointer-events:none;';
      document.body.append(frame);
      try {
        const d = frame.contentDocument;
        d.open(); d.write('<!doctype html><html><head><style>body{margin:0}.docx-wrapper{padding:0!important;background:white!important}section.docx{box-shadow:none!important;margin:0!important}</style></head><body></body></html>'); d.close();
        await window.docx.renderAsync(data, d.body, d.head, { breakPages: true, ignoreLastRenderedPageBreak: false, renderHeaders: true, renderFooters: true, renderAltChunks: false, useBase64URL: true });
        const page = d.querySelector('section.docx');
        if (!page) throw Error('ҚМЖ-ның бірінші беті табылмады.');
        await d.fonts.ready;
        await Promise.all(Array.from(page.querySelectorAll('img')).map(img => img.decode()));
        const width = Math.max(page.offsetWidth, page.scrollWidth);
        const height = Math.min(page.offsetHeight, Math.round(width * Math.SQRT2));
        canvas = await image.toCanvas(page, { backgroundColor: '#ffffff', pixelRatio: Math.min(1.5, 1600 / width), width, height, fontEmbedCSS: '' });
      } finally { frame.remove(); }
    }
    // The catalog shows a public, watermarked image; the original document is unchanged.
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.fillStyle = 'rgba(40,88,166,.13)'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center';
    for (let y = 160; y < canvas.height; y += 280) for (let x = 180; x < canvas.width; x += 380) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 7); ctx.fillText('GoTAB', 0, 0); ctx.restore();
    }
    ctx.restore();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    canvas.width = canvas.height = 0;
    if (!blob) throw Error('ҚМЖ суретін дайындау мүмкін болмады.');
    return blob;
  }
  window.GoTABQmjThumbnail = { convert };
})();
