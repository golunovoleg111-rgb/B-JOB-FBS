const DB_KEY='bjob-fbs-db-v1';
const SESSION_KEY='bjob-fbs-session-v1';
const load=()=>{try{return JSON.parse(localStorage.getItem(DB_KEY))||{};}catch{return {};}};
const save=db=>localStorage.setItem(DB_KEY,JSON.stringify(db));
const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY));}catch{return null;}};
const canEdit=()=>{const u=session();return u?.role==='admin'||(u?.permissions||[]).includes('warehouse.edit');};
let resizing=null;
function bind(){
 const page=document.querySelector('#page');const heading=document.querySelector('header h1');if(!page||heading?.textContent.trim()!=='Склад FBS'||!canEdit())return;
 page.querySelectorAll('[data-resize-el],[data-resize-zone]').forEach(handle=>{
  if(handle.dataset.resizeBound)return;handle.dataset.resizeBound='1';
  handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const el=handle.parentElement,canvas=el.closest('.wh-canvas,.wh-map');if(!canvas)return;resizing={handle,el,canvas,startX:e.clientX,startY:e.clientY,startW:parseFloat(el.style.width),startH:parseFloat(el.style.height),rect:canvas.getBoundingClientRect()};handle.setPointerCapture?.(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(!resizing||resizing.handle!==handle)return;const dw=(e.clientX-resizing.startX)/resizing.rect.width*100,dh=(e.clientY-resizing.startY)/resizing.rect.height*100;resizing.el.style.width=`${Math.max(5,Math.min(80,resizing.startW+dw))}%`;resizing.el.style.height=`${Math.max(4,Math.min(80,resizing.startH+dh))}%`;});
  handle.addEventListener('pointerup',()=>{if(!resizing||resizing.handle!==handle)return;persist(resizing.el);resizing=null;});
 });
}
function persist(el){const db=load();const select=document.querySelector('#warehouseSelect');const wid=select?.value||db.warehouses?.[0]?.id;const w=db.warehouses?.find(x=>x.id===wid);if(!w)return;const zid=el.dataset.zoneId,eid=el.dataset.elementId;const item=zid?w.zones?.find(x=>x.id===zid):w.elements?.find(x=>x.id===eid);if(!item)return;item.w=parseFloat(el.style.width);item.h=parseFloat(el.style.height);item.x=parseFloat(el.style.left);item.y=parseFloat(el.style.top);item.updatedAt=Date.now();save(db);}
const observer=new MutationObserver(bind);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(bind,100);
