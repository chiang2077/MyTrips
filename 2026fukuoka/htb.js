// 豪斯登堡指南：點卡片上的「看詳細攻略」，用 <dialog> 打開對應主題
(()=>{
 const dlg=document.getElementById('htb-dialog');
 if(!dlg||typeof dlg.showModal!=='function')return;
 let opener=null;
 const open=(id,btn)=>{
  const sheet=document.getElementById('sheet-'+id);
  if(!sheet)return;
  dlg.querySelectorAll('.sheet').forEach(s=>{s.hidden=s!==sheet});
  dlg.setAttribute('aria-labelledby','sheet-'+id+'-t');
  opener=btn;
  dlg.showModal();
  dlg.scrollTop=0;
  dlg.querySelector('.htb-close').focus();
 };
 document.addEventListener('click',e=>{
  const b=e.target.closest('button.more[data-sheet]');
  if(b)open(b.dataset.sheet,b);
 });
 dlg.addEventListener('click',e=>{
  // 點關閉鈕，或點到視窗外的暗色背景
  if(e.target.closest('[data-close]')||e.target===dlg)dlg.close();
 });
 dlg.addEventListener('close',()=>{if(opener)opener.focus();opener=null});
})();
