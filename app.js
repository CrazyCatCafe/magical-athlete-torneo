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

/* ---------------- state ---------------- */
function defState(){return {v:1,started:false,names:[],seat:[],roster:Core.parseRoster(DEF),settings:{gold:[3,4,4,5,5,6],silver:[1,1,2,2,2,3]},races:[],pool:[],gold:Core.shuffle([3,4,4,5,5,6],Math.random),silver:Core.shuffle([1,1,2,2,2,3],Math.random)};}
function migrate(o){
 if(!o.settings||!o.settings.gold){o.settings={gold:[3,4,4,5,5,6],silver:[1,1,2,2,2,3]};}
 if(!o.gold)o.gold=[];if(!o.silver)o.silver=[];if(!o.pool)o.pool=[];if(!o.races)o.races=[];if(!o.names)o.names=[];if(!o.seat)o.seat=[];
 if(o.started===undefined)o.started=o.names.length>0;
 o.races.forEach(function(r){if(!r.picks)r.picks={};if(!r.bz)r.bz=o.names.map(function(){return 0;});if(r.w1===undefined)r.w1=null;if(r.w2===undefined)r.w2=null;if(r.last===undefined)r.last=null;});
 return o;
}
function curOf(o){return o.races[o.races.length-1];}
function cur(){return curOf(S);}
function N(){return S.names.length;}
function phaseOf(o,r){if(!r)return "none";if(r.done)return "done";if(Object.keys(r.picks||{}).length<o.names.length)return "pick";if(r.w1===null)return "race";return "result";}
function phase(r){return phaseOf(S,r);}
function finished(){var r=cur();return S.started&&S.races.length>=N()&&r&&r.done;}
function effBz(r,p){return Math.max(0,((r.bz&&r.bz[p])||0)+(BONUS[r.id+"_"+p]||0));}
function raceScore(r,p){return (r.w1===p?(r.g||0):0)+(r.w2===p?(r.s||0):0)+effBz(r,p);}
function startText(r){if(r.tie)return (r.tie.length===N()?"Tutti a "+r.minPts+" punti":"Pareggio a "+r.minPts+" punti tra "+r.tie.map(function(i){return S.names[i];}).join(", "))+": tirate un dado, chi fa di più parte per primo, poi in senso orario.";return "Parte "+S.names[r.first]+" (ha meno punti), poi in senso orario.";}
function mega(i){return 'Megaround '+(Math.floor(i/3)+1)+' · gara '+(i%3+1)+'/3';}
function takenMap(r){var m={};Object.keys(r.picks).forEach(function(k){m[r.picks[k]]=+k;});return m;}
function startPick(o,r){var P=Core.points(o).p;var k=o.names.map(function(_,i){return {i:i,p:P[i],x:Math.random()};});k.sort(function(a,b){return a.p-b.p||a.x-b.x;});r.order=k.map(function(z){return z.i;});var min=Math.min.apply(null,P);var low=o.names.map(function(_,i){return i;}).filter(function(i){return P[i]===min;});r.tie=low.length>1?low:null;r.first=low[0];r.minPts=min;}
function me(){if(!GAME)return null;if(GAME.role==="banco")return "banco";if(!S||!S.started)return "lobby";var nm=GAME.name.toLowerCase();for(var i=0;i<S.names.length;i++)if(S.names[i].toLowerCase()===nm)return i;return "out";}
function lobbyNames(){
 var list=Object.keys(PLAYERS).map(function(k){return PLAYERS[k];}).filter(Boolean).sort(function(a,b){return (a.t||0)-(b.t||0);}).map(function(p){return p.name;});
 var seat=(S&&S.seat||[]).filter(function(n){return list.indexOf(n)>=0;});
 list.forEach(function(n){if(seat.indexOf(n)<0)seat.push(n);});return seat;
}
function playerIdByName(name){var id=null;Object.keys(PLAYERS).forEach(function(k){if(PLAYERS[k]&&PLAYERS[k].name===name)id=k;});return id;}

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
function orderStrip(r){
 var np=Object.keys(r.picks).length;
 return '<div class="order" aria-label="Ordine di scelta">'+r.order.map(function(p,k){var cls=k<np?' done':(k===np?' now':'');return '<div class="os'+cls+'">'+dot(p)+'<span>'+(k+1)+'. '+esc(S.names[p])+'</span>'+(k<np?'<small>· '+esc(r.picks[p])+'</small>':'')+'</div>';}).join("")+'</div>';
}
function board(){
 var n=N(),rows=Core.standings(S),ri=S.races.length-1,r=cur();
 var h='<div class="board"><div class="lanes" style="--n:'+n+'">';
 h+='<div class="lane head"><span></span><span style="text-align:left;padding-left:12px">Corsia</span>';
 for(var k=0;k<n;k++)h+='<span>G'+(k+1)+(k%3===0?'<br><small style="font-weight:800;letter-spacing:.04em">M'+(Math.floor(k/3)+1)+'</small>':'<br><small>&nbsp;</small>')+'</span>';
 h+='<span><span class="flag"></span> Tot</span></div>';
 rows.forEach(function(x,pos){
  h+='<div class="lane" data-flip="p'+x.i+'"><span class="pos">'+(pos+1)+'</span><span class="pn">'+dot(x.i)+'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.n)+'</span></span>';
  for(var k=0;k<n;k++){
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
  h+='<span class="tot">'+x.p+'</span></div>';
 });
 h+='</div></div>';
 var gs=S.gold.slice().sort(function(a,b){return a-b;}),ss=S.silver.slice().sort(function(a,b){return a-b;});
 h+='<div class="row" style="margin-top:14px;gap:18px"><div class="row"><span class="lbl">Oro ancora in pila</span>'+(gs.length?gs.map(function(v){return '<span class="disc g mini">'+v+'</span>';}).join(""):'<span class="mut">finite</span>')+'</div><div class="row"><span class="lbl">Argento</span>'+(ss.length?ss.map(function(v){return '<span class="disc s mini">'+v+'</span>';}).join(""):'<span class="mut">finite</span>')+'</div><span class="mut">Bronzo: 1 punto per stella o potere.</span></div>';
 return h;
}
function awards(){
 var P=Core.points(S),n=N(),best=null,silv=S.names.map(function(){return 0;});
 S.races.forEach(function(R,k){if(!R.done)return;if(R.w2!==null)silv[R.w2]++;for(var p=0;p<n;p++){var v=raceScore(R,p);if(!best||v>best.v)best={v:v,p:p,k:k,a:R.picks[p]};}});
 function arg(a){var m=-1,i=-1;a.forEach(function(v,k){if(v>m){m=v;i=k;}});return {i:i,v:m};}
 var bz=arg(P.b),sv=arg(silv),out=[];
 if(bz.v>0)out.push(['Re del bronzo',S.names[bz.i]+' · '+bz.v+' fiche bronzo']);
 if(sv.v>0)out.push(['Argento vivo',S.names[sv.i]+' · '+sv.v+' secondi posti']);
 if(best&&best.v>0)out.push(['Colpo grosso',S.names[best.p]+' · '+best.v+' punti in gara '+(best.k+1)+' con '+best.a]);
 return out;
}
function joinUrl(){return location.origin+location.pathname+"#"+GAME.code;}
function modeBanner(){return BE&&BE.local?'<div class="banner">Modalità prova: Firebase non è configurato, quindi si sincronizza solo tra schede di questo browser.</div>':'';}

/* ---------------- home + lobby ---------------- */
function vHome(){
 var pre=(location.hash||"").replace("#","").toUpperCase().slice(0,4),last=idGet("ma_name","");
 var h='<div class="home stack">'+modeBanner()+'<span class="logo t" style="align-self:flex-start">Magical Outlet</span>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 h+='<form class="st stack" id="joinf" autocomplete="off"><h2 class="t" style="font-size:30px">Entra in una partita</h2>'+
  '<div><label for="f_code">Codice partita</label><input id="f_code" class="codein" maxlength="4" inputmode="text" autocapitalize="characters" value="'+esc(pre)+'" placeholder="ABCD" required></div>'+
  '<div><label for="f_name">Il tuo nome</label><input id="f_name" maxlength="16" value="'+esc(last)+'" placeholder="Es. Luigi" required></div>'+
  '<button type="submit" class="btn big acc"'+(BUSY?' disabled':'')+'>Entra</button></form>';
 h+='<div class="st stack"><h2 class="t" style="font-size:24px">Sei il tablet al centro del tavolo?</h2><p class="mut" style="margin:0">Crea la partita: comparirà il codice da dare agli amici.</p><button type="button" class="btn big yel" data-act="create"'+(BUSY?' disabled':'')+'>Crea una partita</button></div></div>';
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
 var need=names.length;var okChips=S.settings.gold.length>=need&&S.settings.silver.length>=need;
 h+='<div class="row" style="margin-top:6px"><button type="button" class="btn big acc" data-act="start"'+(names.length<2||!okChips?' disabled':'')+'>Inizia il torneo ('+names.length+' gare)</button>'+(okChips?'':'<span class="mut">Servono almeno '+need+' fiche oro e argento: aggiungile in Impostazioni.</span>')+'</div></div>';
 h+='<p class="sync"><button type="button" class="btn sm alt" data-act="leave">Esci da questa partita</button></p>';
 return h+'</div>';
}
function vLobbyPlayer(){
 var names=lobbyNames(),h='<div class="ph stack">'+modeBanner();
 h+='<div class="me"><span class="dot" style="background:var(--yel)">'+esc(GAME.name.charAt(0).toUpperCase())+'</span><div class="grow"><div class="t" style="font-size:26px;line-height:1">'+esc(GAME.name)+'</div><div class="mut">Partita '+esc(GAME.code)+'</div></div><button type="button" class="btn sm alt" data-act="leave">Esci</button></div>';
 h+='<div class="st turn"><h2 class="t" style="font-size:30px">Sei dentro!</h2><p style="margin:4px 0 0;font-weight:800">Aspetta che il banco inizi il torneo.</p></div>';
 h+='<div class="st stack" style="gap:8px"><span class="lbl">In sala d\'attesa</span>'+names.map(function(n,i){return '<div class="row">'+dotN(names,i)+'<b>'+esc(n)+'</b>'+(n.toLowerCase()===GAME.name.toLowerCase()?' <span class="mut">(tu)</span>':'')+'</div>';}).join("")+'</div>';
 return h+'</div>';
}
function vOut(){
 return '<div class="ph stack"><div class="st"><h2 class="t" style="font-size:28px">Torneo già iniziato</h2><p style="font-weight:700">Nella partita '+esc(GAME.code)+' non c\'è nessun giocatore che si chiama «'+esc(GAME.name)+'». Rientra con il nome che avevi usato: '+S.names.map(esc).join(", ")+'.</p><button type="button" class="btn acc" data-act="leave">Torna all\'inizio</button></div></div>';
}

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
 var r=cur(),ph=phase(r),n=N(),ri=S.races.length-1,h='';
 if(finished())return vEnd();
 if(ph==="none"||ph==="done"){
  var next=S.races.length,fresh=!S.pool||S.pool.length<n,left=fresh?Math.min(3*n,S.roster.length):S.pool.length;
  h+='<div class="st row" style="gap:24px;align-items:center;padding:20px">';
  h+='<div class="deck" aria-hidden="true"><i style="transform:translate(10px,10px) rotate(4deg)"></i><i style="transform:translate(5px,5px) rotate(2deg)"></i><i></i><b>'+left+'</b></div>';
  h+='<div class="grow stack" style="gap:8px"><span class="pill" style="align-self:flex-start">'+mega(next)+'</span><h2 class="t" style="font-size:36px">'+(fresh?'Nuovo megaround!':'Prossima gara')+'</h2><p class="mut" style="margin:0">'+(fresh?'Si pescano '+left+' atleti coperti. Ne riveliamo '+n+' per gara.':'Restano '+left+' atleti coperti in questo megaround.')+'</p><div><button type="button" class="btn big acc" data-act="newrace">Rivela i '+n+' atleti</button></div></div></div>';
  if(r&&r.done)h+=lastResult(r,ri);
  h+='<div class="st" style="margin-top:18px"><h2 class="t" style="font-size:26px;margin-bottom:12px">Tabellone</h2>'+board()+'</div>';
  return h;
 }
 h+='<div class="row" style="margin-bottom:14px"><span class="pill">'+mega(ri)+'</span><span class="grow"></span><button type="button" class="btn sm alt" data-act="abort">Annulla gara</button></div>';
 if(ph==="pick"){
  var np=Object.keys(r.picks).length,who=r.order[np],tm=takenMap(r);
  h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:40px">Sceglie <span class="name-tag">'+esc(S.names[who])+'</span></h2></div>';
  h+='<div style="margin-bottom:18px">'+orderStrip(r)+'</div>';
  var fl=once(r.id+"rev");
  h+='<div class="grid">'+r.drawn.map(function(nm,k){var tk=tm[nm];return aCard(nm,{taken:tk!==undefined?S.names[tk]:null,flip:fl,delay:k*160,btn:tk===undefined?'<button type="button" class="btn sm alt" data-act="pick" data-n="'+esc(nm)+'" data-w="'+who+'">Scegli per '+esc(S.names[who])+'</button>':''});}).join("")+'</div>';
  if(np>0)h+='<p style="margin-top:16px"><button type="button" class="btn sm alt" data-act="unpick">Annulla l\'ultima scelta</button></p>';
  h+='<p class="mut" style="margin-top:12px">Ognuno sceglie dal proprio telefono. Chi non ha il telefono sceglie qui.</p>';
  return h;
 }
 var fo=[];for(var q=0;q<n;q++)fo.push((r.first+q)%n);
 if(ph==="race")h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:40px">In gara!</h2></div><div class="st'+(r.tie?' msg':'')+'" style="margin-bottom:14px;font-weight:800;font-size:18px">'+(r.tie?'🎲 ':'')+esc(startText(r))+'</div>';
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
 var h='<div class="st" style="margin-top:18px">';
 if(r.w1===null){
  h+='<h3 class="t" style="font-size:26px;margin-bottom:10px">Chi è arrivato 1°?</h3><p class="mut" style="margin:0 0 10px">Si gira una fiche oro coperta.</p><div class="row">'+r.order.map(function(p){return '<button type="button" class="btn alt" data-act="w1" data-i="'+p+'">'+dot(p)+esc(S.names[p])+'</button>';}).join("")+'</div>';
 }else if(r.w2===null){
  h+='<h3 class="t" style="font-size:26px;margin-bottom:10px">Chi è arrivato 2°?</h3><p class="mut" style="margin:0 0 10px">Si gira una fiche argento coperta e la gara finisce.</p><div class="row">'+r.order.filter(function(p){return p!==r.w1;}).map(function(p){return '<button type="button" class="btn alt" data-act="w2" data-i="'+p+'">'+dot(p)+esc(S.names[p])+'</button>';}).join("")+'</div><p style="margin:12px 0 0"><button type="button" class="btn sm alt" data-act="unw">Annulla il 1°</button></p>';
 }else{
  h+='<h3 class="t" style="font-size:24px;margin-bottom:6px">Gara finita!</h3><p class="mut" style="margin:0">Controllate i bronzi qui sopra, poi chiudete la gara.</p>';
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
 var rows=Core.standings(S),h='<div class="st" style="text-align:center;padding:24px"><span class="pill">Torneo concluso</span><h2 class="t" style="font-size:46px;margin:10px 0 22px">Vince '+esc(rows[0].n)+'!</h2><div class="podium">';
 var ord=[1,0,2],hgt=[150,200,115],col=["#d9dee9","#ffc83d","#e8a46b"];
 ord.forEach(function(k,j){var x=rows[k];if(!x)return;h+='<div class="pod">'+dot(x.i)+'<div class="t" style="font-size:24px">'+esc(x.n)+'</div><div class="mut">'+x.p+' punti</div><div class="blk" style="height:'+hgt[j]+'px;background:'+col[j]+'">'+(k+1)+'</div></div>';});
 h+='</div></div>';
 var aw=awards();
 if(aw.length)h+='<div class="grid" style="margin-top:18px">'+aw.map(function(a){return '<div class="st award"><span class="disc b mini" aria-hidden="true">★</span><div><div class="lbl">'+esc(a[0])+'</div><div style="font-weight:800">'+esc(a[1])+'</div></div></div>';}).join("")+'</div>';
 h+='<div class="st" style="margin-top:18px">'+board()+'</div>';
 return h;
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

/* ---------------- player ---------------- */
function vPlayer(){
 var i=ME,n=N(),r=cur(),ph=phase(r),rows=Core.standings(S),pos=0,pts=0;rows.forEach(function(x,k){if(x.i===i){pos=k+1;pts=x.p;}});
 var h='<div class="ph stack">'+modeBanner()+'<div class="me">'+dot(i)+'<div class="grow"><div class="t" style="font-size:26px;line-height:1">'+esc(S.names[i])+'</div><div class="mut">'+pts+' punti · '+pos+'° in classifica · '+esc(GAME.code)+'</div></div><button type="button" class="btn sm alt" data-act="leave">Esci</button></div>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 if(!SYNC&&!BE.local)h+='<div class="banner">Connessione persa: riprovo…</div>';
 if(finished()){var w=rows[0];return h+'<div class="st turn"><h2 class="t" style="font-size:32px">Torneo finito!</h2><p style="margin:4px 0 0;font-weight:800">Vince '+esc(w.n)+' con '+w.p+' punti. Tu sei '+pos+'°.</p></div><p class="mut">Guarda il podio sul tablet.</p></div>';}
 if(ph==="none"||ph==="done"){
  if(r&&r.done){var mine=raceScore(r,i);h+='<div class="st"><div class="lbl">Gara '+S.races.length+'</div><p style="margin:4px 0 0;font-weight:800">Con '+esc(r.picks[i])+' hai fatto '+mine+' punt'+(mine===1?'o':'i')+'.</p></div>';}
  return h+'<div class="st"><h2 class="t" style="font-size:28px">Aspetta la prossima gara</h2><p class="mut" style="margin:4px 0 0">Il banco sta per rivelare gli atleti.</p></div></div>';
 }
 h+='<span class="pill" style="align-self:flex-start">'+mega(S.races.length-1)+'</span>';
 if(ph==="pick"){
  var np=Object.keys(r.picks).length,who=r.order[np],tm=takenMap(r),my=r.order.indexOf(i),fav=FAV[r.id]||{};
  if(r.picks[i]!==undefined){
   h+='<div class="st"><h2 class="t" style="font-size:26px">Hai scelto!</h2><p class="mut" style="margin:4px 0 0">Ora sceglie '+esc(S.names[who])+'. Si parte quando hanno scelto tutti.</p></div>'+aCard(r.picks[i]);
   return h+'</div>';
  }
  if(who===i){
   h+='<div class="st turn"><h2 class="t" style="font-size:36px">Tocca a te!</h2><p style="margin:2px 0 0;font-weight:800">Tocca «Scegli» sull\'atleta che vuoi.</p></div>';
   h+=r.drawn.filter(function(nm){return tm[nm]===undefined;}).map(function(nm){return aCard(nm,{fav:!!fav[nm],btn:'<button type="button" class="btn" data-act="pick" data-n="'+esc(nm)+'" data-w="'+i+'"'+(BUSY?' disabled':'')+'>Scegli '+esc(nm)+'</button>'});}).join("");
   var gone=r.drawn.filter(function(nm){return tm[nm]!==undefined;});
   if(gone.length)h+='<p class="mut">Già prese: '+gone.map(function(nm){return esc(nm)+' ('+esc(S.names[tm[nm]])+')';}).join(", ")+'</p>';
   return h+'</div>';
  }
  h+='<div class="st"><h2 class="t" style="font-size:28px">Sceglie '+esc(S.names[who])+'</h2><p class="mut" style="margin:4px 0 0">Tu sei '+(my+1)+'° a scegliere: tocca a te tra '+(my-np)+'. Intanto segna i preferiti con la stella.</p></div>';
  h+=r.drawn.map(function(nm){var tk=tm[nm];return aCard(nm,{taken:tk!==undefined?S.names[tk]:null,fav:tk===undefined?!!fav[nm]:undefined});}).join("");
  return h+'</div>';
 }
 var b=effBz(r,i),popped=POP[r.id+"_"+i]&&POP[r.id+"_"+i]>Date.now(),myB=BONUS[r.id+"_"+i]||0;
 if(ph==="result"){
  h+='<div class="st"><div class="row"><span class="disc g mini">'+r.g+'</span><b>1° '+esc(S.names[r.w1])+'</b></div>';
  if(r.w2!==null)h+='<div class="row" style="margin-top:6px"><span class="disc s mini">'+r.s+'</span><b>2° '+esc(S.names[r.w2])+'</b></div>';
  h+='</div>';
 }else h+=(r.tie&&r.tie.indexOf(i)>=0?'<div class="st msg" style="font-weight:800">🎲 Tocca anche a te tirare il dado: chi fa di più parte per primo.</div>':'')+'<p class="mut" style="margin:0">'+esc(startText(r))+'</p>';
 h+=aCard(r.picks[i]);
 h+='<div style="position:relative"><button type="button" class="plusbtn" data-act="plus">+1 punto</button>'+(popped?'<span class="plus1" style="right:20px">+1</span>':'')+'</div>';
 h+='<div class="st row" style="justify-content:space-between"><div><div class="lbl">Bronzo in questa gara</div><div class="t" style="font-size:34px">'+b+'</div></div><button type="button" class="btn sm alt" data-act="minus"'+(myB?'':' disabled')+'>−1 (errore)</button></div>';
 h+='<div class="row"><label for="f_snd" style="margin:0">Scoreggia del +1</label><select id="f_snd"><option value="random">A caso</option>'+FARTS.map(function(f,k){return '<option value="'+k+'">'+esc(f[0])+'</option>';}).join("")+'</select></div>';
 h+='<p class="mut">Premi +1 per ogni casella stella o potere che ti dà punti.</p>';
 return h+'</div>';
}

/* ---------------- render ---------------- */
function flipCapture(){var m={};document.querySelectorAll("[data-flip]").forEach(function(e){m[e.getAttribute("data-flip")]=e.getBoundingClientRect().top;});return m;}
function flipPlay(m){document.querySelectorAll("[data-flip]").forEach(function(e){var k=e.getAttribute("data-flip");if(m[k]===undefined)return;var dy=m[k]-e.getBoundingClientRect().top;if(Math.abs(dy)<2)return;e.style.transition="none";e.style.transform="translateY("+dy+"px)";requestAnimationFrame(function(){requestAnimationFrame(function(){e.style.transition="transform .7s cubic-bezier(.2,.8,.2,1)";e.style.transform="";});});});}
function typing(){var a=document.activeElement;return a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&a.id!=="f_snd";}
function render(){
 var a=document.getElementById("app");ME=me();
 var act=document.activeElement,id=act&&act.id,pos=act&&act.selectionStart,vals={};
 document.querySelectorAll("#app input,#app textarea").forEach(function(e){if(e.id)vals[e.id]=e.value;});
 var m=flipCapture();pendingSeen=[];var html;
 if(!GAME)html=vHome();
 else if(!S)html='<div class="home stack"><span class="logo t">Magical Outlet</span><div class="st">Collegamento alla partita '+esc(GAME.code)+'…</div><button type="button" class="btn alt" data-act="leave">Annulla</button></div>';
 else if(!S.started)html=GAME.role==="banco"?vLobbyHost():vLobbyPlayer();
 else if(ME==="banco")html=vBanco();
 else if(ME==="out")html=vOut();
 else html=vPlayer();
 a.innerHTML=html;
 Object.keys(vals).forEach(function(k){var e=document.getElementById(k);if(e&&!e.disabled&&k!=="f_code"&&k!=="f_name")e.value=vals[k];else if(e&&(k==="f_code"||k==="f_name")&&vals[k])e.value=vals[k];});
 var se=document.getElementById("f_snd");if(se)se.value=SND;
 pendingSeen.forEach(function(k){SEEN[k]=1;});
 flipPlay(m);
 var q=document.getElementById("qr");if(q&&window.QRCode){try{new QRCode(q,{text:joinUrl(),width:170,height:170,colorDark:"#14121f",colorLight:"#ffffff"});}catch(e){}}
 if(id){var e2=document.getElementById(id);if(e2&&e2.tagName!=="BUTTON"){e2.focus();try{e2.setSelectionRange(pos,pos);}catch(x){}}}
}
function safeRender(){if(!typing())render();}
function checkTurn(){
 var m=me();if(typeof m!=="number")return;var r=cur(),now=false;
 if(r&&phase(r)==="pick"){var np=Object.keys(r.picks).length;now=r.order[np]===m;}
 if(prevTurn===false&&now){try{window.scrollTo(0,0);}catch(e){}ding();try{navigator.vibrate&&navigator.vibrate([150,80,150]);}catch(e){}}
 prevTurn=now;
}
function popAt(key){POP[key]=Date.now()+1500;setTimeout(safeRender,1600);}

/* ---------------- connect ---------------- */
function disconnect(){UNSUB.forEach(function(f){try{f();}catch(e){}});UNSUB=[];S=null;PLAYERS={};BONUS={};prevTurn=null;}
function connect(){
 disconnect();if(!GAME)return;
 UNSUB.push(BE.watchConn(function(ok){SYNC=ok;safeRender();}));
 UNSUB.push(BE.watchState(GAME.code,function(str){
  if(str===null||str===undefined){if(S===null){msg="La partita "+GAME.code+" non esiste più.";GAME=null;idSet("ma_game",null);disconnect();render();}return;}
  try{S=migrate(JSON.parse(str));}catch(e){return;}
  checkTurn();safeRender();
 }));
 UNSUB.push(BE.watchPlayers(GAME.code,function(m){PLAYERS=m||{};safeRender();}));
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
document.getElementById("app").addEventListener("click",function(ev){
 var t=ev.target.closest("[data-act]");if(!t||t.disabled)return;
 var a=t.getAttribute("data-act");msg="";
 var I=+t.getAttribute("data-i"),D=+t.getAttribute("data-d"),NM=t.getAttribute("data-n");
 switch(a){
 case "create":createGame();return;
 case "leave":leave();return;
 case "tab":TAB=t.getAttribute("data-v");confirmReset=false;render();return;
 case "fav":var r0=cur();if(!r0)return;FAV[r0.id]=FAV[r0.id]||{};FAV[r0.id][NM]=!FAV[r0.id][NM];lsSet("ma_fav",FAV);render();return;
 case "plus":case "minus":
  var r1=cur();if(!r1||r1.done||typeof ME!=="number")return;var key=r1.id+"_"+ME;
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
  commit(function(o){if(o.started||order.length<2)return false;if(o.settings.gold.length<order.length||o.settings.silver.length<order.length)return false;o.names=order;o.started=true;o.races=[];o.pool=[];o.gold=Core.shuffle(o.settings.gold,Math.random);o.silver=Core.shuffle(o.settings.silver,Math.random);});return;
 case "newrace":
  commit(function(o){var r=curOf(o);if(r&&!r.done)return false;if(o.races.length>=o.names.length)return false;var n=o.names.length;if(!o.pool||o.pool.length<n)o.pool=Core.megaDraw(o,Math.random);var dr=o.pool.splice(0,n);var nr={id:"r"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36),drawn:dr,picks:{},bz:o.names.map(function(){return 0;}),w1:null,w2:null,g:0,s:0,last:null,done:false};o.races.push(nr);startPick(o,nr);});return;
 case "pick":
  var W=+t.getAttribute("data-w"),isMe=typeof ME==="number";BUSY=isMe;
  commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="pick")return false;var np=Object.keys(r.picks).length,who=r.order[np];if(who!==W)return false;if(takenMap(r)[NM]!==undefined)return false;r.picks[who]=NM;np++;if(np===o.names.length-1){var tm=takenMap(r);r.picks[r.order[np]]=r.drawn.filter(function(x){return tm[x]===undefined;})[0];}}).then(function(ok){BUSY=false;if(!ok){msg="Scelta non riuscita: forse l'atleta è appena stato preso o non è il tuo turno.";}render();});
  render();return;
 case "unpick":
  commit(function(o){var r=curOf(o);if(!r||r.w1!==null)return false;var k2=Object.keys(r.picks).length;if(!k2)return false;var cnt=k2===o.names.length?2:1;for(var c=0;c<cnt;c++){var kk=r.order[Object.keys(r.picks).length-1];delete r.picks[kk];}});return;
 case "w1":commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="race")return false;r.w1=I;r.g=o.gold.length?o.gold.pop():0;});return;
 case "w2":commit(function(o){var r=curOf(o);if(!r||r.w1===null||r.w2!==null||I===r.w1)return false;r.w2=I;r.s=o.silver.length?o.silver.pop():0;});return;
 case "unw":commit(function(o){var r=curOf(o);if(!r||r.w1===null||r.w2!==null)return false;if(r.g)o.gold.push(r.g);r.w1=null;r.g=0;});delete SEEN[(cur()||{}).id+"g"];return;
 case "unw2":commit(function(o){var r=curOf(o);if(!r||r.w2===null||r.done)return false;if(r.s)o.silver.push(r.s);r.w2=null;r.s=0;});delete SEEN[(cur()||{}).id+"s"];return;
 case "bz":
  var rb=cur();if(!rb)return;var extra=BONUS[rb.id+"_"+I]||0;
  commit(function(o){var r=curOf(o);if(!r||r.done)return false;r.bz[I]=Math.max(-extra,(r.bz[I]||0)+D);});
  if(D>0){funny();popAt(rb.id+"_"+I);}return;
 case "close":commit(function(o){var r=curOf(o);if(!r||r.w2===null)return false;r.done=true;});return;
 case "abort":commit(function(o){var r=curOf(o);if(!r||r.done)return false;o.races.pop();if(r.w1!==null&&r.g)o.gold.push(r.g);if(r.w2!==null&&r.s)o.silver.push(r.s);o.pool=r.drawn.concat(o.pool||[]);});return;
 case "save":
  var locked=S.races.length>0,gl=null,sl=null;
  if(!locked){gl=document.getElementById("f_gold").value.split(",").map(function(x){return parseInt(x,10);}).filter(function(x){return !isNaN(x);});sl=document.getElementById("f_silver").value.split(",").map(function(x){return parseInt(x,10);}).filter(function(x){return !isNaN(x);});}
  var ro=Core.parseRoster(document.getElementById("f_roster").value);
  var need=S.started?N():2;
  if(ro.length<Math.max(need,2)){msg="Servono almeno "+Math.max(need,2)+" atleti.";render();return;}
  if(!locked&&S.started&&(gl.length<N()||sl.length<N())){msg="Servono almeno "+N()+" fiche oro e "+N()+" argento.";render();return;}
  commit(function(o){o.roster=ro;if(!(o.races.length>0)&&gl){o.settings={gold:gl,silver:sl};o.gold=Core.shuffle(gl,Math.random);o.silver=Core.shuffle(sl,Math.random);}}).then(function(ok){msg=ok?"Impostazioni salvate.":msg;render();});return;
 case "reset1":confirmReset=true;render();return;
 case "reset0":confirmReset=false;render();return;
 case "reset2":confirmReset=false;TAB="live";commit(function(o){o.races=[];o.pool=[];o.gold=Core.shuffle(o.settings.gold,Math.random);o.silver=Core.shuffle(o.settings.silver,Math.random);});return;
 }
});

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
