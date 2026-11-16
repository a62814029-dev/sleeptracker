/* Sleep Tracker · core.js — состояние, хранилище, расчёты, действия.
   Ключ LocalStorage прежний ("sleeptracker.v1"), формат данных совместим. */
var KEY="sleeptracker.v1",VER="1.1.0",MIN=60000,HR=3600000;
var DEF_SET={anim:true,theme:"dark"};
var S={records:[],active:null,settings:Object.assign({},DEF_SET)};
var loadErr=false,saveErr=false,lostRecs=0;
var $=function(s){return document.querySelector(s)};
var tab="home",sub="cal",range="week",cm=new Date();cm.setDate(1);
var MON=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
var MONG=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
var WD=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],DAYS=["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
var p2=function(n){return(n<10?"0":"")+n};
function uid(){return"r"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function num(v){v=Number(v);return isFinite(v)?v:NaN}

/* ---- безопасная загрузка (старые данные не теряются) ---- */
function normPauses(pp,closeAt){
var o=[];(Array.isArray(pp)?pp:[]).forEach(function(p){if(!p||typeof p!=="object")return;var s=num(p.s);if(!(s>0))return;var e=p.e==null?null:num(p.e);if(e!==null&&!isFinite(e))e=null;o.push({s:s,e:e})});
o.sort(function(a,b){return a.s-b.s});
o.forEach(function(p,i){if(p.e===null){if(i<o.length-1)p.e=o[i+1].s;else if(closeAt!=null)p.e=closeAt}if(p.e!==null&&p.e<p.s)p.e=p.s});
return o}
function normRec(r){if(!r||typeof r!=="object")return null;var s=num(r.start),e=num(r.end);if(!(s>0)||!(e>0)||e<=s)return null;
return Object.assign({},r,{id:r.id!=null?String(r.id):uid(),start:s,end:e,pauses:normPauses(r.pauses,e)})}
function normActive(a){if(!a||typeof a!=="object")return null;var s=num(a.start);if(!(s>0))return null;var n=Date.now();if(s>n)s=n;
return Object.assign({},a,{start:s,pauses:normPauses(a.pauses,null)})}
function loadState(first){
var st={records:[],active:null,settings:Object.assign({},DEF_SET)},raw=null;
try{raw=localStorage.getItem(KEY)}catch(e){}
if(!raw)return st;
if(first){try{if(localStorage.getItem(KEY+".backup")===null)localStorage.setItem(KEY+".backup",raw)}catch(e){}}
try{var j=JSON.parse(raw);
if(j&&typeof j==="object"){var seen={},src=Array.isArray(j.records)?j.records:[];
src.forEach(function(r){var n=normRec(r);if(!n)return;if(seen[n.id])n.id=uid();seen[n.id]=1;st.records.push(n)});
if(first)lostRecs=src.length-st.records.length;
st.active=normActive(j.active);
if(j.settings&&typeof j.settings==="object")st.settings=Object.assign(st.settings,j.settings);
if(st.settings.theme!=="light")st.settings.theme="dark";st.settings.anim=st.settings.anim!==false}
}catch(e){if(first)loadErr=true}
return st}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));saveErr=false;return true}catch(e){saveErr=true;return false}}
S=loadState(true);

/* ---- форматирование ---- */
function hm(t){var d=new Date(t);return p2(d.getHours())+":"+p2(d.getMinutes())}
function dkey(t){var d=new Date(t);return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())}
function fmt(ms){ms=Math.max(0,ms);var m=Math.round(ms/MIN);return Math.floor(m/60)+"ч "+p2(m%60)+"м"}
function ldt(t){var d=new Date(t);return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes())}
function dkRu(k){return k.split("-").reverse().join(".")}
function col(h){return h<6?"#ff4d6d":h<7?"#b6ff3b":h<8?"#3ddc84":h<9?"#12945a":h<10?"#c8d93a":h<11?"#ff9f3a":"#ff4d6d"}
/* первое наступление времени HH:MM не раньше ref (корректно переходит через полночь) */
function tsAfter(hhmm,ref){var m=/^(\d{1,2}):(\d{2})/.exec(hhmm||"");if(!m)return NaN;var d=new Date(ref),r=Math.floor(ref/MIN)*MIN;d.setHours(+m[1],+m[2],0,0);if(d.getTime()<r)d.setDate(d.getDate()+1);return d.getTime()}
function standalone(){return window.navigator.standalone===true||(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)}
var curDay=dkey(Date.now());
function dayChanged(){var k=dkey(Date.now());if(k!==curDay){curDay=k;return true}return false}

/* ---- паузы: границы обрезаются по [start,end], пересечения склеиваются ---- */
function pauseSum(pp,end,start){
var a=[];(pp||[]).forEach(function(p){var s=p.s,e=p.e==null?end:p.e;if(start!=null&&s<start)s=start;if(e>end)e=end;if(e>s)a.push([s,e])});
a.sort(function(x,y){return x[0]-y[0]});
var t=0,cs=null,ce=null;
a.forEach(function(x){if(cs===null){cs=x[0];ce=x[1]}else if(x[0]<=ce){if(x[1]>ce)ce=x[1]}else{t+=ce-cs;cs=x[0];ce=x[1]}});
if(cs!==null)t+=ce-cs;return t}
function dur(r){return Math.max(0,r.end-r.start-pauseSum(r.pauses,r.end,r.start))}
function pauseOf(r){return pauseSum(r.pauses,r.end,r.start)}
var IC={moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',pause:'<path d="M9 5v14M15 5v14"/>',play:'<path d="M7 4l12 8-12 8z"/>',home:'<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'};
function ic(n){return'<svg viewBox="0 0 24 24">'+IC[n]+'</svg>'}
/* день записи = день пробуждения (ночь 15→16 относится к 16-му) */
function byDay(){var m={};S.records.forEach(function(r){var k=dkey(r.end);m[k]=(m[k]||0)+dur(r)});return m}
function dayRecs(k){return S.records.filter(function(r){return dkey(r.end)===k}).sort(function(a,b){return a.end-b.end})}
function conflict(a,b,exceptId){
var c=S.records.filter(function(r){return r.id!==exceptId&&a<r.end&&b>r.start})[0];
if(c)return"Пересекается с записью за "+dkRu(dkey(c.end))+" ("+hm(c.start)+"–"+hm(c.end)+").";
if(S.active&&b>S.active.start)return"Пересекается с текущим сном (начат в "+hm(S.active.start)+").";
return""}

/* ---- действия ---- */
function start(){if(S.active)return;S.active={start:Date.now(),pauses:[]};save();render()}
function isPaused(){var a=S.active;return!!(a&&a.pauses.length&&a.pauses[a.pauses.length-1].e==null)}
function togglePause(){var a=S.active;if(!a)return;var n=Date.now();
if(isPaused()){var p=a.pauses[a.pauses.length-1];p.e=Math.max(n,p.s)}else a.pauses.push({s:Math.max(n,a.start),e:null});
save();render()}
function wake(){var a=S.active;if(!a)return;var n=Date.now();if(n<=a.start)n=a.start+1000;
if(isPaused()){var p=a.pauses[a.pauses.length-1];p.e=Math.max(n,p.s)}
S.records.push({id:uid(),start:a.start,end:n,pauses:normPauses(a.pauses,n)});S.active=null;save();render()}
/* время сна без пауз; открытая пауза считается до «сейчас», поэтому счётчик на паузе стоит */
function activeDur(){var a=S.active,n=Date.now();return Math.max(0,n-a.start-pauseSum(a.pauses,n,a.start))}

/* ---- импорт (данные Safari и установленного PWA хранятся раздельно) ---- */
function importData(txt){var j;try{j=JSON.parse(txt)}catch(e){return{err:"Не удалось прочитать JSON."}}
var arr=Array.isArray(j)?j:(j&&Array.isArray(j.records)?j.records:null);if(!arr)return{err:"В данных нет списка records."};
var add=0,skip=0;
arr.forEach(function(r){var n=normRec(r);if(!n){skip++;return}
if(S.records.some(function(x){return x.id===n.id||(x.start===n.start&&x.end===n.end)})){skip++;return}
S.records.push(n);add++});
if(add)save();return{added:add,skipped:skip}}
