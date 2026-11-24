// GoTAB: нәтижелерді PDF етіп жүктеу.
// Беттер canvas-та сызылады (қазақ әріптері браузер қарпімен дұрыс шығады), сосын pdf-lib арқылы A4 PDF-ке жиналады.
window.GoTABPDF = (() => {
  const W = 1190, H = 1684, M = 76, FOOT = 60;           // A4, 144 dpi
  const FONT = '"GoTAB Noto", "Noto Sans", Inter, -apple-system, "Segoe UI", Arial, sans-serif';
  const C = { text: '#0f172a', muted: '#64748b', line: '#e2e8f0', soft: '#f8fafc', blue: '#1a56db', violet: '#6d28d9',
    g: '#059669', gb: '#dcfce7', a: '#b45309', ab: '#fef3c7', r: '#b91c1c', rb: '#fee2e2' };
  let ready = null;
  function load() {
    if (ready) return ready;
    const font = (w, url) => new FontFace('GoTAB Noto', `url(${url})`, { weight: String(w) }).load().then(f => document.fonts.add(f)).catch(() => {});
    const lib = window.PDFLib ? Promise.resolve() : new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = 'vendor/pdf-lib-1.17.1/pdf-lib.min.js'; s.onload = ok; s.onerror = () => no(new Error('PDF кітапханасы жүктелмеді')); document.head.append(s); });
    ready = Promise.all([lib, font(400, 'fonts/NotoSans-400.ttf'), font(700, 'fonts/NotoSans-700.ttf')]).catch(e => { ready = null; throw e; });
    return ready;
  }

  function doc(title) {
    const pages = []; let ctx, y;
    function page() {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'top';
      pages.push(cv); y = M;
    }
    page();
    const font = (size, bold) => { ctx.font = `${bold ? 700 : 400} ${size}px ${FONT}`; };
    function wrap(str, size, bold, maxW) {
      font(size, bold); const out = [];
      for (const para of String(str ?? '').split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const t = line ? line + ' ' + word : word;
          if (ctx.measureText(t).width <= maxW || !line) {
            if (!line && ctx.measureText(word).width > maxW) { // very long word: cut by characters
              let part = ''; for (const ch of word) { if (ctx.measureText(part + ch).width > maxW) { out.push(part); part = ''; } part += ch; } line = part;
            } else line = t;
          } else { out.push(line); line = word; }
        }
        out.push(line);
      }
      return out;
    }
    const ensure = h => { if (y + h > H - M - FOOT) page(); };
    function text(str, { size = 22, bold = false, color = C.text, x = M, maxW = W - 2 * M, lh = 1.45, gap = 6 } = {}) {
      const lines = wrap(str, size, bold, maxW), lhp = size * lh;
      for (const l of lines) { ensure(lhp); font(size, bold); ctx.fillStyle = color; ctx.fillText(l, x, y); y += lhp; }
      y += gap;
    }
    function rr(x, yy, w, h, r, fill, stroke) {
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, yy, w, h, r) : ctx.rect(x, yy, w, h);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    }
    function pill(str, x, yy, color, bg, size = 18) {
      font(size, true); const w = ctx.measureText(str).width + 26;
      rr(x, yy, w, size + 16, (size + 16) / 2, bg); ctx.fillStyle = color; ctx.fillText(str, x + 13, yy + 8); return w;
    }
    const api = {
      header(subtitle) {
        const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#0b1f5c'); g.addColorStop(.5, '#1a56db'); g.addColorStop(1, '#6d28d9');
        rr(M, y, W - 2 * M, 150, 26, g);
        font(22, true); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('GoTAB', M + 34, y + 26);
        const lines = wrap(title, 38, true, W - 2 * M - 68).slice(0, 2);
        font(38, true); ctx.fillStyle = '#fff'; lines.forEach((l, i) => ctx.fillText(l, M + 34, y + 58 + i * 46));
        y += 150 + 16;
        if (subtitle) text(subtitle, { size: 20, color: C.muted });
        y += 6; return api;
      },
      h2(str) { y += 10; ensure(70); text(str, { size: 28, bold: true, gap: 10 }); return api; },
      p(str, o) { text(str, o); return api; },
      tiles(items) { // [[value, label, colorKey?]]
        ensure(120); const gap = 18, w = (W - 2 * M - gap * (items.length - 1)) / items.length;
        items.forEach(([v, l, ck], i) => { const x = M + i * (w + gap);
          rr(x, y, w, 108, 18, C.soft, C.line); font(38, true); ctx.fillStyle = ck ? C[ck] : C.text; ctx.fillText(String(v), x + 22, y + 16);
          font(18); ctx.fillStyle = C.muted; ctx.fillText(wrap(l, 18, false, w - 40)[0], x + 22, y + 68); });
        y += 126; return api;
      },
      note(str, ck) { // coloured box
        const lines = wrap(str, 21, false, W - 2 * M - 48), h = lines.length * 31 + 34; ensure(h);
        rr(M, y, W - 2 * M, h, 16, C[ck + 'b'] || C.soft); font(21); ctx.fillStyle = C[ck] || C.text;
        lines.forEach((l, i) => ctx.fillText(l, M + 24, y + 17 + i * 31)); y += h + 16; return api;
      },
      bar(label, pct, sub) {
        const ck = pct >= 85 ? 'g' : pct >= 50 ? 'a' : 'r', fill = { g: '#34d399', a: '#fbbf24', r: '#f87171' }[ck];
        const lines = wrap(label, 21, true, W - 2 * M - 120); const h = lines.length * 30 + 44 + (sub ? 30 : 0); ensure(h + 10);
        font(21, true); ctx.fillStyle = C.text; lines.forEach((l, i) => ctx.fillText(l, M, y + i * 30));
        font(24, true); ctx.fillStyle = C[ck]; const ps = pct + '%'; ctx.fillText(ps, W - M - ctx.measureText(ps).width, y);
        const by = y + lines.length * 30 + 6; rr(M, by, W - 2 * M, 18, 9, '#eef2f9'); rr(M, by, Math.max(18, (W - 2 * M) * pct / 100), 18, 9, fill);
        if (sub) { font(18); ctx.fillStyle = C.muted; ctx.fillText(wrap(sub, 18, false, W - 2 * M)[0], M, by + 28); }
        y += h + 14; return api;
      },
      table(cols, rows) { // cols: [[title, widthFraction, align]], rows: [[{t, color, bold, pill}]]
        const tw = W - 2 * M, ws = cols.map(c => c[1] * tw), pad = 14;
        const headH = 50; const drawHead = () => { rr(M, y, tw, headH, 12, '#eef2f9'); font(17, true); ctx.fillStyle = C.muted;
          let x = M; cols.forEach((c, i) => { const s = c[0].toUpperCase(); ctx.fillText(s, c[2] === 'right' ? x + ws[i] - pad - ctx.measureText(s).width : x + pad, y + 16); x += ws[i]; }); y += headH; };
        ensure(headH + 50); drawHead();
        rows.forEach((row, ri) => {
          const cells = row.map((c, i) => { c = typeof c === 'object' && c ? c : { t: c }; return { ...c, lines: c.pill ? [String(c.t)] : wrap(c.t, 20, c.bold, ws[i] - 2 * pad) }; });
          const h = Math.max(...cells.map(c => c.lines.length * 28)) + 24;
          if (y + h > H - M - FOOT) { page(); drawHead(); }
          if (ri % 2) rr(M, y, tw, h, 0, '#fafbfe');
          let x = M; cells.forEach((c, i) => {
            if (c.pill) pill(String(c.t), x + pad, y + 10, C[c.pill], C[c.pill + 'b'], 16);
            else { font(20, c.bold); ctx.fillStyle = c.color ? (C[c.color] || c.color) : C.text;
              c.lines.forEach((l, li) => ctx.fillText(l, cols[i][2] === 'right' ? x + ws[i] - pad - ctx.measureText(l).width : x + pad, y + 12 + li * 28)); }
            x += ws[i]; });
          ctx.fillStyle = C.line; ctx.fillRect(M, y + h - 1, tw, 1.5); y += h;
        });
        y += 18; return api;
      },
      qcard(ok, title, lines) { // one question with the student's answer
        const tl = wrap(title, 21, true, W - 2 * M - 50), sub = lines.map(([s, ck]) => [wrap(s, 19, !!ck, W - 2 * M - 50), ck]);
        const h = tl.length * 30 + sub.reduce((n, [l]) => n + l.length * 27, 0) + 30; ensure(h + 12);
        rr(M, y, W - 2 * M, h, 14, '#fff', C.line); rr(M, y, 8, h, 4, ok ? '#10b981' : '#ef4444');
        let yy = y + 14; font(21, true); ctx.fillStyle = C.text; tl.forEach(l => { ctx.fillText(l, M + 28, yy); yy += 30; });
        sub.forEach(([ls, ck]) => { font(19, !!ck); ctx.fillStyle = ck ? C[ck] : C.muted; ls.forEach(l => { ctx.fillText(l, M + 28, yy); yy += 27; }); });
        y += h + 12; return api;
      },
      studentHead(name, meta, pct, score, levelText) {
        ensure(130); const ck = pct >= 85 ? 'g' : pct >= 50 ? 'a' : 'r';
        rr(M, y, W - 2 * M, 112, 20, C.soft, C.line);
        const cx = M + 58, cy = y + 56; ctx.lineWidth = 12; ctx.strokeStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = { g: '#10b981', a: '#f59e0b', r: '#ef4444' }[ck]; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct / 100); ctx.stroke(); ctx.lineCap = 'butt';
        font(20, true); ctx.fillStyle = C.text; const ps = pct + '%'; ctx.fillText(ps, cx - ctx.measureText(ps).width / 2, cy - 12);
        font(30, true); ctx.fillText(wrap(name, 30, true, W - 2 * M - 420)[0], M + 120, y + 20);
        font(19); ctx.fillStyle = C.muted; ctx.fillText(wrap(meta, 19, false, W - 2 * M - 420)[0], M + 120, y + 64);
        font(32, true); ctx.fillStyle = C[ck]; ctx.fillText(score, W - M - 30 - ctx.measureText(score).width, y + 18);
        font(16, true); const lw = ctx.measureText(levelText).width + 26; pill(levelText, W - M - 30 - lw, y + 64, C[ck], C[ck + 'b'], 16);
        y += 128; return api;
      },
      pageBreak() { if (y > M) page(); return api; },
      async save(filename) {
        await load();
        const pdf = await PDFLib.PDFDocument.create(); pdf.setTitle(title); pdf.setCreator('GoTAB');
        const n = pages.length;
        for (let i = 0; i < n; i++) {
          const cx = pages[i].getContext('2d'); cx.font = `400 17px ${FONT}`; cx.fillStyle = C.muted; cx.textBaseline = 'top';
          cx.fillText('GoTAB · gotabanim-kz.vercel.app', M, H - M + 6);
          const pn = `${i + 1} / ${n}`; cx.fillText(pn, W - M - cx.measureText(pn).width, H - M + 6);
          const jpg = await pdf.embedJpg(pages[i].toDataURL('image/jpeg', .9));
          const pg = pdf.addPage([595.28, 841.89]); pg.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
        }
        const blob = new Blob([await pdf.save()], { type: 'application/pdf' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    };
    return api;
  }
  // қаріптер жүктелмей тұрып сызбас үшін: алдымен load(), сосын doc()
  return { load, doc };
})();
