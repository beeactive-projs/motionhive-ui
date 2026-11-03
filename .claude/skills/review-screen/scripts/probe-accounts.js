// Read-only, no browser: signs in to the local API as each test account and says what data it has,
// so the review picks the account that reaches the most states.  node probe-accounts.js
// ACCOUNTS (optional) overrides the list: "email:password,email:password".
const API = process.env.API_URL || 'http://localhost:3800';
const accounts = (process.env.ACCOUNTS ||
  'instructor@motionhive.fit:Test1234!,coach.radu.marin@motionhive.fit:Test1234!,mh.more.menu.check@gmail.com:SecurePass123!')
  .split(',')
  .map((pair) => { const i = pair.indexOf(':'); return [pair.slice(0, i), pair.slice(i + 1)]; });

(async () => {
  for (const [email, password] of accounts) {
    const login = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) { console.log(email, '→ login', login.status); continue; }
    const { accessToken } = await login.json();
    const auth = { Authorization: 'Bearer ' + accessToken };
    const get = async (path) => { const r = await fetch(API + path, { headers: auth }); return r.ok ? r.json() : `HTTP ${r.status}`; };

    const clients = await get('/clients?page=1&limit=100');
    const tally = {};
    for (const c of clients.items ?? []) {
      const key = c.status + (c.client ? '' : ':emailOnly') + (c.requestType ? ':' + c.requestType : '');
      tally[key] = (tally[key] || 0) + 1;
    }
    const me = await get('/users/me');
    console.log(JSON.stringify({
      email,
      roles: me.roles ?? me.user?.roles,
      language: me.language,
      clients: clients.total ?? clients,
      byStatus: tally,
      pending: await get('/clients/requests/pending/count'),
    }));
  }
})();
