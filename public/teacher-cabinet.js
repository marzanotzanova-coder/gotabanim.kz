const TeacherCabinet = (() => {
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
  async function dashboard(user) {
    const area = document.querySelector('#cabinet');
    const {data, error} = await table().select('*').eq('user_id',user.id).order('updated_at',{ascending:false});
    area.replaceChildren();
    if (error) {
      const retry = node('button','Кабинетті қайта жүктеу');
      retry.onclick = () => dashboard(user);
      area.append(retry);
      return;
    }
    function section(title, empty, rows) {
      const box = node('section');
      box.append(node('h2',title));
      if (!rows.length) box.append(node('p',empty));
      area.append(box);
      return box;
    }
    const classes = data.filter(row => row.kind === 'class');
    const recent = data.filter(row => row.kind === 'recent').slice(0,1);
    const saved = data.filter(row => row.kind === 'saved');
    const classBox = section('Таңдаған сыныптарым','Төменнен пән мен сыныпты таңдаңыз.',classes);
    classes.forEach(row => classBox.append(link(row)));
    const recentBox = section('Соңғы ашқан сабағым','Ашқан сабағыңыз осында көрінеді.',recent);
    recent.forEach(row => recentBox.append(link(row)));
    const savedBox = section('Сақталғандар','Сабақ карточкасындағы «Сақтау» батырмасымен материал жинаңыз.',saved);
    for (const folder of new Set(saved.map(row => row.folder))) {
      const group = node('details');
      group.append(node('summary',folder || 'Барлық жеке сабақтар'));
      for (const row of saved.filter(row => row.folder === folder)) {
        const line = node('div');
        const remove = node('button','Алып тастау');
        remove.onclick = async () => {
          remove.disabled = true;
          const {error} = await table().delete().match({user_id:user.id,kind:'saved',grade:row.grade,subject:row.subject,lesson_num:row.lesson_num});
          if (error) { remove.disabled = false; alert('Өшіру сәтсіз аяқталды.'); }
          else await dashboard(user);
        };
        line.append(link(row),remove);
        group.append(line);
      }
      savedBox.append(group);
    }
  }
  function catalog(user, grade, subject) {
    const grid = document.querySelector('#lessonsGrid');
    const readSaved = () => table().select('lesson_num,grade,subject,folder').eq('user_id',user.id).eq('kind','saved');
    void write(user,'class',{grade,subject,lesson_num:0}).catch(console.warn);
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
  return {dashboard,catalog};
})();
