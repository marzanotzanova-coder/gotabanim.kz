// GoTAB: «Бағалау» бөлімінің AI маршруттары (сабақтық тест құрастыру, БЖБ/ТЖБ тексеру, диагностика).
// OpenAI кілті тек серверде: Vercel → Settings → Environment Variables → OPENAI_API_KEY.
const SUPA_URL = process.env.SUPABASE_URL || 'https://eknjslyvcwtusbqvygxx.supabase.co';
const SUPA_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4AKv-8WUdjo_ZdYvlHPC4w_v-aNINNL';
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 60;

// AI кейде мәтіннің орнына тізім не объект қайтарады: оны оқылатын мәтінге айналдырамыз ("[object Object]" шықпауы үшін)
const flat = v => v == null ? '' : typeof v !== 'object' ? String(v)
  : Array.isArray(v) ? v.map(flat).filter(Boolean).join('\n')
  : Object.entries(v).map(([k, x]) => { const t = flat(x); return t ? (/^\d+$/.test(k) ? '' : k + ': ') + (t.includes('\n') ? '\n' + t : t) : ''; }).filter(Boolean).join('\n');
const str = (v, max) => flat(v).slice(0, max);
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const isDataUrl = (s, kinds) => typeof s === 'string' && kinds.some(k => s.startsWith('data:' + k));

// Мұғалімнің Supabase сессиясын тексеру және күндік AI лимитін бір қадамға арттыру
async function gate(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Кіру қажет' }); return null; }
  const r = await fetch(SUPA_URL + '/rest/v1/rpc/bump_ai_usage', {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: DAILY_LIMIT })
  });
  if (r.status === 401 || r.status === 403) { res.status(401).json({ error: 'Сессия ескірген, қайта кіріңіз' }); return null; }
  const d = await r.json().catch(() => null);
  if (!r.ok || !d) { res.status(502).json({ error: 'Тексеру сәтсіз, кейінірек қайталаңыз' }); return null; }
  if (!d.allowed) {
    res.status(403).json({ error: d.reason === 'limit'
      ? `Бүгінгі AI лимиті таусылды (${DAILY_LIMIT}). Ертең қайта жалғасады.`
      : 'AI мүмкіндіктері жазылымы бар мұғалімдерге ашық.' , reason: d.reason });
    return null;
  }
  return true;
}

// OpenAI Responses API: JSON жауап. Модель OPENAI_MODEL арқылы өзгереді; табылмаса келесісі қолданылады.
async function askJSON({ system, content, vision = false, maxTokens = 8000 }) {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('OPENAI_API_KEY орнатылмаған'), { status: 500 });
  const pref = vision ? [process.env.OPENAI_VISION_MODEL, process.env.OPENAI_MODEL] : [process.env.OPENAI_MODEL];
  const models = [...new Set([...pref, 'gpt-5.5-mini', 'gpt-5-mini', 'gpt-4.1-mini'].filter(Boolean))];
  let last;
  for (const model of models) {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, instructions: system, input: [{ role: 'user', content }],
        text: { format: { type: 'json_object' } }, max_output_tokens: maxTokens })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      last = Object.assign(new Error(d?.error?.message || 'OpenAI қатесі'), { status: r.status, code: d?.error?.code });
      if (r.status === 404 || d?.error?.code === 'model_not_found') continue;
      throw last;
    }
    const text = d.output_text || (d.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
    try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
    catch (_) { last = Object.assign(new Error('AI жауабы толық емес'), { status: 502 }); }
  }
  throw last || new Error('AI қолжетімсіз');
}

function fail(res, e, where) {
  console.error('[ai-assess]', where, e.status || '', e.code || '', e.message);
  const msg = e.code === 'insufficient_quota' ? 'OpenAI шотында қаражат таусылған.'
    : e.status === 401 ? 'OpenAI кілті жарамсыз.'
    : e.status === 429 ? 'AI қазір бос емес, бір минуттан соң қайталаңыз.'
    : e.message === 'OPENAI_API_KEY орнатылмаған' ? 'Серверде OPENAI_API_KEY әлі қосылмаған.'
    : 'AI жауап бере алмады, қайталап көріңіз.';
  res.status(e.status === 429 ? 429 : 502).json({ error: msg });
}

const SUBJECTS = { math: 'Математика', algebra: 'Алгебра', geometry: 'Геометрия', algebra_emn: 'Алгебра (ЖМБ)', geometry_emn: 'Геометрия (ЖМБ)', informatics: 'Информатика' };

module.exports = function mountAssess(app, express) {
  const small = express.json({ limit: '200kb' });
  const big = express.json({ limit: '6mb' });

  // 1) Сабақтық тест құрастыру
  app.post('/api/ai/test-generate', small, async (req, res) => {
    const b = req.body || {};
    const topic = str(b.topic, 300).trim();
    if (!topic) return res.status(400).json({ error: 'Сабақ тақырыбын жазыңыз' });
    if (!(await gate(req, res))) return;
    const count = clampInt(b.count, 3, 15, 5);
    const level = { easy: 'жеңіл', mixed: 'аралас (жеңілден қиынға)', hard: 'қиындау' }[b.level] || 'аралас (жеңілден қиынға)';
    try {
      const out = await askJSON({
        system: 'Сен Қазақстан мектебінің тәжірибелі мұғалімісің. Сабақтың соңындағы қысқа диагностикалық тестті қазақ тілінде құрастырасың. Тек JSON қайтар.',
        content: [{ type: 'input_text', text:
          `Пән: ${SUBJECTS[b.subject] || str(b.subject, 40) || 'Математика'}. Сынып: ${clampInt(b.grade, 1, 11, '')}.\n` +
          `Сабақ тақырыбы: ${topic}.\n${b.notes ? 'Мұғалімнің қосымшасы: ' + str(b.notes, 600) + '\n' : ''}` +
          `${count} сұрақ, деңгейі: ${level}. Әр сұрақта 4 нұсқа, біреуі ғана дұрыс. Сұрақ оқушының тақырыпты түсінгенін тексерсін, ` +
          `жалған нұсқалар оқушылардың жиі жіберетін қателеріне негізделсін. Формулаларды қарапайым мәтінмен жаз (мысалы x^2, √x, 3/4).\n` +
          `JSON пішімі: {"questions":[{"q":"сұрақ","options":["A","B","C","D"],"answer":0,"skill":"тексерілетін дағды (2-5 сөз)"}]}. answer — дұрыс нұсқаның индексі (0-3).` }]
      });
      const questions = (Array.isArray(out.questions) ? out.questions : []).map(q => ({
        q: str(q.q, 500).trim(), options: (Array.isArray(q.options) ? q.options : []).slice(0, 6).map(o => str(o, 200).trim()),
        answer: clampInt(q.answer, 0, 5, 0), skill: str(q.skill, 80).trim()
      })).filter(q => q.q && q.options.length >= 2 && q.answer < q.options.length).slice(0, 15);
      if (!questions.length) return res.status(502).json({ error: 'AI сұрақ құрастыра алмады, тақырыпты нақтылап көріңіз' });
      res.json({ questions });
    } catch (e) { fail(res, e, 'test-generate'); }
  });

  // 1б) Дайын тестті файлдан (PDF, Word, фото) оқып, сұрақтарды толтыру
  app.post('/api/ai/test-import', big, async (req, res) => {
    const b = req.body || {};
    const content = [{ type: 'input_text', text:
      'Бұл — мұғалімнің дайын тесті. Ондағы әр сұрақты бөліп шығар: сұрақ мәтіні, жауап нұсқалары (A, B, C, D… белгілерінсіз) және дұрыс жауап. ' +
      'Дұрыс жауап құжатта белгіленген болса (кілт, жауаптар кестесі, жуан/асты сызылған/белгіленген нұсқа), соны ал да "answer_source":"file" қой. ' +
      'Белгіленбесе, есепті өзің шешіп, дұрыс нұсқаны таңда және "answer_source":"ai" қой. ' +
      'Нұсқасы жоқ ашық сұрақ болса, оны 4 нұсқалы сұраққа айналдыр (дұрыс жауап + оқушылардың жиі қателеріне негізделген 3 жалған нұсқа) және "converted":true қой. ' +
      'Сұрақ мәтінін өзгертпе, тек анық қате тереңдікті түзет. Формулаларды қарапайым мәтінмен жаз (x^2, √x, 3/4). Сұрақ санын азайтпа және ойдан қоспа. ' +
      'JSON: {"title":"тесттің атауы (болса)","topic":"тақырыбы (болса)","questions":[{"q":"...","options":["...","..."],"answer":0,"answer_source":"file|ai","converted":false,"skill":"тексерілетін дағды (2-5 сөз)"}]}' }];
    if (isDataUrl(b.file, ['application/pdf'])) content.push({ type: 'input_file', filename: str(b.filename, 80) || 'test.pdf', file_data: b.file });
    else if (isDataUrl(b.file, ['image/'])) content.push({ type: 'input_image', image_url: b.file, detail: 'high' });
    else if (str(b.text, 40000).trim()) content.push({ type: 'input_text', text: 'Құжат мәтіні:\n' + str(b.text, 40000) });
    else return res.status(400).json({ error: 'PDF, Word немесе фото жүктеңіз' });
    if (!(await gate(req, res))) return;
    try {
      const out = await askJSON({ system: 'Сен Қазақстан мектебінің тәжірибелі мұғалімісің және тест құжаттарын мұқият оқисың. Тек JSON қайтар.', content, vision: true, maxTokens: 16000 });
      const questions = (Array.isArray(out.questions) ? out.questions : []).map(q => ({
        q: str(q.q, 800).trim(), options: (Array.isArray(q.options) ? q.options : []).slice(0, 6).map(o => str(o, 300).trim()).filter(Boolean),
        answer: clampInt(q.answer, 0, 5, 0), from_file: q.answer_source === 'file' && !q.converted, converted: !!q.converted, skill: str(q.skill, 80).trim()
      })).filter(q => q.q && q.options.length >= 2 && q.answer < q.options.length).slice(0, 40);
      if (!questions.length) return res.status(422).json({ error: 'Файлдан сұрақ табылмады. Файл анық па, тест сұрақтары бар ма — тексеріңіз.' });
      res.json({ title: str(out.title, 200), topic: str(out.topic, 300), questions });
    } catch (e) { fail(res, e, 'test-import'); }
  });

  // 2) БЖБ/ТЖБ спецификациясынан тексеру кілтін шығару: әр тапсырманың дескрипторлары (балымен) және дұрыс жауабы
  const cleanDesc = d => (Array.isArray(d) ? d : []).slice(0, 20).map(x => typeof x === 'object' && x && !Array.isArray(x)
    ? { text: str(x.text ?? x.descriptor ?? x.name ?? '', 400).trim(), points: x.points == null && x.score == null ? null : clampInt(x.points ?? x.score, 0, 50, null) }
    : { text: str(x, 400).trim(), points: null }).filter(x => x.text);
  app.post('/api/ai/bzhb-extract', big, async (req, res) => {
    const b = req.body || {};
    const content = [{ type: 'input_text', text:
      'Бұл — БЖБ немесе ТЖБ: тапсырмалар және балл қою кестесі (дескрипторлар). Тексеру кілтін шығар. Әр тапсырма үшін: нөмірі, қысқа атауы (3-6 сөз), ' +
      'дескрипторлар тізімі — әрқайсысы бөлек, құжаттағы мәтінімен және балымен, және дұрыс жауабы. ' +
      'Құжатта бірнеше нұсқа (1-нұсқа, 2-нұсқа…) болса, тапсырманы бір рет шығар; answer ішінде әр нұсқаның жауабын жеке жолмен жаз: «1-нұсқа: …», «2-нұсқа: …». ' +
      'Жауап құжатта жоқ болса, есепті өзің мұқият шешіп, тек соңғы жауапты жаз (шешімнің 1-2 негізгі қадамын жақшада беруге болады). ' +
      'Дескриптордың балы құжатта көрсетілмесе, points үшін null қой. Ешнәрсе ойдан қоспа. Барлық мәндер — жай мәтін немесе сан. ' +
      'JSON: {"title":"жұмыстың атауы","tasks":[{"n":"2","title":"Мәтіндік есеп","descriptors":[{"text":"Есептің қысқаша шартын құрастырады","points":1}],"answer":"1-нұсқа: 1 17/30 т\n2-нұсқа: 11/15 км"}]}' }];
    if (isDataUrl(b.file, ['application/pdf'])) content.push({ type: 'input_file', filename: str(b.filename, 80) || 'bzhb.pdf', file_data: b.file });
    else if (isDataUrl(b.file, ['image/'])) content.push({ type: 'input_image', image_url: b.file, detail: 'high' });
    else if (str(b.text, 30000).trim()) content.push({ type: 'input_text', text: 'Құжат мәтіні:\n' + str(b.text, 30000) });
    else return res.status(400).json({ error: 'PDF, Word немесе фото жүктеңіз' });
    if (!(await gate(req, res))) return;
    try {
      const out = await askJSON({ system: 'Сен Қазақстан мектебіндегі критериалды бағалау маманысың және математиканы мұқият шешесің. Тек JSON қайтар.', content, vision: true, maxTokens: 12000 });
      const tasks = (Array.isArray(out.tasks) ? out.tasks : []).slice(0, 30).map((t, i) => {
        let descriptors = cleanDesc(t.descriptors);
        if (!descriptors.length && (t.criteria || t.max != null)) descriptors = [{ text: str(t.criteria, 1000).trim() || 'Тапсырманы дұрыс орындайды', points: t.max == null ? null : clampInt(t.max, 0, 100, null) }];
        return { n: str(t.n ?? i + 1, 10), title: str(t.title, 160).trim(), descriptors, answer: str(t.answer, 1500).trim() };
      }).filter(t => t.descriptors.length);
      res.json({ title: str(out.title, 200), tasks });
    } catch (e) { fail(res, e, 'bzhb-extract'); }
  });

  // 3) Оқушының жауап парағын тексеру (балл — тек ұсыныс, мұғалім бекітеді)
  app.post('/api/ai/bzhb-check', big, async (req, res) => {
    const b = req.body || {};
    const tasks = (Array.isArray(b.tasks) ? b.tasks : []).slice(0, 30).map((t, i) => {
      let descriptors = cleanDesc(t.descriptors).map(d => ({ ...d, points: d.points ?? 1 }));
      if (!descriptors.length) descriptors = [{ text: str(t.criteria, 2000) || 'Тапсырманы дұрыс орындайды', points: clampInt(t.max, 0, 100, 0) }];
      return { n: str(t.n ?? i + 1, 10), title: str(t.title, 160), descriptors, answer: str(t.answer, 1500), max: descriptors.reduce((a, d) => a + d.points, 0) };
    });
    const images = (Array.isArray(b.images) ? b.images : []).filter(x => isDataUrl(x, ['image/'])).slice(0, 6);
    if (!tasks.length || !tasks.some(t => t.max > 0)) return res.status(400).json({ error: 'Алдымен тексеру кілтін балдарымен толтырыңыз' });
    if (!images.length) return res.status(400).json({ error: 'Оқушы жұмысының фотосын жүктеңіз' });
    if (!(await gate(req, res))) return;
    const rubric = tasks.map(t => `№${t.n}. ${t.title} — барлығы ${t.max} балл. Дескрипторлар:\n` +
      t.descriptors.map((d, k) => `  ${k + 1}) ${d.text} — ${d.points} балл`).join('\n') + (t.answer ? `\n  Дұрыс жауап: ${t.answer}` : '')).join('\n\n');
    try {
      const out = await askJSON({
        vision: true, maxTokens: 12000,
        system: 'Сен Қазақстан мектебінде БЖБ/ТЖБ жұмыстарын дескриптор бойынша тексеретін мұқият мұғалімнің көмекшісісің. ' +
          'Сенің бағаң — тек ұсыныс, оны мұғалім тексереді. Қолжазбаны анық оқи алмасаң, болжама: confidence "low" қойып, не көрінбейтінін жаз. ' +
          'Дескрипторда жоқ талапты ойдан қоспа. Тек JSON қайтар, түсіндірмелер қазақ тілінде.',
        content: [
          { type: 'input_text', text: `Жұмыс: ${str(b.title, 200) || 'БЖБ'}\n\nТексеру кілті:\n${rubric}\n\n` +
            (str(b.key, 4000).trim() ? `Мұғалімнің қосымша ескертпесі:\n${str(b.key, 4000)}\n\n` : '') +
            'Төмендегі суреттер — бір оқушының жауап парағы (бірнеше бет болуы мүмкін). Жұмыс бірнеше нұсқалы болса, алдымен оқушының қай нұсқаны орындағанын шарттағы сандарынан анықта да, сол нұсқаның жауабымен салыстыр. ' +
            'Әр дескрипторды бөлек тексер: marks — әр дескрипторға қойылған балл, дескрипторлар ретімен (0-ден сол дескриптордың балына дейін). ' +
            'JSON: {"variant":"оқушы орындаған нұсқа (анықталса)","tasks":[{"n":"2","marks":[1,1,0],"seen":"оқушы не жазғаны (қысқа)","explanation":"қай дескриптор орындалды/орындалмады, қате неде","confidence":"high|medium|low"}],' +
            '"summary":"оқушының күшті және әлсіз тұстары, 2-3 сөйлем","advice":"оқушыға нақты ұсыныс, 1-2 сөйлем"}' },
          ...images.map(url => ({ type: 'input_image', image_url: url, detail: 'high' }))
        ]
      });
      const got = Array.isArray(out.tasks) ? out.tasks : [];
      const result = tasks.map(t => {
        const g = got.find(x => String(x.n) === t.n) || {};
        const marks = t.descriptors.map((d, k) => clampInt(Array.isArray(g.marks) ? g.marks[k] : null, 0, d.points, 0));
        const hasMarks = Array.isArray(g.marks) && g.marks.length;
        const score = hasMarks ? marks.reduce((a, m) => a + m, 0) : clampInt(g.score, 0, t.max, 0);
        const conf = ['high', 'medium', 'low'].includes(g.confidence) ? g.confidence : 'low';
        return { n: t.n, title: t.title, max: t.max, score, descriptors: t.descriptors.map((d, k) => ({ text: d.text, points: d.points, got: hasMarks ? marks[k] : null })),
          seen: str(g.seen, 600), explanation: str(g.explanation, 1200) || 'AI бұл тапсырманы таба алмады — қолмен тексеріңіз.', confidence: g.explanation ? conf : 'low' };
      });
      res.json({ tasks: result, variant: str(out.variant, 60), summary: str(out.summary, 1500), advice: str(out.advice, 800) });
    } catch (e) { fail(res, e, 'bzhb-check'); }
  });

  // 4) Сабақтық тест нәтижесіне диагностика
  app.post('/api/ai/diagnose', small, async (req, res) => {
    const b = req.body || {};
    const qs = (Array.isArray(b.questions) ? b.questions : []).slice(0, 20).map((q, i) =>
      `${i + 1}. ${str(q.q, 300)} | дұрыс: ${str(q.right, 150)} | дұрыс жауап бергендер: ${clampInt(q.pct, 0, 100, 0)}%` +
      (q.wrong ? ` | ең жиі қате нұсқа: ${str(q.wrong, 150)} (${clampInt(q.wrongPct, 0, 100, 0)}%)` : '') + (q.skill ? ` | дағды: ${str(q.skill, 80)}` : ''));
    if (!qs.length) return res.status(400).json({ error: 'Нәтиже жоқ' });
    if (!(await gate(req, res))) return;
    try {
      const out = await askJSON({
        system: 'Сен Қазақстан мектебінің әдіскерісің. Сабақтан кейінгі тест нәтижесін талдап, мұғалімге қысқа әрі нақты кеңес бересің. Тек JSON, қазақ тілінде.',
        content: [{ type: 'input_text', text:
          `Тест: ${str(b.title, 200)}. Тақырып: ${str(b.topic, 300)}. Сынып: ${clampInt(b.grade, 1, 11, '')}. ` +
          `Қатысқан оқушы: ${clampInt(b.participants, 0, 1000, 0)}, орташа нәтиже: ${clampInt(b.avg, 0, 100, 0)}%.\n\nСұрақтар бойынша:\n${qs.join('\n')}\n\n` +
          'JSON: {"summary":"сыныптың жалпы жағдайы, 2 сөйлем","gaps":["түсінбеген нақты ұғым немесе қате түрі"],' +
          '"next_lesson":["келесі сабақтың басында не істеу керек: нақты 5-10 минуттық әрекет"],"support":"төмен нәтиже алған оқушылармен жұмыс, 1-2 сөйлем"}' }]
      });
      const list = v => (Array.isArray(v) ? v : []).slice(0, 5).map(x => str(x, 300)).filter(Boolean);
      res.json({ summary: str(out.summary, 800), gaps: list(out.gaps), next_lesson: list(out.next_lesson), support: str(out.support, 600) });
    } catch (e) { fail(res, e, 'diagnose'); }
  });
};
