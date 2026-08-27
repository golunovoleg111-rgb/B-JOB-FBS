const DB_KEY = 'bjob-fbs-db-v1';
const SESSION_KEY = 'bjob-fbs-session-v1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const loadDb = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch { return {}; } };
const saveDb = db => localStorage.setItem(DB_KEY, JSON.stringify(db));
const session = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const canEdit = () => { const user = session(); return user?.role === 'admin' || (user?.permissions || []).includes('nomenclature.manage'); };
const makeId = () => `sku_${globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`;

function getItems() {
  const db = loadDb();
  db.nomenclature ||= [];
  return db.nomenclature;
}

function render() {
  const page = document.querySelector('#page');
  if (!page) return;
  const heading = document.querySelector('header h1');
  if (!heading || heading.textContent.trim() !== 'Учет номенклатуры') return;
  const edit = canEdit();
  const rows = getItems();
  page.innerHTML = `<div class="card table-card nomenclature-card">
    <div class="table-head"><div><h2>Учет номенклатуры</h2><p class="muted">Справочник изделий для склада, коробов и сканирования.</p></div>${edit ? '<button class="primary" id="nomenclatureAdd">＋ Добавить изделие</button>' : '<span class="readonly">Только просмотр</span>'}</div>
    <div class="nomenclature-toolbar"><input id="nomenclatureSearch" placeholder="Поиск по баркоду, артикулу, названию, размеру или цвету"><span class="muted" id="nomenclatureCount"></span></div>
    <div class="table-scroll"><table><thead><tr><th>Баркод</th><th>Артикул продавца</th><th>Наименование</th><th>Размер</th><th>Цвет</th>${edit ? '<th>Действия</th>' : ''}</tr></thead><tbody id="nomenclatureBody"></tbody></table></div>
  </div>`;
  const body = page.querySelector('#nomenclatureBody');
  const count = page.querySelector('#nomenclatureCount');
  const drawRows = list => {
    count.textContent = `${list.length} ${list.length === 1 ? 'позиция' : 'позиций'}`;
    body.innerHTML = list.length ? list.map(item => `<tr><td>${esc(item.barcode)}</td><td>${esc(item.article)}</td><td>${esc(item.name)}</td><td>${esc(item.size)}</td><td>${esc(item.color)}</td>${edit ? `<td class="row-actions"><button class="secondary small" data-edit="${esc(item.id)}">Изменить</button><button class="danger-button small" data-delete="${esc(item.id)}">Удалить</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${edit ? 6 : 5}" class="empty-cell"><b>Номенклатура пока пуста</b><br><span class="muted">${edit ? 'Добавьте первое изделие.' : 'Изделия пока не добавлены.'}</span></td></tr>`;
    if (edit) bindActions();
  };
  const filter = () => { const q = page.querySelector('#nomenclatureSearch').value.trim().toLowerCase(); drawRows(rows.filter(item => [item.barcode, item.article, item.name, item.size, item.color].some(v => String(v || '').toLowerCase().includes(q)))); };
  page.querySelector('#nomenclatureSearch').oninput = filter;
  page.querySelector('#nomenclatureAdd')?.addEventListener('click', () => openModal());
  const bindActions = () => {
    page.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => openModal(button.dataset.edit));
    page.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => deleteItem(button.dataset.delete));
  };
  drawRows(rows);
}

function openModal(id = null) {
  const items = getItems();
  const item = items.find(row => row.id === id);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<section class="modal card"><div class="modal-head"><div><h2>${item ? 'Редактирование изделия' : 'Новое изделие'}</h2><p class="muted">Все поля обязательны. Баркод должен однозначно определять изделие.</p></div><button class="icon-button" data-close>×</button></div><form id="nomenclatureForm">
    <label>Баркод<input name="barcode" value="${esc(item?.barcode)}" autocomplete="off" required></label>
    <label>Артикул продавца<input name="article" value="${esc(item?.article)}" autocomplete="off" required></label>
    <label>Наименование<input name="name" value="${esc(item?.name)}" autocomplete="off" required></label>
    <div class="form-grid"><label>Размер<input name="size" value="${esc(item?.size)}" autocomplete="off" required></label><label>Цвет<input name="color" value="${esc(item?.color)}" autocomplete="off" required></label></div>
    <div id="nomenclatureModalError" class="error"></div><div class="modal-actions"><button type="button" class="secondary" data-close>Отмена</button><button class="primary">${item ? 'Сохранить' : 'Добавить изделие'}</button></div>
  </form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll('[data-close]').forEach(button => button.onclick = close);
  modal.querySelector('#nomenclatureForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = { barcode: String(form.get('barcode') || '').trim(), article: String(form.get('article') || '').trim(), name: String(form.get('name') || '').trim(), size: String(form.get('size') || '').trim(), color: String(form.get('color') || '').trim() };
    const duplicate = items.find(row => row.id !== id && (row.barcode.toLowerCase() === values.barcode.toLowerCase() || (row.article.toLowerCase() === values.article.toLowerCase() && row.size.toLowerCase() === values.size.toLowerCase() && row.color.toLowerCase() === values.color.toLowerCase())));
    if (duplicate) { modal.querySelector('#nomenclatureModalError').textContent = 'Такое изделие уже есть в номенклатуре.'; return; }
    const db = loadDb(); db.nomenclature ||= [];
    if (item) Object.assign(item, values, { updatedAt: Date.now() });
    else db.nomenclature.push({ id: makeId(), ...values, createdAt: Date.now(), updatedAt: Date.now() });
    saveDb(db); close(); render();
  };
}

function deleteItem(id) {
  const items = getItems();
  const item = items.find(row => row.id === id);
  if (!item || !confirm(`Удалить изделие «${item.article}»?`)) return;
  const db = loadDb(); db.nomenclature = (db.nomenclature || []).filter(row => row.id !== id); saveDb(db); render();
}

let lastPage = null;
const observer = new MutationObserver(() => {
  const page = document.querySelector('#page');
  const heading = document.querySelector('header h1');
  if (!page || !heading || heading.textContent.trim() !== 'Учет номенклатуры') { lastPage = null; return; }
  if (lastPage !== page || !page.querySelector('.nomenclature-card')) { lastPage = page; render(); }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('storage', render);
setTimeout(render, 0);
