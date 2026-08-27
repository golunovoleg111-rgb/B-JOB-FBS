const DB_KEY = 'bjob-fbs-db-v1';
const SESSION_KEY = 'bjob-fbs-session-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = prefix => `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0,8) || Math.random().toString(36).slice(2,10)}`;
const load = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch { return {}; } };
const save = db => localStorage.setItem(DB_KEY, JSON.stringify(db));
const user = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const canEdit = () => { const u=user(); return u?.role==='admin' || (u?.permissions||[]).includes('warehouse.edit'); };
const getDb = () => { const db=load(); db.warehouses ||= []; db.boxes ||= []; db.nomenclature ||= []; return db; };
let activeId = null;
let step = 1;
let dragging = null;

function render(){
  const page=document.querySelector('#page'), heading=document.querySelector('header h1');
  if(!page || !heading || heading.textContent.trim()!=='Склад FBS') return false;
  const db=getDb();
  if(!activeId || !db.warehouses.some(w=>w.id===activeId)) activeId=db.warehouses[0]?.id||null;
  page.innerHTML = db.warehouses.length ? warehouseView(db, db.warehouses.find(w=>w.id===activeId)) : emptyView();
  bind(page);
  return true;
}
function emptyView(){
  return `<div class="warehouse-empty card"><div class="warehouse-empty-icon">▦</div><h2>Складов пока нет</h2><p>Создайте свой первый склад.</p>${canEdit()?'<button class="primary" id="whCreate">Создать склад</button>':'<p class="muted">Ожидайте, пока менеджер или администратор создаст склад.</p>'}</div>`;
}
function warehouseView(db,w){
  if(w.status==='setup' && canEdit()) return wizardView(db,w);
  return mapView(db,w);
}
function wizardView(db,w){
  const steps=['Комната склада','Вход и элементы','Рабочие пространства','Зоны хранения'];
  const desc=['Создайте контур помещения. Добавляйте стены и линии, затем перетаскивайте элементы мышью.','Укажите вход на склад. Вход обязателен; при необходимости добавьте окна, ворота и перегородки.','Разместите рабочее пространство сборщиков, зону упаковки, место пустых коробов и место для мусора.','Проверьте планировку. После сохранения появится рабочая карта склада и зоны хранения.'];
  const elements=(w.elements||[]).filter(e=>e.step<=step);
  const controls=step===1?`<button class="wh-tool" data-add-el="rect">□ Стена</button><button class="wh-tool" data-add-el="line">╱ Линия</button>`:step===2?`<button class="wh-tool" data-add-el="entrance">＋ Вход</button><button class="wh-tool" data-add-el="window">□ Окно</button><button class="wh-tool" data-add-el="gate">▣ Ворота</button><button class="wh-tool" data-add-el="partition">│ Перегородка</button>`:step===3?`<button class="wh-tool" data-add-el="picking">Сборка</button><button class="wh-tool" data-add-el="packing">Упаковка</button><button class="wh-tool" data-add-el="empty-boxes">Пустые короба</button><button class="wh-tool" data-add-el="trash">Мусор</button>`:`<div class="wh-hint">После сохранения планировки можно размещать зоны хранения.</div>`;
  return `<div class="wh-wizard"><div class="wh-stepper">${steps.map((s,i)=>`<div class="wh-step ${step===i+1?'current':''} ${step>i+1?'done':''}"><b>${i+1}</b><span>${s}</span></div>`).join('')}</div><div class="card wh-wizard-card"><div class="wh-wizard-head"><div><div class="eyebrow">Склад · ${esc(w.name)}</div><h2>Шаг ${step}. ${steps[step-1]}</h2><p class="muted">${desc[step-1]}</p></div><button class="secondary" id="whRename">Переименовать</button></div><div class="wh-canvas" data-canvas="wizard"><div class="wh-grid"></div>${elements.map(elementHtml).join('')}</div><div class="wh-tools">${controls}</div><div class="wh-wizard-actions">${step>1?'<button class="secondary" id="whPrev">Назад</button>':''}${step<4?'<button class="primary" id="whNext">Продолжить</button>':'<button class="primary" id="whFinish">Сохранить планировку</button>'}</div></div></div>`;
}
function elementHtml(e){
  return `<div class="wh-element ${esc(e.type)}" data-element-id="${esc(e.id)}" style="left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%"><span>${esc(e.label)}</span><button class="wh-delete" data-delete-el="${esc(e.id)}" title="Удалить">×</button><i class="wh-resize" data-resize-el="${esc(e.id)}"></i></div>`;
}
function mapView(db,w){
  const zones=w.zones||[], boxes=db.boxes.filter(b=>b.warehouseId===w.id), edit=canEdit();
  return `<div class="wh-toolbar card"><div><div class="eyebrow">Склад FBS</div><h2>${esc(w.name)}</h2><span class="muted">${zones.length} зон · ${boxes.length} коробов</span></div><div class="wh-toolbar-actions">${edit?'<button class="secondary" id="whEditPlan">Изменить планировку</button><button class="secondary" id="whAddBox">＋ Добавить ящик</button><button class="primary" id="whAddZone">＋ Разместить зону</button>':'<span class="readonly">Только просмотр</span>'}</div></div><div class="warehouse-layout wh-layout"><div class="map card wh-map"><div class="wh-grid"></div><div class="wh-map-title">${esc(w.name)}</div>${(w.elements||[]).map(elementHtml).join('')}${zones.map(zoneHtml).join('')}</div><aside class="side-panel card wh-side"><h3>Склад</h3><div class="stat"><b>${zones.length}</b><span>зон</span></div><div class="stat"><b>${boxes.length}</b><span>ящиков</span></div><div class="stat"><b>${boxes.filter(b=>!b.zoneId).length}</b><span>без зоны</span></div><hr><h3>Зоны хранения</h3>${zones.length?zones.map(z=>`<div class="wh-zone-row"><div><b>${esc(z.name)}</b><small>${z.boxIds?.length||0} / ${z.capacity} ящиков</small></div><button class="icon-button" data-zone-edit="${esc(z.id)}">⋯</button></div>`).join(''):'<p class="muted">Зоны пока не созданы.</p>'}</aside></div>`;
}
function zoneHtml(z){ return `<div class="wh-zone" data-zone-id="${esc(z.id)}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%"><b>${esc(z.name)}</b><span>${z.boxIds?.length||0}/${z.capacity}</span><i class="wh-resize" data-resize-zone="${esc(z.id)}"></i></div>`; }
function bind(page){
  page.querySelector('#whCreate')?.addEventListener('click',createWarehouse);
  page.querySelector('#whRename')?.addEventListener('click',renameWarehouse);
  page.querySelector('#whPrev')?.addEventListener('click',()=>{step=Math.max(1,step-1);render();});
  page.querySelector('#whNext')?.addEventListener('click',()=>{step=Math.min(4,step+1);render();});
  page.querySelector('#whFinish')?.addEventListener('click',finish);
  page.querySelector('#whEditPlan')?.addEventListener('click',()=>{step=1;const db=getDb();const w=db.warehouses.find(x=>x.id===activeId);if(w){w.status='setup';save(db);render();}});
  page.querySelector('#whAddZone')?.addEventListener('click',addZone);
  page.querySelector('#whAddBox')?.addEventListener('click',addBox);
  page.querySelectorAll('[data-add-el]').forEach(b=>b.addEventListener('click',()=>addElement(b.dataset.addEl)));
  page.querySelectorAll('[data-delete-el]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();deleteElement(b.dataset.deleteEl);}));
  page.querySelectorAll('[data-zone-edit]').forEach(b=>b.addEventListener('click',()=>editZone(b.dataset.zoneEdit)));
  bindDrag(page);
}
function createWarehouse(){
  const name=prompt('Название склада',`Склад №${getDb().warehouses.length+1}`)?.trim(); if(!name)return;
  const db=getDb(),w={id:uid('wh'),name,status:'setup',elements:[],zones:[],createdAt:Date.now(),updatedAt:Date.now()};db.warehouses.push(w);save(db);activeId=w.id;step=1;render();
}
function renameWarehouse(){ const db=getDb(),w=db.warehouses.find(x=>x.id===activeId);if(!w)return;const name=prompt('Название склада',w.name)?.trim();if(name){w.name=name;w.updatedAt=Date.now();save(db);render();} }
function addElement(type){
  const db=getDb(),w=db.warehouses.find(x=>x.id===activeId);if(!w)return;
  const labels={rect:'Стена',line:'Линия',entrance:'Вход',window:'Окно',gate:'Ворота',partition:'Перегородка',picking:'Сборка',packing:'Упаковка','empty-boxes':'Пустые короба',trash:'Мусор'};
  const isLine=type==='line'; const isEntrance=type==='entrance';
  if(isEntrance && (w.elements||[]).some(e=>e.type==='entrance')){alert('На складе уже указан вход.');return;}
  w.elements ||= []; const n=w.elements.length;w.elements.push({id:uid('el'),type,label:labels[type],step,x:Math.min(75,8+n*4),y:Math.min(70,10+n*3),w:isLine?28:18,h:isLine?3:14});w.updatedAt=Date.now();save(db);render();
}
function deleteElement(id){const db=getDb(),w=db.warehouses.find(x=>x.id===activeId);if(!w)return;w.elements=(w.elements||[]).filter(e=>e.id!==id);save(db);render();}
function finish(){
  const db=getDb(),w=db.warehouses.find(x=>x.id===activeId);if(!w)return;
  if(!(w.elements||[]).some(e=>e.type==='entrance')){alert('Добавьте вход на шаге 2. Вход является обязательным.');step=2;render();return;}
  if(!(w.elements||[]).some(e=>e.type==='rect'||e.type==='line')){alert('Сначала создайте помещение на шаге 1.');step=1;render();return;}
  w.status='ready';w.updatedAt=Date.now();save(db);render();
}
function addZone(){
  const db=getDb(),w=db.warehouses.find(x=>x.id===activeId);if(!w)return;
  const name=prompt('Название зоны',`Зона ${String.fromCharCode(65+(w.zones?.length||0))}`)?.trim();if(!name)return;
  const capacity=Number(prompt('Вместимость зоны в коробах или ящиках','10'));if(!Number.isInteger(capacity)||capacity<1){alert('Введите положительное целое число.');return;}
  w.zones ||= []; const n=w.zones.length;w.zones.push({id:uid('zone'),name,capacity,boxIds:[],x:8+(n%4)*23,y:24+Math.floor(n/4)*28,w:20,h:20});w.updatedAt=Date.now();save(db);render();
}
function editZone(id){
  const db=getDb(),w=db.warehouses.find(x=>x.id===activeId),z=w?.zones?.find(x=>x.id===id);if(!z)return;
  const name=prompt('Название зоны',z.name)?.trim();if(!name)return;const capacity=Number(prompt('Вместимость зоны',z.capacity));if(!Number.isInteger(capacity)||capacity<z.boxIds.length){alert(`Вместимость не может быть меньше ${z.boxIds.length}.`);return;}z.name=name;z.capacity=capacity;save(db);render();
}
function addBox(){
  const db=getDb(),w=db.warehouses.find(x=>x.id===activeId);if(!w)return;
  const available=db.nomenclature||[];if(!available.length){alert('Сначала загрузите номенклатуру в разделе «Учет номенклатуры».');return;}
  const options=available.slice(0,120).map((n,i)=>`${i+1}. ${n.article} / ${n.size} / ${n.barcode}`).join('\n');
  const selected=prompt(`Выберите изделие по номеру:\n\n${options}\n\nДля большого справочника лучше использовать поиск в разделе номенклатуры.`)?.trim();if(!selected)return;
  const index=Number(selected)-1;if(!Number.isInteger(index)||!available[index]){alert('Некорректный номер изделия.');return;}
  const item=available[index];const quantity=Number(prompt(`Количество для «${item.article} / ${item.size}»`,'1'));if(!Number.isInteger(quantity)||quantity<1){alert('Количество должно быть положительным целым числом.');return;}
  const zoneId=chooseZone(w);const box={id:uid('box'),name:`Ящик ${String(db.boxes.length+1).padStart(4,'0')}`,qr:`BJOB-${String(db.boxes.length+1).padStart(6,'0')}`,warehouseId:w.id,zoneId:zoneId||null,contents:[{barcode:item.barcode,article:item.article,size:item.size,quantity}],createdAt:Date.now()};db.boxes.push(box);w.zones ||= [];if(zoneId){const z=w.zones.find(x=>x.id===zoneId);z.boxIds ||= [];z.boxIds.push(box.id);}rebuildInventory(db,w.id);save(db);render();
}
function chooseZone(w){const zones=w.zones||[];if(!zones.length)return null;const list=zones.map((z,i)=>`${i+1}. ${z.name} (${z.boxIds?.length||0}/${z.capacity})`).join('\n');const answer=prompt(`Выберите зону для ящика:\n\n${list}\n\n0 — без зоны`,'1');if(answer===null)return null;const n=Number(answer);if(n===0)return null;const z=zones[n-1];if(!z){alert('Некорректная зона.');return null;}if((z.boxIds?.length||0)>=z.capacity){alert('Зона заполнена.');return null;}return z.id;}
function rebuildInventory(db,warehouseId){
  db.inventory ||= [];db.inventory=db.inventory.filter(row=>row.warehouseId!==warehouseId);
  const boxes=db.boxes.filter(b=>b.warehouseId===warehouseId);const w=db.warehouses.find(x=>x.id===warehouseId);for(const box of boxes){const zone=w?.zones?.find(z=>z.id===box.zoneId);for(const c of box.contents||[]){const key=`${c.barcode}|${box.zoneId||''}`;let row=db.inventory.find(r=>r.warehouseId===warehouseId&&r._key===key);if(!row){row={_key:key,warehouseId,barcode:c.barcode,article:c.article,size:c.size,zone:zone?.name||'Без зоны',quantity:0};db.inventory.push(row);}row.quantity+=Number(c.quantity)||0;}}
}
function bindDrag(page){
  const canvas=page.querySelector('[data-canvas]')||page.querySelector('.wh-map');if(!canvas)return;
  page.querySelectorAll('[data-element-id]').forEach(el=>makeDraggable(el,canvas,'element'));
  page.querySelectorAll('[data-zone-id]').forEach(el=>makeDraggable(el,canvas,'zone'));
}
function makeDraggable(el,canvas,kind){
  el.addEventListener('pointerdown',event=>{
    if(event.target.closest('button')||event.target.classList.contains('wh-resize'))return;
    event.preventDefault();el.setPointerCapture(event.pointerId);const startX=event.clientX,startY=event.clientY,rect=canvas.getBoundingClientRect();const sx=parseFloat(el.style.left),sy=parseFloat(el.style.top);dragging={el,canvas,kind,sx,sy,startX,startY,rect};
  });
  el.addEventListener('pointermove',event=>{if(!dragging||dragging.el!==el)return;const dx=(event.clientX-dragging.startX)/dragging.rect.width*100,dy=(event.clientY-dragging.startY)/dragging.rect.height*100;el.style.left=`${Math.max(0,Math.min(100-parseFloat(el.style.width),dragging.sx+dx))}%`;el.style.top=`${Math.max(0,Math.min(100-parseFloat(el.style.height),dragging.sy+dy))}%`;});
  el.addEventListener('pointerup',()=>{if(!dragging||dragging.el!==el)return;persistPosition(el,kind);dragging=null;});
}
function persistPosition(el,kind){const db=getDb(),w=db.warehouses.find(x=>x.id===activeId);if(!w)return;const id=kind==='zone'?el.dataset.zoneId:el.dataset.elementId;const item=kind==='zone'?w.zones.find(x=>x.id===id):w.elements.find(x=>x.id===id);if(!item)return;item.x=parseFloat(el.style.left);item.y=parseFloat(el.style.top);item.w=parseFloat(el.style.width);item.h=parseFloat(el.style.height);w.updatedAt=Date.now();save(db);}
const observer=new MutationObserver(()=>{const heading=document.querySelector('header h1');if(heading?.textContent.trim()==='Склад FBS'){const page=document.querySelector('#page');if(page&&!page.dataset.warehouseRendered){page.dataset.warehouseRendered='1';render();}else if(page&&!page.querySelector('.warehouse-empty,.wh-wizard,.wh-toolbar'))render();}else{const page=document.querySelector('#page');if(page)delete page.dataset.warehouseRendered;}});
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(render,0);
