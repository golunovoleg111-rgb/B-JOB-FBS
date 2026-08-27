import { AuthService } from '../auth/auth.js';
import { PERMISSIONS, defaultPermissions, hasPermission, roleName } from '../auth/permissions.js';
import { loadDatabase, saveDatabase, makeId } from '../core/storage.js';

const NAV = [
  ['warehouse', 'Склад FBS', 'warehouse.view'],
  ['inventory', 'Учет склада', 'inventory.view'],
  ['deliveries', 'Заявки на поставки', 'deliveries.view'],
  ['transfers', 'Заявка на перемещение', 'transfers.view'],
  ['revisions', 'Ревизия', 'revisions.view'],
  ['nomenclature', 'Учет номенклатуры', 'nomenclature.view']
];

const state = {
  db: loadDatabase(),
  page: 'warehouse',
  warehouseId: null,
  wizardStep: 1,
  employeeId: null
};

const auth = new AuthService(state.db, () => saveDatabase(state.db));

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = key => ({ warehouse: '▦', inventory: '▤', deliveries: '⇧', transfers: '⇄', revisions: '✓', nomenclature: '⌘' }[key] || '•');

export function startApp(root) {
  window.addEventListener('storage', () => {
    state.db = loadDatabase();
    render(root);
  });
  render(root);
}

function render(root) {
  if (!auth.currentUser) {
    root.innerHTML = loginView();
    bindLogin(root);
    return;
  }
  if (!NAV.some(([key, , permission]) => key === state.page && auth.can(permission))) state.page = 'warehouse';
  root.innerHTML = shell();
  renderPage(root.querySelector('#page'));
  bindShell(root);
}

function loginView() {
  return `<main class="auth"><section class="auth-card"><div class="brand">B-JOB <span>FBS</span></div><h1>Вход в систему</h1><p class="muted">Платформа адресного хранения и сборки FBS</p><form id="loginForm"><label>Логин<input name="login" autocomplete="username" required autofocus></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary wide">Войти</button><div id="loginError" class="error"></div></form><div class="demo">Первый вход: <b>Admin</b> / <b>Admin123</b></div></section></main>`;
}

function shell() {
  const nav = NAV.filter(([, , permission]) => auth.can(permission)).map(([key, label]) => `<button class="nav-item ${state.page === key ? 'active' : ''}" data-page="${key}"><span>${icon(key)}</span>${label}</button>`).join('');
  const manageEmployees = auth.can('users.manage') ? '<button class="secondary employee-button" id="employees">Сотрудники</button>' : '';
  const warehouseSelector = state.page === 'warehouse' && state.db.warehouses.length ? `<select id="warehouseSelect" class="warehouse-select">${state.db.warehouses.map(w => `<option value="${w.id}" ${w.id === state.warehouseId ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>` : '';
  return `<div class="app"><aside class="sidebar"><div class="brand">B-JOB <span>FBS</span></div><div class="user-card"><b>${esc(auth.currentUser.login)}</b><small>${roleName(auth.currentUser.role)}</small></div><nav>${nav}</nav><button id="logout" class="nav-item logout"><span>↪</span>Выйти</button></aside><main class="content"><header><div><h1>${NAV.find(item => item[0] === state.page)?.[1] || 'B-JOB FBS'}</h1><p class="muted">${subtitle(state.page)}</p></div><div class="header-actions">${warehouseSelector}${manageEmployees}</div></header><section id="page" class="page"></section></main></div>`;
}

function subtitle(page) {
  return ({ warehouse: 'Проектирование и управление складами', inventory: 'Автоматический учет содержимого', deliveries: 'Заявки и контроль поставок', transfers: 'Перемещение товаров между точками', revisions: 'Плановые и фактические ревизии', nomenclature: 'Единый справочник товаров' })[page] || '';
}

function renderPage(target) {
  if (state.page === 'warehouse') target.innerHTML = warehousePage();
  else if (state.page === 'inventory') target.innerHTML = inventoryPage();
  else target.innerHTML = placeholderPage(state.page);
  bindPage(target);
}

function warehousePage() {
  if (!state.db.warehouses.length) {
    return `<div class="empty card"><div class="empty-icon">▦</div><h2>Складов пока нет</h2><p>Создайте свой первый склад.</p>${auth.can('warehouse.edit') ? '<button id="createWarehouse" class="primary">Создать склад</button>' : '<p class="muted">Ожидайте, пока менеджер или администратор создаст склад.</p>'}</div>`;
  }
  const warehouse = state.db.warehouses.find(item => item.id === state.warehouseId) || state.db.warehouses[0];
  state.warehouseId = warehouse.id;
  if (warehouse.status === 'setup') return setupPage(warehouse);
  return warehouseMap(warehouse);
}

function setupPage(warehouse) {
  if (!auth.can('warehouse.edit')) return `<div class="empty card"><h2>${esc(warehouse.name)}</h2><p>Склад создан. Карта доступна в режиме просмотра.</p><button class="primary" id="openWarehouse">Открыть карту</button></div>`;
  const steps = ['Комната склада', 'Вход и элементы', 'Рабочие пространства', 'Зоны хранения'];
  const descriptions = [
    'Создайте внешний контур помещения.',
    'Добавьте обязательный вход и нужные элементы.',
    'Разместите рабочую зону сборки, упаковку, пустые короба и мусор.',
    'Планировка готова. После сохранения размещайте зоны хранения.'
  ];
  return `<div class="wizard"><div class="steps">${steps.map((name, index) => `<div class="step ${state.wizardStep === index + 1 ? 'current' : ''} ${state.wizardStep > index + 1 ? 'done' : ''}"><b>${index + 1}</b><span>${name}</span></div>`).join('')}</div><div class="card wizard-body"><h2>Шаг ${state.wizardStep}. ${steps[state.wizardStep - 1]}</h2><p>${descriptions[state.wizardStep - 1]}</p>${designCanvas(warehouse)}<div class="wizard-actions">${state.wizardStep > 1 ? '<button id="prevStep" class="secondary">Назад</button>' : ''}${state.wizardStep < 4 ? '<button id="nextStep" class="primary">Продолжить</button>' : '<button id="finishSetup" class="primary">Сохранить планировку</button>'}</div></div></div>`;
}

function designCanvas(warehouse) {
  const elements = warehouse.elements || [];
  const controls = state.wizardStep === 1 ? '<button class="tool" data-add="rect">□ Прямоугольник</button><button class="tool" data-add="line">╱ Линия</button>' : state.wizardStep === 2 ? '<button class="tool" data-add="entrance">＋ Вход</button><button class="tool" data-add="window">□ Окно</button><button class="tool" data-add="gate">▣ Ворота</button><button class="tool" data-add="partition">│ Перегородка</button>' : state.wizardStep === 3 ? '<button class="tool" data-add="picking">Сборка</button><button class="tool" data-add="packing">Упаковка</button><button class="tool" data-add="empty-boxes">Пустые короба</button><button class="tool" data-add="trash">Мусор</button>' : '<span class="hint">Зоны хранения добавляются после сохранения планировки.</span>';
  return `<div class="warehouse-canvas"><div class="grid"></div>${elements.map(element => `<div class="canvas-element ${esc(element.type)}" style="left:${element.x || 10}%;top:${element.y || 15}%;width:${element.w || 20}%;height:${element.h || 15}%">${esc(element.label || element.type)}</div>`).join('')}<div class="canvas-label">${elements.length ? 'Схема склада' : 'Рабочая область'}</div></div><div class="tool-row">${controls}</div>`;
}

function warehouseMap(warehouse) {
  const zones = warehouse.zones || [];
  const boxes = state.db.boxes.filter(box => box.warehouseId === warehouse.id);
  const unassigned = boxes.filter(box => !box.zoneId);
  const edit = auth.can('warehouse.edit');
  return `<div class="toolbar card"><div><b>${esc(warehouse.name)}</b><span class="muted"> · ${zones.length} зон · ${boxes.length} коробов</span></div>${edit ? '<div><button class="primary" id="addZone">＋ Разместить зону</button><button class="secondary" id="addBox">＋ Добавить короб</button><button class="secondary" id="renameWarehouse">Название склада</button></div>' : '<span class="readonly">Режим просмотра</span>'}</div><div class="warehouse-layout"><div class="map card"><div class="map-grid"></div><div class="map-title">${esc(warehouse.name)}</div>${zones.map(zone => `<div class="zone" style="left:${zone.x}%;top:${zone.y}%;width:${zone.w}%;height:${zone.h}%"><b>${esc(zone.name)}</b><small>${zone.boxIds?.length || 0}/${zone.capacity} коробов</small></div>`).join('')}${unassigned.length ? `<div class="unassigned-count">${unassigned.length} без зоны</div>` : ''}</div><div class="side-panel card"><h3>Хранение</h3><div class="stat"><b>${zones.length}</b><span>зон</span></div><div class="stat"><b>${boxes.length}</b><span>коробов</span></div><div class="stat"><b>${unassigned.length}</b><span>без зоны</span></div><hr><h3>Без зоны</h3>${unassigned.length ? unassigned.map(box => `<div class="list-row"><span>${esc(box.name)}</span>${edit ? `<select data-box-zone="${box.id}"><option value="">Без зоны</option>${zones.map(zone => `<option value="${zone.id}" ${zone.id === box.zoneId ? 'selected' : ''}>${esc(zone.name)}</option>`).join('')}</select>` : '<span class="muted">—</span>'}</div>`).join('') : '<p class="muted">Все короба размещены.</p>'}</div></div>`;
}

function inventoryPage() {
  const rows = state.db.inventory || [];
  return `<div class="card table-card"><div class="table-head"><div><h2>Учет склада</h2><p class="muted">Автоматическая таблица. Ручное редактирование отключено.</p></div><span class="readonly">Только просмотр</span></div><table><thead><tr><th>Баркод</th><th>Артикул продавца</th><th>Размер</th><th>Цвет</th><th>Зона</th><th>Количество</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${esc(row.barcode)}</td><td>${esc(row.article)}</td><td>${esc(row.size)}</td><td>${esc(row.color)}</td><td>${esc(row.zone || 'Без зоны')}</td><td><b>${Number(row.quantity) || 0}</b></td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">Учет пока пуст.</td></tr>'}</tbody></table></div>`;
}

function placeholderPage(page) {
  const names = { deliveries: ['Заявки на поставки', 'Здесь будет полный цикл заявки на поставку.'], transfers: ['Заявка на перемещение', 'Здесь появятся автоматические рекомендации по остаткам и ручные заявки.'], revisions: ['Ревизия', 'Здесь система будет формировать плановые ревизии.'], nomenclature: ['Учет номенклатуры', 'Единый справочник артикулов, ШК, размеров и цветов.'] };
  const [title, text] = names[page];
  return `<div class="empty card"><div class="empty-icon">${icon(page)}</div><h2>${title}</h2><p>${text}</p></div>`;
}

function bindLogin(root) {
  root.querySelector('#loginForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = auth.login(form.get('login'), form.get('password'));
    if (!result.ok) root.querySelector('#loginError').textContent = result.error;
    else render(root);
  };
}

function bindShell(root) {
  root.querySelectorAll('[data-page]').forEach(button => button.onclick = () => { state.page = button.dataset.page; render(root); });
  root.querySelector('#logout')?.addEventListener('click', () => { auth.logout(); render(root); });
  root.querySelector('#warehouseSelect')?.addEventListener('change', event => { state.warehouseId = event.target.value; state.wizardStep = 1; render(root); });
  root.querySelector('#employees')?.addEventListener('click', () => openEmployeeModal(root));
}

function bindPage(root) {
  root.querySelector('#createWarehouse')?.addEventListener('click', () => {
    const name = prompt('Название склада', `Склад №${state.db.warehouses.length + 1}`);
    if (!name?.trim()) return;
    const warehouse = { id: makeId('wh'), name: name.trim(), status: 'setup', elements: [], zones: [], createdAt: Date.now() };
    state.db.warehouses.push(warehouse);
    state.warehouseId = warehouse.id;
    state.wizardStep = 1;
    saveDatabase(state.db);
    render(document.getElementById('app'));
  });
  root.querySelector('#nextStep')?.addEventListener('click', () => { state.wizardStep = Math.min(4, state.wizardStep + 1); render(document.getElementById('app')); });
  root.querySelector('#prevStep')?.addEventListener('click', () => { state.wizardStep = Math.max(1, state.wizardStep - 1); render(document.getElementById('app')); });
  root.querySelector('#finishSetup')?.addEventListener('click', () => {
    const warehouse = state.db.warehouses.find(item => item.id === state.warehouseId);
    const hasEntrance = (warehouse.elements || []).some(element => element.type === 'entrance');
    if (!hasEntrance) return alert('Добавьте вход на шаге 2. Вход является обязательным.');
    warehouse.status = 'ready';
    saveDatabase(state.db);
    render(document.getElementById('app'));
  });
  root.querySelectorAll('[data-add]').forEach(button => button.onclick = () => {
    const warehouse = state.db.warehouses.find(item => item.id === state.warehouseId);
    if (!warehouse) return;
    const type = button.dataset.add;
    const labels = { rect: 'Комната', line: 'Стена', entrance: 'Вход', window: 'Окно', gate: 'Ворота', partition: 'Перегородка', picking: 'Сборка', packing: 'Упаковка', 'empty-boxes': 'Пустые короба', trash: 'Мусор' };
    warehouse.elements ||= [];
    warehouse.elements.push({ id: makeId('el'), type, label: labels[type] || type, x: 10 + warehouse.elements.length * 3, y: 15 + warehouse.elements.length * 2, w: type === 'line' ? 25 : 20, h: type === 'line' ? 2 : 15 });
    saveDatabase(state.db);
    render(document.getElementById('app'));
  });
  root.querySelector('#openWarehouse')?.addEventListener('click', () => render(document.getElementById('app')));
  root.querySelector('#renameWarehouse')?.addEventListener('click', () => {
    const warehouse = state.db.warehouses.find(item => item.id === state.warehouseId);
    const name = prompt('Название склада', warehouse?.name);
    if (!warehouse || !name?.trim()) return;
    warehouse.name = name.trim(); saveDatabase(state.db); render(document.getElementById('app'));
  });
  root.querySelector('#addZone')?.addEventListener('click', () => {
    const warehouse = state.db.warehouses.find(item => item.id === state.warehouseId);
    const name = prompt('Название зоны', `Зона ${String.fromCharCode(65 + (warehouse.zones?.length || 0))}`);
    if (!name?.trim()) return;
    const capacity = Number(prompt('Вместимость зоны в коробах', '10'));
    if (!Number.isInteger(capacity) || capacity <= 0) return alert('Вместимость должна быть положительным целым числом.');
    warehouse.zones ||= [];
    warehouse.zones.push({ id: makeId('zone'), name: name.trim(), capacity, boxIds: [], x: 10 + warehouse.zones.length * 5, y: 25, w: 20, h: 20 });
    saveDatabase(state.db); render(document.getElementById('app'));
  });
  root.querySelector('#addBox')?.addEventListener('click', () => {
    const warehouse = state.db.warehouses.find(item => item.id === state.warehouseId);
    const name = prompt('Название короба', `Короб ${String(state.db.boxes.length + 1).padStart(4, '0')}`);
    if (!name?.trim()) return;
    const box = { id: makeId('box'), name: name.trim(), qr: `BJOB-${String(state.db.boxes.length + 1).padStart(6, '0')}`, warehouseId: warehouse.id, zoneId: null, contents: [] };
    state.db.boxes.push(box); saveDatabase(state.db); render(document.getElementById('app'));
  });
  root.querySelectorAll('[data-box-zone]').forEach(select => select.onchange = () => {
    const box = state.db.boxes.find(item => item.id === select.dataset.boxZone);
    const warehouse = state.db.warehouses.find(item => item.id === state.warehouseId);
    if (!box || !warehouse) return;
    const oldZone = warehouse.zones.find(zone => zone.id === box.zoneId);
    const newZone = warehouse.zones.find(zone => zone.id === select.value);
    if (newZone && newZone.boxIds.length >= newZone.capacity) { alert('Зона заполнена.'); render(document.getElementById('app')); return; }
    if (oldZone) oldZone.boxIds = oldZone.boxIds.filter(id => id !== box.id);
    box.zoneId = newZone?.id || null;
    if (newZone && !newZone.boxIds.includes(box.id)) newZone.boxIds.push(box.id);
    saveDatabase(state.db); render(document.getElementById('app'));
  });
}

function openEmployeeModal(root) {
  const employee = state.db.users.find(item => item.id === state.employeeId);
  const isEdit = Boolean(employee);
  const role = employee?.role || 'manager';
  const permissions = employee?.permissions || defaultPermissions(role);
  const rows = PERMISSIONS.filter(item => item.id !== 'users.manage').map(item => `<label class="permission"><input type="checkbox" name="permission" value="${item.id}" ${permissions.includes(item.id) ? 'checked' : ''}> <span>${esc(item.label)}</span></label>`).join('');
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<section class="modal card"><div class="modal-head"><div><h2>${isEdit ? 'Редактирование сотрудника' : 'Добавить сотрудника'}</h2><p class="muted">${isEdit ? 'Измените доступ и учетные данные.' : 'Создайте учетную запись для менеджера или сборщика.'}</p></div><button class="icon-button" data-close>×</button></div><form id="employeeForm"><label>Логин<input name="login" value="${esc(employee?.login || '')}" required></label><label>Пароль<input name="password" type="password" ${isEdit ? '' : 'required'} placeholder="${isEdit ? 'Оставьте пустым, чтобы не менять' : ''}"></label><label>Роль<select name="role"><option value="manager" ${role === 'manager' ? 'selected' : ''}>Менеджер</option><option value="picker" ${role === 'picker' ? 'selected' : ''}>Сборщик</option></select></label><div class="permission-box"><b>Редактировать доступ</b>${rows}</div><div id="employeeError" class="error"></div><div class="modal-actions"><button type="button" class="secondary" data-close>Отмена</button><button class="primary">${isEdit ? 'Сохранить' : 'Создать сотрудника'}</button></div></form>${isEdit ? '<button class="danger-button" id="deleteEmployee">Удалить сотрудника</button>' : ''}</section>`;
  root.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll('[data-close]').forEach(button => button.onclick = close);
  modal.querySelector('[name="role"]').onchange = event => {
    modal.querySelectorAll('[name="permission"]').forEach(input => input.checked = defaultPermissions(event.target.value).includes(input.value));
  };
  modal.querySelector('#employeeForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = [...modal.querySelectorAll('[name="permission"]:checked')].map(input => input.value);
    const result = isEdit ? auth.updateEmployee(employee.id, { login: form.get('login'), password: form.get('password'), role: form.get('role'), permissions: selected }) : auth.addEmployee({ login: form.get('login'), password: form.get('password'), role: form.get('role'), permissions: selected });
    if (!result.ok) { modal.querySelector('#employeeError').textContent = result.error; return; }
    state.employeeId = null; close(); render(document.getElementById('app'));
  };
  modal.querySelector('#deleteEmployee')?.addEventListener('click', () => {
    if (!confirm(`Удалить сотрудника ${employee.login}?`)) return;
    const result = auth.removeEmployee(employee.id);
    if (!result.ok) { modal.querySelector('#employeeError').textContent = result.error; return; }
    state.employeeId = null; close(); render(document.getElementById('app'));
  });
}
