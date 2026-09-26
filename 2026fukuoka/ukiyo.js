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
const LAND='M204,14 C204,47.5 213,181.5 204,215 C195,248.5 157.3,225.8 150,215 C142.7,204.2 160,165.8 160,150 C160,134.2 155,128.3 150,120 C145,111.7 136.3,98.7 130,100 C123.7,101.3 117.7,119.7 112,128 C106.3,136.3 98,143.8 96,150 C94,156.2 101.3,161.3 100,165 C98.7,168.7 92.7,166.2 88,172 C83.3,177.8 77,192.8 72,200 C67,207.2 62,213.3 58,215 C54,216.7 48.5,215 48,210 C47.5,205 55.7,191.7 55,185 C54.3,178.3 48.2,175.8 44,170 C39.8,164.2 32.7,157 30,150 C27.3,143 26.7,134.3 28,128 C29.3,121.7 39,117.5 38,112 C37,106.5 26,100.7 22,95 C18,89.3 12.7,82.2 14,78 C15.3,73.8 24,70.7 30,70 C36,69.3 44.7,75.3 50,74 C55.3,72.7 58.3,66.3 62,62 C65.7,57.7 68.2,49.2 72,48 C75.8,46.8 80.3,55.7 85,55 C89.7,54.3 94.5,46.5 100,44 C105.5,41.5 112.2,42.7 118,40 C123.8,37.3 130,28.3 135,28 C140,27.7 143.8,38.3 148,38 C152.2,37.7 154.7,29 160,26 C165.3,23 172.7,22 180,20 C187.3,18 200,15 204,14 C208,13 204,-19.5 204,14 Z';
const line=pts=>'M'+pts.map(k=>P(k).slice(0,2).join(',')).join(' L');
const pins=Object.entries(PL).map(([k,[x,y,ax]])=>`<g class="fm-pin" data-p="${k}"><circle cx="${x}" cy="${y}" r="3.4"/><text x="${x+ax}" y="${y+4}"${ax<0?' text-anchor="end"':''}>${k}</text></g>`).join('');
const hills=[[112,62],[126,74],[172,58],[186,88],[168,112],[184,150],[176,190],[74,82],[100,120]].map(([x,y])=>`<path class="fm-hill" d="M${x-9},${y+4} Q${x-3},${y-9} ${x},${y-8} Q${x+4},${y-9} ${x+9},${y+4}"/><path class="fm-hillsh" d="M${x+1},${y-6} Q${x+4},${y-2} ${x+6},${y+3}"/>`).join('');
const trees=[[140,52],[150,90],[174,132],[60,140],[90,70],[178,176]].map(([x,y])=>`<g class="fm-tree"><circle cx="${x}" cy="${y}" r="2.6"/><circle cx="${x+3.6}" cy="${y+1.2}" r="2.2"/><circle cx="${x-3.2}" cy="${y+1.4}" r="2"/></g>`).join('');
const map=`<svg class="fm-map" viewBox="-12 -4 224 226" aria-hidden="true"><defs><radialGradient id="fm-parch" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#f7ecd0"/><stop offset=".7" stop-color="#ecd9ac"/><stop offset="1" stop-color="#c9a66b"/></radialGradient><filter id="fm-rough"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter><filter id="fm-wash" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="3" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 1.05" result="a"/><feComposite in="SourceGraphic" in2="a" operator="in" result="t"/><feGaussianBlur in="t" stdDeviation=".6" result="b"/><feDisplacementMap in="b" in2="n" scale="4"/></filter><filter id="fm-grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .32  0 0 0 0 .18  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter><clipPath id="fm-clip"><rect x="-4" y="4" width="208" height="210" rx="4"/></clipPath></defs><g filter="url(#fm-rough)"><rect class="fm-paper" x="-8" y="0" width="216" height="218" rx="6"/><rect x="-8" y="0" width="216" height="218" rx="6" fill="#000" filter="url(#fm-grain)"/><g clip-path="url(#fm-clip)"><path class="fm-ripple r3" d="${LAND}"/><path class="fm-ripple r2" d="${LAND}"/><path class="fm-ripple r1" d="${LAND}"/><path class="fm-land" d="${LAND}" filter="url(#fm-wash)"/><path class="fm-coast" d="${LAND}"/></g><ellipse class="fm-isle" cx="40" cy="195" rx="4.5" ry="2.6"/>${hills}${trees}<path class="fm-all" d="${line(['福岡','武雄','有田'])} ${line(['武雄','諫早','長崎','軍艦島'])} ${line(['長崎','豪斯登堡','福岡'])}"/><path class="fm-seg" id="fm-seg" pathLength="1"/><rect class="fm-frame" x="-4" y="4" width="208" height="210" rx="4"/></g><text class="fm-sea" x="44" y="26">玄界灘</text><text class="fm-sea" x="132" y="196">有明海</text><g class="fm-compass" transform="translate(14,34)"><circle r="9"/><path d="M0,-13 L3,0 L0,13 L-3,0 Z"/><path class="n" d="M0,-13 L3,0 L-3,0 Z"/><text y="-16">北</text></g><path class="fm-cloud" d="M8,212 q-6,0 -5,-5 q1,-5 7,-3 q2,-6 9,-4 q6,-1 7,5 q5,1 3,6 Z"/><g class="fm-ship" transform="translate(8,150)"><path d="M-7,0 Q0,5 7,0 Z"/><path d="M0,-1 L0,-11 L6,-3 Z"/></g>${pins}</svg>`;
const shots=[{intro:true},...days.map((d,k)=>({d,k})),{outro:true}];
root.innerHTML=`<div class="fm-stage"><div class="fm-layer" id="fm-a"></div><div class="fm-layer" id="fm-b"></div><div class="fm-shade"></div>${map}<div class="fm-text" id="fm-text" aria-live="polite"></div><div class="fm-progress"><i id="fm-bar"></i></div></div><div class="fm-bar"><button type="button" id="fm-prev" aria-label="上一幕">‹</button><button type="button" id="fm-play"></button><button type="button" id="fm-next" aria-label="下一幕">›</button><span id="fm-count"></span></div>`;
const $=s=>root.querySelector(s),layers=[$('#fm-a'),$('#fm-b')],text=$('#fm-text'),bar=$('#fm-bar'),play=$('#fm-play'),seg=$('#fm-seg');
const DUR=5600,moves=['fm-zin','fm-zout','fm-pl','fm-pr'];let i=0,front=0,timer=null,playing=false,done=false;
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
function step(){if(i>=shots.length-1){done=true;run(false);return}show(i+1)}
function run(on){playing=on;clearInterval(timer);timer=on?setInterval(step,DUR):null;play.textContent=on?'❚❚ 暫停':(done?'↻ 重播':'▶ 播放');play.setAttribute('aria-pressed',String(on));if(on){if(done){done=false;i=0}show(i)}}
$('#fm-prev').onclick=()=>{done=false;run(false);show(i-1)};$('#fm-next').onclick=()=>{done=false;run(false);show(i+1)};play.onclick=()=>run(!playing);
days.forEach(d=>{new Image().src='img/'+d.image});new Image().src='img/takeoff.jpg';
show(0);run(false);
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
if('IntersectionObserver' in window)new IntersectionObserver(es=>es.forEach(e=>{if(!done&&e.isIntersecting!==playing)run(e.isIntersecting)}),{threshold:.5}).observe(root);
})();
