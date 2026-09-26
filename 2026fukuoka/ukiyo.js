/* 行程懶人包影片：日系旅遊片風格，一幕一句直書短句＋日期地點＋左上手繪地圖，讀 journey.js 的 days。 */
(function(){
if(typeof days==='undefined')return;
const root=document.getElementById('ukiyo-film');if(!root)return;
const story=['穿過雲層，九州','先泡一場湯','朱紅樓門，白瓷器','沿著海，慢慢走','看島，聽城市','帶一盒甜，往北','今天不趕路','把可愛留一晚','走進祭典的燈','好好逛，好好慶祝','市場的早餐','下次，再回來'];
/* 手繪地圖：九州西北部示意，座標由經緯度粗略換算（非精確比例）；第三個值是標籤左右偏移 */
const PL={福岡:[150,35,7],武雄:[87,102,7],有田:[63,102,-7],豪斯登堡:[48,118,-7],長崎:[62,175,7],軍艦島:[40,195,7]};
const V={諫早:[100,150]};
const P=k=>PL[k]||V[k];
/* 每一幕的移動區間（片頭、十天、片尾），只有一個點＝當天不移動 */
const legs=[['福岡'],['福岡','武雄'],['武雄','有田','武雄'],['武雄','諫早','長崎'],['長崎','軍艦島','長崎'],['長崎','豪斯登堡'],['豪斯登堡'],['豪斯登堡'],['豪斯登堡','福岡'],['福岡'],['福岡'],['福岡']];
const LAND='M204,14 L204,215 L150,215 L160,150 L150,120 L130,100 L112,128 L96,150 L100,165 L88,172 L72,200 L58,215 L48,210 L55,185 L44,170 L30,150 L28,128 L38,112 L22,95 L14,78 L30,70 L50,74 L62,62 L72,48 L85,55 L100,44 L118,40 L135,28 L148,38 L160,26 L180,20 L204,14 Z';
const line=pts=>'M'+pts.map(k=>P(k).slice(0,2).join(',')).join(' L');
const pins=Object.entries(PL).map(([k,[x,y,ax]])=>`<g class="fm-pin" data-p="${k}"><circle cx="${x}" cy="${y}" r="3.4"/><text x="${x+ax}" y="${y+4}"${ax<0?' text-anchor="end"':''}>${k}</text></g>`).join('');
const map=`<svg class="fm-map" viewBox="-8 0 216 219" aria-hidden="true"><defs><filter id="fm-rough"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3.5"/></filter></defs><g filter="url(#fm-rough)"><rect class="fm-paper" x="-4" y="2" width="208" height="213" rx="10"/><path class="fm-land" d="${LAND}"/><path class="fm-all" d="${line(['福岡','武雄','有田'])} ${line(['武雄','諫早','長崎','軍艦島'])} ${line(['長崎','豪斯登堡','福岡'])}"/><path class="fm-seg" id="fm-seg" pathLength="1"/></g>${pins}</svg>`;
const shots=[{intro:true},...days.map((d,k)=>({d,k})),{outro:true}];
root.innerHTML=`<div class="fm-stage"><div class="fm-layer" id="fm-a"></div><div class="fm-layer" id="fm-b"></div><div class="fm-shade"></div>${map}<div class="fm-text" id="fm-text" aria-live="polite"></div><div class="fm-progress"><i id="fm-bar"></i></div></div><div class="fm-bar"><button type="button" id="fm-prev" aria-label="上一幕">‹</button><button type="button" id="fm-play"></button><button type="button" id="fm-next" aria-label="下一幕">›</button><span id="fm-count"></span></div>`;
const $=s=>root.querySelector(s),layers=[$('#fm-a'),$('#fm-b')],text=$('#fm-text'),bar=$('#fm-bar'),play=$('#fm-play'),seg=$('#fm-seg');
const DUR=5600,moves=['fm-zin','fm-zout','fm-pl','fm-pr'];let i=0,front=0,timer=null,playing=false;
function show(n){i=(n+shots.length)%shots.length;const s=shots[i];
 const img=s.d?s.d.image:(s.intro?'aerial-kyushu.jpg':'takeoff.jpg');
 front^=1;const L=layers[front],B=layers[front^1];
 L.style.backgroundImage=`url("img/${img}")`;L.className='fm-layer on '+moves[i%4];B.classList.remove('on');
 const date=s.d?s.d.date:(s.intro?'10.24':'11.02'),place=s.d?s.d.city.replace('・','／'):(s.intro?'九州':'福岡機場');
 text.innerHTML=`<h3>${story[i]}</h3><small>${date}<br>${place}</small>`;
 text.classList.remove('in');void text.offsetWidth;text.classList.add('in');
 const leg=legs[i];seg.setAttribute('d',leg.length>1?line(leg):'');seg.classList.remove('draw');void seg.getBoundingClientRect();seg.classList.add('draw');
 root.querySelectorAll('.fm-pin').forEach(g=>g.classList.toggle('now',leg.includes(g.dataset.p)));
 $('#fm-count').textContent=`${i+1} / ${shots.length}`;
 bar.style.animation='none';void bar.offsetWidth;bar.style.animation=playing?`fmBar ${DUR}ms linear forwards`:'none';}
function run(on){playing=on;clearInterval(timer);timer=on?setInterval(()=>show(i+1),DUR):null;play.textContent=on?'❚❚ 暫停':'▶ 播放';play.setAttribute('aria-pressed',String(on));if(on)show(i);}
$('#fm-prev').onclick=()=>{run(false);show(i-1)};$('#fm-next').onclick=()=>{run(false);show(i+1)};play.onclick=()=>run(!playing);
days.forEach(d=>{new Image().src='img/'+d.image});new Image().src='img/takeoff.jpg';
show(0);run(false);
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
if('IntersectionObserver' in window)new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting!==playing)run(e.isIntersecting)}),{threshold:.5}).observe(root);
})();
