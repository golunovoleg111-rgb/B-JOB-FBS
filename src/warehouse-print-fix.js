(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const printQr=button=>{
  const modal=button.closest('.fbs-box-view-modal');
  if(!modal)return;
  const text=modal.querySelector('.eyebrow')?.textContent?.trim()||'';
  const title=modal.querySelector('h2')?.textContent?.trim()||'Ящик';
  const qrText=modal.querySelector('.muted')?.textContent?.replace(/^QR:\s*/,'').trim()||'';
  let svg='';
  try{if(typeof qrcode==='function'){const q=qrcode(0,'M');q.addData(qrText);q.make();svg=q.createSvgTag(4,0);}}catch{}
  const win=window.open('','_blank','width=360,height=430');
  if(!win){alert('Браузер заблокировал окно печати. Разрешите всплывающие окна для сайта.');return;}
  win.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:58mm 60mm;margin:0}html,body{margin:0;padding:0;width:58mm;height:60mm;background:#fff}body{font-family:Arial,sans-serif}.sheet{width:58mm;height:60mm;box-sizing:border-box;padding:3mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden}.title{font-size:4mm;font-weight:700;margin-bottom:1.5mm}.zone{font-size:2.8mm;color:#667085;margin-bottom:2mm}.qr svg{width:36mm;height:36mm;display:block}.code{font-size:3.2mm;font-weight:700;letter-spacing:.3mm;margin-top:2mm;word-break:break-all}</style></head><body><div class="sheet"><div class="title">${esc(title)}</div><div class="zone">${esc(text)}</div><div class="qr">${svg||`<div>${esc(qrText)}</div>`}</div><div class="code">${esc(qrText)}</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
 };
 document.addEventListener('click',e=>{const b=e.target.closest?.('#fbsPrint');if(!b)return;e.preventDefault();e.stopImmediatePropagation();printQr(b);},true);
})();