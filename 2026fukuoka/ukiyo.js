/* 行程懶人包影片：用每天的實景照片做電影式慢推鏡，讀 journey.js 的 days。 */
(function(){
if(typeof days==='undefined')return;
const root=document.getElementById('ukiyo-film');if(!root)return;
const stays=[['武雄','2'],['長崎','2'],['豪斯登堡','3'],['福岡','2']];
const stayOf=d=>/福岡|博多/.test(d.city)?3:/豪斯登堡/.test(d.city)?2:/長崎/.test(d.city)?1:0;
const shots=[{intro:true},...days.map((d,k)=>({d,k})),{outro:true}];
root.innerHTML=`<div class="fm-stage"><div class="fm-layer" id="fm-a"></div><div class="fm-layer" id="fm-b"></div><div class="fm-shade"></div><div class="fm-text" id="fm-text" aria-live="polite"></div><ol class="fm-route">${stays.map(([c,n])=>`<li><b>${c}</b><span>${n} 晚</span></li>`).join('')}</ol><div class="fm-progress"><i id="fm-bar"></i></div></div><div class="fm-bar"><button type="button" id="fm-prev" aria-label="上一幕">‹</button><button type="button" id="fm-play"></button><button type="button" id="fm-next" aria-label="下一幕">›</button><span id="fm-count"></span></div>`;
const $=s=>root.querySelector(s),layers=[$('#fm-a'),$('#fm-b')],text=$('#fm-text'),bar=$('#fm-bar'),play=$('#fm-play');
const DUR=5200,moves=['fm-zin','fm-zout','fm-pl','fm-pr'];let i=0,front=0,timer=null,playing=false;
function show(n){i=(n+shots.length)%shots.length;const s=shots[i];
 const img=s.d?s.d.image:(s.intro?'hero.jpg':'airport.jpg');
 front^=1;const L=layers[front],B=layers[front^1];
 L.style.backgroundImage=`url("img/${img}")`;L.className='fm-layer on '+moves[i%4];B.classList.remove('on');
 if(s.intro)text.innerHTML=`<small>2026 秋・九州</small><h3>十天九夜</h3><p>武雄的溫泉、長崎的坡道、豪斯登堡的燈海，最後在博多收尾。</p>`;
 else if(s.outro)text.innerHTML=`<small>11.02・回家</small><h3>一路順風</h3><p>每天的細節就在下面 ↓</p>`;
 else text.innerHTML=`<small>DAY ${String(s.k+1).padStart(2,'0')}・${s.d.date}（${s.d.week}）・${s.d.city}</small><h3>${s.d.title}</h3><p>${s.d.route}</p>`;
 text.classList.remove('in');void text.offsetWidth;text.classList.add('in');
 root.querySelectorAll('.fm-route li').forEach((li,k)=>li.classList.toggle('now',!!s.d&&stayOf(s.d)===k));
 $('#fm-count').textContent=s.d?`${s.k+1} / ${days.length}`:(s.intro?'片頭':'片尾');
 bar.style.animation='none';void bar.offsetWidth;bar.style.animation=playing?`fmBar ${DUR}ms linear forwards`:'none';}
function run(on){playing=on;clearInterval(timer);timer=on?setInterval(()=>show(i+1),DUR):null;play.textContent=on?'❚❚ 暫停':'▶ 播放';play.setAttribute('aria-pressed',String(on));if(on)show(i);}
$('#fm-prev').onclick=()=>{run(false);show(i-1)};$('#fm-next').onclick=()=>{run(false);show(i+1)};play.onclick=()=>run(!playing);
days.forEach(d=>{new Image().src='img/'+d.image});
show(0);run(false);
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
if('IntersectionObserver' in window)new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting!==playing)run(e.isIntersecting)}),{threshold:.5}).observe(root);
})();
