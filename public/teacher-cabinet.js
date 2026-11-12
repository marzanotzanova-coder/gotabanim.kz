window.TeacherCabinet = (() => {
  const table = () => sb.from('teacher_cabinet');
  const subjects = {math:'Математика', algebra:'Алгебра', geometry:'Геометрия', informatics:'Информатика'};
  const label = row => row.grade + '-сынып · ' + subjects[row.subject];
  function node(tag, text) {
    const el = document.createElement(tag);
    el.textContent = text || '';
    return el;
  }
  function link(row) {
    const el = node('a', row.lesson_num ? label(row) + ' · ' + row.title : label(row));
    el.href = 'content.html?' + new URLSearchParams({grade:row.grade, subject:row.subject})
      + (row.lesson_num ? '#lesson-' + row.lesson_num : '');
    return el;
  }
  async function write(user, kind, row) {
    const {error} = await table().upsert({...row, user_id:user.id, kind, updated_at:new Date().toISOString()});
    if (error) throw error;
  }
  const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const ICON = {
    recent: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', classes: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    saved: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', go: '<path d="M5 12h14M13 6l6 6-6 6"/>' };
  function head(box, kind, title, bg, color) {
    const h = node('div'); h.className = 'cab-head';
    const i = node('i'); i.style.cssText = `background:${bg};color:${color}`; i.innerHTML = svg(ICON[kind]);
    h.append(i, node('h2', title)); box.replaceChildren(h);
  }
  function empty(box, text) { const p = node('p', text); p.className = 'cab-empty'; box.append(p); }
  async function dashboard(user) {
    const boxes = { recent: document.querySelector('#cabRecent'), classes: document.querySelector('#cabClasses'), saved: document.querySelector('#cabSaved') };
    const {data, error} = await table().select('*').eq('user_id',user.id).order('updated_at',{ascending:false});
    head(boxes.recent, 'recent', 'Соңғы ашқан сабағым', '#e0ecff', '#1a56db');
    head(boxes.classes, 'classes', 'Менің сыныптарым', '#ede9fe', '#7c3aed');
    head(boxes.saved, 'saved', 'Сақталғандар', '#fef3c7', '#d97706');
    if (error) {
      const retry = node('button','Кабинетті қайта жүктеу'); retry.className = 'pk-chip';
      retry.onclick = () => dashboard(user);
      boxes.recent.append(retry);
      return;
    }
    const classes = data.filter(row => row.kind === 'class');
    const recent = data.find(row => row.kind === 'recent');
    const saved = data.filter(row => row.kind === 'saved');
    window.onCabinetClasses?.(classes);
    // last lesson: one big link back into it
    if (recent) {
      const a = link(recent); a.className = 'cab-recent'; a.textContent = '';
      const t = node('div'); t.append(node('b', recent.title || ('Сабақ ' + recent.lesson_num)), node('span', label(recent) + ' · ' + recent.lesson_num + '-сабақ'));
      const go = node('span'); go.className = 'go'; go.innerHTML = 'Жалғастыру ' + svg(ICON.go);
      a.append(t, go); boxes.recent.append(a);
      // the hero also offers to continue it
      const row = document.querySelector('#heroRow');
      if (row && !row.querySelector('.hero-continue')) { const h = link(recent); h.className = 'hero-btn hero-continue'; h.innerHTML = svg(ICON.go) + 'Соңғы сабақты жалғастыру'; row.prepend(h); }
    } else empty(boxes.recent, 'Материалдардан сабақ ашсаңыз, ол осында шығады — келесі жолы бір батырмамен жалғастырасыз.');
    if (classes.length) {
      const wrap = node('div'); wrap.className = 'cab-chips';
      classes.forEach(row => { const a = link(row); a.className = 'pk-chip mine'; wrap.append(a); });
      boxes.classes.append(wrap);
    } else empty(boxes.classes, '«Сабаққа өту» бөлімінен сыныпты ашсаңыз, ол осында сақталады.');
    if (!saved.length) { empty(boxes.saved, 'Сабақ бетіндегі «Сақтау» батырмасымен ұнаған сабақтарды папкаларға жинаңыз.'); return; }
    for (const folder of new Set(saved.map(row => row.folder))) {
      const group = node('details'); group.className = 'cab-folder'; group.open = true;
      const sum = node('summary'); sum.innerHTML = svg(ICON.folder); sum.append(folder || 'Жеке сабақтар');
      group.append(sum);
      for (const row of saved.filter(row => row.folder === folder)) {
        const line = node('div'); line.className = 'cab-line';
        const remove = node('button'); remove.className = 'cab-del'; remove.title = 'Алып тастау'; remove.setAttribute('aria-label', 'Алып тастау'); remove.innerHTML = svg(ICON.trash);
        remove.onclick = async () => {
          remove.disabled = true;
          const {error} = await table().delete().match({user_id:user.id,kind:'saved',grade:row.grade,subject:row.subject,lesson_num:row.lesson_num});
          if (error) { remove.disabled = false; alert('Өшіру сәтсіз аяқталды.'); }
          else await dashboard(user);
        };
        line.append(link(row),remove);
        group.append(line);
      }
      boxes.saved.append(group);
    }
  }
  let opener = null;
  function catalog(user, grade, subject) {
    const grid = document.querySelector('#lessonsGrid');
    const readSaved = () => table().select('lesson_num,grade,subject,folder').eq('user_id',user.id).eq('kind','saved');
    void write(user,'class',{grade,subject,lesson_num:0}).catch(console.warn);
    // a lesson opened from its card counts as the last opened lesson
    opener = (num, title) => void write(user,'recent',{grade,subject,lesson_num:num,title}).catch(console.warn);
    grid.addEventListener('click',async event => {
      const card = event.target.closest('[data-lesson-num]');
      if (!card) return;
      const row = {grade,subject,lesson_num:Number(card.dataset.lessonNum),title:card.querySelector('.ppt-title').textContent};
      const save = event.target.closest('[data-save-lesson]');
      if (!save) {
        if (event.target.closest('button,a,video,[data-preview]')) void write(user,'recent',row).catch(console.warn);
        return;
      }
      const dialog = document.querySelector('#saveDialog');
      const input = dialog.querySelector('input');
      const status = dialog.querySelector('output');
      const submit = dialog.querySelector('[type=submit]');
      const form = dialog.querySelector('form');
      status.textContent = '';
      input.value = '';
      submit.disabled = true;
      dialog.showModal();
      const {data,error} = await readSaved();
      if (!dialog.open) return;
      if (error) { status.textContent = 'Папкалар жүктелмеді. Терезені жауып, қайта көріңіз.'; return; }
      input.value = data.find(r => r.grade === grade && r.subject === subject && r.lesson_num === row.lesson_num)?.folder || '';
      dialog.querySelector('datalist').replaceChildren(...Array.from(new Set(data.map(r=>r.folder).filter(Boolean)), name => new Option(name,name)));
      submit.disabled = false;
      form.onsubmit = async e => {
        e.preventDefault();
        submit.disabled = true;
        try {
          await write(user,'saved',{...row,folder:input.value.trim()});
          dialog.close();
          save.textContent = 'Сақталды';
        } catch { status.textContent = 'Сақталмады. Қайта көріңіз.'; }
        finally { submit.disabled = false; }
      };
    },true);
  }
  return {dashboard,catalog,opened:(num,title) => opener?.(num,title)};
})();
