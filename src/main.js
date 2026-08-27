import './styles.css';

const DB_KEY = 'bjob-fbs-db-v1';
const SESSION_KEY = 'bjob-fbs-session-v1';
const DEFAULT_ADMIN = { id:'admin', login:'Admin', password:'Admin123', role:'admin', permissions:['warehouse.edit','inventory.view','deliveries.manage','transfers.manage','revisions.manage','nomenclature.manage','users.manage'] };
const NAV = [
  ['warehouse','Склад FBS','warehouse.edit'],
  ['inventory','Учет склада','inventory.view'],
  ['deliveries','Заявки на поставки','deliveries.view'],
  ['transfers','Заявка на перемещение','transfers.view'],
  ['revisions','Ревизия','revisions.view'],
  ['nomenclature','Учет номенклатуры','nomenclature.view']
];
const PERMS = [
  ['warehouse.edit','Редактирование склада'],['inventory.view','Просмотр учета склада'],['deliveries.manage','Управление поставками'],
  ['transfers.manage','Управление перемещениями'],['revisions.manage','Управление ревизиями'],['nomenclature.manage','Управление номенклатурой']
];

function loadDB(){
  try { const raw=localStorage.getItem(DB_KEY); if(raw) return JSON.parse(raw); } catch(e){}
  const db={users:[DEFAULT_ADMIN], warehouses:[], nomenclature:[], boxes:[], inventory:[], deliveries:[], transfers:[], revisions:[]};
  saveDB(db); return db;
}
function saveDB(db){ localStorage.setItem(DB_KEY,JSON.stringify(db)); }
function session(){ try{return JSON.parse(localStorage.getItem(SESSION_KEY));}catch(e){return null;} }
function setSession(user){ localStorage.setItem(SESSION_KEY,JSON.stringify({id:user.id,login:user.login,role:user.role,permissions:user.permissions||[]})); }
function can(user,permission){ return user?.role==='admin' || user?.permissions?.includes(permission) || (user?.role==='manager' && ['warehouse.edit','inventory.view','deliveries.manage','transfers.manage','revisions.manage','nomenclature.manage'].includes(permission)); }
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function id(prefix='id'){return prefix+'_'+crypto.randomUUID().slice(0,8);}

let db=loadDB(); let user=session(); let page='warehouse'; let wizard=1; let selectedWarehouse=null;

function loginView(){
  return `<main class="auth"><section class="auth-card"><div class="brand">B-JOB <span>FBS</span></div><h1>Вход в систему</h1><p class="muted">Платформа адресного хранения и сборки FBS</p><form id="loginForm"><label>Логин<input name="login" autocomplete="username" required autofocus></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary wide">Войти</button><div id="loginError" class="error"></div></form><div class="demo">Администратор по умолчанию: <b>Admin</b> / <b>Admin123</b></div></section></main>`;
}
function layout(){
  const nav=NAV.filter(([,label,perm])=>can(user,perm)).map(([key,label])=>`<button class="nav-item ${page===key?'active':''}" data-page="${key}"><span>${icon(key)}</span>${label}</button>`).join('');
  return `<div class="app"><aside class="sidebar"><div class="brand">B-JOB <span>FBS</span></div><div class="user-card"><b>${esc(user.login)}</b><small>${roleName(user.role)}</small></div><nav>${nav}</nav><button id="logout" class="nav-item logout"><span>↪</span>Выйти</button></aside><main class="content"><header><div><h1>${NAV.find(x=>x[0]===page)?.[1]||'B-JOB FBS'}</h1><p class="muted">${page==='warehouse'?'Проектирование и управление складом':page==='inventory'?'Автоматический учет содержимого складов':'Рабочий раздел'}</p></div>${page==='warehouse'&&db.warehouses.length?`<select id="warehouseSelect" class="warehouse-select">${db.warehouses.map(w=>`<option value="${w.id}" ${w.id===selectedWarehouse?'selected':''}>${esc(w.name)}</option>`).join('')}</select>`:''}</header><section id="page" class="page"></section></main></div>`;
}
function roleName(r){return r==='admin'?'Администратор':r==='manager'?'Менеджер':'Сборщик';}
function icon(k){return ({warehouse:'▦',inventory:'▤',deliveries:'⇧',transfers:'⇄',revisions:'✓',nomenclature:'⌘'})[k]||'•';}

function warehousePage(){
  if(!db.warehouses.length) return `<div class="empty"><div class="empty-icon">▦</div><h2>Складов пока нет</h2><p>Создайте первый склад и пройдите короткую настройку.</p>${can(user,'warehouse.edit')?'<button id="createWarehouse" class="primary">Создать склад</button>':'<p class="muted">Ожидайте, пока администратор или менеджер создаст склад.</p>'}</div>`;
  const w=db.warehouses.find(x=>x.id===selectedWarehouse)||db.warehouses[0]; selectedWarehouse=w.id;
  if(w.status==='setup' && can(user,'warehouse.edit')) return wizardView(w);
  return warehouseEditor(w);
}
function wizardView(w){
  const steps=['Комната склада','Вход и элементы','Рабочие пространства','Зоны хранения'];
  const body=[
    `<h2>Шаг 1. Разместите комнату склада</h2><p>Создайте внешний контур помещения. Инструменты можно менять в любой момент.</p>${canvas(w,'room')}<div class="hint">Начните с прямоугольника или соедините стены линиями. Узлы автоматически привязываются.</div>`,
    `<h2>Шаг 2. Укажите вход и дополнительные элементы</h2><p>Вход обязателен. Остальные элементы добавляются по необходимости.</p>${canvas(w,'infra')}<div class="tool-row"><button class="tool" data-add-element="entrance">＋ Вход</button><button class="tool" data-add-element="window">□ Окно</button><button class="tool" data-add-element="gate">▣ Ворота</button><button class="tool" data-add-element="partition">│ Перегородка</button></div>`,
    `<h2>Шаг 3. Рабочие пространства</h2><p>Разместите рабочие области сборщиков и служебные зоны.</p>${canvas(w,'work')}<div class="tool-row"><button class="tool" data-add-work="picking">Сборка</button><button class="tool" data-add-work="packing">Упаковка</button><button class="tool" data-add-work="empty-boxes">Пустые короба</button><button class="tool" data-add-work="trash">Мусор</button></div>`,
    `<h2>Шаг 4. Планировка готова</h2><p>Теперь размещайте зоны хранения коробов, заполняйте их и задавайте линии маршрута.</p>${canvas(w,'storage')}<div class="tool-row"><button id="finishSetup" class="primary">Перейти к хранению</button></div>`
  ][wizard-1];
  return `<div class="wizard"><div class="steps">${steps.map((s,i)=>`<div class="step ${i+1===wizard?'current':''} ${i+1<wizard?'done':''}"><b>${i+1}</b><span>${s}</span></div>`).join('')}</div><div class="card wizard-body">${body}<div class="wizard-actions">${wizard>1?'<button id="prevStep" class="secondary">Назад</button>':''}${wizard<4?'<button id="nextStep" class="primary">Продолжить</button>':''}</div></div></div>`;
}
function canvas(w,mode){
  const elements=w.elements||[]; return `<div class="warehouse-canvas ${mode}"><div class="grid"></div><div class="canvas-tools"><button class="tool active" data-tool="select">↖ Выбор</button><button class="tool" data-tool="line">╱ Линия</button><button class="tool" data-tool="rect">□ Прямоугольник</button><button class="tool" data-tool="erase">⌫ Удалить</button></div>${elements.map(e=>`<div class="canvas-element ${e.type}" style="left:${e.x||10}%;top:${e.y||15}%;width:${e.w||20}%;height:${e.h||15}%">${esc(e.label||e.type)}</div>`).join('')}<div class="canvas-label">${elements.length?'Схема склада':'Рабочая область — добавляйте элементы'}</div></div>`;
}
function warehouseEditor(w){
  const zones=w.zones||[]; const boxes=db.boxes.filter(b=>b.warehouseId===w.id); const unassigned=boxes.filter(b=>!b.zoneId); return `<div class="toolbar card"><button class="primary" id="addZone">＋ Разместить зону</button><button class="secondary" id="addBox">＋ Добавить ящик</button><button class="secondary" id="renameWarehouse">Название склада</button>${unassigned.length?`<span class="warning-pill">${unassigned.length} без зоны</span>`:''}</div><div class="warehouse-layout"><div class="map card"><div class="map-grid"></div><div class="map-title">${esc(w.name)}</div>${zones.map(z=>`<div class="zone" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%"><b>${esc(z.name)}</b><small>${z.boxIds?.length||0}/${z.capacity} коробов</small></div>`).join('')}${boxes.filter(b=>b.zoneId).map(b=>`<div class="box-dot" title="${esc(b.name)}">▣</div>`).join('')}</div><div class="side-panel card"><h3>Хранение</h3><div class="stat"><b>${zones.length}</b><span>зон</span></div><div class="stat"><b>${boxes.length}</b><span>коробов</span></div><div class="stat"><b>${unassigned.length}</b><span>без зоны</span></div><hr><h3>Без зоны</h3>${unassigned.length?unassigned.map(b=>`<div class="list-row"><span>${esc(b.name)}</span><select data-box-zone="${b.id}"><option value="">Без зоны</option>${zones.map(z=>`<option value="${z.id}">${esc(z.name)}</option>`).join('')}</select></div>`).join(''):'<p class="muted">Все короба размещены.</p>'}</div></div>`;
}
function inventoryPage(){
 const rows=db.inventory; return `<div class="card table-card"><div class="table-head"><div><h2>Учет склада</h2><p class="muted">Таблица формируется автоматически из содержимого коробов.</p></div><span class="readonly">Только просмотр</span></div><table><thead><tr><th>Баркод</th><th>Артикул продавца</th><th>Размер</th><th>Цвет</th><th>Зона</th><th>Количество</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.barcode)}</td><td>${esc(r.article)}</td><td>${esc(r.size)}</td><td>${esc(r.color)}</td><td>${esc(r.zone||'Без зоны')}</td><td><b>${r.quantity}</b></td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">Пока нет данных. Добавьте содержимое в короб.</td></tr>'}</tbody></table></div>`;
}
function simplePage(title,text,button){return `<div class="empty card"><div class="empty-icon">${icon(page)}</div><h2>${title}</h2><p>${text}</p>${button||''}</div>`;}
function render(){
 if(!user){document.getElementById('app').innerHTML=loginView(); bindLogin(); return;}
 if(!NAV.some(x=>x[0]===page&&can(user,x[2]))) page='warehouse';
 document.getElementById('app').innerHTML=layout(); const p=document.getElementById('page');
 p.innerHTML=page==='warehouse'?warehousePage():page==='inventory'?inventoryPage():page==='nomenclature'?simplePage('Учет номенклатуры','Здесь будет единый справочник артикулов, ШК, размеров и цветов.',can(user,'nomenclature.manage')?'<button id="addSku" class="primary">＋ Добавить номенклатуру</button>':''):page==='deliveries'?simplePage('Заявки на поставки','Подготовка и выполнение заявок на поставку.'):page==='transfers'?simplePage('Заявка на перемещение','Автоматические рекомендации по низким остаткам и ручные заявки.'):simplePage('Ревизия','Система будет формировать плановые ревизии по истории операций.');
 bind();
}
function bindLogin(){document.getElementById('loginForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const u=db.users.find(x=>x.login===f.get('login')&&x.password===f.get('password'));if(!u){document.getElementById('loginError').textContent='Неверный логин или пароль';return;}user=u;setSession(u);render();};}
function bind(){
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;render();});
 document.getElementById('logout')?.addEventListener('click',()=>{localStorage.removeItem(SESSION_KEY);user=null;render();});
 document.getElementById('warehouseSelect')?.addEventListener('change',e=>{selectedWarehouse=e.target.value;render();});
 document.getElementById('createWarehouse')?.addEventListener('click',()=>{const name=prompt('Название склада','Склад №1');if(!name)return;const w={id:id('wh'),name,status:'setup',elements:[],zones:[]};db.warehouses.push(w);saveDB(db);selectedWarehouse=w.id;wizard=1;render();});
 document.getElementById('nextStep')?.addEventListener('click',()=>{wizard=Math.min(4,wizard+1);render();});
 document.getElementById('prevStep')?.addEventListener('click',()=>{wizard=Math.max(1,wizard-1);render();});
 document.getElementById('finishSetup')?.addEventListener('click',()=>{const w=db.warehouses.find(x=>x.id===selectedWarehouse);w.status='ready';saveDB(db);render();});
 document.querySelectorAll('[data-add-element]').forEach(b=>b.onclick=()=>addElement(b.dataset.addElement));
 document.querySelectorAll('[data-add-work]').forEach(b=>b.onclick=()=>addElement(b.dataset.addWork));
 document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b)));
 document.getElementById('addZone')?.addEventListener('click',addZone);
 document.getElementById('addBox')?.addEventListener('click',addBox);
 document.getElementById('renameWarehouse')?.addEventListener('click',renameWarehouse);
 document.querySelectorAll('[data-box-zone]').forEach(s=>s.onchange=()=>assignBox(s.dataset.boxZone,s.value));
}
function addElement(type){const w=db.warehouses.find(x=>x.id===selectedWarehouse);w.elements.push({id:id('el'),type,label:type==='entrance'?'Вход':type==='window'?'Окно':type==='gate'?'Ворота':type==='partition'?'Перегородка':({picking:'Сборка',packing:'Упаковка','empty-boxes':'Пустые короба',trash:'Мусор'}[type]||type),x:15+Math.random()*45,y:15+Math.random()*45,w:18,h:12});saveDB(db);render();}
function addZone(){const w=db.warehouses.find(x=>x.id===selectedWarehouse);const name=prompt('Название зоны','Зона А');if(!name)return;const cap=Number(prompt('Вместимость зоны в коробах','20'));if(!Number.isFinite(cap)||cap<1)return;w.zones.push({id:id('z'),name,capacity:cap,x:10+(w.zones.length*4)%55,y:20+(w.zones.length*3)%45,w:25,h:20,boxIds:[]});saveDB(db);render();}
function addBox(){const w=db.warehouses.find(x=>x.id===selectedWarehouse);const name=prompt('Название / номер короба','Короб '+String(db.boxes.length+1).padStart(4,'0'));if(!name)return;const b={id:id('box'),warehouseId:w.id,name,qr:'BJOB-'+Math.random().toString(36).slice(2,10).toUpperCase(),zoneId:null,contents:[]};db.boxes.push(b);saveDB(db);render();}
function assignBox(boxId,zoneId){const b=db.boxes.find(x=>x.id===boxId);const w=db.warehouses.find(x=>x.id===b.warehouseId);w.zones.forEach(z=>z.boxIds=(z.boxIds||[]).filter(x=>x!==boxId));if(zoneId){const z=w.zones.find(x=>x.id===zoneId);if(z&&(z.boxIds.length<z.capacity)){z.boxIds.push(boxId);b.zoneId=zoneId;}else{alert('Зона заполнена');b.zoneId=null;}}else b.zoneId=null;rebuildInventory();saveDB(db);render();}
function rebuildInventory(){db.inventory=[];for(const b of db.boxes){const w=db.warehouses.find(x=>x.id===b.warehouseId);const z=w?.zones.find(x=>x.id===b.zoneId);for(const c of b.contents||[]) db.inventory.push({...c,boxId:b.id,zone:z?.name||'Без зоны'});}}
function renameWarehouse(){const w=db.warehouses.find(x=>x.id===selectedWarehouse);const n=prompt('Название склада',w.name);if(n){w.name=n;saveDB(db);render();}}

render();
