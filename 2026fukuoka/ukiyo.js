/* 行程懶人包影片：用每天的實景照片做電影式慢推鏡，讀 journey.js 的 days。 */
(function(){
if(typeof days==='undefined')return;
const root=document.getElementById('ukiyo-film');if(!root)return;
const stays=[['武雄','2'],['長崎','2'],['豪斯登堡','3'],['福岡','2']];
const stayOf=d=>/福岡|博多/.test(d.city)?3:/豪斯登堡/.test(d.city)?2:/長崎/.test(d.city)?1:0;
const story=[
 ['序章','穿過雲層，九州就在眼前','玄界灘的藍一路鋪到海岸線。接下來十天，我們不趕路，只跟著季節走。'],
 ['第一章','第一口氣，給溫泉','落地後直奔武雄。放下行李、吃頓午飯，傍晚泡進東洋館的湯裡，旅程就算正式開始了。'],
 ['第二章','朱紅樓門，白色瓷器','早上爬上樓門看生肖雕刻，午後到有田挑一只喜歡的器皿，把溫泉鄉的日子帶一點回家。'],
 ['第三章','沿著海，慢慢進港','雙星列車貼著有明海前進，窗外是閃光的潮水。下車時，長崎的坡道已經在等我們。'],
 ['第四章','出海，然後安靜下來','上午搭船看軍艦島的輪廓，下午走進原爆資料館。這一天，讓城市的過去說給我們聽。'],
 ['第五章','帶著甜，前往荷蘭','排隊買一盒長崎菓子當伴手禮，再往北移動。風車和運河出現時，換上另一種節奏。'],
 ['第六章','今天什麼都不趕','整整一天在豪斯登堡：運河邊散步、看花、等夜裡的燈一盞盞亮起。'],
 ['第七章','把可愛留一晚','搬進園區中央的米菲兔房。這是整趟最孩子氣、也最捨不得的一夜。'],
 ['第八章','回到城市的熱鬧','午後搭特急回福岡，晚上走進中洲祭，攤販的燈火和人潮，是另一種九州。'],
 ['第九章','好好逛，好好慶祝','一整天在天神和博多買個痛快，晚上用紀念日晚餐，替這趟旅行舉杯。'],
 ['第十章','最後一頓早餐','清晨到柳橋市場吃海鮮早餐，散步回飯店拿行李。秋天，已經裝進行李箱。'],
 ['終章','起飛，帶著九州回家','機輪離地的那一刻，十天的風景一格格倒帶。下一次，我們再回來。']
];
const shots=[{intro:true},...days.map((d,k)=>({d,k})),{outro:true}];
root.innerHTML=`<div class="fm-stage"><div class="fm-layer" id="fm-a"></div><div class="fm-layer" id="fm-b"></div><div class="fm-shade"></div><div class="fm-text" id="fm-text" aria-live="polite"></div><ol class="fm-route">${stays.map(([c,n])=>`<li><b>${c}</b><span>${n} 晚</span></li>`).join('')}</ol><div class="fm-progress"><i id="fm-bar"></i></div></div><div class="fm-bar"><button type="button" id="fm-prev" aria-label="上一幕">‹</button><button type="button" id="fm-play"></button><button type="button" id="fm-next" aria-label="下一幕">›</button><span id="fm-count"></span></div>`;
const $=s=>root.querySelector(s),layers=[$('#fm-a'),$('#fm-b')],text=$('#fm-text'),bar=$('#fm-bar'),play=$('#fm-play');
const DUR=5200,moves=['fm-zin','fm-zout','fm-pl','fm-pr'];let i=0,front=0,timer=null,playing=false;
function show(n){i=(n+shots.length)%shots.length;const s=shots[i];
 const img=s.d?s.d.image:(s.intro?'aerial-kyushu.jpg':'takeoff.jpg');
 front^=1;const L=layers[front],B=layers[front^1];
 L.style.backgroundImage=`url("img/${img}")`;L.className='fm-layer on '+moves[i%4];B.classList.remove('on');
 const [ch,h,p]=story[i],tag=s.d?`${ch}・${s.d.date}（${s.d.week}）・${s.d.city}`:(s.intro?`${ch}・10.24`:`${ch}・11.02`);
 text.innerHTML=`<small>${tag}</small><h3>${h}</h3><p>${p}</p>`;
 text.classList.remove('in');void text.offsetWidth;text.classList.add('in');
 root.querySelectorAll('.fm-route li').forEach((li,k)=>li.classList.toggle('now',!!s.d&&stayOf(s.d)===k));
 $('#fm-count').textContent=s.d?`${s.k+1} / ${days.length}`:(s.intro?'片頭':'片尾');
 bar.style.animation='none';void bar.offsetWidth;bar.style.animation=playing?`fmBar ${DUR}ms linear forwards`:'none';}
function run(on){playing=on;clearInterval(timer);timer=on?setInterval(()=>show(i+1),DUR):null;play.textContent=on?'❚❚ 暫停':'▶ 播放';play.setAttribute('aria-pressed',String(on));if(on)show(i);}
$('#fm-prev').onclick=()=>{run(false);show(i-1)};$('#fm-next').onclick=()=>{run(false);show(i+1)};play.onclick=()=>run(!playing);
days.forEach(d=>{new Image().src='img/'+d.image});new Image().src='img/takeoff.jpg';
show(0);run(false);
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
if('IntersectionObserver' in window)new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting!==playing)run(e.isIntersecting)}),{threshold:.5}).observe(root);
})();
