export function nomenclaturePage({ db, canEdit, onChange }) {
  const items = db.nomenclature || [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  return `<div class="card table-card">
    <div class="table-head">
      <div><h2>Учет номенклатуры</h2><p class="muted">Справочник изделий, которые можно размещать в коробах и определять по сканированию.</p></div>
      ${canEdit ? '<button class="primary" id="addNomenclature">＋ Добавить изделие</button>' : '<span class="readonly">Только просмотр</span>'}
    </div>
    <div class="nomenclature-toolbar"><input id="nomenclatureSearch" placeholder="Поиск по баркоду, артикулу, названию, размеру или цвету"></div>
    <table><thead><tr><th>Баркод</th><th>Артикул продавца</th><th>Наименование</th><th>Размер</th><th>Цвет</th>${canEdit ? '<th></th>' : ''}</tr></thead>
    <tbody id="nomenclatureRows">${renderRows(items, canEdit, esc)}</tbody></table>
  </div>`;

  function renderRows(rows, edit, escape) {
    if (!rows.length) return `<tr><td colspan="${edit ? 6 : 5}" class="empty-cell">Номенклатура пока пуста. Добавьте первое изделие.</td></tr>`;
    return rows.map(item => `<tr><td>${escape(item.barcode)}</td><td>${escape(item.article)}</td><td>${escape(item.name)}</td><td>${escape(item.size)}</td><td>${escape(item.color)}</td>${edit ? `<td><button class="table-action" data-edit-nomenclature="${escape(item.id)}">Изменить</button><button class="table-action danger-text" data-delete-nomenclature="${escape(item.id)}">Удалить</button></td>` : ''}</tr>`).join('');
  }
}

export function bindNomenclature(root, db, canEdit, makeId, saveDatabase, rerender) {
  const search = root.querySelector('#nomenclatureSearch');
  const render = () => {
    const q = search?.value.trim().toLowerCase() || '';
    const rows = (db.nomenclature || []).filter(item => !q || [item.barcode, item.article, item.name, item.size, item.color].some(value => String(value || '').toLowerCase().includes(q)));
    const tbody = root.querySelector('#nomenclatureRows');
    if (!tbody) return;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    tbody.innerHTML = rows.length ? rows.map(item => `<tr><td>${esc(item.barcode)}</td><td>${esc(item.article)}</td><td>${esc(item.name)}</td><td>${esc(item.size)}</td><td>${esc(item.color)}</td>${canEdit ? `<td><button class="table-action" data-edit-nomenclature="${esc(item.id)}">Изменить</button><button class="table-action danger-text" data-delete-nomenclature="${esc(item.id)}">Удалить</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${canEdit ? 6 : 5}" class="empty-cell">Ничего не найдено.</td></tr>`;
    bindActions();
  };

  const form = item => {
    const barcode = prompt('Баркод', item?.barcode || ''); if (barcode === null) return null;
    const article = prompt('Артикул продавца', item?.article || ''); if (article === null) return null;
    const name = prompt('Наименование', item?.name || ''); if (name === null) return null;
    const size = prompt('Размер', item?.size || ''); if (size === null) return null;
    const color = prompt('Цвет', item?.color || ''); if (color === null) return null;
    if (![barcode, article, name, size, color].every(value => String(value).trim())) { alert('Все поля обязательны.'); return null; }
    return { id: item?.id || makeId('nm'), barcode: barcode.trim(), article: article.trim(), name: name.trim(), size: size.trim(), color: color.trim(), updatedAt: Date.now() };
  };

  const bindActions = () => {
    root.querySelector('#addNomenclature')?.addEventListener('click', () => { const value = form(); if (!value) return; db.nomenclature.push(value); saveDatabase(db); rerender(); });
    root.querySelectorAll('[data-edit-nomenclature]').forEach(button => button.onclick = () => { const item = db.nomenclature.find(x => x.id === button.dataset.editNomenclature); const value = form(item); if (!value) return; Object.assign(item, value); saveDatabase(db); rerender(); });
    root.querySelectorAll('[data-delete-nomenclature]').forEach(button => button.onclick = () => { const item = db.nomenclature.find(x => x.id === button.dataset.deleteNomenclature); if (!item || !confirm(`Удалить «${item.article}»?`)) return; db.nomenclature = db.nomenclature.filter(x => x.id !== item.id); saveDatabase(db); rerender(); });
  };
  search?.addEventListener('input', render);
  bindActions();
}
