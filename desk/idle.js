// Shared safety guard for the Owner Desk and the test app.
// 1) Automatic sign-out after a long stretch without use (HIPAA "automatic logoff" habit, set to one shift for now).
//    Activity is shared across tabs on this device. Sign-out is "local": other devices stay signed in.
// 2) Refuses to run inside another site's frame (clickjacking guard; GitHub Pages cannot send a frame header).
(function(){
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try { window.top.location = window.self.location.href; } catch(e) {}
  }
  const LIMIT_MS = 12 * 60 * 60 * 1000;   // 12 hours. Shorten (for example to 15 minutes plus a quick unlock) before real resident data.
  const KEY = 'ss-last-active';
  const NOTE = 'ss-idle-signed-out';
  const now = () => Date.now();
  const last = () => { try { return +localStorage.getItem(KEY) || 0; } catch(e) { return 0; } };
  let wrote = 0;
  const touch = () => { const t = now(); if (t - wrote < 60000) return; wrote = t; try { localStorage.setItem(KEY, String(t)); } catch(e) {} };
  const stale = () => { const l = last(); return l > 0 && now() - l > LIMIT_MS; };

  function notice(){
    let seen = false; try { seen = sessionStorage.getItem(NOTE); sessionStorage.removeItem(NOTE); } catch(e) {}
    if (!seen) return;
    const n = document.createElement('div');
    n.setAttribute('role', 'status');
    n.textContent = 'You were signed out after 12 hours without use. Please sign in again.';
    n.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);max-width:calc(100% - 32px);background:#E8F3FC;color:#1F3A52;border:1px solid #B9CDDD;border-radius:12px;padding:.8rem 1rem;font:inherit;z-index:1500;box-shadow:0 10px 30px -15px rgba(20,50,80,.5)';
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 12000);
  }

  async function hasSession(sb){
    try { const { data } = await sb.auth.getSession(); return !!(data && data.session); } catch(e) { return false; }
  }
  async function signOutIdle(sb){
    if (!(await hasSession(sb))) { try { localStorage.setItem(KEY, String(now())); } catch(e) {} return false; }
    try { sessionStorage.setItem(NOTE, '1'); } catch(e) {}
    try { localStorage.removeItem(KEY); } catch(e) {}
    try { await sb.auth.signOut({ scope: 'local' }); } catch(e) {}
    return true;
  }

  // Call right after createClient and before reading the session. Resolves once a stale session is cleared.
  async function guard(sb){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', notice); else notice();
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(ev => addEventListener(ev, touch, { passive: true }));
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      if (stale()) { if (await signOutIdle(sb)) location.reload(); } else touch();
    });
    setInterval(async () => { if (stale() && await signOutIdle(sb)) location.reload(); }, 5 * 60 * 1000);
    // A fresh sign-in link in the address counts as activity, so it is never undone.
    if (/access_token=/.test(location.hash)) { try { localStorage.setItem(KEY, String(now())); } catch(e) {} return; }
    if (stale()) await signOutIdle(sb);
    else if (!last()) { try { localStorage.setItem(KEY, String(now())); } catch(e) {} }
  }
  window.SSIdle = { guard, LIMIT_MS };
})();
