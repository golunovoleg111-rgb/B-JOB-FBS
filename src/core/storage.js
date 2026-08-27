const DB_KEY = 'bjob-fbs-db-v1';
const SESSION_KEY = 'bjob-fbs-session-v1';

export const DEFAULT_ADMIN = {
  id: 'user_admin',
  login: 'Admin',
  password: 'Admin123',
  role: 'admin',
  permissions: [
    'warehouse.edit',
    'inventory.view',
    'deliveries.manage',
    'transfers.manage',
    'revisions.manage',
    'nomenclature.manage',
    'users.manage'
  ]
};

export function emptyDatabase() {
  return {
    version: 1,
    users: [{ ...DEFAULT_ADMIN }],
    warehouses: [],
    nomenclature: [],
    boxes: [],
    inventory: [],
    deliveries: [],
    transfers: [],
    revisions: []
  };
}

export function loadDatabase() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDatabase();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users)) {
      return emptyDatabase();
    }
    return {
      ...emptyDatabase(),
      ...parsed,
      users: parsed.users.length ? parsed.users : [{ ...DEFAULT_ADMIN }]
    };
  } catch {
    return emptyDatabase();
  }
}

export function saveDatabase(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    login: user.login,
    role: user.role,
    permissions: [...(user.permissions || [])]
  }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function makeId(prefix = 'id') {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${uuid ? uuid.slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
}

export function resetDatabase() {
  const db = emptyDatabase();
  saveDatabase(db);
  return db;
}
