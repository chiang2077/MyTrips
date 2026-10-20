// 每日天氣：開頁時向 Open-Meteo 抓當地預報（最多 16 天），存一份在手機裡，離線時顯示上次抓到的資料
(function(){
const SPOTS={
 takeo:{name:'武雄',lat:33.196,lon:130.020,jma:'410000'},
 arita:{name:'有田',lat:33.190,lon:129.885,jma:'410000'},
 nagasaki:{name:'長崎',lat:32.745,lon:129.874,jma:'420000'},
 htb:{name:'豪斯登堡',lat:33.085,lon:129.788,jma:'420000'},
 fukuoka:{name:'福岡',lat:33.590,lon:130.401,jma:'400000'}
};
// 行程日期 → 白天主要待的地方
const BY_DATE={'10.24':'takeo','10.25':'arita','10.26':'nagasaki','10.27':'nagasaki','10.28':'htb','10.29':'htb','10.30':'htb','10.31':'fukuoka','11.01':'fukuoka','11.02':'fukuoka'};
const KEY='kyushu-2026-weather-v1',MAX_AGE=60*60*1000;
const keys=Object.keys(SPOTS);
let store=null,failed=false;
try{store=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}

// WMO 天氣代碼
function describe(c){
 if(c===0)return['☀️','晴'];
 if(c===1)return['🌤️','大致晴朗'];
 if(c===2)return['⛅','晴時多雲'];
 if(c===3)return['☁️','陰'];
 if(c===45||c===48)return['🌫️','有霧'];
 if(c>=51&&c<=57)return['🌦️','毛毛雨'];
 if(c===61)return['🌧️','小雨'];
 if(c===63||c===66)return['🌧️','雨'];
 if(c===65||c===67)return['🌧️','大雨'];
 if(c>=71&&c<=77)return['🌨️','雪'];
 if(c===80)return['🌦️','短暫陣雨'];
 if(c===81)return['🌧️','陣雨'];
 if(c===82)return['⛈️','強陣雨'];
 if(c===85||c===86)return['🌨️','陣雪'];
 if(c>=95)return['⛈️','雷雨'];
 return['🌡️','—'];
}
const pad=n=>String(n).padStart(2,'0');
const stamp=t=>{const d=new Date(t);return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const jmaLink=code=>`https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=${code}`;

function html(date){
 const k=BY_DATE[date];if(!k)return '';
 const s=SPOTS[k],iso='2026-'+date.replace('.','-');
 const link=`<a href="${jmaLink(s.jma)}" target="_blank" rel="noopener noreferrer">氣象廳預報 ↗</a>`;
 const day=store&&store.data&&store.data[k]&&store.data[k][iso];
 if(!day){
  const msg=store?'這天還在預報範圍外（約出發前 16 天才有）':(navigator.onLine===false?'目前離線，連網後會自動抓預報':failed?'暫時抓不到預報，請看氣象廳':'正在抓天氣預報…');
  return `<div class="day-wx empty"><span class="wx-place">${s.name}天氣</span><span class="wx-msg">${msg}</span><span class="wx-src">${link}</span></div>`;
 }
 const [icon,text]=describe(day.c);
 const rain=day.p==null?'':`<span class="wx-rain">降雨 ${day.p}%</span>`;
 const wind=day.w!=null&&day.w>=10?`<span class="wx-wind">陣風 ${Math.round(day.w)} m/s</span>`:'';
 return `<div class="day-wx"><span class="wx-place">${s.name}</span><span class="wx-icon" aria-hidden="true">${icon}</span><span class="wx-text">${text}</span><span class="wx-temp"><b>${Math.round(day.hi)}°</b> / ${Math.round(day.lo)}°C</span>${rain}${wind}<span class="wx-src">預報 ${stamp(store.t)} 更新・Open-Meteo｜${link}</span></div>`;
}

async function refresh(){
 if(store&&Date.now()-store.t<MAX_AGE)return;
 const q=new URLSearchParams({
  latitude:keys.map(k=>SPOTS[k].lat).join(','),
  longitude:keys.map(k=>SPOTS[k].lon).join(','),
  daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max',
  wind_speed_unit:'ms',timezone:'Asia/Tokyo',forecast_days:'16'
 });
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);
 try{
  const r=await fetch('https://api.open-meteo.com/v1/forecast?'+q,{signal:ctl.signal});
  if(!r.ok)throw new Error(r.status);
  let j=await r.json();if(!Array.isArray(j))j=[j];
  const data={};
  keys.forEach((k,i)=>{
   const d=j[i]&&j[i].daily;if(!d)return;
   data[k]={};
   d.time.forEach((t,n)=>{
    if(d.temperature_2m_max[n]==null)return;
    data[k][t]={c:d.weather_code[n],hi:d.temperature_2m_max[n],lo:d.temperature_2m_min[n],p:d.precipitation_probability_max?d.precipitation_probability_max[n]:null,w:d.wind_gusts_10m_max?d.wind_gusts_10m_max[n]:null};
   });
  });
  store={t:Date.now(),data};
  try{localStorage.setItem(KEY,JSON.stringify(store));}catch{}
 }catch{
  failed=true;
 }finally{
  clearTimeout(timer);
  document.dispatchEvent(new Event('trip-weather'));
 }
}

window.tripWeather={html};
refresh();
addEventListener('online',()=>refresh());
})();
