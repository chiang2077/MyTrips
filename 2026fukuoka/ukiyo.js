/* 行程懶人包動畫：現代浮世繪風格，每天一幕，讀 journey.js 的 days／hotels。 */
(function(){
const C={sky:'#f2e6cf',indigo:'#1d3557',deep:'#12243a',wave:'#2f5d8a',foam:'#f7f1e3',sun:'#d9482b',gold:'#d9a441',pine:'#2e5e4e',ink:'#1b1b1b',plum:'#b5485d'};
const wave=(y,col,amp,dur,dx)=>`<g class="uk-drift" style="--d:${dur}s;--dx:${dx}px"><path fill="${col}" d="M-120 ${y} ${Array.from({length:12},(_,i)=>`q30 -${amp} 60 0 q20 ${amp*.6} 40 -${amp*.3}`).join(' ')} V360 H-120Z"/><path fill="none" stroke="${C.foam}" stroke-width="2" stroke-linecap="round" d="M-120 ${y} ${Array.from({length:12},()=>`q30 -${amp} 60 0 q20 ${amp*.6} 40 -${amp*.3}`).join(' ')}"/></g>`;
const bigWave=`<g class="uk-rise"><path fill="${C.wave}" d="M-10 360 C40 250 90 190 170 170 C230 155 270 185 255 215 C240 240 205 225 212 205 C150 215 120 280 140 360Z"/><path fill="${C.foam}" d="M170 170 c14 -8 34 -6 44 4 c-8 -2 -14 2 -12 8 c-6 -6 -14 -4 -16 4 c-4 -8 -12 -8 -16 -2Z"/></g>`;
const sun=(x,y,r,col=C.sun)=>`<circle class="uk-sun" cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;
const clouds=`<g class="uk-drift" style="--d:18s;--dx:40px" fill="none" stroke="${C.gold}" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M40 70 h80 m-60 12 h110"/><path d="M430 50 h90 m-40 12 h70"/></g>`;
const mountains=`<path fill="${C.pine}" opacity=".85" d="M0 250 L90 170 L150 215 L230 140 L330 230 L420 175 L520 240 L640 190 V360 H0Z"/>`;
const ground=col=>`<rect y="270" width="640" height="90" fill="${col}"/>`;
const train=(y,col=C.ink,acc=C.gold)=>`<g class="uk-train"><rect x="0" y="${y}" width="150" height="34" rx="14" fill="${col}"/><rect x="152" y="${y}" width="120" height="34" rx="4" fill="${col}"/><g fill="${acc}">${[18,48,78,108,170,200,230].map(x=>`<rect x="${x}" y="${y+8}" width="20" height="10" rx="2"/>`).join('')}</g><rect x="0" y="${y+34}" width="272" height="3" fill="${acc}"/></g><rect y="${y+40}" width="640" height="3" fill="${C.ink}"/>`;
const plane=(dir)=>`<g class="uk-plane ${dir}"><path fill="${C.foam}" stroke="${C.ink}" stroke-width="2" d="M0 12 L70 8 L90 0 L96 2 L86 10 L110 10 Q118 12 110 14 L86 14 L96 22 L90 24 L70 16 L0 14Z"/></g>`;
const steam=(x,y)=>`<g fill="none" stroke="${C.foam}" stroke-width="4" stroke-linecap="round" opacity=".9">${[0,22,44].map((o,i)=>`<path class="uk-steam" style="--s:${i*.6}s" d="M${x+o} ${y} c-10 -14 10 -22 0 -36 c-10 -14 10 -22 0 -36"/>`).join('')}</g>`;
const romon=`<g transform="translate(410 150)"><rect x="10" y="40" width="140" height="80" fill="${C.sun}"/><path fill="${C.ink}" d="M-10 44 L80 8 L170 44Z M20 18 L80 -10 L140 18Z"/><rect x="60" y="70" width="40" height="50" fill="${C.deep}"/></g>`;
const torii=`<g transform="translate(400 130)" fill="${C.foam}" stroke="${C.ink}" stroke-width="3"><path d="M-10 10 Q80 -6 170 10 L166 24 Q80 10 -6 24Z"/><rect x="10" y="40" width="140" height="10"/><rect x="25" y="24" width="14" height="120"/><rect x="121" y="24" width="14" height="120"/></g>`;
const vase=(x,y)=>`<g transform="translate(${x} ${y})"><path fill="${C.foam}" stroke="${C.ink}" stroke-width="3" d="M20 0 h30 v10 q30 20 25 60 q-5 30 -40 30 q-35 0 -40 -30 q-5 -40 25 -60Z"/><path fill="none" stroke="${C.wave}" stroke-width="4" d="M8 50 q12 -10 24 0 t24 0 t24 0"/><circle cx="35" cy="75" r="6" fill="${C.sun}"/></g>`;
const island=`<g class="uk-rise"><path fill="${C.deep}" d="M250 262 L270 200 L300 205 L305 180 L340 182 L345 160 L380 165 L390 200 L420 205 L440 262Z"/><g fill="${C.gold}">${[280,310,350,380,410].map(x=>`<rect x="${x}" y="215" width="8" height="8"/>`).join('')}</g></g>`;
const boat=`<g class="uk-boat"><path fill="${C.foam}" stroke="${C.ink}" stroke-width="2" d="M0 0 h80 l-12 16 h-58Z"/><rect x="24" y="-12" width="30" height="12" fill="${C.sun}"/></g>`;
const windmill=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path fill="${C.foam}" stroke="${C.ink}" stroke-width="3" d="M-22 120 L-14 20 L14 20 L22 120Z"/><path fill="${C.sun}" d="M-18 20 L0 0 L18 20Z"/><g class="uk-spin" style="transform-origin:0 18px"><g fill="${C.gold}" stroke="${C.ink}" stroke-width="2">${[0,90,180,270].map(r=>`<rect x="-6" y="-42" width="12" height="60" transform="rotate(${r} 0 18)"/>`).join('')}</g></g></g>`;
const tulips=`<g>${Array.from({length:22},(_,i)=>`<g transform="translate(${10+i*29} ${300+(i%2)*14})"><rect x="3" y="0" width="3" height="26" fill="${C.pine}"/><path fill="${[C.sun,C.gold,C.plum][i%3]}" d="M-4 2 q0 -16 8 -16 q8 0 8 16Z"/></g>`).join('')}</g>`;
const fireworks=`<g fill="none" stroke-width="3" stroke-linecap="round">${[[120,80,C.gold],[500,70,C.plum],[320,50,C.foam]].map(([x,y,c],i)=>`<g class="uk-burst" style="--s:${i*.7}s;transform-origin:${x}px ${y}px" stroke="${c}">${Array.from({length:10},(_,k)=>{const a=k*Math.PI/5;return `<path d="M${x+Math.cos(a)*10} ${y+Math.sin(a)*10} L${x+Math.cos(a)*34} ${y+Math.sin(a)*34}"/>`}).join('')}</g>`).join('')}</g>`;
const rabbit=`<g transform="translate(470 175)"><ellipse cx="40" cy="70" rx="42" ry="38" fill="${C.foam}" stroke="${C.ink}" stroke-width="3"/><ellipse cx="22" cy="18" rx="10" ry="30" fill="${C.foam}" stroke="${C.ink}" stroke-width="3"/><ellipse cx="58" cy="18" rx="10" ry="30" fill="${C.foam}" stroke="${C.ink}" stroke-width="3"/><circle cx="28" cy="66" r="3" fill="${C.ink}"/><circle cx="52" cy="66" r="3" fill="${C.ink}"/></g>`;
const lanterns=`<g class="uk-sway">${Array.from({length:8},(_,i)=>`<g transform="translate(${30+i*80} ${40+(i%2)*14})"><line x1="20" y1="-40" x2="20" y2="0" stroke="${C.ink}" stroke-width="2"/><ellipse cx="20" cy="22" rx="18" ry="24" fill="${i%2?C.sun:C.gold}" stroke="${C.ink}" stroke-width="2"/><rect x="10" y="-2" width="20" height="5" fill="${C.ink}"/></g>`).join('')}<path d="M0 36 Q320 70 640 36" fill="none" stroke="${C.ink}" stroke-width="2"/></g>`;
const city=`<g fill="${C.deep}">${[[20,150,60],[90,110,50],[150,170,70],[230,90,40],[280,140,80],[370,120,50],[430,160,70],[510,100,55],[575,150,60]].map(([x,h,w])=>`<rect x="${x}" y="${270-h}" width="${w}" height="${h}"/>`).join('')}</g><g fill="${C.gold}" opacity=".9">${Array.from({length:40},(_,i)=>`<rect class="uk-win" style="--s:${(i%7)*.3}s" x="${30+(i*53)%600}" y="${140+(i*37)%110}" width="6" height="8"/>`).join('')}</g>`;
const bags=`<g transform="translate(250 230)">${[[0,C.sun],[46,C.gold],[92,C.plum]].map(([x,c])=>`<g transform="translate(${x} 0)"><rect y="14" width="40" height="44" fill="${c}" stroke="${C.ink}" stroke-width="3"/><path d="M10 14 q10 -20 20 0" fill="none" stroke="${C.ink}" stroke-width="3"/></g>`).join('')}</g>`;
const sea=wave(262,C.wave,14,6,-60)+wave(290,C.indigo,10,4,50);
const scenes=[
 ()=>sun(520,90,48)+clouds+mountains+plane('in')+ground(C.indigo)+steam(560,250),
 ()=>sun(120,80,40,C.gold)+clouds+mountains+romon+ground(C.pine)+vase(120,190)+steam(460,150),
 ()=>sun(540,80,44)+clouds+sea+train(210,C.ink,C.gold),
 ()=>sun(110,90,40)+clouds+island+`<g transform="translate(0 250)">${boat}</g>`+sea,
 ()=>sun(520,80,40,C.gold)+clouds+ground('#6f8f5f')+windmill(480,150)+train(230,C.sun,C.foam),
 ()=>`<rect width="640" height="360" fill="${C.deep}"/>`+fireworks+ground(C.pine)+windmill(160,150,.9)+windmill(470,160,.7)+tulips,
 ()=>sun(110,80,36,C.plum)+clouds+ground('#6f8f5f')+windmill(250,150,.9)+rabbit+tulips,
 ()=>`<rect width="640" height="360" fill="${C.deep}"/>`+lanterns+sun(540,150,30,C.gold)+wave(290,C.indigo,10,5,50),
 ()=>sun(540,70,36)+clouds+city+ground(C.indigo)+bags,
 ()=>sun(120,90,50)+clouds+sea+plane('out')
];
if(typeof days==="undefined")return;
const root=document.getElementById('ukiyo-film');if(!root||!days.length)return;
root.innerHTML=`<div class="uk-head"><p class="eyebrow">懶人包動畫</p><h3>十天，一幅浮世繪。</h3></div><div class="uk-stage"><svg viewBox="0 0 640 360" role="img" aria-labelledby="uk-cap" preserveAspectRatio="xMidYMid slice"><defs><pattern id="uk-grain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#00000014"/></pattern></defs><g id="uk-scene"></g><rect width="640" height="360" fill="url(#uk-grain)"/></svg><div class="uk-card" id="uk-cap" aria-live="polite"></div><div class="uk-seal" id="uk-seal"></div></div><div class="uk-bar"><button type="button" id="uk-prev" aria-label="上一幕">←</button><button type="button" id="uk-play"></button><button type="button" id="uk-next" aria-label="下一幕">→</button><div class="uk-dots">${days.map((d,i)=>`<button type="button" data-uk="${i}" aria-label="${d.date} ${d.city}"></button>`).join('')}</div></div>`;
let i=0,timer=null;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene=root.querySelector('#uk-scene'),cap=root.querySelector('#uk-cap'),seal=root.querySelector('#uk-seal'),play=root.querySelector('#uk-play');
function show(n){i=(n+days.length)%days.length;const d=days[i];scene.innerHTML=`<rect width="640" height="360" fill="${C.sky}"/>`+scenes[i%scenes.length]();scene.classList.remove('uk-in');void scene.getBoundingClientRect();scene.classList.add('uk-in');
 cap.innerHTML=`<small>${d.date}（${d.week}）・${d.city}</small><strong>${d.title}</strong><span>${d.route}</span>`;cap.classList.remove('uk-in');void cap.offsetWidth;cap.classList.add('uk-in');
 seal.textContent=String(i+1).padStart(2,'0');root.querySelectorAll('[data-uk]').forEach((b,k)=>b.setAttribute('aria-current',k===i?'true':'false'));}
function run(on){clearInterval(timer);timer=on?setInterval(()=>show(i+1),4200):null;play.textContent=on?'❚❚ 暫停':'▶ 播放';play.setAttribute('aria-pressed',String(on));}
root.querySelector('#uk-prev').onclick=()=>{run(false);show(i-1)};root.querySelector('#uk-next').onclick=()=>{run(false);show(i+1)};
play.onclick=()=>run(!timer);root.querySelector('.uk-dots').onclick=e=>{const b=e.target.closest('[data-uk]');if(b){run(false);show(Number(b.dataset.uk))}};
show(0);
if(reduce){run(false);return;}
// 只在看得到時播放，省電也不打擾。
if('IntersectionObserver' in window){new IntersectionObserver(es=>es.forEach(e=>run(e.isIntersecting))).observe(root);}else run(true);
})();
