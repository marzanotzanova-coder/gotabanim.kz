const SUPABASE_URL = 'https://eknjslyvcwtusbqvygxx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4AKv-8WUdjo_ZdYvlHPC4w_v-aNINNL';
const ADMIN_EMAIL  = 'admin@gotab.kz';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  // Remember last visited page for auto-return
  const here = location.pathname.split('/').pop() + location.search;
  if (here && here !== 'login.html' && here !== 'index.html' && here !== 'register.html') {
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
