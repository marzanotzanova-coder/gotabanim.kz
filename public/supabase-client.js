const SUPABASE_URL = 'https://eknjslyvcwtusbqvygxx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4AKv-8WUdjo_ZdYvlHPC4w_v-aNINNL';
const ADMIN_EMAIL  = 'admingotab.kz@gmail.com';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  // Remember last visited page for auto-return (admin pages excluded)
  const here = location.pathname.split('/').pop() + location.search;
  const excluded = ['login.html', 'index.html', 'register.html', 'admin.html', 'games.html'];
  if (here && !excluded.includes(here.split('?')[0])) {
    localStorage.setItem('gotab_last_page', here);
  }
  return session.user;
}

// For index/login pages: if session exists, skip login and go to last page
async function redirectIfLoggedIn() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const last = localStorage.getItem('gotab_last_page') || 'dashboard.html';
    window.location.href = last;
  }
}

// Server-clock subscription deadline, including tabs left open overnight.
(async function watchSubscription(){
  const page=location.pathname.split('/').pop();
  if(!['content.html','visuals.html','games.html','quiz-maker.html','quiz-play.html','labs.html','lab-pyramid.html'].includes(page))return;
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.email===ADMIN_EMAIL)return;
  let deadline=0,timer,pending=false;
  const info=new URLSearchParams(location.search).get('subject')==='informatics';
  const gate=document.createElement('div');gate.id='subscriptionGate';
  gate.style.cssText='position:fixed;inset:68px 0 0;z-index:9000;background:#f4f7fbf5;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center';
  const card=document.createElement('div');card.style.cssText='background:white;border:1px solid #dfe7f2;border-radius:20px;padding:32px;max-width:440px;box-shadow:0 12px 40px #17365d12';
  const title=document.createElement('h2'),text=document.createElement('p'),button=document.createElement('button'),back=document.createElement('a');
  title.textContent='Қолжетімділікті тексеру';text.textContent='Бір сәт күтіңіз…';text.style.cssText='line-height:1.7;color:#617590;margin:16px 0';
  button.textContent='Жазылымды жаңарту';button.className='btn-primary';button.style.cssText='padding:12px 20px;border-radius:10px;border:0;background:#2864df;color:#fff;cursor:pointer;font:inherit';
  button.hidden=true;button.onclick=()=>{if(typeof openModal==='function'){const modal=document.getElementById('payModal');if(modal)modal.style.zIndex='10000';openModal();}else location.href='dashboard.html';};
  back.href='dashboard.html';back.textContent='Кабинетке оралу';back.style.cssText='display:block;margin-top:20px;color:#2858a6';
  card.append(title,text,button,back);gate.append(card);document.body.append(gate);
  function closeAccess(message){deadline=0;clearTimeout(timer);document.body.append(gate);title.textContent='Материалдарға доступ жабық';text.textContent=message;button.hidden=false;document.querySelectorAll('video').forEach(v=>v.pause());}
  async function refresh(){
    if(pending)return;pending=true;
    try{
      const {data,error}=await sb.rpc('get_my_access');if(error||!data)throw Error('Қолжетімділікті тексеру мүмкін болмады. Интернетті тексеріп, бетті жаңартыңыз.');
      const active=info?data.informatics_active:data.math_active;
      const until=info?data.informatics_until:data.math_until;
      const remaining=new Date(until)-new Date(data.server_now);
      if(!active||!(remaining>0)){closeAccess(data.is_banned?'Аккаунт блокталған. Әкімшіге хабарласыңыз.':'Жазылым белсенді емес немесе мерзімі аяқталған. Келесі айға төлем расталғаннан кейін материалдар қайта ашылады.');return;}
      deadline=performance.now()+remaining;gate.remove();clearTimeout(timer);timer=setTimeout(()=>{if(remaining>2147483647)refresh();else closeAccess('Жазылым мерзімі аяқталды. Келесі айға төлем расталғаннан кейін материалдар қайта ашылады.');},Math.min(remaining,2147483647));
    }catch(e){closeAccess(e.message);}finally{pending=false;}
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('#subscriptionGate,.top-nav,.pay-modal-overlay,.modal-overlay'))return;
    if(e.target.closest('[data-dl-ppt],[data-dl-qmj],[data-dl-vid],[data-dl-all],[data-extra-file],.sticker-item,.btn-dl-set') && (!deadline||performance.now()>=deadline)){
      e.preventDefault();e.stopImmediatePropagation();closeAccess('Жазылым мерзімі аяқталған. Төлем расталғаннан кейін қайта ашылады.');
    }
  },true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  await refresh();setInterval(refresh,30000);
})();
