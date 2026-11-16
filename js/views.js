/* Sleep Tracker · views.js — интерфейс, события, service worker.
   Использует глобалы из core.js (S, save, dur, byDay, conflict, importData, ...). */
var GOAL=8*HR,CIRC=2*Math.PI*46,ed=null;

/* ---- утилиты ---- */
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
function fmtS(ms){var s=Math.floor(Math.max(0,ms)/1000);return Math.floor(s/3600)+":"+p2(Math.floor(s/60)%60)+":"+p2(s%60)}
function sod(t){var d=new Date(t);return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function addD(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)}
function parseKey(k){var p=k.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function applySettings(){var st=S.settings;
document.documentElement.setAttribute("data-theme",st.theme);
document.body.classList.toggle("anim",st.anim!==false);
var m=$("#theme-meta");if(m)m.setAttribute("content",st.theme==="light"?"#f3effa":"#07050f")}

/* ---- баннеры ошибок хранилища ---- */
function banners(){var h="";
if(saveErr)h+='<div class="warn">Не удалось сохранить данные: хранилище недоступно или переполнено. Последние изменения есть только в памяти — сделайте экспорт в «Профиле».</div>';
if(loadErr)h+='<div class="warn">Сохранённые данные не удалось прочитать. Исходный текст сохранён в LocalStorage под ключом «'+KEY+'.backup». <b data-a="hide" style="text-decoration:underline">Скрыть</b></div>';
if(lostRecs>0)h+='<div class="warn">Повреждённых записей пропущено: '+lostRecs+'. Копия исходных данных лежит в «'+KEY+'.backup». <b data-a="hide" style="text-decoration:underline">Скрыть</b></div>';
return h}

/* ---- главная ---- */
function lastRec(){var l=null;S.records.forEach(function(r){if(!l||r.end>l.end)l=r});return l}
function avg7(){var bd=byDay(),t=sod(Date.now()),sum=0,n=0;
for(var i=0;i<7;i++){var k=dkey(addD(t,-i).getTime());if(bd[k]){sum+=bd[k];n++}}return n?sum/n:0}
function vHome(){
var a=S.active,n=Date.now(),d=new Date(n),val,big,capt,prog,stroke,chips,ctl;
if(a){val=activeDur();big=fmtS(val);capt=isPaused()?"Пауза":"Сон идёт";prog=val/GOAL;stroke=isPaused()?"var(--cy)":"var(--ac)";
chips='<div class="chip">'+ic("moon")+'Уснул в '+hm(a.start)+'</div><div class="chip">'+ic("pause")+'<span id="rc">'+fmt(pauseSum(a.pauses,n,a.start))+'</span></div>';
var pz=isPaused();
ctl='<button class="pause'+(pz?' on':'')+'" data-a="pause">'+ic(pz?"play":"pause")+(pz?"Далее":"Пауза")+'</button><button class="main-btn wake" data-a="wake">'+ic("sun")+'Проснулся</button>'}
else{var lr=lastRec();val=lr?dur(lr):0;big=fmt(val);capt=lr?"последний сон":"пока нет записей";prog=val/GOAL;stroke=col(val/HR);
chips='<div class="chip">'+ic("moon")+'Цель: 8ч 00м</div>';
ctl='<button class="main-btn" data-a="start">'+ic("moon")+'Уснул</button>'}
var off=CIRC*(1-Math.min(1,Math.max(0,prog))),lr2=lastRec(),av=avg7();
return'<section><h1>'+(a?'Спокойной ночи':'Сон')+'</h1><div class="mu">'+cap(DAYS[d.getDay()])+', '+d.getDate()+' '+MONG[d.getMonth()]+'</div>'
+'<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--card2)" stroke-width="7"/>'
+'<circle id="rp" cx="50" cy="50" r="46" fill="none" stroke="'+stroke+'" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+CIRC+'" stroke-dashoffset="'+off+'"/></svg>'
+'<div class="c"><div class="big" id="rt">'+big+'</div><div class="mu" id="rs">'+capt+'</div></div></div>'
+'<div class="chips">'+chips+'</div><div class="ctl">'+ctl+'</div>'
+'<div class="grid" style="margin-top:22px"><div class="stat"><span>Прошлый сон</span><b>'+(lr2?fmt(dur(lr2)):'—')+'</b></div>'
+'<div class="stat"><span>Среднее за 7 дней</span><b>'+(av?fmt(av):'—')+'</b></div></div></section>'}

/* обновление кольца раз в секунду без перерисовки страницы */
function tick(){
if(dayChanged()){render();return}
if(!S.active||tab!=="home")return;
var v=activeDur(),n=Date.now(),t=$("#rt"),p=$("#rp"),c=$("#rc");
if(t)t.textContent=fmtS(v);
if(p)p.setAttribute("stroke-dashoffset",CIRC*(1-Math.min(1,v/GOAL)));
if(c)c.textContent=fmt(pauseSum(S.active.pauses,n,S.active.start))}

/* ---- календарь и список ---- */
function vCal(){
var h='<section><h1>Дни</h1><div class="seg"><button data-a="sub" data-v="cal"'+(sub==="cal"?' class="on"':'')+'>Календарь</button><button data-a="sub" data-v="list"'+(sub==="list"?' class="on"':'')+'>Список</button></div>';
if(sub==="list")return h+vList()+'</section>';
var y=cm.getFullYear(),m=cm.getMonth(),bd=byDay(),today=dkey(Date.now()),dim=new Date(y,m+1,0).getDate(),off=(new Date(y,m,1).getDay()+6)%7;
h+='<div class="cal-head"><button data-a="pm">‹</button><b>'+MON[m]+' '+y+'</b><button data-a="nm">›</button></div><div class="cal">';
WD.forEach(function(w){h+='<div class="wd">'+w+'</div>'});
for(var i=0;i<off;i++)h+='<div></div>';
for(var d=1;d<=dim;d++){
var k=y+"-"+p2(m+1)+"-"+p2(d),ms=bd[k],c=ms?col(ms/HR):"",cls="day"+(ms?" d":" e")+(k>today?" f":"")+(k===today?" t":"");
h+='<button class="'+cls+'" data-a="day" data-k="'+k+'"><i'+(ms?' style="background:'+c+';color:'+c+'"':'')+'><span style="'+(ms?'color:#0b0813':'')+'">'+d+'</span></i></button>'}
h+='</div><div class="legend">';
[["<6ч",5],["6–7",6.5],["7–8",7.5],["8–9",8.5],["9–10",9.5],["10–11",10.5],["11+",12]].forEach(function(x){h+='<span><u style="background:'+col(x[1])+'"></u>'+x[0]+'</span>'});
h+='</div><button class="btn pri" data-a="add" data-k="'+today+'" style="margin-top:18px">+ Добавить запись</button></section>';
return h}
function vList(){
var rs=S.records.slice().sort(function(a,b){return b.end-a.end}),h='<button class="btn pri" data-a="add" data-k="'+dkey(Date.now())+'" style="margin-top:0">+ Добавить запись</button><div class="card" style="margin-top:12px">';
if(!rs.length)return h+'<div class="empty">Записей пока нет</div></div>';
rs.forEach(function(r){h+=recRow(r,true)});
return h+'</div>'}
function recRow(r,withDate){
var pz=pauseOf(r);
return'<button class="row" data-a="edit" data-id="'+esc(r.id)+'"><span class="dot" style="background:'+col(dur(r)/HR)+'"></span><span class="g"><b>'+fmt(dur(r))+'</b><div class="mu">'+(withDate?dkRu(dkey(r.end))+' · ':'')+hm(r.start)+'–'+hm(r.end)+'</div></span>'+(pz>0?'<span class="pill">пауза '+fmt(pz)+'</span>':'')+'</button>'}

/* ---- шторка ---- */
function sheetOpen(h){$("#sp").innerHTML=h;$("#sheet").classList.add("on")}
function sheetClose(){$("#sheet").classList.remove("on");$("#sp").innerHTML="";ed=null}
function openDay(k){
var d=parseKey(k),rs=dayRecs(k),h='<h2>'+d.getDate()+' '+MONG[d.getMonth()]+', '+DAYS[d.getDay()]+'</h2>';
if(rs.length){h+='<div>';rs.forEach(function(r){h+=recRow(r,false)});h+='</div>'}
else h+='<div class="empty">В этот день записей нет</div>';
h+='<button class="btn pri" data-a="add" data-k="'+k+'">+ Добавить запись</button><button class="btn" data-a="close">Закрыть</button>';
sheetOpen(h)}

/* ---- форма записи с редактором пауз ---- */
function pv(id){var el=$("#"+id),v=el?el.value:"",t=v?new Date(v).getTime():NaN;return isFinite(t)?t:null}
function openRec(id,k){
var r=id?S.records.filter(function(x){return x.id===id})[0]:null,s,e,pp=[];
if(id&&!r)return;
if(r){s=r.start;e=r.end;pp=r.pauses.map(function(p){return{s:p.s,e:p.e==null?r.end:p.e}})}
else{var n=Date.now(),p=parseKey(k||dkey(n));e=new Date(p.getFullYear(),p.getMonth(),p.getDate(),7,0).getTime();if(e>n)e=Math.floor(n/MIN)*MIN;s=e-8*HR}
ed={id:r?r.id:null,ep:pp};
sheetOpen('<h2>'+(r?'Запись сна':'Новая запись')+'</h2>'
+'<label>Уснул</label><input type="datetime-local" id="fs" value="'+ldt(s)+'">'
+'<label>Проснулся</label><input type="datetime-local" id="fe" value="'+ldt(e)+'">'
+'<label>Паузы</label><div id="pl"></div>'
+'<button class="btn" data-a="addp">+ Пауза</button>'
+'<div class="warn" id="fw" style="display:none"></div>'
+'<button class="btn pri" data-a="saverec">Сохранить</button>'
+(r?'<button class="btn red" data-a="delrec">Удалить запись</button>':'')
+'<button class="btn" data-a="close">Отмена</button>');
pauseRows()}
/* паузы никогда не удаляются молча: вне границ они просто не учитываются */
function pauseRows(){
if(!ed)return;
var a=pv("fs"),b=pv("fe"),h="";
ed.ep.forEach(function(p,i){
h+='<div class="prow"><input type="time" data-w="s" data-i="'+i+'" value="'+hm(p.s)+'"><span>–</span><input type="time" data-w="e" data-i="'+i+'" value="'+hm(p.e)+'"><button class="icon-btn" data-a="delp" data-i="'+i+'">×</button></div>';
if(a!==null&&b!==null){
if(p.e<=a||p.s>=b)h+='<div class="hint">Пауза вне границ записи: не учитывается, но и не удалена.</div>';
else if(p.s<a||p.e>b)h+='<div class="hint">Часть паузы выходит за границы записи: учитывается только пересечение.</div>'}});
if(!ed.ep.length)h='<div class="hint">Пауз нет.</div>';
$("#pl").innerHTML=h}
function formErr(t){var w=$("#fw");if(!w)return;w.textContent=t;w.style.display=t?"block":"none"}
function saveRec(){
var a=pv("fs"),b=pv("fe"),n=Date.now();
if(a===null||b===null)return formErr("Укажите время засыпания и пробуждения.");
if(b<=a)return formErr("Пробуждение должно быть позже засыпания.");
if(b-a>36*HR)return formErr("Запись длиннее 36 часов — проверьте даты.");
if(b>n+MIN)return formErr("Пробуждение не может быть в будущем.");
for(var i=0;i<ed.ep.length;i++)if(!(ed.ep[i].e>ed.ep[i].s))return formErr("В паузе №"+(i+1)+" конец должен быть позже начала.");
var cf=conflict(a,b,ed.id);if(cf)return formErr(cf);
var pauses=normPauses(ed.ep.map(function(p){return{s:p.s,e:p.e}}),b);
if(ed.id){var r=S.records.filter(function(x){return x.id===ed.id})[0];
if(!r)return formErr("Эта запись была изменена в другом окне. Закройте форму и откройте её снова.");
r.start=a;r.end=b;r.pauses=pauses}
else S.records.push({id:uid(),start:a,end:b,pauses:pauses});
save();sheetClose();render()}
function onChange(e){
var t=e.target;if(!ed)return;
if(t.id==="fs"||t.id==="fe"){formErr("");pauseRows();return}
if(!t.dataset||!t.dataset.w||!t.value)return;
var i=+t.dataset.i,p=ed.ep[i];if(!p)return;
if(t.dataset.w==="s"){var ns=tsAfter(t.value,pv("fs")||p.s);
if(isFinite(ns)){p.s=ns;if(p.e<p.s)p.e=tsAfter(hm(p.e),p.s)}}
else{var ne=tsAfter(t.value,p.s);if(isFinite(ne))p.e=ne}
formErr("");pauseRows()}
function addPause(){
if(!ed)return;
var a=pv("fs"),b=pv("fe"),s,e;
if(a!==null&&b!==null&&b>a){s=Math.floor((a+(b-a)/2)/MIN)*MIN;e=Math.min(s+10*MIN,b)}
else{s=Math.floor(Date.now()/MIN)*MIN;e=s+10*MIN}
ed.ep.push({s:s,e:e});formErr("");pauseRows()}

/* ---- статистика ---- */
function series(){
var bd=byDay(),keys=Object.keys(bd).sort(),today=sod(Date.now()),n,i,days=[];
if(!keys.length)return{bars:[],vals:[],kind:"d"};
if(range==="week")n=7;else if(range==="month")n=30;
else{n=Math.max(1,Math.round((today-parseKey(keys[0]))/864e5)+1)}
for(i=n-1;i>=0;i--){var d=addD(today,-i),k=dkey(d.getTime());days.push({d:d,k:k,ms:bd[k]||0,has:!!bd[k]})}
var vals=days.filter(function(x){return x.has}).map(function(x){return x.ms});
var kind=(range!=="all"||n<=31)?"d":(n<=182?"w":"m"),bars=[];
if(kind==="d"){
days.forEach(function(x){bars.push({l:range==="week"?WD[(x.d.getDay()+6)%7]:String(x.d.getDate()),v:x.ms,has:x.has})})}
else{var g={},ord=[];
days.forEach(function(x){
var key,lab;
if(kind==="w"){var ws=addD(x.d,-((x.d.getDay()+6)%7));key=dkey(ws.getTime());lab=p2(ws.getDate())+"."+p2(ws.getMonth()+1)}
else{key=x.d.getFullYear()+"-"+x.d.getMonth();lab=MON[x.d.getMonth()].slice(0,3)}
if(!g[key]){g[key]={l:lab,s:0,c:0};ord.push(key)}
if(x.has){g[key].s+=x.ms;g[key].c++}});
ord.forEach(function(k){var o=g[k];bars.push({l:o.l,v:o.c?o.s/o.c:0,has:o.c>0})})}
return{bars:bars,vals:vals,kind:kind}}
function vStats(){
var h='<section><h1>Статистика</h1><div class="seg">';
[["week","Неделя"],["month","Месяц"],["all","Всё время"]].forEach(function(x){h+='<button data-a="rng" data-v="'+x[0]+'"'+(range===x[0]?' class="on"':'')+'>'+x[1]+'</button>'});
h+='</div>';
var s=series();
if(!s.vals.length)return h+'<div class="card"><div class="empty">Нет данных за выбранный период</div></div></section>';
var sum=0,mx=0,mn=Infinity;
s.vals.forEach(function(v){sum+=v;if(v>mx)mx=v;if(v<mn)mn=v});
h+='<div class="grid"><div class="stat"><span>В среднем</span><b>'+fmt(sum/s.vals.length)+'</b></div><div class="stat"><span>Ночей с данными</span><b>'+s.vals.length+'</b></div>'
+'<div class="stat"><span>Самый долгий</span><b>'+fmt(mx)+'</b></div><div class="stat"><span>Самый короткий</span><b>'+fmt(mn)+'</b></div></div>';
var maxv=Math.max(10*HR,mx),step=Math.ceil(s.bars.length/8);
h+='<div class="card"><h2>'+(s.kind==="d"?'По дням':s.kind==="w"?'По неделям':'По месяцам')+'</h2>'
+'<div style="position:relative;height:160px;display:flex;align-items:flex-end;gap:'+(s.bars.length>40?1:3)+'px">'
+'<div style="position:absolute;left:0;right:0;bottom:'+(GOAL/maxv*100)+'%;border-top:1px dashed var(--mu);opacity:.6;pointer-events:none"></div>';
s.bars.forEach(function(b){
h+='<div style="flex:1;min-width:0;height:'+(b.has?Math.max(2,b.v/maxv*100):0)+'%;background:'+(b.has?col(b.v/HR):'transparent')+';border-radius:'+(s.bars.length>40?1:5)+'px 5px 0 0"></div>'});
h+='</div><div style="display:flex;gap:'+(s.bars.length>40?1:3)+'px;margin-top:6px">';
s.bars.forEach(function(b,i){h+='<div style="flex:1;min-width:0;font-size:10px;color:var(--mu);text-align:center;white-space:nowrap;overflow:visible">'+(i%step===0?b.l:'')+'</div>'});
h+='</div><div class="hint" style="margin-top:10px">Пунктир — цель 8 часов.'+(s.kind==="d"?'':' Столбик — среднее за ночь в неделе/месяце (по дням с данными).')+' Ночь относится ко дню пробуждения.</div></div></section>';
return h}

/* ---- профиль, экспорт, импорт ---- */
function vMe(){
var st=S.settings,h='<section><h1>Профиль</h1><div class="card"><div class="sw" style="border-top:0"><span>Светлая тема</span><button class="tg'+(st.theme==="light"?' on':'')+'" data-a="tg" data-k="theme" aria-label="Светлая тема"></button></div>'
+'<div class="sw"><span>Анимации</span><button class="tg'+(st.anim?' on':'')+'" data-a="tg" data-k="anim" aria-label="Анимации"></button></div></div>'
+'<div class="card"><h2>Данные</h2><div class="hint">Записей: '+S.records.length+'. Данные хранятся только на этом устройстве, в этом браузере.</div>'
+'<button class="btn" data-a="exp">Экспорт (JSON)</button><button class="btn" data-a="imp">Импорт</button></div>';
if(!standalone())h+='<div class="card"><h2>Установка на iPhone</h2><div class="hint">Откройте сайт в Safari → «Поделиться» → «На экран “Домой”». Данные Safari и установленного приложения хранятся раздельно: перенесите их через экспорт и импорт.</div></div>';
return h+'<div class="mu" style="text-align:center;margin-top:8px">Sleep Tracker v'+VER+'</div></section>'}
function openExport(){
sheetOpen('<h2>Экспорт</h2><div class="hint">Скопируйте текст и сохраните его, например, в заметки. Его можно вставить в «Импорт» на другом устройстве.</div>'
+'<label>JSON</label><textarea id="ex" readonly></textarea><button class="btn pri" data-a="cp">Скопировать</button><button class="btn" data-a="close">Закрыть</button>');
$("#ex").value=JSON.stringify({version:VER,exported:Date.now(),records:S.records})}
function openImport(){
sheetOpen('<h2>Импорт</h2><div class="hint">Вставьте JSON из экспорта. Существующие записи не удаляются, дубликаты пропускаются.</div>'
+'<label>JSON</label><textarea id="imp"></textarea><div id="impr"></div><button class="btn pri" data-a="doimp">Импортировать</button><button class="btn" data-a="close">Закрыть</button>')}
function copyEx(btn){
var ta=$("#ex");if(!ta)return;
var ok=function(){btn.textContent="Скопировано"};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(ta.value).then(ok,function(){ta.select();try{document.execCommand("copy");ok()}catch(e){}})}
else{ta.focus();ta.select();try{document.execCommand("copy");ok()}catch(e){}}}

/* ---- отрисовка ---- */
function render(){
var m=$("#main"),sc=m.scrollTop,h=banners();
if(tab==="home")h+=vHome();else if(tab==="cal")h+=vCal();else if(tab==="stats")h+=vStats();else h+=vMe();
m.innerHTML=h;m.scrollTop=sc;
var nv="";
[["home","Главная","home"],["cal","Дни","cal"],["stats","Статистика","chart"],["me","Профиль","user"]].forEach(function(x){
nv+='<button data-a="tab" data-v="'+x[0]+'"'+(tab===x[0]?' class="on"':'')+'>'+ic(x[2])+x[1]+'</button>'});
$("#nav").innerHTML=nv}

/* ---- события ---- */
function onClick(e){
var t=e.target;
if(t.id==="sheet"){sheetClose();return}
t=t.closest?t.closest("[data-a]"):null;if(!t)return;
var a=t.dataset.a,v=t.dataset.v,k=t.dataset.k;
switch(a){
case"tab":tab=v;render();$("#main").scrollTop=0;break;
case"sub":sub=v;render();break;
case"rng":range=v;render();break;
case"pm":cm.setMonth(cm.getMonth()-1);render();break;
case"nm":cm.setMonth(cm.getMonth()+1);render();break;
case"day":openDay(k);break;
case"add":openRec(null,k);break;
case"edit":openRec(t.dataset.id);break;
case"close":sheetClose();break;
case"addp":addPause();break;
case"delp":if(ed){ed.ep.splice(+t.dataset.i,1);pauseRows()}break;
case"saverec":saveRec();break;
case"delrec":if(ed&&ed.id&&confirm("Удалить запись?")){var id=ed.id;S.records=S.records.filter(function(r){return r.id!==id});save();sheetClose();render()}break;
case"start":start();break;
case"pause":togglePause();break;
case"wake":wake();break;
case"tg":if(k==="theme")S.settings.theme=S.settings.theme==="light"?"dark":"light";else S.settings.anim=!S.settings.anim;save();applySettings();render();break;
case"exp":openExport();break;
case"imp":openImport();break;
case"cp":copyEx(t);break;
case"doimp":var res=importData($("#imp").value),box=$("#impr");
if(box)box.innerHTML=res.err?'<div class="warn">'+esc(res.err)+'</div>':'<div class="hint" style="margin-top:10px">Добавлено: '+res.added+', пропущено: '+res.skipped+'.</div>';
render();break;
case"hide":loadErr=false;lostRecs=0;render();break}}

/* синхронизация с другой вкладкой / возврат в приложение; без потери данных в памяти при ошибке записи */
function sync(){
if(saveErr)return;
var raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
if(raw)S=loadState(false);
dayChanged();applySettings();render()}

document.addEventListener("click",onClick);
document.addEventListener("change",onChange);
window.addEventListener("storage",function(e){if(e.key===KEY||e.key===null)sync()});
window.addEventListener("pageshow",function(e){if(e.persisted)sync()});
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")sync()});
setInterval(tick,1000);

applySettings();render();

/* ---- service worker ---- */
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){
window.addEventListener("load",function(){navigator.serviceWorker.register("service-worker.js").catch(function(){})})}
