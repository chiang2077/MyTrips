/* 行程懶人包影片：日系旅遊片風格，一幕一句直書短句＋日期地點，讀 journey.js 的 days。 */
(function(){
if(typeof days==='undefined')return;
const root=document.getElementById('ukiyo-film');if(!root)return;
const story=['穿過雲層，九州','先泡一場湯','朱紅樓門，白瓷器','沿著海，慢慢走','看島，聽城市','帶一盒甜，往北','今天不趕路','把可愛留一晚','走進祭典的燈','好好逛，好好慶祝','市場的早餐','下次，再回來'];
const shots=[{intro:true},...days.map((d,k)=>({d,k})),{outro:true}];
root.innerHTML=`<div class="fm-stage"><div class="fm-layer" id="fm-a"></div><div class="fm-layer" id="fm-b"></div><div class="fm-shade"></div><div class="fm-text" id="fm-text" aria-live="polite"></div><div class="fm-progress"><i id="fm-bar"></i></div></div><div class="fm-bar"><button type="button" id="fm-prev" aria-label="上一幕">‹</button><button type="button" id="fm-play"></button><button type="button" id="fm-next" aria-label="下一幕">›</button><span id="fm-count"></span></div>`;
const $=s=>root.querySelector(s),layers=[$('#fm-a'),$('#fm-b')],text=$('#fm-text'),bar=$('#fm-bar'),play=$('#fm-play');
const DUR=5600,moves=['fm-zin','fm-zout','fm-pl','fm-pr'];let i=0,front=0,timer=null,playing=false;
function show(n){i=(n+shots.length)%shots.length;const s=shots[i];
 const img=s.d?s.d.image:(s.intro?'aerial-kyushu.jpg':'takeoff.jpg');
 front^=1;const L=layers[front],B=layers[front^1];
 L.style.backgroundImage=`url("img/${img}")`;L.className='fm-layer on '+moves[i%4];B.classList.remove('on');
 const date=s.d?s.d.date:(s.intro?'10.24':'11.02'),place=s.d?s.d.city.replace('・','／'):(s.intro?'九州':'福岡機場');
 text.innerHTML=`<h3>${story[i]}</h3><small>${date}<br>${place}</small>`;
 text.classList.remove('in');void text.offsetWidth;text.classList.add('in');
 $('#fm-count').textContent=`${i+1} / ${shots.length}`;
 bar.style.animation='none';void bar.offsetWidth;bar.style.animation=playing?`fmBar ${DUR}ms linear forwards`:'none';}
function run(on){playing=on;clearInterval(timer);timer=on?setInterval(()=>show(i+1),DUR):null;play.textContent=on?'❚❚ 暫停':'▶ 播放';play.setAttribute('aria-pressed',String(on));if(on)show(i);}
$('#fm-prev').onclick=()=>{run(false);show(i-1)};$('#fm-next').onclick=()=>{run(false);show(i+1)};play.onclick=()=>run(!playing);
days.forEach(d=>{new Image().src='img/'+d.image});new Image().src='img/takeoff.jpg';
show(0);run(false);
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
if('IntersectionObserver' in window)new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting!==playing)run(e.isIntersecting)}),{threshold:.5}).observe(root);
})();
