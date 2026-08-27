import { clearSession, loadSession, saveSession, makeId } from '../core/storage.js';
import { defaultPermissions } from './permissions.js';

export class AuthService {
  constructor(db, persist) {
    this.db = db;
    this.persist = persist;
    this.currentUser = loadSession();
    if (this.currentUser && !this.db.users.some(user => user.id === this.currentUser.id)) {
      this.logout();
    }
  }

  login(login, password) {
    const normalizedLogin = String(login || '').trim();
    const user = this.db.users.find(item => item.login === normalizedLogin && item.password === password);
    if (!user) return { ok: false, error: 'Неверный логин или пароль' };
    this.currentUser = {
      id: user.id,
      login: user.login,
      role: user.role,
      permissions: [...(user.permissions || [])]
    };
    saveSession(user);
    return { ok: true, user: this.currentUser };
  }

  logout() {
    clearSession();
    this.currentUser = null;
  }

  can(permission) {
    if (!this.currentUser) return false;
    return this.currentUser.role === 'admin' || (this.currentUser.permissions || []).includes(permission);
  }

  addEmployee({ login, password, role, permissions }) {
    const cleanLogin = String(login || '').trim();
    if (!cleanLogin || !password) return { ok: false, error: 'Логин и пароль обязательны' };
    if (cleanLogin.length < 3) return { ok: false, error: 'Логин должен содержать минимум 3 символа' };
    if (String(password).length < 6) return { ok: false, error: 'Пароль должен содержать минимум 6 символов' };
    if (!['manager', 'picker'].includes(role)) return { ok: false, error: 'Недопустимая роль' };
    if (this.db.users.some(user => user.login.toLowerCase() === cleanLogin.toLowerCase())) {
      return { ok: false, error: 'Такой логин уже существует' };
    }
    const employee = {
      id: makeId('user'),
      login: cleanLogin,
      password: String(password),
      role,
      permissions: Array.isArray(permissions) ? [...new Set(permissions)] : defaultPermissions(role)
    };
    this.db.users.push(employee);
    this.persist();
    return { ok: true, user: employee };
  }

  updateEmployee(id, changes) {
    const employee = this.db.users.find(user => user.id === id);
    if (!employee || employee.role === 'admin') return { ok: false, error: 'Системного администратора нельзя изменить здесь' };
    if (changes.login) {
      const login = String(changes.login).trim();
      if (this.db.users.some(user => user.id !== id && user.login.toLowerCase() === login.toLowerCase())) {
        return { ok: false, error: 'Такой логин уже существует' };
      }
      employee.login = login;
    }
    if (changes.password) employee.password = String(changes.password);
    if (changes.role && ['manager', 'picker'].includes(changes.role)) employee.role = changes.role;
    if (Array.isArray(changes.permissions)) employee.permissions = [...new Set(changes.permissions)];
    this.persist();
    if (this.currentUser?.id === id) saveSession(employee);
    return { ok: true, user: employee };
  }

  removeEmployee(id) {
    const index = this.db.users.findIndex(user => user.id === id);
    if (index < 0 || this.db.users[index].role === 'admin') return { ok: false, error: 'Системного администратора удалить нельзя' };
    this.db.users.splice(index, 1);
    this.persist();
    return { ok: true };
  }
}
