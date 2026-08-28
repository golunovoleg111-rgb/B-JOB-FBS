import { loadDatabase, saveDatabase, makeId } from './core/storage.js';

const uid = (prefix) => makeId(prefix);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

let activeWarehouseId = null;
let draftZoneId = null;
let setupStep = 1;

function getState() {
  const db = loadDatabase();
  db.warehouses ??= [];
  db.boxes ??= [];
  db.inventory ??= [];
  return db;
}
function persist(db) { saveDatabase(db); }
function warehouse(db) {
  if (!activeWarehouseId || !db.warehouses.some(w => w.id === activeWarehouseId)) activeWarehouseId = db.warehouses[0]?.id ?? null;
  return db.warehouses.find(w => w.id === activeWarehouseId) ?? null;
}
function canEdit(user) { return !!user?.canEdit; }

export function warehousePage(user) {
  const db = getState();
  const w = warehouse(db);
  if (!w) return `<div class="wh-empty card"><div class="wh-icon">▦</div><h2>Создайте ваш первый склад</h2><p>Склад можно создать Администратору или сотруднику с доступом к управлению складом.</p>${canEdit(user) ? '<button class="primary" data-wh-create>＋ Добавить склад</button>' : '<p class="muted">У вас нет доступа к созданию склада.</p>'}</div>`;
  if (w.status !== 'ready') return renderSetup(w, user);
  return renderMap(db, w, user);
}

function renderSetup(w, user) {
  const titles = ['Создайте планировку','Добавьте дополнительные элементы','Проверьте планировку','Готово'];
  const tools = [
    '<button class="tool" data-wh-add="room">▭ Область склада</button><button class="tool" data-wh-add="wall">╱ Стена</button>',
    '<button class="tool" data-wh-add="entrance">↪ Вход</button><button class="tool" data-wh-add="packing">▣ Упаковка</button><button class="tool" data-wh-add="assembly">▣ Сборка</button><button class="tool" data-wh-add="trash">♢ Мусор</button>',
    '<div class="wh-hint">Проверьте схему. После сохранения планировки она фиксируется.</div>',
    '<div class="wh-hint">Планировка будет сохранена и станет рабочей.</div>'
  ][setupStep-1];
  return `<div class="wh-wizard"><div class="wh-steps">${titles.map((t,i)=>`<div class="wh-step ${i+1===setupStep?'current':''} ${i+1<setupStep?'done':''}"><b>${i+1}</b><span>${t}</span></div>`).join('')}</div><section class="card wh-wizard-card"><div class="wh-head"><div><span class="eyebrow">Склад · ${esc(w.name)}</span><h2>Шаг ${setupStep}. ${titles[setupStep-1]}</h2></div></div><div class="wh-canvas" data-wh-canvas>${(w.layout?.elements ?? []).map(e=>layoutElement(e, setupStep !== e.step)).join('')}</div><div class="wh-tools">${canEdit(user) ? tools : '<span class="muted">Только просмотр</span>'}</div><div class="wh-actions">${setupStep>1?'<button class="secondary" data-wh-prev>Назад</button>':''}${setupStep<4?'<button class="primary" data-wh-next>Продолжить</button>':'<button class="primary" data-wh-save-layout>Сохранить планировку</button>'}</div></section></div>`;
}
function layoutElement(e, locked) {
  return `<div class="wh-layout-element ${esc(e.type)} ${locked?'locked':''}" data-wh-element="${esc(e.id)}" style="left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%"><span>${esc(e.label)}</span>${!locked?`<button class="wh-element-delete" data-wh-delete-element="${esc(e.id)}">×</button>`:''}</div>`;
}

function renderMap(db,w,user) {
  const boxes = db.boxes.filter(b=>b.warehouseId===w.id);
  const zones = w.zones ?? [];
  return `<div class="wh-top card"><div><span class="eyebrow">Склад FBS</span><h2>${esc(w.name)}</h2><span class="muted">${zones.length} зон · ${boxes.length} ящиков</span></div><div class="wh-top-actions"><select data-wh-select>${db.warehouses.map(x=>`<option value="${esc(x.id)}" ${x.id===w.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>${canEdit(user)?'<button class="secondary" data-wh-new>＋ Добавить склад</button><button class="primary" data-wh-add-zone>＋ Добавить зону</button>':''}${user?.isAdmin?'<button class="secondary" data-wh-edit-layout>Поменять планировку</button>':''}<button class="secondary" data-wh-demo>Демонстрация</button></div></div><div class="wh-grid"><section class="wh-map card" data-wh-map><div class="wh-map-tools"><button data-wh-zoom="out">−</button><b data-wh-zoom-label>100%</b><button data-wh-zoom="in">＋</button></div>${(w.layout?.elements ?? []).map(e=>layoutElement(e,true)).join('')}${zones.map(z=>renderZone(z,db,w,user)).join('')}</section><aside class="wh-sidebar card"><h3>Зоны хранения</h3>${zones.length?zones.map(z=>`<button class="wh-zone-list" data-wh-open-zone="${z.id}"><span><b>${esc(z.name)}</b><small>${(z.boxIds??[]).length} / ${z.capacity} ящиков</small></span><i>›</i></button>`).join(''):'<p class="muted">Зон пока нет.</p>'}</aside></div>`;
}
function renderZone(z,db,w,user) {
  const boxes = db.boxes.filter(b=>b.zoneId===z.id);
  return `<div class="wh-zone ${z.locked?'locked':''} ${draftZoneId===z.id?'editing':''}" data-wh-zone="${z.id}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%"><header><b>${esc(z.name)}</b><span>${boxes.length}/${z.capacity}</span></header><div class="wh-boxes">${boxes.map((b,i)=>`<button class="wh-box" data-wh-box="${b.id}" title="${esc(b.name||'Ящик')}" ><b>${i+1}</b><small>${esc(b.contents?.length?b.contents.length+' поз.':'Пустой')}</small></button>`).join('')}</div><footer>${draftZoneId===z.id?'<button class="primary small" data-wh-save-zone>Сохранить</button>':'<button class="secondary small" data-wh-add-box="'+z.id+'">＋ Ящик</button><button class="ghost small" data-wh-zone-actions="'+z.id+'">•••</button>'}</footer></div>`;
}

export function bindWarehouse(root,user,onChange) {
  root.querySelector('[data-wh-create]')?.addEventListener('click',()=>createWarehouse(onChange));
  root.querySelector('[data-wh-new]')?.addEventListener('click',()=>createWarehouse(onChange));
  root.querySelector('[data-wh-select]')?.addEventListener('change',e=>{activeWarehouseId=e.target.value;draftZoneId=null;onChange();});
  root.querySelector('[data-wh-prev]')?.addEventListener('click',()=>{setupStep=Math.max(1,setupStep-1);onChange();});
  root.querySelector('[data-wh-next]')?.addEventListener('click',()=>{setupStep=Math.min(4,setupStep+1);onChange();});
  root.querySelector('[data-wh-save-layout]')?.addEventListener('click',()=>saveLayout(user,onChange));
  root.querySelectorAll('[data-wh-add]').forEach(b=>b.addEventListener('click',()=>addLayoutElement(b.dataset.whAdd,onChange)));
  root.querySelectorAll('[data-wh-delete-element]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();deleteLayoutElement(b.dataset.whDeleteElement,onChange);}));
  root.querySelector('[data-wh-add-zone]')?.addEventListener('click',()=>createZone(onChange));
  root.querySelectorAll('[data-wh-zone]').forEach(el=>bindZoneDrag(el,root.querySelector('[data-wh-map]'),onChange));
  root.querySelectorAll('[data-wh-add-box]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();boxModal(b.dataset.whAddBox,onChange);}));
  root.querySelectorAll('[data-wh-box]').forEach(b=>b.addEventListener('click',()=>boxModal(b.dataset.whBox,onChange,true)));
  root.querySelectorAll('[data-wh-open-zone]').forEach(b=>b.addEventListener('click',()=>zoneModal(b.dataset.whOpenZone,onChange)));
  root.querySelectorAll('[data-wh-zone-actions]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();zoneActions(b.dataset.whZoneActions,onChange,user);}));
  root.querySelector('[data-wh-demo]')?.addEventListener('click',()=>demoMode());
  root.querySelector('[data-wh-edit-layout]')?.addEventListener('click',()=>editLayout(onChange));
  root.querySelectorAll('[data-wh-zoom]').forEach(b=>b.addEventListener('click',()=>zoom(root,b.dataset.whZoom)));
}

function createWarehouse(onChange){
  const db=getState(); const name=prompt('Название склада','Склад №'+(db.warehouses.length+1))?.trim(); if(!name)return;
  const w={id:uid('warehouse'),name,status:'setup',layout:{locked:false,elements:[]},zones:[],createdAt:Date.now()}; db.warehouses.push(w); persist(db); activeWarehouseId=w.id; setupStep=1; onChange();
}
function addLayoutElement(type,onChange){
  const db=getState(),w=warehouse(db); if(!w)return; const labels={room:'Склад',wall:'Стена',entrance:'Вход',packing:'Упаковка',assembly:'Сборка',trash:'Мусор'};
  if(type==='entrance'&&(w.layout.elements??[]).some(e=>e.type==='entrance')) return alert('Вход уже добавлен.');
  const n=w.layout.elements.length; w.layout.elements.push({id:uid('layout'),type,label:labels[type],step:setupStep,x:8+(n%4)*20,y:8+Math.floor(n/4)*18,w:type==='wall'?30:18,h:type==='wall'?3:14}); persist(db); onChange();
}
function deleteLayoutElement(id,onChange){const db=getState(),w=warehouse(db);w.layout.elements=w.layout.elements.filter(e=>e.id!==id);persist(db);onChange();}
function saveLayout(user,onChange){
  const db=getState(),w=warehouse(db); if(!w)return; if(!w.layout.elements.some(e=>e.type==='room'))return alert('Сначала добавьте область склада.'); if(!w.layout.elements.some(e=>e.type==='entrance'))return alert('Добавьте вход.'); w.status='ready';w.layout.locked=true;persist(db);onChange();
}
function editLayout(onChange){const db=getState(),w=warehouse(db);if(!w)return;w.status='setup';w.layout.locked=false;setupStep=1;persist(db);onChange();}

function layoutBounds(w){const room=w.layout.elements.find(e=>e.type==='room');return room??{x:0,y:0,w:100,h:100};}
function validZone(z,w,ignoreId){const b=layoutBounds(w);if(z.x<b.x||z.y<b.y||z.x+z.w>b.x+b.w||z.y+z.h>b.y+b.h)return false;return !(w.zones??[]).some(o=>o.id!==ignoreId&&overlap(z,o));}
function createZone(onChange){
  const db=getState(),w=warehouse(db);const name=prompt('Название зоны','Зона '+String.fromCharCode(65+(w.zones?.length??0)))?.trim();if(!name)return;const capacity=Number(prompt('Количество доступных мест для ящиков','20'));if(!Number.isInteger(capacity)||capacity<1)return alert('Введите целое число больше нуля.');
  const z={id:uid('zone'),name,capacity,boxIds:[],x:10,y:12,w:22,h:20,locked:false}; if(!validZone(z,w))return alert('Новая зона пересекает существующий объект или выходит за границы склада.');w.zones.push(z);draftZoneId=z.id;persist(db);onChange();
}
function bindZoneDrag(el,map,onChange){
  let start=null;
  el.onpointerdown=e=>{if(e.target.closest('button')||el.classList.contains('locked'))return;const r=map.getBoundingClientRect();start={x:e.clientX,y:e.clientY,left:parseFloat(el.style.left),top:parseFloat(el.style.top),r};el.setPointerCapture(e.pointerId);};
  el.onpointermove=e=>{if(!start)return;const db=getState(),w=warehouse(db),z=w.zones.find(x=>x.id===el.dataset.whZone);const n={...z,x:start.left+(e.clientX-start.x)/start.r.width*100,y:start.top+(e.clientY-start.y)/start.r.height*100};if(validZone(n,w,z.id)){el.style.left=n.x+'%';el.style.top=n.y+'%';}};
  el.onpointerup=()=>{if(!start)return;const db=getState(),w=warehouse(db),z=w.zones.find(x=>x.id===el.dataset.whZone);z.x=parseFloat(el.style.left);z.y=parseFloat(el.style.top);persist(db);start=null;};
}

function boxModal(zoneId,onChange,view=false){
  const db=getState();let box=db.boxes.find(b=>b.id===zoneId);let zone;
  if(view){zone=db.warehouses.flatMap(w=>w.zones??[]).find(z=>z.id===box?.zoneId);}else{const w=warehouse(db);zone=w.zones.find(z=>z.id===zoneId);if(!zone)return;if(db.boxes.filter(b=>b.zoneId===zoneId).length>=zone.capacity)return alert('В зоне нет свободных мест для ящиков.');}
  const modal=document.createElement('div');modal.className='wh-modal-backdrop';modal.innerHTML=view?boxViewHtml(box,zone):boxCreateHtml();document.body.appendChild(modal);
  if(!view){const form=modal.querySelector('form');form.onsubmit=e=>{e.preventDefault();createBox(db,zone,form,onChange);modal.remove();};modal.querySelector('[data-wh-close]')?.addEventListener('click',()=>modal.remove());bindProductSearch(modal);}
  else {modal.querySelector('[data-wh-close]')?.addEventListener('click',()=>modal.remove());modal.querySelector('[data-wh-delete-box]')?.addEventListener('click',()=>{modal.remove();deleteBox(box.id,onChange);});}
}
function boxCreateHtml(){return `<div class="wh-modal card"><button class="wh-modal-close" data-wh-close>×</button><span class="eyebrow">Новый ящик</span><h2>Добавить содержимое</h2><form><label>Баркод<input name="barcode" id="wh-barcode" autocomplete="off" autofocus placeholder="Сканируйте или введите баркод"></label><div id="wh-product-result" class="wh-product-result">Отсканируйте баркод или найдите товар вручную.</div><label>Артикул / поиск<input name="article" id="wh-article" autocomplete="off" placeholder="Поиск по номенклатуре"></label><label>Размер<input name="size" placeholder="Например, 46"></label><label>Количество<input name="qty" type="number" min="1" value="1" required></label><div class="wh-modal-actions"><button type="button" class="secondary" data-wh-close>Отмена</button><button class="primary">Сохранить ящик</button></div></form></div>`;}
function boxViewHtml(box,zone){return `<div class="wh-modal card"><button class="wh-modal-close" data-wh-close>×</button><span class="eyebrow">${esc(zone?.name||'Зона')}</span><h2>${esc(box?.name||'Ящик')}</h2><div class="qr-preview"><div class="qr-fake">${esc(box?.qrToken||'QR')}</div><small>QR: ${esc(box?.qrToken||'')}</small></div><h3>Содержимое</h3>${box?.contents?.length?box.contents.map(c=>`<div class="wh-content-row"><span>${esc(c.article)} · ${esc(c.size||'—')}</span><b>${c.qty}</b></div>`).join(''):'<p class="muted">Ящик пуст.</p>'}<div class="wh-modal-actions"><button class="secondary" data-wh-close>Закрыть</button><button class="danger-button" data-wh-delete-box>Удалить ящик</button></div></div>`;}
function bindProductSearch(modal){
  const input=modal.querySelector('#wh-barcode'),article=modal.querySelector('#wh-article'),result=modal.querySelector('#wh-product-result');const lookup=(q)=>{const n=getState().nomenclature||[];return n.find(x=>String(x.barcode??x.barcodes?.[0]??'').trim()===String(q).trim())||n.find(x=>String(x.article??x.vendorCode??x.name??'').toLowerCase().includes(String(q).toLowerCase()));};
  const apply=()=>{const p=lookup(input.value||article.value);if(p){article.value=p.article??p.vendorCode??p.name??'';result.textContent=`Найдено: ${p.name??p.article??'товар'}${p.color?' · '+p.color:''}`;}else if(input.value||article.value)result.textContent='Товар не найден в номенклатуре.';};input.addEventListener('change',apply);article.addEventListener('input',apply);
}
function createBox(db,zone,form,onChange){
  const barcode=form.barcode.value.trim(),article=form.article.value.trim(),size=form.size.value.trim(),qty=Number(form.qty.value);if(!article)return alert('Выберите товар из номенклатуры.');if(!Number.isInteger(qty)||qty<1)return alert('Количество должно быть целым числом.');
  const box={id:uid('box'),warehouseId:activeWarehouseId,zoneId:zone.id,name:'Ящик '+String((zone.boxIds?.length??0)+1),qrToken:'BJFBS-'+uid('qr').replace('qr_',''),qrVersion:1,barcode,contents:[{article,size,qty}],createdAt:Date.now()};db.boxes.push(box);zone.boxIds??=[];zone.boxIds.push(box.id);persist(db);onChange();
}
function deleteBox(id,onChange){const db=getState(),box=db.boxes.find(b=>b.id===id);if(!box)return;db.boxes=db.boxes.filter(b=>b.id!==id);for(const w of db.warehouses){for(const z of w.zones??[]){z.boxIds=(z.boxIds??[]).filter(x=>x!==id);}}db.inventory=(db.inventory??[]).filter(i=>i.boxId!==id);persist(db);onChange();}
function zoneModal(id,onChange){const db=getState(),w=warehouse(db),z=w.zones.find(x=>x.id===id);if(!z)return;const boxes=db.boxes.filter(b=>b.zoneId===id);const modal=document.createElement('div');modal.className='wh-modal-backdrop';modal.innerHTML=`<div class="wh-modal card"><button class="wh-modal-close" data-wh-close>×</button><span class="eyebrow">Зона</span><h2>${esc(z.name)}</h2><p class="muted">${boxes.length} из ${z.capacity} ящиков</p><div class="wh-zone-detail">${boxes.map(b=>`<button class="wh-content-row" data-open-box="${b.id}"><span>${esc(b.name)}</span><b>${esc(b.qrToken)}</b></button>`).join('')||'<p class="muted">Ящиков нет.</p>'}</div><div class="wh-modal-actions"><button class="secondary" data-wh-close>Закрыть</button><button class="secondary" data-wh-lock>${z.locked?'Разблокировать':'Заблокировать'}</button>${boxes.length===0?'<button class="danger-button" data-wh-delete-zone>Удалить зону</button>':'<span class="muted">Удалите ящики, чтобы удалить зону.</span>'}</div></div>`;document.body.appendChild(modal);modal.querySelectorAll('[data-wh-close]').forEach(b=>b.addEventListener('click',()=>modal.remove()));modal.querySelector('[data-open-box]')?.addEventListener('click',e=>{modal.remove();boxModal(e.currentTarget.dataset.openBox,onChange,true);});modal.querySelector('[data-wh-lock]')?.addEventListener('click',()=>{z.locked=!z.locked;persist(db);modal.remove();onChange();});modal.querySelector('[data-wh-delete-zone]')?.addEventListener('click',()=>{if(db.boxes.some(b=>b.zoneId===id))return alert('Сначала удалите все ящики из зоны.');w.zones=w.zones.filter(x=>x.id!==id);persist(db);modal.remove();onChange();});}
function zoneActions(id,onChange,user){zoneModal(id,onChange);}
function zoom(root,direction){const map=root.querySelector('[data-wh-map]');let z=Number(map.dataset.zoom||100);z=Math.max(60,Math.min(180,z+(direction==='in'?20:-20)));map.dataset.zoom=z;map.style.setProperty('--wh-zoom',z/100);root.querySelector('[data-wh-zoom-label]').textContent=z+'%';}
function demoMode(){const overlay=document.createElement('div');overlay.className='wh-demo';overlay.innerHTML='<button class="wh-demo-close">×</button><div class="wh-demo-title">Схема склада · режим сборщика</div><div class="wh-demo-map">Зоны склада отображаются здесь. Активная зона подсвечивается во время сборки или ревизии.</div>';document.body.appendChild(overlay);overlay.querySelector('.wh-demo-close').onclick=()=>overlay.remove();}

export function inventoryV2(){const db=getState();const rows=(db.boxes??[]).flatMap(b=>(b.contents??[]).map(c=>({article:c.article,size:c.size,qty:c.qty,box:b.name,qr:b.qrToken})));return `<div class="card wh-inventory"><div class="wh-head"><div><span class="eyebrow">Учет склада</span><h2>Текущее содержимое ящиков</h2></div></div>${rows.length?`<table><thead><tr><th>Артикул</th><th>Размер</th><th>Количество</th><th>Ящик</th><th>QR</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.article)}</td><td>${esc(r.size||'—')}</td><td><b>${r.qty}</b></td><td>${esc(r.box)}</td><td>${esc(r.qr)}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">В ящиках пока нет товаров.</p>'}</div>`;}
