const DB_KEY = 'bjob-fbs-db-v1';
const SESSION_KEY = 'bjob-fbs-session-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const loadDb = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch { return {}; } };
const saveDb = db => localStorage.setItem(DB_KEY, JSON.stringify(db));
const session = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const canEdit = () => { const user = session(); return user?.role === 'admin' || (user?.permissions || []).includes('nomenclature.manage'); };
const makeId = () => `sku_${globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`;
function getItems() { const db = loadDb(); db.nomenclature ||= []; return db.nomenclature; }
function normalize(item) { return { ...item, article: String(item.article || '').trim(), size: String(item.size || '').trim(), barcode: String(item.barcode || '').trim() }; }
function render() {
  const page = document.querySelector('#page');
  const heading = document.querySelector('header h1');
  if (!page || !heading || heading.textContent.trim() !== 'Учет номенклатуры') return;
  const edit = canEdit();
  const rows = getItems().map(normalize);
  page.innerHTML = `<div class="card table-card nomenclature-card"><div class="table-head"><div><h2>Учет номенклатуры</h2><p class="muted">Артикулы, размеры и баркоды для работы склада и сканирования.</p></div>${edit ? '<div class="nomenclature-actions"><button class="secondary" id="nomenclatureImport">⇧ Импорт Excel</button><button class="primary" id="nomenclatureAdd">＋ Добавить изделие</button></div>' : '<span class="readonly">Только просмотр</span>'}</div><div class="nomenclature-toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input id="nomenclatureSearch" placeholder="Поиск по артикулу, размеру или баркоду" autocomplete="off"></div><select id="nomenclatureSort" class="nomenclature-sort"><option value="article-asc">Артикул ↑</option><option value="article-desc">Артикул ↓</option><option value="size-asc">Размер ↑</option><option value="size-desc">Размер ↓</option></select><span class="muted" id="nomenclatureCount"></span></div><div class="table-scroll"><table><thead><tr><th>Баркод</th><th>Артикул продавца</th><th>Размер</th>${edit ? '<th>Действия</th>' : ''}</tr></thead><tbody id="nomenclatureBody"></tbody></table></div></div>`;
  const body = page.querySelector('#nomenclatureBody');
  const count = page.querySelector('#nomenclatureCount');
  const sortSelect = page.querySelector('#nomenclatureSort');
  const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
  const sortRows = (list, mode) => [...list].sort((a, b) => { const [field, direction] = mode.split('-'); const value = collator.compare(String(a[field] || ''), String(b[field] || '')); return direction === 'desc' ? -value : value; });
  const drawRows = list => {
    const sorted = sortRows(list, sortSelect.value);
    count.textContent = `${sorted.length} ${sorted.length === 1 ? 'позиция' : 'позиций'}`;
    body.innerHTML = sorted.length ? sorted.map(item => `<tr><td class="barcode-cell">${esc(item.barcode)}</td><td><b>${esc(item.article)}</b></td><td>${esc(item.size)}</td>${edit ? `<td class="row-actions"><button class="secondary small" data-edit="${esc(item.id)}">Изменить</button><button class="danger-button small" data-delete="${esc(item.id)}">Удалить</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${edit ? 4 : 3}" class="empty-cell"><b>Номенклатура пока пуста</b><br><span class="muted">${edit ? 'Добавьте изделие вручную или импортируйте Excel Wildberries.' : 'Изделия пока не добавлены.'}</span></td></tr>`;
    bindActions();
  };
  const filter = () => { const q = page.querySelector('#nomenclatureSearch').value.trim().toLowerCase(); drawRows(rows.filter(item => [item.barcode, item.article, item.size].some(v => String(v || '').toLowerCase().includes(q)))); };
  page.querySelector('#nomenclatureSearch').oninput = filter;
  sortSelect.onchange = filter;
  page.querySelector('#nomenclatureAdd')?.addEventListener('click', () => openModal());
  page.querySelector('#nomenclatureImport')?.addEventListener('click', () => openImport());
  function bindActions() {
    page.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => openModal(button.dataset.edit));
    page.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => deleteItem(button.dataset.delete));
  }
  drawRows(rows);
}
function openModal(id = null) {
  const items = getItems(); const item = items.find(row => row.id === id); const modal = document.createElement('div'); modal.className = 'modal-backdrop';
  modal.innerHTML = `<section class="modal card nomenclature-form-modal"><div class="modal-head"><div><h2>${item ? 'Редактирование изделия' : 'Новое изделие'}</h2><p class="muted">Укажите данные из номенклатуры Wildberries.</p></div><button class="icon-button" data-close>×</button></div><form id="nomenclatureForm"><label>Артикул продавца<input name="article" value="${esc(item?.article)}" autocomplete="off" required></label><div class="form-grid"><label>Размер<input name="size" value="${esc(item?.size)}" autocomplete="off" required></label><label>Баркод<input name="barcode" value="${esc(item?.barcode)}" autocomplete="off" required></label></div><div id="nomenclatureModalError" class="error"></div><div class="modal-actions"><button type="button" class="secondary" data-close>Отмена</button><button class="primary">${item ? 'Сохранить' : 'Добавить изделие'}</button></div></form></section>`;
  document.body.appendChild(modal); const close = () => modal.remove(); modal.querySelectorAll('[data-close]').forEach(button => button.onclick = close);
  modal.querySelector('#nomenclatureForm').onsubmit = event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const values = { article: String(form.get('article') || '').trim(), size: String(form.get('size') || '').trim(), barcode: String(form.get('barcode') || '').trim() };
    const duplicate = items.find(row => row.id !== id && (String(row.barcode || '').toLowerCase() === values.barcode.toLowerCase() || (String(row.article || '').toLowerCase() === values.article.toLowerCase() && String(row.size || '').toLowerCase() === values.size.toLowerCase())));
    if (duplicate) { modal.querySelector('#nomenclatureModalError').textContent = 'Такое изделие уже есть в номенклатуре.'; return; }
    const db = loadDb(); db.nomenclature ||= [];
    if (item) { Object.assign(item, values, { updatedAt: Date.now() }); delete item.name; delete item.color; }
    else db.nomenclature.push({ id: makeId(), ...values, createdAt: Date.now(), updatedAt: Date.now() });
    saveDb(db); close(); render();
  };
}
function openImport() {
  const modal = document.createElement('div'); modal.className = 'modal-backdrop';
  modal.innerHTML = `<section class="modal card import-modal"><div class="modal-head"><div><h2>Импорт номенклатуры</h2><p class="muted">Excel Wildberries: используются только колонки A, B и C.</p></div><button class="icon-button" data-close>×</button></div><div class="import-mapping"><div><b>A</b><span>Артикул</span></div><div><b>B</b><span>Размер</span></div><div><b>C</b><span>Баркод</span></div></div><div class="import-note"><b>Формат:</b> A — Артикул, B — Размер, C — Баркод. Цвет и наименование отдельно не хранятся: цвет уже входит в артикул.</div><label class="file-picker"><span class="file-picker-title">Выберите Excel-файл</span><span class="file-picker-hint">.xlsx или .xls</span><input id="nomenclatureFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label><div id="importStatus" class="import-status"></div><div class="modal-actions"><button type="button" class="secondary" data-close>Отмена</button><button type="button" class="primary" id="startImport" disabled>Импортировать</button></div></section>`;
  document.body.appendChild(modal); const close = () => modal.remove(); modal.querySelectorAll('[data-close]').forEach(button => button.onclick = close);
  const fileInput = modal.querySelector('#nomenclatureFile'); let selectedFile = null;
  fileInput.onchange = () => { selectedFile = fileInput.files?.[0] || null; modal.querySelector('#startImport').disabled = !selectedFile; modal.querySelector('#importStatus').textContent = selectedFile ? `Выбран файл: ${selectedFile.name}` : ''; };
  modal.querySelector('#startImport').onclick = async () => {
    if (!selectedFile) return; const status = modal.querySelector('#importStatus'); const button = modal.querySelector('#startImport'); button.disabled = true; status.textContent = 'Читаем Excel…';
    try { if (!window.XLSX) throw new Error('Модуль Excel еще не загрузился. Обновите страницу и повторите импорт.'); const workbook = window.XLSX.read(await selectedFile.arrayBuffer(), { type: 'array', raw: false }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; if (!sheet) throw new Error('В файле не найден лист.'); const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }); const result = importRows(rows); status.innerHTML = `Импорт завершен: <b>${result.added}</b> добавлено, <b>${result.updated}</b> обновлено, <b>${result.skipped}</b> пропущено.`; setTimeout(() => { close(); render(); }, 900); } catch (error) { status.textContent = `Ошибка импорта: ${error.message || error}`; button.disabled = false; }
  };
}
function cleanCell(value) { return String(value ?? '').trim(); }
function importRows(rows) {
  if (!rows.length) throw new Error('Excel-файл пуст.'); let start = 0; const first = rows[0].slice(0, 3).map(cleanCell).map(value => value.toLowerCase()); if (first.some(value => value.includes('артикул') || value.includes('размер') || value.includes('баркод') || value.includes('barcode'))) start = 1;
  const db = loadDb(); db.nomenclature ||= []; let added = 0, updated = 0, skipped = 0; const importedBarcodes = new Set();
  for (let index = start; index < rows.length; index += 1) { const row = rows[index] || []; const article = cleanCell(row[0]); const size = cleanCell(row[1]); const barcode = cleanCell(row[2]); if (!article && !size && !barcode) continue; if (!article || !size || !barcode) { skipped += 1; continue; } if (importedBarcodes.has(barcode)) { skipped += 1; continue; } importedBarcodes.add(barcode); const existing = db.nomenclature.find(item => cleanCell(item.barcode) === barcode); if (existing) { existing.article = article; existing.size = size; existing.barcode = barcode; delete existing.name; delete existing.color; existing.updatedAt = Date.now(); updated += 1; } else { db.nomenclature.push({ id: makeId(), barcode, article, size, createdAt: Date.now(), updatedAt: Date.now() }); added += 1; } }
  if (!added && !updated && skipped) throw new Error('Не найдено ни одной корректной строки. Ожидаются A=Артикул, B=Размер, C=Баркод.'); saveDb(db); return { added, updated, skipped };
}
function deleteItem(id) { const items = getItems(); const item = items.find(row => row.id === id); if (!item || !confirm(`Удалить изделие «${item.article}»?`)) return; const db = loadDb(); db.nomenclature = (db.nomenclature || []).filter(row => row.id !== id); saveDb(db); render(); }
let lastPage = null;
const observer = new MutationObserver(() => { const page = document.querySelector('#page'); const heading = document.querySelector('header h1'); if (!page || !heading || heading.textContent.trim() !== 'Учет номенклатуры') { lastPage = null; return; } if (lastPage !== page || !page.querySelector('.nomenclature-card')) { lastPage = page; render(); } });
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('storage', render); setTimeout(render, 0);
