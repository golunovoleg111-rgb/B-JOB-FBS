const KEY = 'bjob-fbs-v2';
const DEFAULT = { users: [{ id: 'admin', login: 'Admin1', password: 'Admin123', role: 'admin', active: true }], session: null, nomenclature: [], warehouses: [] };
const clone = value => JSON.parse(JSON.stringify(value));
export function createStore() {
  const read = () => { try { return { ...clone(DEFAULT), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return clone(DEFAULT); } };
  const write = data => localStorage.setItem(KEY, JSON.stringify(data));
  return { read, write };
}
