(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const phone=matchMedia('(max-width:760px)'),mapZoom=matchMedia('(max-width:900px)');

// 摺疊區塊：同步 aria-expanded；手機上卡片內的「交通與實用資訊」預設收合，縮短頁面
$$('details').forEach(el=>{
  const sum=el.querySelector('summary');
  const sync=()=>sum&&sum.setAttribute('aria-expanded',String(el.open));
  if(phone.matches&&el.parentElement.classList.contains('card'))el.open=false;
  el.addEventListener('toggle',sync);sync();
});

// 對話框：開啟時加一筆瀏覽紀錄，讓手機「返回」鍵可以關閉
const openDialog=d=>{
  if(d.open)return;
  if(d.showModal)d.showModal();else d.setAttribute('open','');
  history.pushState({dialog:d.id},'');
};
// 關閉時把那筆紀錄退掉；close 事件是非同步的，所以按鈕關閉時直接處理，Esc 關閉再由事件補上
let backing=false;
const dropState=d=>{if(!backing&&history.state&&history.state.dialog===d.id){backing=true;history.back();}};
const closeDialog=d=>{
  if(d.open){if(d.close)d.close();else d.removeAttribute('open');}
  dropState(d);
};
$$('dialog').forEach(d=>{
  d.addEventListener('close',()=>dropState(d));
  d.addEventListener('click',e=>{if(e.target===d)closeDialog(d);});
});
addEventListener('popstate',()=>{backing=false;$$('dialog[open]').forEach(closeDialog);});

// 加到手機桌面
const btn=$('#install-btn'),sheet=$('#install-sheet');
const ua=navigator.userAgent;
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isLine=/\bLine\//i.test(ua),inApp=isLine||/FBAN|FBAV|FB_IAB|Instagram|MicroMessenger/i.test(ua);
const touch=matchMedia('(pointer:coarse)').matches;
let deferred=null;
if(btn&&sheet&&!standalone){
  if(isIOS||touch)btn.hidden=false;
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(touch)btn.hidden=false;});
  addEventListener('appinstalled',()=>{btn.hidden=true;deferred=null;});
  const go=$('.sheet-go',sheet);
  if(go)go.href=location.origin+location.pathname+'?openExternalBrowser=1';
  btn.addEventListener('click',async()=>{
    if(deferred&&!inApp){
      const p=deferred;deferred=null;p.prompt();
      const r=await p.userChoice.catch(()=>null);
      if(r&&r.outcome==='accepted')btn.hidden=true;
      return;
    }
    sheet.dataset.os=isLine?'line':inApp?'inapp':isIOS?'ios':'android';
    openDialog(sheet);
  });
  $('.sheet-close',sheet).addEventListener('click',()=>closeDialog(sheet));
}

// 地圖：手機與平板上縮成整張小圖，點一下全螢幕放大
const mapBox=$('.map-scroll'),lb=$('#map-lightbox');
if(mapBox&&lb){
  const hint=document.createElement('span');
  hint.className='map-zoom-hint';hint.setAttribute('aria-hidden','true');hint.textContent='點一下放大 ⤢';
  mapBox.appendChild(hint);
  const stage=$('.lb-scroll',lb);
  const open=()=>{
    if(!stage.querySelector('svg'))stage.appendChild(mapBox.querySelector('svg').cloneNode(true));
    openDialog(lb);
    stage.scrollLeft=(stage.scrollWidth-stage.clientWidth)/2;stage.scrollTop=(stage.scrollHeight-stage.clientHeight)/2;
  };
  mapBox.addEventListener('click',e=>{if(!mapZoom.matches)return;e.preventDefault();open();});
  mapBox.addEventListener('keydown',e=>{if(mapZoom.matches&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open();}});
  $('.lb-close',lb).addEventListener('click',()=>closeDialog(lb));
}

// 底部操作列：捲到哪一段就亮哪一顆
const dock=$('.dock');
if(dock&&'IntersectionObserver' in window){
  const group={home:'',stay:'stay',map:'map',arrival:'map',walks:'walks',bay:'walks',shops:'walks',outings:'walks',more:'walks',food:'food',pocket:'pocket'};
  const links=$$('a',dock);
  const mark=k=>links.forEach(a=>{if(a.dataset.k===k)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)mark(group[e.target.id]);}),{rootMargin:'-40% 0px -55% 0px'});
  Object.keys(group).forEach(id=>{const el=document.getElementById(id);if(el)io.observe(el);});
}
})();
