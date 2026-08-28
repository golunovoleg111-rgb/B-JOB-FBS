export function createAuth(store) {
  let currentUser = null;
  const load = () => store.read();
  const save = data => store.write(data);
  return {
    get currentUser() { return currentUser; },
    login(login, password) {
      const db = load();
      const user = db.users.find(u => u.login === login.trim() && u.password === password && u.active);
      if (!user) return { ok: false, error: 'Неверный логин или пароль' };
      currentUser = { id: user.id, login: user.login, role: user.role };
      db.session = currentUser; save(db); return { ok: true };
    },
    logout() { const db = load(); db.session = null; save(db); currentUser = null; },
    restore() { const db = load(); currentUser = db.session || null; return currentUser; }
  };
}
