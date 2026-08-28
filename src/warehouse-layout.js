(()=>{
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  const roomBounds=(map)=>{
    const wall=map?.querySelector('.wh-element.rect');
    if(!wall)return null;
    const mr=map.getBoundingClientRect(),wr=wall.getBoundingClientRect();
    if(!mr.width||!mr.height)return null;
    return {
      x:((wr.left-mr.left)/mr.width)*100,
      y:((wr.top-mr.top)/mr.height)*100,
      w:(wr.width/mr.width)*100,
      h:(wr.height/mr.height)*100
    };
  };

  const removeZoneResizeHandles=(root=document)=>{
    root.querySelectorAll('[data-resize-zone]').forEach(el=>el.remove());
  };

  const keepInsideRoom=(zone,map)=>{
    const room=roomBounds(map);
    if(!room)return;
    let x=parseFloat(zone.style.left)||0;
    let y=parseFloat(zone.style.top)||0;
    let w=parseFloat(zone.style.width)||0;
    let h=parseFloat(zone.style.height)||0;
    const maxW=Math.max(5,room.w),maxH=Math.max(5,room.h);
    w=Math.min(w,maxW);
    h=Math.min(h,maxH);
    x=clamp(x,room.x,room.x+room.w-w);
    y=clamp(y,room.y,room.y+room.h-h);
    zone.style.left=`${x}%`;
    zone.style.top=`${y}%`;
    zone.style.width=`${w}%`;
    zone.style.height=`${h}%`;
  };

  const setup=()=>{
    const page=document.querySelector('#page');
    if(!page)return;
    removeZoneResizeHandles(page);
    if(page.dataset.zoneLayoutBound==='1')return;
    page.dataset.zoneLayoutBound='1';

    page.addEventListener('click',e=>{
      const box=e.target.closest('[data-box-open], [data-zone-add], [data-zone-edit], [data-resize-zone], .wh-zone-expand');
      if(box)return;
      const zone=e.target.closest('.wh-zone');
      if(!zone)return;
      toggle(zone);
    });

    page.addEventListener('pointerup',e=>{
      const zone=e.target.closest('.wh-zone');
      if(!zone)return;
      const map=zone.closest('.wh-map');
      if(map)keepInsideRoom(zone,map);
    },true);
  };

  const toggle=zone=>{
    const map=zone.closest('.wh-map');
    if(!map)return;
    if(zone.classList.contains('zone-expanded')){
      zone.classList.remove('zone-expanded');
      zone.querySelector('.wh-zone-expand')?.remove();
      zone.querySelector('.wh-zone-expanded-label')?.remove();
      if(zone.dataset.prevStyle){
        zone.setAttribute('style',zone.dataset.prevStyle);
        delete zone.dataset.prevStyle;
      }
      keepInsideRoom(zone,map);
      return;
    }

    zone.dataset.prevStyle=zone.getAttribute('style')||'';
    const mapRect=map.getBoundingClientRect(),z=zone.getBoundingClientRect();
    const x=((z.left-mapRect.left)/mapRect.width)*100;
    const y=((z.top-mapRect.top)/mapRect.height)*100;
    const room=roomBounds(map);
    let w=42,h=42;
    if(room){
      w=Math.min(w,room.w);
      h=Math.min(h,room.h);
    }
    zone.classList.add('zone-expanded');
    zone.style.width=`${w}%`;
    zone.style.height=`${h}%`;
    zone.style.left=`${x}%`;
    zone.style.top=`${y}%`;
    keepInsideRoom(zone,map);
    if(!zone.querySelector('.wh-zone-expand')){
      zone.insertAdjacentHTML('afterbegin','<button type="button" class="wh-zone-expand" aria-label="Свернуть зону">−</button>');
    }
  };

  new MutationObserver(()=>{
    const page=document.querySelector('#page');
    if(page)removeZoneResizeHandles(page);
    setup();
  }).observe(document.documentElement,{childList:true,subtree:true});

  setup();
})();