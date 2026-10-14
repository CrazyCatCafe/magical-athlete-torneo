/* Magical Outlet — app (telefono giocatore + tablet banco) */
var S=null,GAME=null,PLAYERS={},BONUS={},BE=null,UNSUB=[],ME=null;
var TAB="live",msg="",confirmReset=false,SYNC=false,FAV={},SEEN={},POP={},AC=null,prevTurn=null,SND="random",BUSY=false;
var PC=["#ff7a59","#7fb2ff","#6fe0a3","#ffe14d","#ff9fd2","#c4a7ff","#ffb86b","#9ee7f0"];
var TC={S:"#ff7a59",A:"#ffe14d",B:"#7fb2ff",C:"#6fe0a3",D:"#ff9fd2"};
var STAR='<svg viewBox="0 0 24 24" fill="none" stroke="#14121f" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
var CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ";

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function lsGet(k,d){try{var v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function idGet(k,d){try{var st=(BE&&BE.local)?sessionStorage:localStorage;var v=st.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function idSet(k,v){try{var st=(BE&&BE.local)?sessionStorage:localStorage;if(v===null)st.removeItem(k);else st.setItem(k,JSON.stringify(v));}catch(e){}}
function lsSet(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function tierOf(n){for(var i=0;i<S.roster.length;i++)if(S.roster[i].n===n)return S.roster[i].t;return "";}
function pcol(i){return PC[i%PC.length];}
function ini(names,i){var f=names.map(function(n){return (n||"?").charAt(0).toUpperCase();});var c=f[i];return f.filter(function(x){return x===c;}).length>1?String(i+1):c;}
function dotN(names,i){return '<span class="dot" style="background:'+pcol(i)+'" aria-hidden="true">'+esc(ini(names,i))+'</span>';}
function dot(i){return dotN(S.names,i);}

/* ---------------- state ----------------
 Regole Magical Outlet:
 - 6 gare in 2 megaround da 3.
 - Megaround 1: draft a passaggio (4 carte a testa, scegli 1 e passa il resto al giocatore successivo).
 - Gara 1 e 4: carta casuale dalla propria mano. Gare 2,3,5,6: si sceglie dalla mano, in ordine dal più punti
   (pareggio: livello della carta usata nella gara precedente, dal più alto; poi a caso).
 - Megaround 2: si rimischiano tutte le carte tranne quelle tenute; 3 giri: si rivelano 6 carte e si sceglie
   una a testa dal meno punti (pareggio a caso).
 - Alla fine la carta rimasta dà punti: S/A 2, B/C 1, D 0 (senza livello: 1).
*/
var RACES=6;
var TRANK={S:5,A:4,B:3,C:2,D:1};
function trank(n){return TRANK[tierOf(n)]||0;}
function tierBonus(n){var t=tierOf(n);return (t==="S"||t==="A")?2:(t==="D"?0:1);}
function defState(){return {v:2,started:false,stage:"lobby",names:[],seat:[],roster:Core.parseRoster(DEF),settings:{gold:[3,4,4,5,5,6],silver:[1,1,2,2,2,3]},races:[],hands:[],d1:null,d2:null,gold:[],silver:[]};}
function migrate(o){
 if(!o.settings||!o.settings.gold){o.settings={gold:[3,4,4,5,5,6],silver:[1,1,2,2,2,3]};}
 if(!o.gold)o.gold=[];if(!o.silver)o.silver=[];if(!o.races)o.races=[];if(!o.names)o.names=[];if(!o.seat)o.seat=[];
 if(!o.hands)o.hands=[];o.names.forEach(function(_,i){if(!o.hands[i])o.hands[i]=[];});
 if(o.d1===undefined)o.d1=null;if(o.d2===undefined)o.d2=null;
 if(o.started===undefined)o.started=o.names.length>0;
 if(!o.stage||o.v!==2){o.v=2;if(!o.started)o.stage="lobby";else{o.stage="lobby";o.started=false;o.races=[];}}
 o.races.forEach(function(r){if(!r.picks)r.picks={};if(!r.bz)r.bz=o.names.map(function(){return 0;});if(r.w1===undefined)r.w1=null;if(r.w2===undefined)r.w2=null;});
 if(o.d1){o.d1.packs=o.d1.packs||[];o.names.forEach(function(_,i){if(!o.d1.packs[i])o.d1.packs[i]=[];});o.d1.picked=o.d1.picked||[];}
 if(o.d2){o.d2.revealed=o.d2.revealed||[];o.d2.deck=o.d2.deck||[];o.d2.picks=o.d2.picks||{};o.d2.order=o.d2.order||[];}
 return o;
}
function curOf(o){return o.races[o.races.length-1];}
function cur(){return curOf(S);}
function N(){return S.names.length;}
function nPicks(r){return Object.keys(r.picks||{}).length;}
function phaseOf(o,r){if(!r)return "none";if(r.done)return "done";if(nPicks(r)<o.names.length)return "sel";if(r.w1===null)return "race";return "result";}
function phase(r){return phaseOf(S,r);}
function finished(){return S.started&&S.stage==="end";}
function effBz(r,p){return Math.max(0,((r.bz&&r.bz[p])||0)+(BONUS[r.id+"_"+p]||0));}
function raceScore(r,p){return (r.w1===p?(r.g||0):0)+(r.w2===p?(r.s||0):0)+effBz(r,p);}
function finalBonus(o,i){if(o.stage!=="end")return 0;var h=o.hands[i]||[];return h.length?tierBonusIn(o,h[0]):0;}
function tierBonusIn(o,n){var t="";for(var k=0;k<o.roster.length;k++)if(o.roster[k].n===n)t=o.roster[k].t;return (t==="S"||t==="A")?2:(t==="D"?0:1);}
function totals(o){
 var n=o.names.length,p=[],w=[],b=[],fb=[];for(var i=0;i<n;i++){p.push(0);w.push(0);b.push(0);fb.push(finalBonus(o,i));}
 o.races.forEach(function(R){if(!R.done)return;for(var i=0;i<n;i++){var v=Math.max(0,((R.bz&&R.bz[i])||0)+(BONUS[R.id+"_"+i]||0));b[i]+=v;p[i]+=v;}if(R.w1!==null){p[R.w1]+=R.g||0;w[R.w1]++;}if(R.w2!==null)p[R.w2]+=R.s||0;});
 for(var j=0;j<n;j++)p[j]+=fb[j];
 return {p:p,w:w,b:b,fb:fb};
}
function standings(o){o=o||S;var T=totals(o);var rows=o.names.map(function(n,i){return {i:i,n:n,p:T.p[i],w:T.w[i],b:T.b[i],fb:T.fb[i]};});rows.sort(function(a,b){return b.p-a.p||b.w-a.w||b.b-a.b||a.i-b.i;});return rows;}
function startInfo(o,r){var P=totals(o).p;var min=Math.min.apply(null,P);var low=o.names.map(function(_,i){return i;}).filter(function(i){return P[i]===min;});r.tie=low.length>1?low:null;r.first=low[0];r.minPts=min;}
function startText(r){if(r.tie)return (r.tie.length===N()?"Tutti a "+r.minPts+" punti":"Pareggio a "+r.minPts+" punti tra "+r.tie.map(function(i){return S.names[i];}).join(", "))+": tirate un dado, chi fa di più parte per primo, poi in senso orario.";return "Parte "+S.names[r.first]+" (ha meno punti), poi in senso orario.";}
function mega(k){return 'Megaround '+(Math.floor(k/3)+1)+' · gara '+(k%3+1)+'/3';}
function takenMap(r){var m={};Object.keys(r.picks).forEach(function(k){m[r.picks[k]]=+k;});return m;}
/* ordine di scelta per le gare 2,3,5,6: più punti prima; pari → livello carta gara precedente (alto prima); pari → caso */
function chooseOrder(o){
 var P=totals(o).p,prev=curOf(o);var rk={};for(var i=0;i<o.names.length;i++){var c=prev&&prev.picks?prev.picks[i]:null;var t="";if(c)for(var k=0;k<o.roster.length;k++)if(o.roster[k].n===c)t=o.roster[k].t;rk[i]=TRANK[t]||0;}
 var arr=o.names.map(function(_,i){return {i:i,p:P[i],t:rk[i],x:Math.random()};});
 arr.sort(function(a,b){return b.p-a.p||b.t-a.t||a.x-b.x;});
 var why=[];for(var j=1;j<arr.length;j++){var a=arr[j-1],b=arr[j];if(a.p===b.p)why.push(a.t!==b.t?(o.names[a.i]+" prima di "+o.names[b.i]+": stessi punti, carta di livello più alto nella gara prima"):(o.names[a.i]+" prima di "+o.names[b.i]+": parità totale, estratto a caso"));}
 return {order:arr.map(function(z){return z.i;}),why:why};
}
/* ordine draft megaround 2: meno punti prima, pari a caso */
function d2Order(o){var P=totals(o).p;var arr=o.names.map(function(_,i){return {i:i,p:P[i],x:Math.random()};});arr.sort(function(a,b){return a.p-b.p||a.x-b.x;});return arr.map(function(z){return z.i;});}
function allNames(o){return o.roster.map(function(x){return x.n;});}
function dealD1(o){
 var n=o.names.length,deck=Core.shuffle(allNames(o),Math.random),packs=[];
 for(var i=0;i<n;i++)packs.push(deck.splice(0,4));
 o.hands=o.names.map(function(){return [];});o.d1={round:0,packs:packs,picked:o.names.map(function(){return false;})};o.d2=null;o.d2done=false;o.stage="draft1";
}
function setupD2(o){
 var held=[];o.hands.forEach(function(h){h.forEach(function(c){held.push(c);});});
 var deck=Core.shuffle(allNames(o).filter(function(c){return held.indexOf(c)<0;}),Math.random);
 var n=o.names.length;o.d2={round:0,deck:deck,revealed:deck.splice(0,n),order:d2Order(o),picks:{}};o.d2.deck=deck;o.stage="draft2";
}
function me(){if(!GAME)return null;if(GAME.role==="banco")return "banco";if(!S||!S.started)return "lobby";var nm=GAME.name.toLowerCase();for(var i=0;i<S.names.length;i++)if(S.names[i].toLowerCase()===nm)return i;return "out";}
function lobbyNames(){
 var list=Object.keys(PLAYERS).map(function(k){return PLAYERS[k];}).filter(Boolean).sort(function(a,b){return (a.t||0)-(b.t||0);}).map(function(p){return p.name;});
 var seat=(S&&S.seat||[]).filter(function(n){return list.indexOf(n)>=0;});
 list.forEach(function(n){if(seat.indexOf(n)<0)seat.push(n);});return seat;
}
function playerIdByName(name){var id=null;Object.keys(PLAYERS).forEach(function(k){if(PLAYERS[k]&&PLAYERS[k].name===name)id=k;});return id;}
/* chi deve agire adesso (per il "ding" sul telefono) */
function myTurnNow(m){
 if(typeof m!=="number"||!S)return false;
 if(S.stage==="draft1"&&S.d1)return !S.d1.picked[m];
 if(S.stage==="draft2"&&S.d2)return S.d2.order[Object.keys(S.d2.picks).length]===m;
 var r=cur();if(r&&phase(r)==="sel")return r.order[nPicks(r)]===m;
 return false;
}
/* ---------------- backends ---------------- */
function makeLocalBackend(){
 var L={},bc=null;
 function k(p){return "ma_db:"+p;}
 function get(p){return lsGet(k(p),null);}
 function fire(p){(L[p]||[]).forEach(function(cb){cb(get(p));});}
 function put(p,v){lsSet(k(p),v);fire(p);try{bc&&bc.postMessage(p);}catch(e){}}
 try{bc=new BroadcastChannel("ma_db");bc.onmessage=function(e){fire(e.data);};}catch(e){}
 window.addEventListener("storage",function(e){if(e.key&&e.key.indexOf("ma_db:")===0)fire(e.key.slice(6));});
 function watch(p,cb){(L[p]=L[p]||[]).push(cb);setTimeout(function(){cb(get(p));},0);return function(){L[p]=(L[p]||[]).filter(function(x){return x!==cb;});};}
 return {
  local:true,
  exists:function(c){return Promise.resolve(get("games/"+c+"/state")!==null);},
  getState:function(c){return Promise.resolve(get("games/"+c+"/state"));},
  create:function(c,str){put("games/"+c+"/state",str);put("games/"+c+"/players",{});put("games/"+c+"/bonus",{});return Promise.resolve();},
  watchState:function(c,cb){return watch("games/"+c+"/state",cb);},
  commit:function(c,fn){var cur=get("games/"+c+"/state");if(cur===null)return Promise.resolve(false);var o=JSON.parse(cur);if(fn(o)===false)return Promise.resolve(false);put("games/"+c+"/state",JSON.stringify(o));return Promise.resolve(true);},
  watchPlayers:function(c,cb){return watch("games/"+c+"/players",function(v){cb(v||{});});},
  join:function(c,name){var m=get("games/"+c+"/players")||{};var ex=Object.keys(m).some(function(id){return m[id].name.toLowerCase()===name.toLowerCase();});if(!ex){m["p"+Date.now().toString(36)+Math.floor(Math.random()*1e4)]={name:name,t:Date.now()};put("games/"+c+"/players",m);}return Promise.resolve();},
  removePlayer:function(c,id){var m=get("games/"+c+"/players")||{};delete m[id];put("games/"+c+"/players",m);return Promise.resolve();},
  watchBonus:function(c,cb){return watch("games/"+c+"/bonus",function(v){cb(v||{});});},
  incBonus:function(c,idx,rid,d){var m=get("games/"+c+"/bonus")||{};m[idx]=m[idx]||{};m[idx][rid]=Math.max(0,(m[idx][rid]||0)+d);put("games/"+c+"/bonus",m);return Promise.resolve();},
  watchFarts:function(c,cb){return watch("games/"+c+"/farts",function(v){cb(v||{});});},
  sendFart:function(c,key,data){var m=get("games/"+c+"/farts")||{};data.t=Date.now();m[key]=data;put("games/"+c+"/farts",m);return Promise.resolve();},
  watchConn:function(cb){cb(true);return function(){};}
 };
}
function makeFirebaseBackend(cfg){
 var app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);var db=firebase.database();
 function r(p){return db.ref(p);}
 function on(ref,cb){var h=ref.on("value",function(s){cb(s.val());},function(e){msg="Errore di connessione: "+e.message;render();});return function(){ref.off("value",h);};}
 return {
  local:false,
  exists:function(c){return r("games/"+c+"/state").get().then(function(s){return s.exists();});},
  getState:function(c){return r("games/"+c+"/state").get().then(function(s){return s.val();});},
  create:function(c,str){return r("games/"+c).set({state:str,created:firebase.database.ServerValue.TIMESTAMP});},
  watchState:function(c,cb){return on(r("games/"+c+"/state"),cb);},
  commit:function(c,fn){return r("games/"+c+"/state").transaction(function(cur){if(cur===null)return null;var o;try{o=JSON.parse(cur);}catch(e){return;}if(fn(o)===false)return;return JSON.stringify(o);}).then(function(res){return res.committed;});},
  watchPlayers:function(c,cb){return on(r("games/"+c+"/players"),function(v){cb(v||{});});},
  join:function(c,name){var ref=r("games/"+c+"/players");return ref.get().then(function(s){var m=s.val()||{};var ex=Object.keys(m).some(function(id){return m[id]&&m[id].name&&m[id].name.toLowerCase()===name.toLowerCase();});if(!ex)return ref.push({name:name,t:firebase.database.ServerValue.TIMESTAMP});});},
  removePlayer:function(c,id){return r("games/"+c+"/players/"+id).remove();},
  watchBonus:function(c,cb){return on(r("games/"+c+"/bonus"),function(v){cb(v||{});});},
  incBonus:function(c,idx,rid,d){return r("games/"+c+"/bonus/"+idx+"/"+rid).transaction(function(v){return Math.max(0,(v||0)+d);});},
  watchFarts:function(c,cb){return on(r("games/"+c+"/farts"),function(v){cb(v||{});});},
  sendFart:function(c,key,data){data.t=firebase.database.ServerValue.TIMESTAMP;return r("games/"+c+"/farts/"+key).set(data);},
  watchConn:function(cb){var ref=db.ref(".info/connected");var h=ref.on("value",function(s){cb(!!s.val());});return function(){ref.off("value",h);};}
 };
}

/* ---------------- sound ---------------- */
function unlockAudio(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();preloadClips();}catch(e){}}
document.addEventListener("pointerdown",unlockAudio,{passive:true});
function ding(){try{unlockAudio();var c=AC;if(!c)return;var t=c.currentTime,g=c.createGain(),o=c.createOscillator();g.connect(c.destination);o.type="sine";o.frequency.setValueAtTime(880,t);o.frequency.setValueAtTime(1320,t+.12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.35,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);o.start(t);o.stop(t+.55);}catch(e){}}
var FARTS=[["Toot","f01"],["Bagnata","f02"],["Secca","f03"],["Con sorpresa","f04"],["Infernale","f05"],["Maratona","f06"],["Lamento","f07"],["Fanfara","f08"],["Tirami il dito","f09"],["Elefantiaca","f10"]];
var BUF={},PRELOADED=false;
function loadClip(id){if(!BUF[id]){BUF[id]=fetch("sounds/"+id+".mp3").then(function(r){if(!r.ok)throw new Error(r.status);return r.arrayBuffer();}).then(function(ab){return new Promise(function(res,rej){AC.decodeAudioData(ab,res,rej);});});BUF[id].catch(function(){delete BUF[id];});}return BUF[id];}
function preloadClips(){if(PRELOADED||!AC)return;PRELOADED=true;FARTS.forEach(function(f){loadClip(f[1]).catch(function(){});});}
function playClip(id){
 unlockAudio();
 function fallback(){try{var el=new Audio("sounds/"+id+".mp3");el.play().catch(function(){});}catch(e){}}
 if(!AC){fallback();return;}
 loadClip(id).then(function(b){var src=AC.createBufferSource();src.buffer=b;var g=AC.createGain();g.gain.value=1;src.connect(g);g.connect(AC.destination);src.start();}).catch(fallback);
}
function funny(){var k=parseInt(SND,10);if(isNaN(k)||!FARTS[k])k=Math.floor(Math.random()*FARTS.length);playClip(FARTS[k][1]);}

/* ---------------- pieces ---------------- */
var pendingSeen=[];
function once(key){if(SEEN[key])return false;pendingSeen.push(key);return true;}
function aCard(n,o){
 o=o||{};var t=tierOf(n),a=abOf(n),bg=o.taken!=null?"#e3e4ee":(TC[t]||"#e9e9f2");
 return '<div class="ac'+(o.taken!=null?' taken':'')+(o.flip?' flip':'')+'" style="background:'+bg+(o.delay?';animation-delay:'+o.delay+'ms':'')+'">'+
  '<div class="ah"><span class="nm">'+esc(n)+'</span>'+(o.fav!==undefined?'<button type="button" class="star'+(o.fav?' on':'')+'" data-act="fav" data-n="'+esc(n)+'" aria-label="'+(o.fav?'Togli dai preferiti ':'Segna come preferito ')+esc(n)+'" aria-pressed="'+(o.fav?'true':'false')+'">'+STAR+'</button>':'')+'<span class="tier" title="Livello">'+(t||'?')+'</span></div>'+
  (a[1]?'<div class="ab">'+(a[0]?'<span class="pw">'+esc(a[0])+'</span>':'')+esc(a[1])+'</div>':'<div class="ab mut">Abilità non inserita.</div>')+
  (o.btn||'')+(o.taken!=null?'<div class="stamp">Presa da '+esc(o.taken)+'</div>':'')+'</div>';
}
function orderStrip(order,picks,hideCards){
 var np=Object.keys(picks).length;
 return '<div class="order" aria-label="Ordine di scelta">'+order.map(function(p,k){var cls=k<np?' done':(k===np?' now':'');return '<div class="os'+cls+'">'+dot(p)+'<span>'+(k+1)+'. '+esc(S.names[p])+'</span>'+(k<np&&!hideCards?'<small>· '+esc(picks[p])+'</small>':'')+'</div>';}).join("")+'</div>';
}
function board(){
 var n=N(),rows=standings(),ri=S.races.length-1,r=cur(),end=S.stage==="end";
 var h='<div class="board"><div class="lanes" style="--n:'+(RACES+(end?1:0))+'">';
 h+='<div class="lane head"><span></span><span style="text-align:left;padding-left:12px">Corsia</span>';
 for(var k=0;k<RACES;k++)h+='<span>G'+(k+1)+(k%3===0?'<br><small style="font-weight:800;letter-spacing:.04em">M'+(Math.floor(k/3)+1)+'</small>':'<br><small>&nbsp;</small>')+'</span>';
 if(end)h+='<span>Carta<br><small>bonus</small></span>';
 h+='<span><span class="flag"></span> Tot</span></div>';
 rows.forEach(function(x,pos){
  h+='<div class="lane" data-flip="p'+x.i+'"><span class="pos">'+(pos+1)+'</span><span class="pn">'+dot(x.i)+'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.n)+'</span></span>';
  for(var k=0;k<RACES;k++){
   var R=S.races[k],c='';
   if(R){
    if(R.w1===x.i)c+='<span class="disc g mini">'+R.g+'</span>';
    if(R.w2===x.i)c+='<span class="disc s mini">'+R.s+'</span>';
    var b=effBz(R,x.i);if(b)c+='<span class="mini-b">+'+b+'</span>';
    if(!c&&R.done)c='<span class="empty">0</span>';
    if(!c&&!R.done&&R.picks[x.i])c='<span class="mut" style="font-size:12px;text-align:center;line-height:1.1">'+esc(R.picks[x.i])+'</span>';
   }
   if(!c)c='<span class="empty">·</span>';
   h+='<span class="cell'+(k===ri&&r&&!r.done?' cur':'')+'">'+c+'</span>';
  }
  if(end){var hc=(S.hands[x.i]||[])[0];h+='<span class="cell" style="flex-direction:column;gap:2px"><span class="mini-b" style="background:'+(TC[tierOf(hc)]||'#e9e9f2')+'">+'+x.fb+'</span><span class="mut" style="font-size:11px;text-align:center;line-height:1.1">'+esc(hc||'')+'</span></span>';}
  h+='<span class="tot">'+x.p+'</span></div>';
 });
 h+='</div></div>';
 var gs=S.gold.slice().sort(function(a,b){return a-b;}),ss=S.silver.slice().sort(function(a,b){return a-b;});
 h+='<div class="row" style="margin-top:14px;gap:18px"><div class="row"><span class="lbl">Oro ancora in pila</span>'+(gs.length?gs.map(function(v){return '<span class="disc g mini">'+v+'</span>';}).join(""):'<span class="mut">finite</span>')+'</div><div class="row"><span class="lbl">Argento</span>'+(ss.length?ss.map(function(v){return '<span class="disc s mini">'+v+'</span>';}).join(""):'<span class="mut">finite</span>')+'</div><span class="mut">Bronzo: 1 punto per stella o potere. Carta finale: S/A +2, B/C +1, D 0.</span></div>';
 return h;
}
function awards(){
 var T=totals(S),n=N(),best=null,silv=S.names.map(function(){return 0;});
 S.races.forEach(function(R,k){if(!R.done)return;if(R.w2!==null)silv[R.w2]++;for(var p=0;p<n;p++){var v=raceScore(R,p);if(!best||v>best.v)best={v:v,p:p,k:k,a:R.picks[p]};}});
 function arg(a){var m=-1,i=-1;a.forEach(function(v,k){if(v>m){m=v;i=k;}});return {i:i,v:m};}
 var bz=arg(T.b),sv=arg(silv),out=[];
 if(bz.v>0)out.push(['Re del bronzo',S.names[bz.i]+' · '+bz.v+' fiche bronzo']);
 if(sv.v>0)out.push(['Argento vivo',S.names[sv.i]+' · '+sv.v+' secondi posti']);
 if(best&&best.v>0)out.push(['Colpo grosso',S.names[best.p]+' · '+best.v+' punti in gara '+(best.k+1)+' con '+best.a]);
 return out;
}
/* ---- cosa sta succedendo (mostrato a tutti) ---- */
function stageInfo(){
 var n=N(),r=cur(),ph=phase(r),k=S.races.length;
 if(S.stage==="draft1"){var d=S.d1,left=S.names.filter(function(_,i){return !d.picked[i];});return {t:"Draft · Megaround 1 · giro "+(d.round+1)+" di 3",x:"Ognuno sceglie 1 carta dal suo mazzetto; le altre passano al giocatore successivo. Alla fine avrete 4 carte a testa."+(left.length?" Mancano: "+left.join(", ")+".":"")};}
 if(S.stage==="draft2"){var d2=S.d2,np=Object.keys(d2.picks).length;return {t:"Draft · Megaround 2 · giro "+(d2.round+1)+" di 3",x:"Si rivelano "+n+" carte e si sceglie una a testa, da chi ha meno punti. Ora sceglie "+S.names[d2.order[np]]+". Alla fine avrete 4 carte: 3 nuove più quella tenuta dal megaround 1."};}
 if(S.stage==="end")return {t:"Torneo finito",x:"La carta rimasta in mano dà punti bonus: S o A +2, B o C +1, D 0."};
 if(ph==="sel"){var who=r.order[nPicks(r)];return {t:"Gara "+k+" · scelta della carta",x:"Ognuno sceglie una carta dalla sua mano, da chi ha più punti. Ora sceglie "+S.names[who]+"."};}
 if(ph==="race")return {t:"Gara "+k+" in corso",x:startText(r)+" Premete +1 sul telefono per stelle e poteri."};
 if(ph==="result")return {t:"Gara "+k+" · arrivo",x:"Il banco registra 1° e 2° e gira le fiche."};
 if(k===0)return {t:"Gara 1",x:"Il banco assegna a ognuno una carta a caso dalla sua mano."};
 if(k===3&&!S.d2done)return {t:"Fine del Megaround 1",x:"Ognuno tiene la carta rimasta. Il banco avvia il draft del Megaround 2."};
 return {t:"Prossima: gara "+(k+1),x:"Si sceglie la carta dalla propria mano, da chi ha più punti (pari: livello della carta usata nella gara prima)."};
}
function infoBox(big){var si=stageInfo();return '<div class="st msg" role="status"><div class="lbl">Cosa succede ora</div><div class="t" style="font-size:'+(big?28:22)+'px;margin:2px 0 4px">'+esc(si.t)+'</div><div style="font-weight:700">'+esc(si.x)+'</div></div>';}
function handRow(i,label){var h=S.hands[i]||[];return '<div class="st"><div class="lbl">'+(label||'Le tue carte')+' ('+h.length+')</div><div class="row" style="margin-top:8px">'+(h.length?h.map(function(c){return '<span class="pill" style="background:'+(TC[tierOf(c)]||'#e9e9f2')+'">'+esc(c)+' · '+(tierOf(c)||'?')+'</span>';}).join(""):'<span class="mut">nessuna</span>')+'</div></div>';}

/* ---------------- banco ---------------- */
function vBanco(){
 var h=modeBanner()+'<div class="top"><span class="logo t">Magical Outlet</span><span class="pill">Codice '+esc(GAME.code)+'</span><div class="grow"></div><nav class="tabs" aria-label="Sezioni">'+[["live","Diretta"],["board","Tabellone"],["cards","Carte"],["set","Impostazioni"]].map(function(t){return '<button type="button" class="btn sm" data-act="tab" data-v="'+t[0]+'"'+(TAB===t[0]?' aria-current="page"':'')+'>'+t[1]+'</button>';}).join("")+'</nav></div>';
 if(msg)h+='<div class="st msg" role="status" style="margin-bottom:14px;font-weight:800">'+esc(msg)+'</div>';
 if(TAB==="board")h+='<div class="st"><h2 class="t" style="font-size:28px;margin-bottom:12px">Tabellone</h2>'+board()+'</div>';
 else if(TAB==="cards")h+=vCards();
 else if(TAB==="set")h+=vSet();
 else h+=vLive();
 h+='<p class="sync" style="margin-top:18px">'+(SYNC?'● Collegato':'○ Non collegato: controlla la connessione')+' · Questo dispositivo è il banco · <button type="button" class="btn sm alt" data-act="leave" style="min-height:36px">Esci</button></p>';
 return h;
}
function vLive(){
 var r=cur(),ph=phase(r),n=N(),k=S.races.length,h='';
 if(finished())return vEnd();
 h+='<div style="margin-bottom:16px">'+infoBox(true)+'</div>';
 if(S.stage==="draft1"){
  var d=S.d1;
  h+='<div class="st"><div class="row" style="margin-bottom:12px"><h2 class="t grow" style="font-size:30px">Draft in corso</h2><span class="pill">Giro '+(d.round+1)+'/3</span></div><div class="grid">'+S.names.map(function(nm,i){var nx=S.names[(i+1)%n];return '<div class="pl" style="background:'+(d.picked[i]?'#d7f5e3':'#fff')+'">'+dot(i)+'<span class="nm">'+esc(nm)+'</span>'+(d.picked[i]?'<span class="mut">✓ scelto</span>':(SHOWPACK!==null?'<button type="button" class="btn sm alt" data-act="showpack" data-i="'+i+'">'+(SHOWPACK===i?'Nascondi':'Scegli per lui')+'</button>':'<span class="mut">sta scegliendo…</span>'))+'</div>';}).join("")+'</div>'+(SHOWPACK!==null&&SHOWPACK>=0&&!d.picked[SHOWPACK]?'<div class="st" style="margin-top:14px;background:#fff8d6"><div class="lbl">Mazzetto di '+esc(S.names[SHOWPACK])+' (visibile a tutti)</div><div class="row" style="margin-top:8px">'+(d.packs[SHOWPACK]||[]).map(function(c){return '<button type="button" class="btn alt" data-act="d1pick" data-n="'+esc(c)+'" data-w="'+SHOWPACK+'">'+esc(c)+' · '+(tierOf(c)||'?')+'</button>';}).join("")+'</div></div>':'')+'<p style="margin:12px 0 0"><button type="button" class="btn sm alt" data-act="showpack" data-i="-1">'+(SHOWPACK===null?'Qualcuno non ha il telefono?':'Chiudi aiuto')+'</button></p><p class="mut" style="margin:12px 0 0">Le carte del draft sono segrete: si vedono solo sui telefoni. Dopo ogni giro i mazzetti passano al giocatore successivo (ordine dei posti). All\'ultimo giro l\'ultima carta viene presa in automatico.</p></div>';
  h+='<div class="st" style="margin-top:18px"><h2 class="t" style="font-size:24px;margin-bottom:10px">Tabellone</h2>'+board()+'</div>';
  return h;
 }
 if(S.stage==="draft2"){
  var d2=S.d2,np=Object.keys(d2.picks).length,who=d2.order[np],tm={};Object.keys(d2.picks).forEach(function(q){tm[d2.picks[q]]=+q;});
  h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:36px">Sceglie <span class="name-tag">'+esc(S.names[who])+'</span></h2><span class="pill">Giro '+(d2.round+1)+'/3</span></div>';
  h+='<div style="margin-bottom:18px">'+orderStrip(d2.order,d2.picks)+'</div>';
  var fl=once("d2r"+d2.round+(d2.revealed[0]||""));
  h+='<div class="grid">'+d2.revealed.map(function(nm,q){var tk=tm[nm];return aCard(nm,{taken:tk!==undefined?S.names[tk]:null,flip:fl,delay:q*140,btn:tk===undefined?'<button type="button" class="btn sm alt" data-act="d2pick" data-n="'+esc(nm)+'" data-w="'+who+'">Scegli per '+esc(S.names[who])+'</button>':''});}).join("")+'</div>';
  if(np>0)h+='<p style="margin-top:16px"><button type="button" class="btn sm alt" data-act="d2undo">Annulla l\'ultima scelta</button></p>';
  return h;
 }
 if(ph==="none"||ph==="done"){
  var mr2=k===3&&!S.d2done;
  h+='<div class="st row" style="gap:24px;align-items:center;padding:20px"><div class="grow stack" style="gap:8px"><span class="pill" style="align-self:flex-start">'+(mr2?'Fine Megaround 1':mega(k))+'</span><h2 class="t" style="font-size:36px">'+(mr2?'Pronti per il Megaround 2':(k===0?'Gara 1: carte a caso':'Gara '+(k+1)+': si sceglie'))+'</h2><div><button type="button" class="btn big acc" data-act="'+(mr2?'startd2':'newrace')+'">'+(mr2?'Avvia il draft del Megaround 2':(k===0?'Assegna le carte a caso':'Inizia la scelta della gara '+(k+1)))+'</button></div></div></div>';
  if(r&&r.done){h+=lastResult(r,k-1);if(!(k===3&&S.d2done))h+='<p style="margin:10px 0 0"><button type="button" class="btn sm alt" data-act="reopen">Riapri la gara '+k+' per correggere</button></p>';}
  h+='<div class="st" style="margin-top:18px"><h2 class="t" style="font-size:26px;margin-bottom:12px">Tabellone</h2>'+board()+'</div>';
  return h;
 }
 h+='<div class="row" style="margin-bottom:14px"><span class="pill">'+mega(k-1)+'</span><span class="grow"></span><button type="button" class="btn sm alt" data-act="abort">Annulla gara</button></div>';
 if(ph==="sel"){
  var npk=nPicks(r),who2=r.order[npk];
  h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:40px">Sceglie <span class="name-tag">'+esc(S.names[who2])+'</span></h2></div>';
  h+='<div style="margin-bottom:18px">'+orderStrip(r.order,r.picks)+(r.why&&r.why.length?'<p class="mut" style="margin:10px 0 0">Pareggi: '+esc(r.why.join(" · "))+'.</p>':'')+'</div>';
  h+='<div class="grid">'+r.order.filter(function(p){return r.picks[p]!==undefined;}).map(function(p){return aCard(r.picks[p],{btn:'<div class="row">'+dot(p)+'<b>'+esc(S.names[p])+'</b></div>'});}).join("")+'</div>';
  h+='<div class="st" style="margin-top:16px"><div class="row"><span class="grow mut">'+esc(S.names[who2])+' sceglie dal telefono. Se non ce l\'ha, il banco può scegliere al suo posto (la sua mano diventa visibile a tutti).</span><button type="button" class="btn sm alt" data-act="showhand" data-i="'+who2+'">'+(SHOWHAND===who2?'Nascondi la mano':'Scegli al posto suo')+'</button></div>';
  if(SHOWHAND===who2)h+='<div class="row" style="margin-top:10px">'+(S.hands[who2]||[]).map(function(c){return '<button type="button" class="btn alt" data-act="selpick" data-n="'+esc(c)+'" data-w="'+who2+'">'+esc(c)+' · '+(tierOf(c)||'?')+'</button>';}).join("")+'</div>';
  h+='</div>';
  if(npk>0)h+='<p style="margin-top:16px"><button type="button" class="btn sm alt" data-act="selundo">Annulla l\'ultima scelta</button></p>';
  return h;
 }
 var fo=[];for(var q=0;q<n;q++)fo.push((r.first+q)%n);
 if(ph==="race")h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:40px">In gara!</h2></div>';
 else h+=resultHead(r);
 h+='<div class="stack" style="gap:10px">'+fo.map(function(p){
  var nm=r.picks[p],a=abOf(nm),t=tierOf(nm),popped=POP[r.id+"_"+p]&&POP[r.id+"_"+p]>Date.now();
  return '<div class="rem" style="background:'+(TC[t]||'#e9e9f2')+'"><div class="who">'+dot(p)+'<span>'+esc(S.names[p])+'</span>'+(r.tie?(r.tie.indexOf(p)>=0?'<span class="first-badge">Dado</span>':''):(p===r.first?'<span class="first-badge">Parte</span>':''))+'</div>'+
   '<div class="ath"><b>'+esc(nm)+'</b> <span class="mut">· '+(t||'?')+'</span><div>'+esc(a[1]||'')+'</div></div>'+
   '<div class="bz"><button type="button" class="btn sm alt" data-act="bz" data-i="'+p+'" data-d="-1" aria-label="Togli un bronzo a '+esc(S.names[p])+'">−</button><span class="n" aria-label="Bronzo">'+effBz(r,p)+'</span><button type="button" class="btn sm alt" data-act="bz" data-i="'+p+'" data-d="1" aria-label="Aggiungi un bronzo a '+esc(S.names[p])+'">+</button></div>'+
   (popped?'<span class="plus1">+1</span>':'')+'</div>';}).join("")+'</div>';
 h+=resultControls(r);
 return h;
}
function resultHead(r){
 var h='<div class="st row" style="gap:22px;margin-bottom:16px;padding:18px 20px">';
 h+='<div class="row" style="gap:14px"><span class="disc g'+(once(r.id+"g")?' chipflip':'')+'">'+r.g+'</span><div><div class="lbl">1° posto</div><div class="t" style="font-size:30px">'+esc(S.names[r.w1])+'</div><div class="mut">'+esc(r.picks[r.w1])+'</div></div></div>';
 if(r.w2!==null)h+='<div class="row" style="gap:14px"><span class="disc s'+(once(r.id+"s")?' chipflip':'')+'">'+r.s+'</span><div><div class="lbl">2° posto</div><div class="t" style="font-size:30px">'+esc(S.names[r.w2])+'</div><div class="mut">'+esc(r.picks[r.w2])+'</div></div></div>';
 return h+'</div>';
}
function resultControls(r){
 var h='<div class="st" style="margin-top:18px">',k=S.races.length;
 if(r.w1===null){
  h+='<h3 class="t" style="font-size:26px;margin-bottom:10px">Chi è arrivato 1°?</h3><p class="mut" style="margin:0 0 10px">Si gira una fiche oro coperta.</p><div class="row">'+S.names.map(function(_,p){return p;}).map(function(p){return '<button type="button" class="btn alt" data-act="w1" data-i="'+p+'">'+dot(p)+esc(S.names[p])+'</button>';}).join("")+'</div>';
 }else if(r.w2===null){
  h+='<h3 class="t" style="font-size:26px;margin-bottom:10px">Chi è arrivato 2°?</h3><p class="mut" style="margin:0 0 10px">Si gira una fiche argento coperta e la gara finisce.</p><div class="row">'+S.names.map(function(_,p){return p;}).filter(function(p){return p!==r.w1;}).map(function(p){return '<button type="button" class="btn alt" data-act="w2" data-i="'+p+'">'+dot(p)+esc(S.names[p])+'</button>';}).join("")+'</div><p style="margin:12px 0 0"><button type="button" class="btn sm alt" data-act="unw">Annulla il 1°</button></p>';
 }else{
  h+='<h3 class="t" style="font-size:24px;margin-bottom:6px">Gara finita!</h3><p class="mut" style="margin:0">Controllate i bronzi qui sopra, poi chiudete la gara.'+(k===RACES?' Chiudendo l\'ultima gara si rivelano le carte bonus.':'')+'</p>';
  h+='<div class="row" style="margin-top:16px"><button type="button" class="btn alt" data-act="unw2">Annulla il 2°</button><span class="grow"></span><button type="button" class="btn big acc" data-act="close">Chiudi la gara</button></div>';
 }
 return h+'</div>';
}
function lastResult(r,ri){
 var h='<div class="st" style="margin-top:18px"><div class="row" style="gap:18px"><span class="lbl">Gara '+(ri+1)+' conclusa</span>';
 h+='<span class="row" style="gap:8px"><span class="disc g mini">'+r.g+'</span><b>'+esc(S.names[r.w1])+'</b> <span class="mut">'+esc(r.picks[r.w1])+'</span></span>';
 h+='<span class="row" style="gap:8px"><span class="disc s mini">'+r.s+'</span><b>'+esc(S.names[r.w2])+'</b> <span class="mut">'+esc(r.picks[r.w2])+'</span></span>';
 var b=S.names.map(function(nm,i){var v=effBz(r,i);return v?esc(nm)+' +'+v:'';}).filter(Boolean).join(' · ');
 if(b)h+='<span class="row" style="gap:6px"><span class="mini-b">B</span>'+b+'</span>';
 return h+'</div></div>';
}
function vEnd(){
 var rows=standings(),h='<div class="st" style="text-align:center;padding:24px"><span class="pill">Torneo concluso</span><h2 class="t" style="font-size:46px;margin:10px 0 22px">Vince '+esc(rows[0].n)+'!</h2><div class="podium">';
 var ord=[1,0,2],hgt=[150,200,115],col=["#d9dee9","#ffc83d","#e8a46b"];
 ord.forEach(function(k,j){var x=rows[k];if(!x)return;h+='<div class="pod">'+dot(x.i)+'<div class="t" style="font-size:24px">'+esc(x.n)+'</div><div class="mut">'+x.p+' punti</div><div class="blk" style="height:'+hgt[j]+'px;background:'+col[j]+'">'+(k+1)+'</div></div>';});
 h+='</div></div>';
 var fl=once("finalcards");
 h+='<h2 class="t" style="font-size:28px;margin:22px 0 12px">Le carte rimaste (bonus finale)</h2><div class="grid">'+S.names.map(function(nm,i){var c=(S.hands[i]||[])[0];if(!c)return '';return aCard(c,{flip:fl,delay:i*250,btn:'<div class="row">'+dot(i)+'<b class="grow">'+esc(nm)+'</b><span class="mini-b">+'+tierBonus(c)+'</span></div>'});}).join("")+'</div>';
 var aw=awards();
 if(aw.length)h+='<div class="grid" style="margin-top:18px">'+aw.map(function(a){return '<div class="st award"><span class="disc b mini" aria-hidden="true">★</span><div><div class="lbl">'+esc(a[0])+'</div><div style="font-weight:800">'+esc(a[1])+'</div></div></div>';}).join("")+'</div>';
 h+='<div class="st" style="margin-top:18px">'+board()+'</div>';
 return h;
}

/* ---------------- player ---------------- */
function vPlayer(){
 var i=ME,n=N(),r=cur(),ph=phase(r),rows=standings(),pos=0,pts=0,k=S.races.length;rows.forEach(function(x,q){if(x.i===i){pos=q+1;pts=x.p;}});
 var h='<div class="ph stack">'+modeBanner()+'<div class="me">'+dot(i)+'<div class="grow"><div class="t" style="font-size:26px;line-height:1">'+esc(S.names[i])+'</div><div class="mut">'+pts+' punti · '+pos+'° in classifica · '+esc(GAME.code)+'</div></div><button type="button" class="btn sm alt" data-act="leave">Esci</button></div>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 if(!SYNC&&!BE.local)h+='<div class="banner">Connessione persa: riprovo…</div>';
 if(finished()){var w=rows[0],c=(S.hands[i]||[])[0];return h+'<div class="st turn"><h2 class="t" style="font-size:32px">Torneo finito!</h2><p style="margin:4px 0 0;font-weight:800">Vince '+esc(w.n)+' con '+w.p+' punti. Tu sei '+pos+'°.</p></div>'+(c?'<div class="lbl">La tua carta bonus: +'+tierBonus(c)+'</div>'+aCard(c):'')+'<p class="mut">Guarda il podio sul tablet.</p></div>';}
 // draft 1
 if(S.stage==="draft1"){
  var d=S.d1,next=S.names[(i+1)%n];
  if(!d.picked[i]){
   h+='<div class="st turn"><h2 class="t" style="font-size:32px">Draft: scegli una carta</h2><p style="margin:2px 0 0;font-weight:800">Giro '+(d.round+1)+' di 3. Le altre passano a '+esc(next)+'.</p></div>';
   h+=(d.packs[i]||[]).map(function(c){return aCard(c,{btn:'<button type="button" class="btn" data-act="d1pick" data-n="'+esc(c)+'"'+(BUSY?' disabled':'')+'>Prendi '+esc(c)+'</button>'});}).join("");
  }else{
   var left=S.names.filter(function(_,q){return !d.picked[q];});
   h+='<div class="st"><h2 class="t" style="font-size:26px">Fatto! Aspetta gli altri</h2><p class="mut" style="margin:4px 0 0">Mancano: '+esc(left.join(", "))+'. Poi ti arriva il mazzetto di '+esc(S.names[(i-1+n)%n])+'.</p></div>';
  }
  return h+handRow(i)+'</div>';
 }
 // draft 2
 if(S.stage==="draft2"){
  var d2=S.d2,np=Object.keys(d2.picks).length,who=d2.order[np],tm={};Object.keys(d2.picks).forEach(function(q){tm[d2.picks[q]]=+q;});
  var my=d2.order.indexOf(i);
  if(who===i){h+='<div class="st turn"><h2 class="t" style="font-size:32px">Tocca a te!</h2><p style="margin:2px 0 0;font-weight:800">Draft Megaround 2, giro '+(d2.round+1)+' di 3: prendi una carta.</p></div>';
   h+=d2.revealed.filter(function(c){return tm[c]===undefined;}).map(function(c){return aCard(c,{btn:'<button type="button" class="btn" data-act="d2pick" data-n="'+esc(c)+'" data-w="'+i+'"'+(BUSY?' disabled':'')+'>Prendi '+esc(c)+'</button>'});}).join("");}
  else{h+=infoBox()+'<p class="mut" style="margin:0">'+(d2.picks[i]!==undefined?'Hai già preso '+esc(d2.picks[i])+' in questo giro.':'Tu sei '+(my+1)+'° a scegliere: tocca a te tra '+(my-np)+'.')+'</p>';
   h+=d2.revealed.map(function(c){var tk=tm[c];return aCard(c,{taken:tk!==undefined?S.names[tk]:null});}).join("");}
  return h+handRow(i)+'</div>';
 }
 if(ph==="none"||ph==="done"){
  if(r&&r.done){var mine=raceScore(r,i);h+='<div class="st"><div class="lbl">Gara '+k+'</div><p style="margin:4px 0 0;font-weight:800">Con '+esc(r.picks[i])+' hai fatto '+mine+' punt'+(mine===1?'o':'i')+'.</p></div>';}
  return h+infoBox()+handRow(i)+'</div>';
 }
 h+='<span class="pill" style="align-self:flex-start">'+mega(k-1)+'</span>';
 if(ph==="sel"){
  var npk=nPicks(r),who2=r.order[npk],my2=r.order.indexOf(i);
  if(r.picks[i]!==undefined){h+=infoBox()+'<div class="lbl">La tua carta per questa gara</div>'+aCard(r.picks[i]);}
  else if(who2===i){h+='<div class="st turn"><h2 class="t" style="font-size:32px">Tocca a te!</h2><p style="margin:2px 0 0;font-weight:800">Scegli quale carta usare nella gara '+k+'.</p></div>';
   h+=(S.hands[i]||[]).map(function(c){return aCard(c,{btn:'<button type="button" class="btn" data-act="selpick" data-n="'+esc(c)+'" data-w="'+i+'"'+(BUSY?' disabled':'')+'>Gioca '+esc(c)+'</button>'});}).join("");}
  else{h+=infoBox()+'<p class="mut" style="margin:0">Tu sei '+(my2+1)+'° a scegliere: tocca a te tra '+(my2-npk)+'.</p>'+handRow(i);}
  var chosen=r.order.filter(function(p){return r.picks[p]!==undefined&&p!==i;});
  if(chosen.length)h+='<div class="st"><div class="lbl">Già scelte dagli altri</div><div class="stack" style="gap:6px;margin-top:8px">'+chosen.map(function(p){return '<div class="row">'+dot(p)+'<b>'+esc(S.names[p])+'</b><span class="mut">'+esc(r.picks[p])+' · '+(tierOf(r.picks[p])||'?')+'</span></div>';}).join("")+'</div></div>';
  return h+'</div>';
 }
 var b=effBz(r,i),popped=POP[r.id+"_"+i]&&POP[r.id+"_"+i]>Date.now(),myB=BONUS[r.id+"_"+i]||0;
 if(ph==="result"){
  h+='<div class="st"><div class="row"><span class="disc g mini">'+r.g+'</span><b>1° '+esc(S.names[r.w1])+'</b></div>';
  if(r.w2!==null)h+='<div class="row" style="margin-top:6px"><span class="disc s mini">'+r.s+'</span><b>2° '+esc(S.names[r.w2])+'</b></div>';
  h+='</div>';
 }else h+=(r.tie&&r.tie.indexOf(i)>=0?'<div class="st msg" style="font-weight:800">🎲 Tocca anche a te tirare il dado: chi fa di più parte per primo.</div>':'')+'<p class="mut" style="margin:0">'+esc(startText(r))+(k===1?' Carte assegnate a caso.':'')+'</p>';
 h+=aCard(r.picks[i]);
 h+='<div style="position:relative"><button type="button" class="plusbtn" data-act="plus">+1 punto</button>'+(popped?'<span class="plus1" style="right:20px">+1</span>':'')+'</div>';
 h+='<div class="st row" style="justify-content:space-between"><div><div class="lbl">Bronzo in questa gara</div><div class="t" style="font-size:34px">'+b+'</div></div><button type="button" class="btn sm alt" data-act="minus"'+(myB?'':' disabled')+'>−1 (errore)</button></div>';
 h+='<div class="row"><label for="f_snd" style="margin:0">Scoreggia del +1</label><select id="f_snd"><option value="random">A caso</option>'+FARTS.map(function(f,q){return '<option value="'+q+'">'+esc(f[0])+'</option>';}).join("")+'</select></div>';
 h+=handRow(i,'Ti restano in mano');
 return h+'</div>';
}
var SHOWHAND=null,SHOWPACK=null,CONFIRM=null,FARTSEEN=null,FARTTOAST=null;
function fartKey(){return (GAME&&GAME.name?GAME.name:"x").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,24)||"x";}
function fartBtn(){return '<div class="fartdock"><button type="button" class="fartbtn" data-act="fart" aria-label="Fai una scoreggia: la sentono tutti, anche sul tablet"><svg viewBox="0 0 52 34" width="44" height="29" fill="none" stroke="#14121f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11h9M1.5 17h7M3 23h9"/><path d="M19 27a6 6 0 0 1 .5-12 9 9 0 0 1 16.5-3 7.5 7.5 0 0 1 7 11.5A5.5 5.5 0 0 1 38 30H22.5A5 5 0 0 1 19 27z" fill="#ffffff"/><circle cx="29" cy="20" r="1.6" fill="#14121f" stroke="none"/><circle cx="35" cy="20" r="1.6" fill="#14121f" stroke="none"/></svg><span>Scoreggia!</span></button></div>';}
function freeFart(){var k=parseInt(SND,10);if(isNaN(k)||!FARTS[k])k=Math.floor(Math.random()*FARTS.length);playClip(FARTS[k][1]);if(GAME&&BE)BE.sendFart(GAME.code,fartKey(),{clip:FARTS[k][1],name:GAME.name,n:Math.random()}).catch(function(){});}
function fartToast(){return FARTTOAST&&FARTTOAST.until>Date.now()?'<div class="farttoast" role="status">💨 '+esc(FARTTOAST.name)+'</div>':'';}
function checkTurn(){
 var m=me();if(typeof m!=="number")return;var now=myTurnNow(m);
 if(prevTurn===false&&now){try{window.scrollTo(0,0);}catch(e){}ding();try{navigator.vibrate&&navigator.vibrate([150,80,150]);}catch(e){}}
 prevTurn=now;
}
function popAt(key){POP[key]=Date.now()+1500;setTimeout(safeRender,1600);}
function joinUrl(){return location.origin+location.pathname+"#"+GAME.code;}
function modeBanner(){return BE&&BE.local?'<div class="banner">Modalità prova: Firebase non è configurato, quindi si sincronizza solo tra schede di questo browser.</div>':'';}

/* ---------------- home + lobby ---------------- */
function vHome(){
 var pre=(location.hash||"").replace("#","").toUpperCase().slice(0,4),last=idGet("ma_name","");
 var h='<div class="home stack">'+modeBanner()+'<span class="logo t" style="align-self:flex-start">Magical Outlet</span>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 h+='<form class="st stack" id="joinf" autocomplete="off"><h2 class="t" style="font-size:30px">Entra in una partita</h2>'+
  '<div><label for="f_code">Codice partita</label><input id="f_code" class="codein" maxlength="4" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" value="'+esc(pre)+'" placeholder="ABCD" required></div>'+
  '<div><label for="f_name">Il tuo nome</label><input id="f_name" maxlength="16" autocomplete="nickname" value="'+esc(last)+'" placeholder="Es. Luigi" required></div>'+
  '<button type="submit" class="btn big acc"'+(BUSY?' disabled':'')+'>'+(BUSY?'Entro…':'Entra')+'</button></form>';
 h+=tutBtn();
 h+='<div class="hostbox"><span class="mut">Sei il tablet al centro del tavolo?</span><button type="button" class="btn sm alt" data-act="create"'+(BUSY?' disabled':'')+'>Crea una partita</button></div></div>';
 return h;
}
function vLobbyHost(){
 var names=lobbyNames(),h='<div class="stack">'+modeBanner();
 h+='<div class="top" style="margin:0"><span class="logo t">Magical Outlet</span><div class="grow"></div><button type="button" class="btn sm alt" data-act="tab" data-v="'+(TAB==="set"?"live":"set")+'">'+(TAB==="set"?'Torna alla sala d\'attesa':'Impostazioni')+'</button></div>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 if(TAB==="set")return h+vSet()+'</div>';
 h+='<div class="st row" style="gap:28px;padding:22px"><div class="stack" style="gap:10px"><span class="lbl">Codice partita</span><span class="code">'+esc(GAME.code)+'</span><span class="mut">Aprite questo sito sul telefono e inserite il codice,<br>oppure inquadrate il QR.</span><span class="mut" style="word-break:break-all">'+esc(joinUrl())+'</span></div>'+(window.QRCode?'<div class="qr" id="qr" role="img" aria-label="QR code per entrare nella partita"></div>':'')+'</div>';
 h+='<div class="st stack"><div class="row"><h2 class="t grow" style="font-size:28px">Giocatori ('+names.length+')</h2><span class="mut">Mettili nell\'ordine in cui siete seduti: serve per il senso orario.</span></div>';
 if(!names.length)h+='<p class="mut" style="margin:0">Ancora nessuno. Aspetto che entrino dal telefono…</p>';
 h+=names.map(function(n,i){return '<div class="pl">'+dotN(names,i)+'<span class="nm">'+(i+1)+'. '+esc(n)+'</span><button type="button" class="btn sm alt" data-act="seat" data-n="'+esc(n)+'" data-d="-1" aria-label="Sposta su '+esc(n)+'"'+(i===0?' disabled':'')+'>↑</button><button type="button" class="btn sm alt" data-act="seat" data-n="'+esc(n)+'" data-d="1" aria-label="Sposta giù '+esc(n)+'"'+(i===names.length-1?' disabled':'')+'>↓</button><button type="button" class="btn sm alt" data-act="kick" data-n="'+esc(n)+'" aria-label="Togli '+esc(n)+'">✕</button></div>';}).join("");
 var need=RACES;var okChips=S.settings.gold.length>=need&&S.settings.silver.length>=need;
 h+='<div class="row" style="margin-top:6px"><button type="button" class="btn big acc" data-act="start"'+(names.length<2||!okChips?' disabled':'')+'>Inizia il torneo (6 gare, si parte dal draft)</button>'+(okChips?'':'<span class="mut">Servono almeno '+need+' fiche oro e argento: aggiungile in Impostazioni.</span>')+'</div></div>';
 h+='<p class="sync"><button type="button" class="btn sm alt" data-act="leave">Esci da questa partita</button></p>';
 return h+'</div>';
}
function vLobbyPlayer(){
 var names=lobbyNames(),h='<div class="ph stack">'+modeBanner();
 h+='<div class="me"><span class="dot" style="background:var(--yel)">'+esc(GAME.name.charAt(0).toUpperCase())+'</span><div class="grow"><div class="t" style="font-size:26px;line-height:1">'+esc(GAME.name)+'</div><div class="mut">Partita '+esc(GAME.code)+'</div></div><button type="button" class="btn sm alt" data-act="leave">Esci</button></div>';
 h+='<div class="st turn"><h2 class="t" style="font-size:30px">Sei dentro!</h2><p style="margin:4px 0 0;font-weight:800">Aspetta che il banco inizi il torneo. Intanto ripassa le regole.</p></div>'+tutBtn();
 h+='<div class="st stack" style="gap:8px"><span class="lbl">In sala d\'attesa</span>'+names.map(function(n,i){return '<div class="row">'+dotN(names,i)+'<b>'+esc(n)+'</b>'+(n.toLowerCase()===GAME.name.toLowerCase()?' <span class="mut">(tu)</span>':'')+'</div>';}).join("")+'</div>';
 return h+'</div>';
}
function vOut(){
 return '<div class="ph stack"><div class="st"><h2 class="t" style="font-size:28px">Torneo già iniziato</h2><p style="font-weight:700">Nella partita '+esc(GAME.code)+' non c\'è nessun giocatore che si chiama «'+esc(GAME.name)+'». Rientra con il nome che avevi usato: '+S.names.map(esc).join(", ")+'.</p><button type="button" class="btn acc" data-act="leave">Torna all\'inizio</button></div></div>';
}

function vCards(){
 var h='<div class="stack">';
 ["S","A","B","C","D",""].forEach(function(t){var l=S.roster.filter(function(x){return x.t===t;});if(!l.length)return;h+='<h2 class="t" style="font-size:28px">'+(t?'Livello '+t:'Senza livello')+'</h2><div class="grid">'+l.map(function(x){return aCard(x.n);}).join("")+'</div>';});
 return h+'</div>';
}
function vSet(){
 var s=S.settings,locked=S.races.length>0;
 var h='<div class="stack">';
 if(S.started)h+='<div class="st"><span class="lbl">Giocatori in ordine di posto</span><p style="margin:6px 0 0;font-weight:800">'+S.names.map(esc).join(" → ")+'</p></div>';
 h+='<div class="st"><div class="row" style="align-items:flex-start"><div class="grow"><label for="f_gold">Fiche oro (si pescano coperte)</label><input id="f_gold" value="'+s.gold.join(", ")+'"'+(locked?' disabled':'')+'></div><div class="grow"><label for="f_silver">Fiche argento</label><input id="f_silver" value="'+s.silver.join(", ")+'"'+(locked?' disabled':'')+'></div></div>'+(locked?'<p class="mut" style="margin:8px 0 0">Le fiche si cambiano solo prima della prima gara.</p>':'')+'</div>';
 h+='<div class="st"><label for="f_roster">Atleti: Nome | Livello (S, A, B, C, D) | Abilità facoltativa</label><textarea id="f_roster" style="min-height:280px">'+esc(Core.rosterText(S.roster))+'</textarea></div>';
 h+='<div><button type="button" class="btn big acc" data-act="save">Salva impostazioni</button></div>';
 if(S.started)h+='<div class="st"><h3 class="t" style="font-size:22px;margin-bottom:10px">Ricomincia</h3>'+(confirmReset?'<div class="row"><button type="button" class="btn acc" data-act="reset2">Sì, azzera i punti e ricomincia</button><button type="button" class="btn alt" data-act="reset0">No</button></div>':'<button type="button" class="btn alt" data-act="reset1">Azzera il torneo (tiene giocatori e atleti)</button>')+'</div>';
 return h+'</div>';
}

/* ---------------- tutorial ---------------- */
var TUT=false;
function tutBtn(){return '<button type="button" class="btn big alt tutbtn" data-act="tut"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 12h5"/></svg>Tutorial: le regole</button>';}
function vTut(){
 var gold=(S&&S.settings?S.settings.gold:[3,4,4,5,5,6]).slice().sort(function(a,b){return a-b;}),silv=(S&&S.settings?S.settings.silver:[1,1,2,2,2,3]).slice().sort(function(a,b){return a-b;});
 function chips(arr,cls){return arr.map(function(v){return '<span class="disc '+cls+' mini">'+v+'</span>';}).join("");}
 function step(n,title,body,color){return '<section class="st tstep" style="background:'+(color||'#fff')+'"><div class="row" style="gap:12px;align-items:flex-start"><span class="tnum">'+n+'</span><div class="grow"><h3 class="t" style="font-size:24px;margin-bottom:6px">'+title+'</h3>'+body+'</div></div></section>';}
 var h='<div class="tut" role="dialog" aria-modal="true" aria-labelledby="tut_t"><div class="ph stack">';
 h+='<div class="row tuthead"><span class="logo t" id="tut_t">Come si gioca</span><span class="grow"></span><button type="button" class="btn sm" data-act="tutclose">Chiudi</button></div>';
 h+='<p style="font-weight:800;margin:0">Magical Outlet è un torneo di Magical Athlete: <b>6 gare</b> divise in <b>2 megaround da 3</b>. Vince chi fa più punti. Il tablet al centro fa da banco e tabellone, tu giochi dal telefono.</p>';
 h+=step(1,'Entra nella partita','<p class="tp">Il banco crea la partita sul tablet e mostra un <b>codice di 4 lettere</b>. Inseriscilo qui con il tuo nome. Se chiudi il telefono, rientri con lo stesso codice e lo stesso nome.</p>');
 h+=step(2,'Draft · Megaround 1','<p class="tp">Ricevi <b>4 carte segrete</b>. Ne tieni <b>1</b> e passi le altre al giocatore seduto dopo di te; poi ricevi il mazzetto di chi ti sta prima. Si fanno 3 giri, l\'ultima carta arriva da sola: finisci con <b>4 carte in mano</b>.</p>','#ffe9a8');
 h+=step(3,'Quale carta giochi','<p class="tp"><b>Gara 1</b>: l\'app ti assegna una carta <b>a caso</b> dalla tua mano (non c\'è ancora un punteggio).</p><p class="tp"><b>Gare 2–6</b>: scegli tu dalla tua mano, uno alla volta, a partire da <b>chi ha più punti</b>. Le carte già scelte sono visibili a tutti, quindi chi sceglie dopo può contrastare. Parità di punti: sceglie prima chi nella gara precedente ha usato la carta di <b>livello più alto</b>; se ancora pari, decide il caso.</p>','#d9e6ff');
 h+=step(4,'La gara','<p class="tp">Si gioca con le regole normali di Magical Athlete: la gara finisce quando <b>due atleti</b> tagliano il traguardo.</p><p class="tp">Parte per primo <b>chi ha meno punti</b>, poi in senso orario. Se più giocatori sono pari, <b>tirano un dado</b>: chi fa di più parte.</p>','#d2f6e3');
 h+=step(5,'I punti','<p class="tp"><b>1° posto</b>: una fiche oro coperta, a caso tra</p><div class="row" style="gap:6px;margin:0 0 12px">'+chips(gold,"g")+'</div><p class="tp"><b>2° posto</b>: una fiche argento coperta, a caso tra</p><div class="row" style="gap:6px;margin:0 0 12px">'+chips(silv,"s")+'</div><p class="tp">Ogni fiche girata viene scartata: nelle 6 gare escono tutte, una volta sola.</p><p class="tp"><span class="mini-b">+1</span> <b>Bronzo</b>: ogni casella stella e ogni potere che dà punti (Hare, Lovable Loser, Sisyphus…) vale 1 punto. Lo segni tu con il tasto <b>+1 punto</b> sul telefono.</p>','#ffe1d8');
 h+=step(6,'Draft · Megaround 2','<p class="tp">Dopo la gara 3 ti resta <b>1 carta</b>: la tieni. Tutte le altre carte si rimischiano. Per 3 volte si rivelano 6 carte e ognuno ne prende una, a partire da <b>chi ha meno punti</b>. Torni ad avere 4 carte e si giocano le gare 4, 5 e 6 come prima.</p>','#ffe9a8');
 h+=step(7,'Fine e bonus','<p class="tp">Dopo la gara 6 ti resta 1 carta: vale punti in più secondo il suo livello.</p><div class="row" style="gap:8px;margin:6px 0 10px"><span class="pill" style="background:#ff7a59">S +2</span><span class="pill" style="background:#ffe14d">A +2</span><span class="pill" style="background:#7fb2ff">B +1</span><span class="pill" style="background:#6fe0a3">C +1</span><span class="pill" style="background:#ff9fd2">D 0</span></div><p class="tp">Vince chi ha più punti. Parità: più vittorie, poi più bronzi.</p>','#efe2ff');
 h+=step(8,'I tasti del telefono','<p class="tp"><b>Tocca a te</b>: il telefono suona e vibra quando devi scegliere.</p><p class="tp"><b>+1 punto</b>: per stelle e poteri, durante la gara. Sbagliato? C\'è il −1.</p><p class="tp"><b>Scoreggia!</b>: in basso, sempre disponibile. La sentono tutti, anche il tablet.</p>');
 h+='<button type="button" class="btn big acc" data-act="tutclose" style="align-self:center">Ho capito, si gioca!</button>';
 return h+'</div></div>';
}
/* ---------------- render ---------------- */
function flipCapture(){var m={};document.querySelectorAll("[data-flip]").forEach(function(e){m[e.getAttribute("data-flip")]=e.getBoundingClientRect().top;});return m;}
function flipPlay(m){document.querySelectorAll("[data-flip]").forEach(function(e){var k=e.getAttribute("data-flip");if(m[k]===undefined)return;var dy=m[k]-e.getBoundingClientRect().top;if(Math.abs(dy)<2)return;e.style.transition="none";e.style.transform="translateY("+dy+"px)";requestAnimationFrame(function(){requestAnimationFrame(function(){e.style.transition="transform .7s cubic-bezier(.2,.8,.2,1)";e.style.transform="";});});});}
function typing(){var a=document.activeElement;return a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&a.id!=="f_snd";}
function render(){
 var a=document.getElementById("app");ME=me();
 var act=document.activeElement,id=act&&act.id,pos=act&&act.selectionStart,vals={};
 document.querySelectorAll("#app input,#app textarea").forEach(function(e){if(e.id)vals[e.id]=e.value;});
 var tutEl=document.querySelector(".tut"),tutTop=tutEl?tutEl.scrollTop:0;
 var m=flipCapture();pendingSeen=[];var html;
 if(!GAME)html=vHome();
 else if(!S)html='<div class="home stack"><span class="logo t">Magical Outlet</span><div class="st">Collegamento alla partita '+esc(GAME.code)+'…</div><button type="button" class="btn alt" data-act="leave">Annulla</button></div>';
 else if(!S.started)html=GAME.role==="banco"?vLobbyHost():vLobbyPlayer();
 else if(ME==="banco")html=vBanco();
 else if(ME==="out")html=vOut();
 else html=vPlayer();
 if(GAME&&GAME.role==="player"&&S)html+=fartBtn();
 if(GAME&&GAME.role==="banco")html=fartToast()+html;
 if(CONFIRM==="leave")html=html.replace(/(data-act="leave"[^>]*>)[^<]*</g,'$1Tocca ancora per uscire<');
 if(CONFIRM==="abort")html=html.replace(/(data-act="abort"[^>]*>)[^<]*</g,'$1Tocca ancora: annullo la gara<');
 if(TUT)html+=vTut();
 a.innerHTML=html;
 Object.keys(vals).forEach(function(k){var e=document.getElementById(k);if(e&&!e.disabled&&k!=="f_code"&&k!=="f_name")e.value=vals[k];else if(e&&(k==="f_code"||k==="f_name")&&vals[k])e.value=vals[k];});
 var se=document.getElementById("f_snd");if(se)se.value=SND;
 pendingSeen.forEach(function(k){SEEN[k]=1;});
 var tutEl2=document.querySelector(".tut");if(tutEl2&&tutTop)tutEl2.scrollTop=tutTop;
 flipPlay(m);
 var q=document.getElementById("qr");if(q&&window.QRCode){try{new QRCode(q,{text:joinUrl(),width:170,height:170,colorDark:"#14121f",colorLight:"#ffffff"});}catch(e){}}
 if(id){var e2=document.getElementById(id);if(e2&&e2.tagName!=="BUTTON"){e2.focus();try{e2.setSelectionRange(pos,pos);}catch(x){}}}
}
function safeRender(){if(!typing())render();}
/* ---------------- connect ---------------- */
function disconnect(){FARTSEEN=null;UNSUB.forEach(function(f){try{f();}catch(e){}});UNSUB=[];S=null;PLAYERS={};BONUS={};prevTurn=null;}
function connect(){
 disconnect();if(!GAME)return;
 UNSUB.push(BE.watchConn(function(ok){SYNC=ok;safeRender();}));
 UNSUB.push(BE.watchState(GAME.code,function(str){
  if(str===null||str===undefined){if(S===null){msg="La partita "+GAME.code+" non esiste più.";GAME=null;idSet("ma_game",null);disconnect();render();}return;}
  try{S=migrate(JSON.parse(str));}catch(e){return;}
  checkTurn();safeRender();
 }));
 UNSUB.push(BE.watchPlayers(GAME.code,function(m){PLAYERS=m||{};safeRender();}));
 UNSUB.push(BE.watchFarts(GAME.code,function(m){
  var sig={};Object.keys(m||{}).forEach(function(k){var v=m[k]||{};sig[k]=String(v.t)+"|"+v.n;});
  if(FARTSEEN===null){FARTSEEN=sig;return;}
  Object.keys(sig).forEach(function(k){if(sig[k]!==FARTSEEN[k]){var v=m[k];if(GAME.role==="banco"){playClip(v.clip||"f01");FARTTOAST={name:v.name||"?",until:Date.now()+2200};safeRender();setTimeout(safeRender,2300);}}});
  FARTSEEN=sig;
 }));
 UNSUB.push(BE.watchBonus(GAME.code,function(bm){
  var nb={};Object.keys(bm||{}).forEach(function(idx){var rm=bm[idx]||{};Object.keys(rm).forEach(function(rid){nb[rid+"_"+idx]=rm[rid];});});
  if(ME==="banco"){var played=false;Object.keys(nb).forEach(function(k){if((nb[k]||0)>(BONUS[k]||0)){POP[k]=Date.now()+1500;if(!played){funny();played=true;}}});if(played)setTimeout(safeRender,1600);}
  BONUS=nb;safeRender();
 }));
}
function commit(fn){
 if(!GAME||!BE)return Promise.resolve(false);
 return BE.commit(GAME.code,function(o){migrate(o);return fn(o);}).then(function(ok){return ok;}).catch(function(e){msg="Non riesco a salvare: "+((e&&e.message)||e);render();return false;});
}
function newCode(){var s="";for(var i=0;i<4;i++)s+=CODE_CHARS.charAt(Math.floor(Math.random()*CODE_CHARS.length));return s;}
async function createGame(){
 BUSY=true;render();
 try{
  var code=null;for(var k=0;k<8;k++){var c=newCode();if(!(await BE.exists(c))){code=c;break;}}
  if(!code)throw new Error("nessun codice libero");
  await BE.create(code,JSON.stringify(defState()));
  GAME={code:code,role:"banco"};idSet("ma_game",GAME);TAB="live";msg="";connect();
 }catch(e){msg="Non riesco a creare la partita: "+(e.message||e);}
 BUSY=false;render();
}
async function joinGame(code,name){
 code=(code||"").toUpperCase().replace(/[^A-Z]/g,"");name=(name||"").trim().replace(/\s+/g," ");
 if(code.length!==4){msg="Il codice ha 4 lettere.";render();return;}
 if(name.length<1){msg="Scrivi il tuo nome.";render();return;}
 BUSY=true;msg="";render();
 try{
  var str=await BE.getState(code);
  if(str===null||str===undefined){msg="Nessuna partita con il codice "+code+".";BUSY=false;render();return;}
  var o=migrate(JSON.parse(str));
  if(o.started){var ok=o.names.some(function(n){return n.toLowerCase()===name.toLowerCase();});if(!ok){msg="Il torneo è già iniziato. Usa il nome con cui eri entrato: "+o.names.join(", ")+".";BUSY=false;render();return;}name=o.names.filter(function(n){return n.toLowerCase()===name.toLowerCase();})[0];}
  else await BE.join(code,name);
  idSet("ma_name",name);GAME={code:code,role:"player",name:name};idSet("ma_game",GAME);connect();
  try{history.replaceState(null,"",location.pathname+"#"+code);}catch(e){}
 }catch(e){msg="Non riesco a entrare: "+(e.message||e);}
 BUSY=false;render();
}
function leave(){disconnect();GAME=null;idSet("ma_game",null);msg="";TAB="live";render();}

/* ---------------- actions ---------------- */
document.getElementById("app").addEventListener("submit",function(ev){
 if(ev.target.id==="joinf"){ev.preventDefault();joinGame(document.getElementById("f_code").value,document.getElementById("f_name").value);}
});
document.getElementById("app").addEventListener("change",function(ev){var t=ev.target;if(t.id==="f_snd"){SND=t.value;lsSet("ma_snd",SND);funny();}});
function askConfirm(k){CONFIRM=k;render();setTimeout(function(){if(CONFIRM===k){CONFIRM=null;safeRender();}},4000);}
function rm(arr,x){var k=arr.indexOf(x);if(k>=0)arr.splice(k,1);return k>=0;}
function newRaceObj(o){return {id:"r"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36),k:o.races.length,picks:{},order:[],bz:o.names.map(function(){return 0;}),w1:null,w2:null,g:0,s:0,done:false};}
function afterPick(p){BUSY=false;if(!p)msg="Non riuscito: forse qualcuno ha appena scelto o non è il tuo turno.";render();}
document.getElementById("app").addEventListener("click",function(ev){
 var t=ev.target.closest("[data-act]");if(!t||t.disabled)return;
 var a=t.getAttribute("data-act");msg="";
 var I=+t.getAttribute("data-i"),D=+t.getAttribute("data-d"),NM=t.getAttribute("data-n"),W=+t.getAttribute("data-w");
 switch(a){
 case "create":createGame();return;
 case "leave":if(CONFIRM!=="leave"&&S&&S.started){askConfirm("leave");return;}CONFIRM=null;leave();return;
 case "tab":TAB=t.getAttribute("data-v");confirmReset=false;render();return;
 case "fart":freeFart();return;
 case "tut":TUT=true;render();try{var tt=document.querySelector(".tut");if(tt){tt.scrollTop=0;var cb=tt.querySelector("[data-act=tutclose]");cb&&cb.focus();}}catch(e){}return;
 case "tutclose":TUT=false;render();return;
 case "showpack":if(I===-1)SHOWPACK=SHOWPACK===null?-1:null;else SHOWPACK=SHOWPACK===I?-1:I;render();return;
 case "reopen":
  commit(function(o){var r=curOf(o);if(!r||!r.done)return false;if(o.races.length===3&&(o.d2done||o.stage==="draft2"))return false;r.done=false;if(o.stage==="end")o.stage="races";});return;
 case "showhand":SHOWHAND=SHOWHAND===I?null:I;render();return;
 case "plus":case "minus":
  var r1=cur();if(!r1||r1.done||phase(r1)==="sel"||typeof ME!=="number")return;var key=r1.id+"_"+ME;
  if(a==="minus"&&!(BONUS[key]>0))return;
  BONUS[key]=Math.max(0,(BONUS[key]||0)+(a==="plus"?1:-1));
  if(a==="plus"){funny();popAt(key);}
  BE.incBonus(GAME.code,ME,r1.id,a==="plus"?1:-1);render();return;
 case "seat":
  var names=lobbyNames(),ix=names.indexOf(NM),j=ix+D;if(ix<0||j<0||j>=names.length)return;var tmp=names[ix];names[ix]=names[j];names[j]=tmp;
  commit(function(o){if(o.started)return false;o.seat=names;});return;
 case "kick":
  var pid=playerIdByName(NM);if(pid)BE.removePlayer(GAME.code,pid);commit(function(o){if(o.started)return false;o.seat=(o.seat||[]).filter(function(x){return x!==NM;});});return;
 case "start":
  var order=lobbyNames();
  commit(function(o){if(o.started||order.length<2)return false;if(o.settings.gold.length<RACES||o.settings.silver.length<RACES)return false;if(o.roster.length<order.length*4)return false;
   o.names=order;o.started=true;o.races=[];o.gold=Core.shuffle(o.settings.gold,Math.random);o.silver=Core.shuffle(o.settings.silver,Math.random);dealD1(o);});return;
 /* --- draft megaround 1 (simultaneo, a passaggio) --- */
 case "d1pick":
  var meI=typeof ME==="number"?ME:(ME==="banco"?W:null);if(meI===null||isNaN(meI))return;BUSY=typeof ME==="number";SHOWPACK=ME==="banco"?-1:null;render();
  commit(function(o){if(o.stage!=="draft1"||!o.d1)return false;var d=o.d1,n=o.names.length;if(d.picked[meI])return false;if(!rm(d.packs[meI],NM))return false;o.hands[meI].push(NM);d.picked[meI]=true;
   if(d.picked.every(Boolean)){var np=[];for(var i=0;i<n;i++)np[(i+1)%n]=d.packs[i];d.packs=np;d.round++;d.picked=o.names.map(function(){return false;});
    if(d.packs.every(function(p){return p.length===1;})){for(var q=0;q<n;q++)o.hands[q].push(d.packs[q][0]);o.d1=null;o.stage="races";}}
  }).then(afterPick);return;
 /* --- gare --- */
 case "newrace":
  commit(function(o){if(o.stage!=="races")return false;var r=curOf(o);if(r&&!r.done)return false;if(o.races.length>=RACES)return false;var nr=newRaceObj(o);
   if(o.races.length===0){nr.order=o.names.map(function(_,i){return i;});o.names.forEach(function(_,i){var h=o.hands[i];var c=h[Math.floor(Math.random()*h.length)];rm(h,c);nr.picks[i]=c;});nr.random=true;}
   else{var co=chooseOrder(o);nr.order=co.order;nr.why=co.why;}
   startInfo(o,nr);o.races.push(nr);});return;
 case "selpick":
  BUSY=typeof ME==="number";SHOWHAND=null;render();
  commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="sel")return false;var who=r.order[nPicks(r)];if(who!==W)return false;if(!rm(o.hands[who],NM))return false;r.picks[who]=NM;}).then(afterPick);return;
 case "selundo":
  commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="sel"||r.random)return false;var np=nPicks(r);if(!np)return false;var who=r.order[np-1];o.hands[who].push(r.picks[who]);delete r.picks[who];});return;
 case "w1":commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="race")return false;r.w1=I;r.g=o.gold.length?o.gold.pop():0;});return;
 case "w2":commit(function(o){var r=curOf(o);if(!r||r.w1===null||r.w2!==null||I===r.w1)return false;r.w2=I;r.s=o.silver.length?o.silver.pop():0;});return;
 case "unw":commit(function(o){var r=curOf(o);if(!r||r.w1===null||r.w2!==null)return false;if(r.g)o.gold.push(r.g);r.w1=null;r.g=0;});delete SEEN[(cur()||{}).id+"g"];return;
 case "unw2":commit(function(o){var r=curOf(o);if(!r||r.w2===null||r.done)return false;if(r.s)o.silver.push(r.s);r.w2=null;r.s=0;});delete SEEN[(cur()||{}).id+"s"];return;
 case "bz":
  var rb=cur();if(!rb)return;var extra=BONUS[rb.id+"_"+I]||0;
  commit(function(o){var r=curOf(o);if(!r||r.done)return false;r.bz[I]=Math.max(-extra,(r.bz[I]||0)+D);});
  if(D>0){funny();popAt(rb.id+"_"+I);}return;
 case "close":
  commit(function(o){var r=curOf(o);if(!r||r.w2===null||r.done)return false;r.done=true;if(o.races.length===RACES)o.stage="end";});return;
 case "abort":
  if(CONFIRM!=="abort"){askConfirm("abort");return;}CONFIRM=null;
  commit(function(o){var r=curOf(o);if(!r||r.done)return false;o.races.pop();Object.keys(r.picks).forEach(function(p){o.hands[p].push(r.picks[p]);});if(r.w1!==null&&r.g)o.gold.push(r.g);if(r.w2!==null&&r.s)o.silver.push(r.s);});return;
 /* --- draft megaround 2 --- */
 case "startd2":
  commit(function(o){if(o.stage!=="races"||o.races.length!==3||o.d2done)return false;var r=curOf(o);if(!r||!r.done)return false;setupD2(o);});return;
 case "d2pick":
  BUSY=typeof ME==="number";render();
  commit(function(o){if(o.stage!=="draft2"||!o.d2)return false;var d=o.d2,n=o.names.length,np=Object.keys(d.picks).length,who=d.order[np];if(who!==W)return false;if(d.revealed.indexOf(NM)<0)return false;
   var taken=Object.keys(d.picks).map(function(k){return d.picks[k];});if(taken.indexOf(NM)>=0)return false;
   d.picks[who]=NM;o.hands[who].push(NM);np++;
   if(np===n-1){var last=d.order[np];var left=d.revealed.filter(function(c){return c!==NM&&taken.indexOf(c)<0;})[0];d.picks[last]=left;o.hands[last].push(left);np++;}
   if(np===n){d.round++;if(d.round>=3){o.d2=null;o.d2done=true;o.stage="races";}else{d.revealed=d.deck.splice(0,n);d.picks={};}}
  }).then(afterPick);return;
 case "d2undo":
  commit(function(o){if(o.stage!=="draft2"||!o.d2)return false;var d=o.d2,np=Object.keys(d.picks).length;if(!np)return false;var who=d.order[np-1];rm(o.hands[who],d.picks[who]);delete d.picks[who];});return;
 /* --- impostazioni --- */
 case "save":
  var locked=S.started&&S.races.length>0,gl=null,sl=null;
  if(!locked){gl=document.getElementById("f_gold").value.split(",").map(function(x){return parseInt(x,10);}).filter(function(x){return !isNaN(x);});sl=document.getElementById("f_silver").value.split(",").map(function(x){return parseInt(x,10);}).filter(function(x){return !isNaN(x);});
   if(gl.length<RACES||sl.length<RACES){msg="Servono almeno "+RACES+" fiche oro e "+RACES+" argento.";render();return;}}
  var ro=Core.parseRoster(document.getElementById("f_roster").value);
  if(S.started){var used=[];S.hands.forEach(function(h){h.forEach(function(c){used.push(c);});});S.races.forEach(function(r){Object.keys(r.picks).forEach(function(k){used.push(r.picks[k]);});});var miss=used.filter(function(c){return !ro.some(function(x){return x.n===c;});});if(miss.length){msg="Non puoi togliere atleti già in gioco: "+miss.join(", ")+".";render();return;}}
  commit(function(o){o.roster=ro;if(!(o.started&&o.races.length>0)&&gl){o.settings={gold:gl,silver:sl};if(o.started){o.gold=Core.shuffle(gl,Math.random);o.silver=Core.shuffle(sl,Math.random);}}}).then(function(ok){msg=ok?"Impostazioni salvate.":msg;render();});return;
 case "reset1":confirmReset=true;render();return;
 case "reset0":confirmReset=false;render();return;
 case "reset2":confirmReset=false;TAB="live";commit(function(o){o.races=[];o.gold=Core.shuffle(o.settings.gold,Math.random);o.silver=Core.shuffle(o.settings.silver,Math.random);dealD1(o);});return;
 }
});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&TUT){TUT=false;render();}});
/* ---------------- boot ---------------- */
(function boot(){
 SND=lsGet("ma_snd","random");FAV=lsGet("ma_fav",{})||{};
 var cfg=window.FIREBASE_CONFIG;
 try{BE=(cfg&&window.firebase)?makeFirebaseBackend(cfg):makeLocalBackend();}catch(e){BE=makeLocalBackend();msg="Firebase non si avvia: "+e.message;}
 GAME=idGet("ma_game",null);
 var h=(location.hash||"").replace("#","").toUpperCase();
 if(GAME&&h&&/^[A-Z]{4}$/.test(h)&&h!==GAME.code)GAME=null;
 if(GAME)connect();
 render();
})();

