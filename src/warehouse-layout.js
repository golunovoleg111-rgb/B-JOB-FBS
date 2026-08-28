(()=>{
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const setup=()=>{
    const page=document.querySelector('#page');
    if(!page||page.dataset.zoneLayoutBound==='1')return;
    page.dataset.zoneLayoutBound='1';
    page.addEventListener('click',e=>{
      const box=e.target.closest('[data-box-open], [data-zone-add], [data-zone-edit], [data-resize-zone], .wh-zone-expand');
      if(box)return;
      const zone=e.target.closest('.wh-zone');
      if(!zone)return;
      toggle(zone);
    });
  };
  const toggle=zone=>{
    const map=zone.closest('.wh-map');
    if(!map)return;
    if(zone.classList.contains('zone-expanded')){
      zone.classList.remove('zone-expanded');
      zone.querySelector('.wh-zone-expand')?.remove();
      zone.querySelector('.wh-zone-expanded-label')?.remove();
      if(zone.dataset.prevStyle){zone.setAttribute('style',zone.dataset.prevStyle);delete zone.dataset.prevStyle;}
      return;
    }
    zone.dataset.prevStyle=zone.getAttribute('style')||'';
    const mapRect=map.getBoundingClientRect(),z=zone.getBoundingClientRect();
    const x=((z.left-mapRect.left)/mapRect.width)*100,y=((z.top-mapRect.top)/mapRect.height)*100;
    zone.classList.add('zone-expanded');
    const w=42,h=42;
    zone.style.left=`${clamp(x,1,100-w-1)}%`;
    zone.style.top=`${clamp(y,1,100-h-1)}%`;
    if(!zone.querySelector('.wh-zone-expand'))zone.insertAdjacentHTML('afterbegin','<button type="button" class="wh-zone-expand" aria-label="Свернуть зону">−</button>');
  };
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
  setup();
})();