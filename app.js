/* Magical Outlet — app (telefono giocatore + tablet banco) */
var S=null,GAME=null,PLAYERS={},BONUS={},BE=null,UNSUB=[],ME=null;
var TAB="live",msg="",confirmReset=false,SYNC=false,FAV={},SEEN={},POP={},AC=null,prevTurn=null,SND="random",BUSY=false;
var PC=["#ff7a59","#7fb2ff","#6fe0a3","#ffe14d","#ff9fd2","#c4a7ff","#ffb86b","#9ee7f0"];
var TC={S:"#ff7a59",A:"#ffe14d",B:"#7fb2ff",C:"#6fe0a3",D:"#ff9fd2",E:"#c9c9d6"};
var STAR='<svg viewBox="0 0 24 24" fill="none" stroke="#14121f" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
var CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ";

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function lsGet(k,d){try{var v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function idGet(k,d){try{var st=(BE&&BE.local)?sessionStorage:localStorage;var v=st.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function idSet(k,v){try{var st=(BE&&BE.local)?sessionStorage:localStorage;if(v===null)st.removeItem(k);else st.setItem(k,JSON.stringify(v));}catch(e){}}
function lsSet(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function rosterNow(){if(S&&S.roster)return S.roster;var ro=Core.parseRoster(DEF);ro.forEach(function(x){var t=(typeof GTIERS!=="undefined")&&GTIERS[String(x.n).replace(/[^A-Za-z0-9]/g,"_")];if(t)x.t=t;});return ro;}
function tierOf(n){var R=rosterNow();for(var i=0;i<R.length;i++)if(R[i].n===n)return R[i].t;return "";}
function pcol(i){return PC[i%PC.length];}
function ini(names,i){var f=names.map(function(n){return (n||"?").charAt(0).toUpperCase();});var c=f[i];return f.filter(function(x){return x===c;}).length>1?String(i+1):c;}
function dotN(names,i){return '<span class="dot" style="background:'+pcol(i)+'" aria-hidden="true">'+esc(ini(names,i))+'</span>';}
function dot(i){return dotN(S.names,i);}

/* ---------------- state ----------------
 Regole Magical Outlet (v3):
 - 4 gare. Punti 1°/2°: gara 1 3/1, gara 2 4/2, gara 3 4/2, gara 4 5/3 (+ bronzo +1 dal telefono).
 - Pole position (a caso): chi parte nella gara 1, chi sceglie per primo il racer della gara 1, chi inizia il draft.
 - Draft comune prima delle gare: 5 giri; ogni giro si rivelano N+1 carte e si prende una carta a testa in senso
   orario; il giro dopo comincia il giocatore successivo; la carta avanzata si scarta. 5 carte a testa.
 - Gara 1: si sceglie la carta in senso orario a partire dal giocatore estratto. Gare 2-4: dal più punti
   (pari: meno rutti/scoregge, poi livello carta gara precedente, poi caso). Poi l'ultimo in classifica sceglie chi parte.
 - Fine: la carta rimasta dà S/A +2, B/C +1, D 0. Livelli: la carta del 1° sale, quella dell'ultimo scende (permanente).
*/
var RACES=4,DRAFTS=5;
var DEFPTS=[[3,1],[4,2],[4,2],[5,3]];
var TRANK={S:5,A:4,B:3,C:2,D:1,E:0};
var TLIST=["E","D","C","B","A","S"];
function tierIn(o,n){for(var k=0;k<o.roster.length;k++)if(o.roster[k].n===n)return o.roster[k].t||"D";return "D";}
function setTier(o,n,t){for(var k=0;k<o.roster.length;k++)if(o.roster[k].n===n)o.roster[k].t=t;}
function shifted(t,d){var i=TLIST.indexOf(t||"D");if(i<0)i=0;return TLIST[Math.max(0,Math.min(5,i+d))];}
function lastCands(r){return S.names.map(function(_,p){return p;}).filter(function(p){return p!==r.w1&&p!==r.w2;});}
function tierPreview(r){var out=[];var up=r.picks[r.w1],t=tierOf(up);if(t!=="S")out.push(esc(up)+' sale: '+(t||'D')+' → '+shifted(t,1));else out.push(esc(up)+' è già S');if(r.last!==null&&r.last!==undefined){var dn=r.picks[r.last],t2=tierOf(dn);out.push(t2!=="E"?esc(dn)+' scende: '+(t2||'D')+' → '+shifted(t2,-1):esc(dn)+' è già E');}return out;}
var TIEMODE=false,LASTSEL=[],GTIERS={},IMGS={};
function tkey(n){return String(n).replace(/[^A-Za-z0-9]/g,"_");}
function applyGlobalTiers(o){o.roster.forEach(function(x){var t=GTIERS[tkey(x.n)];if(t&&TRANK[t])x.t=t;});}
function rosterTierMap(ro){var m={};ro.forEach(function(x){m[tkey(x.n)]=x.t||"D";});return m;}
function tierBonus(n){var t=tierOf(n);return (t==="S"||t==="A")?2:((t==="D"||t==="E")?0:1);}
function pts(o){var p=(o.settings&&o.settings.pts)||DEFPTS;return p;}
function defState(){return {v:3,started:false,stage:"lobby",names:[],teams:[],seat:[],roster:Core.parseRoster(DEF),settings:{pts:DEFPTS.map(function(x){return x.slice();})},races:[],hands:[],pole:null,dr:null,deck:[]};}
function migrate(o){
 if(o.v!==3){var fresh=defState();fresh.roster=o.roster||fresh.roster;fresh.seat=o.seat||[];Object.keys(fresh).forEach(function(k){o[k]=fresh[k];});o.roster=fresh.roster;}
 if(!o.settings||!o.settings.pts)o.settings={pts:DEFPTS.map(function(x){return x.slice();})};
 ["races","names","teams","seat","hands","deck"].forEach(function(k){if(!o[k])o[k]=[];});
 o.roster.forEach(function(x){if((x.n==="Centaur"||x.n==="Third Wheel")&&!x.t)x.t="D";});
 o.names.forEach(function(_,i){if(!o.hands[i])o.hands[i]=[];});
 if(o.pole===undefined)o.pole=null;if(o.dr===undefined)o.dr=null;
 if(o.dr){o.dr.revealed=o.dr.revealed||[];o.dr.picks=o.dr.picks||{};o.dr.order=o.dr.order||[];}
 o.races.forEach(function(r){if(!r.picks)r.picks={};if(!r.order)r.order=[];if(!r.bz)r.bz=o.names.map(function(){return 0;});["w1","w2","last","first"].forEach(function(k){if(r[k]===undefined)r[k]=null;});});
 return o;
}
function curOf(o){return o.races[o.races.length-1];}
function cur(){return curOf(S);}
function N(){return S.names.length;}
function teamOf(i){return (S.teams&&S.teams[i])||("Team "+S.names[i]);}
function nPicks(r){return Object.keys(r.picks||{}).length;}
function phaseOf(o,r){if(!r)return "none";if(r.done)return "done";if(r.first===null||r.first===undefined)return "starter";if(nPicks(r)<o.names.length)return "sel";if(r.w1===null)return "race";return "result";}
function phase(r){return phaseOf(S,r);}
function finished(){return S.started&&S.stage==="end";}
function effBz(r,p){return Math.max(0,((r.bz&&r.bz[p])||0)+(BONUS[r.id+"_"+p]||0));}
function raceScore(r,p){return (r.w1===p?(r.g||0):0)+(r.w2===p?(r.s||0):0)+effBz(r,p);}
function tierBonusIn(o,n){var t=tierIn(o,n);return (t==="S"||t==="A")?2:((t==="D"||t==="E")?0:1);}
function finalBonus(o,i){if(o.stage!=="end")return 0;var h=o.hands[i]||[];return h.length?tierBonusIn(o,h[0]):0;}
function totals(o){
 var n=o.names.length,p=[],w=[],b=[],fb=[];for(var i=0;i<n;i++){p.push(0);w.push(0);b.push(0);fb.push(finalBonus(o,i));}
 o.races.forEach(function(R){if(!R.done)return;for(var i=0;i<n;i++){var v=Math.max(0,((R.bz&&R.bz[i])||0)+(BONUS[R.id+"_"+i]||0));b[i]+=v;p[i]+=v;}if(R.w1!==null){p[R.w1]+=R.g||0;w[R.w1]++;}if(R.w2!==null)p[R.w2]+=R.s||0;});
 for(var j=0;j<n;j++)p[j]+=fb[j];
 return {p:p,w:w,b:b,fb:fb};
}
var FARTMAP={};
function nameKey(n){return String(n||"x").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,24)||"x";}
function fartsOf(o,i){var v=FARTMAP[nameKey(o.names[i])];return (v&&v.c)||0;}
function standings(o){o=o||S;var T=totals(o);var rows=o.names.map(function(n,i){return {i:i,n:n,p:T.p[i],w:T.w[i],b:T.b[i],fb:T.fb[i],f:fartsOf(o,i)};});rows.sort(function(a,b){return b.p-a.p||a.f-b.f||b.w-a.w||b.b-a.b||a.i-b.i;});return rows;}
function startText(r){if(r.first===null||r.first===undefined)return "";if(r.k===0)return "Parte "+S.names[r.first]+" (pole position estratta a caso), poi in senso orario.";return "Parte "+S.names[r.first]+", scelto da "+S.names[r.starterBy]+" (ultimo in classifica), poi in senso orario.";}
function raceLabel(k){var p=pts(S)[k]||[0,0];return 'Gara '+(k+1)+' di '+RACES+' · '+p[0]+'/'+p[1]+' punti';}
function takenMap(r){var m={};Object.keys(r.picks).forEach(function(k){m[r.picks[k]]=+k;});return m;}
function clockwise(o,start){var n=o.names.length,a=[];for(var q=0;q<n;q++)a.push((start+q)%n);return a;}
/* ordine di scelta gare 2-4: più punti prima; pari → meno rutti/scoregge; pari → livello carta gara precedente; pari → caso */
function chooseOrder(o){
 var P=totals(o).p,prev=curOf(o);var rk={};for(var i=0;i<o.names.length;i++){var c=prev&&prev.picks?prev.picks[i]:null;rk[i]=c?(TRANK[tierIn(o,c)]||0):0;}
 var arr=o.names.map(function(_,i){return {i:i,p:P[i],f:fartsOf(o,i),t:rk[i],x:Math.random()};});
 arr.sort(function(a,b){return b.p-a.p||a.f-b.f||b.t-a.t||a.x-b.x;});
 var why=[];for(var j=1;j<arr.length;j++){var a=arr[j-1],b=arr[j];if(a.p===b.p)why.push(a.f!==b.f?(o.names[a.i]+" prima di "+o.names[b.i]+": stessi punti, meno rutti e scoregge ("+a.f+" contro "+b.f+")"):a.t!==b.t?(o.names[a.i]+" prima di "+o.names[b.i]+": stessi punti, carta di livello più alto nella gara prima"):(o.names[a.i]+" prima di "+o.names[b.i]+": parità totale, estratto a caso"));}
 return {order:arr.map(function(z){return z.i;}),why:why};
}
function allNames(o){return o.roster.map(function(x){return x.n;});}
function startTournament(o,order,teams){
 var n=order.length;applyGlobalTiers(o);o.names=order;o.teams=teams;o.started=true;o.races=[];o.hands=order.map(function(){return [];});
 o.pole={start:Math.floor(Math.random()*n),reveal:Math.floor(Math.random()*n),draft:Math.floor(Math.random()*n)};
 o.dr=null;o.deck=[];o.stage="pole";o.tid=Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36);
}
function startDraft(o){
 var n=o.names.length;o.deck=Core.shuffle(allNames(o),Math.random);o.hands=o.names.map(function(){return [];});
 o.dr={round:0,order:clockwise(o,o.pole.draft),revealed:o.deck.splice(0,Math.min(n+1,o.deck.length)),picks:{}};o.stage="draft";
}
function me(){if(!GAME)return null;if(GAME.role==="banco")return "banco";if(!S||!S.started)return "lobby";var nm=GAME.name.toLowerCase();for(var i=0;i<S.names.length;i++)if(S.names[i].toLowerCase()===nm)return i;return "out";}
function lobbyNames(){
 var list=Object.keys(PLAYERS).map(function(k){return PLAYERS[k];}).filter(Boolean).sort(function(a,b){return (a.t||0)-(b.t||0);}).map(function(p){return p.name;});
 var seat=(S&&S.seat||[]).filter(function(n){return list.indexOf(n)>=0;});
 list.forEach(function(n){if(seat.indexOf(n)<0)seat.push(n);});return seat;
}
function playerByName(name){var p=null;Object.keys(PLAYERS).forEach(function(k){if(PLAYERS[k]&&PLAYERS[k].name===name)p=PLAYERS[k];});return p;}
function playerIdByName(name){var id=null;Object.keys(PLAYERS).forEach(function(k){if(PLAYERS[k]&&PLAYERS[k].name===name)id=k;});return id;}
function lobbyTeam(name){var p=playerByName(name);return (p&&p.team)||("Team "+name);}
/* ---- giocatori registrati e storico ---- */
var PICKSEL=null;
var DEFPLAYERS=["Luigi","Riccardo","Mirko","Simone","Luca","Fabio"],REG={},HIST={},CARDV=null,STATSV=false;
function knownPlayers(){
 var seen={},out=[];function add(n){n=String(n||"").trim();if(!n)return;var k=nameKey(n);if(seen[k])return;seen[k]=1;out.push(n);}
 DEFPLAYERS.forEach(add);
 var extra=[];Object.keys(REG).forEach(function(k){if(REG[k]&&REG[k].name)extra.push(REG[k].name);});
 Object.keys(HIST).forEach(function(id){(HIST[id]&&HIST[id].players||[]).forEach(function(p){Core.members(p.name).forEach(function(m){extra.push(m);});});});
 extra.sort(function(a,b){return a.localeCompare(b,"it");}).forEach(add);return out;
}
function histList(){return Object.keys(HIST).map(function(id){var h=HIST[id];if(h)h.id=id;return h;}).filter(function(h){return h&&h.players&&h.players.length;}).sort(function(a,b){return (b.date||0)-(a.date||0);});}
function playerStats(name){
 var k=nameKey(name),st={name:name,t:0,w:0,pod:0,pts:0,races:0,rw:0,last:null};
 histList().forEach(function(h){h.players.forEach(function(p){if(!Core.members(p.name).some(function(m){return nameKey(m)===k;}))return;st.t++;st.pts+=p.p||0;if(st.best===undefined||(p.p||0)>st.best)st.best=p.p||0;if(p.pos===1)st.w++;if(p.pos<=3)st.pod++;st.races+=(h.races||[]).length;st.rw+=p.rw||0;if(!st.last||h.date>st.last)st.last=h.date;});});
 st.wr=st.t?Math.round(st.w/st.t*100):null;st.avg=st.t?Math.round(st.pts/st.t*10)/10:null;st.rwr=st.races?Math.round(st.rw/st.races*100):null;return st;
}
var ELOC=null,ELOH=null,ELOTIP="";
function eloNow(){if(ELOH!==HIST||!ELOC){ELOH=HIST;ELOC=Core.elo(histList());}return ELOC;}
function eloOf(name){var x=eloNow().ratings[nameKey(name)];return x?x.r:Core.ELO.start;}
function eloTxt(d){return (d>0?'+':(d<0?'−':'±'))+Math.abs(d);}
function eloInfo(tid,name){var m=eloNow().per[tid];return m?m[nameKey(Core.members(name)[0]||name)]:null;}
var ECOL=["#2a78d6","#eb6834","#1baf7a","#eda100","#e87ba4","#008300","#6250d6","#e34948"];
function eloChart(){
 var E=eloNow(),L=E.list;if(!L.length)return '';
 var order=knownPlayers().filter(function(n){return E.series[nameKey(n)];}).slice(0,8);
 var vw=(window.innerWidth||800),W=Math.max(320,Math.min(820,vw-(vw<700?70:120))),H=vw<700?220:260,ml=40,mr=16+7.2*Math.max.apply(null,[6].concat(knownPlayers().filter(function(n){return E.series[nameKey(n)];}).slice(0,8).map(function(n){return n.length+5;}))),mt=14,mb=28,nT=L.length;
 var all=[Core.ELO.start];order.forEach(function(n){E.series[nameKey(n)].forEach(function(p){all.push(p.r);});});
 var lo=Math.min.apply(null,all),hi=Math.max.apply(null,all);var st=hi-lo>120?50:25;lo=Math.floor((lo-5)/st)*st;hi=Math.ceil((hi+5)/st)*st;if(hi===lo)hi=lo+st;
 function X(t){return ml+(nT?(t+1)/nT:0)*(W-ml-mr);}function Y(r){return mt+(hi-r)/(hi-lo)*(H-mt-mb);}
 var g='<svg class="elochart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Andamento dello S.K.U.L.O. per giocatore">';
 for(var v=lo;v<=hi;v+=st)g+='<line x1="'+ml+'" x2="'+(W-mr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="'+(v===Core.ELO.start?'#8f8ca8':'#e3e3ee')+'" stroke-width="1"'+(v===Core.ELO.start?' stroke-dasharray="4 4"':'')+'/><text x="'+(ml-8)+'" y="'+(Y(v)+4)+'" text-anchor="end" class="ax">'+v+'</text>';
 g+='<text x="'+X(-1)+'" y="'+(H-8)+'" text-anchor="middle" class="ax">inizio</text>';
 var lastLab="",every=Math.max(1,Math.ceil(nT/Math.max(2,Math.floor((W-ml-mr)/56))));L.forEach(function(h,t){var lb=fmtShort(h.date);if(lb===lastLab||(t%every!==0&&t!==nT-1))return;lastLab=lb;if(true)g+='<text x="'+X(t)+'" y="'+(H-8)+'" text-anchor="middle" class="ax">'+esc(fmtShort(h.date))+'</text>';});
 var ends=[];
 order.forEach(function(n,ci){var k=nameKey(n),ser=E.series[k],c=ECOL[ci];
  var pts=[[X(-1),Y(Core.ELO.start)]].concat(ser.map(function(p){return [X(p.t),Y(p.r)];}));
  g+='<polyline fill="none" stroke="'+c+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="'+pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' ')+'"/>';
  ser.forEach(function(p){var tip=n+' · '+fmtDate(p.date)+' · '+p.r+' ('+eloTxt(p.d)+')';g+='<circle cx="'+X(p.t)+'" cy="'+Y(p.r)+'" r="4.5" fill="'+c+'" stroke="#fff" stroke-width="2"/><circle cx="'+X(p.t)+'" cy="'+Y(p.r)+'" r="13" fill="transparent" data-act="elotip" data-n="'+esc(tip)+'"><title>'+esc(tip)+'</title></circle>';});
  var lp=ser[ser.length-1];ends.push({y:Y(lp.r),n:n,r:lp.r,c:c,x:X(lp.t)});});
 ends.sort(function(a,b){return a.y-b.y;});for(var i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<14)ends[i].y=ends[i-1].y+14;
 ends.forEach(function(e){g+='<text x="'+(W-mr+8)+'" y="'+(e.y+4)+'" class="lab">'+esc(e.n)+' '+e.r+'</text><line x1="'+(e.x+6)+'" x2="'+(W-mr+4)+'" y1="'+e.y+'" y2="'+e.y+'" stroke="'+e.c+'" stroke-width="1" opacity=".5"/>';});
 g+='</svg>';
 var leg='<div class="row" style="gap:6px 12px;margin:6px 0 4px">'+order.map(function(n,ci){return '<span class="eleg"><i style="background:'+ECOL[ci]+'"></i>'+esc(n)+'</span>';}).join("")+'</div>';
 return '<div class="st"><div class="lbl">Andamento dello S.K.U.L.O.</div><p class="mut" style="margin:2px 0 0;font-size:13px;font-style:italic">Supremazia Konquistata Usando Lanci Onesti</p>'+leg+'<div class="chartwrap">'+g+'</div><p class="mut" style="margin:4px 0 0;min-height:1.4em" aria-live="polite">'+(ELOTIP?esc(ELOTIP):'Tocca un punto per i dettagli. Si parte tutti da '+Core.ELO.start+'.')+'</p></div>';
}
function fmtShort(t){try{return new Date(t).toLocaleDateString("it-IT",{day:"numeric",month:"short"});}catch(e){return "";}}
function avgTier(cards){var v=(cards||[]).map(function(c){var r=TRANK[tierOf(c)||"D"];return r===undefined?1:r;});if(!v.length)return null;var a=v.reduce(function(x,y){return x+y;},0)/v.length;return {v:Math.round(a*10)/10,l:TLIST[Math.max(0,Math.min(5,Math.round(a)))]};}
function wrText(st){return st.t?st.wr+'% ('+st.w+' su '+st.t+')':'primo torneo';}
function buildHistory(o){
 var rows=standings(o),T=totals(o);
 return {date:Date.now(),code:(GAME&&GAME.code)||"",tid:o.tid||"",
  players:rows.map(function(x,q){var cards=[];o.races.forEach(function(R){if(R.picks&&R.picks[x.i])cards.push(R.picks[x.i]);});
   var rw=o.races.filter(function(R){return R.w1===x.i;}).length;
   return {name:x.n,team:(o.teams&&o.teams[x.i])||"",pos:q+1,p:x.p,rw:rw,b:x.b,f:x.f,fb:x.fb,cards:cards,last:(o.hands[x.i]||[])[0]||""};}),
  races:o.races.map(function(R){return {w1:o.names[R.w1],c1:R.picks[R.w1],w2:o.names[R.w2],c2:R.picks[R.w2],g:R.g,s:R.s};})};
}
/* chi deve agire adesso (per il "ding" sul telefono) */
function myTurnNow(m){
 if(typeof m!=="number"||!S)return false;
 if(S.stage==="draft"&&S.dr)return S.dr.order[Object.keys(S.dr.picks).length]===m;
 var r=cur();if(!r)return false;var ph=phase(r);
 if(ph==="sel")return r.order[nPicks(r)]===m;
 if(ph==="starter")return r.starterBy===m;
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
  join:function(c,name,team){var m=get("games/"+c+"/players")||{};var ex=null;Object.keys(m).forEach(function(id){if(m[id].name.toLowerCase()===name.toLowerCase())ex=id;});if(!ex)m["p"+Date.now().toString(36)+Math.floor(Math.random()*1e4)]={name:name,t:Date.now(),team:team||""};else if(team)m[ex].team=team;put("games/"+c+"/players",m);return Promise.resolve();},
  removePlayer:function(c,id){var m=get("games/"+c+"/players")||{};delete m[id];put("games/"+c+"/players",m);return Promise.resolve();},
  watchBonus:function(c,cb){return watch("games/"+c+"/bonus",function(v){cb(v||{});});},
  incBonus:function(c,idx,rid,d){var m=get("games/"+c+"/bonus")||{};m[idx]=m[idx]||{};m[idx][rid]=Math.max(0,(m[idx][rid]||0)+d);put("games/"+c+"/bonus",m);return Promise.resolve();},
  watchFarts:function(c,cb){return watch("games/"+c+"/farts",function(v){cb(v||{});});},
  sendFart:function(c,key,data){var m=get("games/"+c+"/farts")||{};data.t=Date.now();data.c=((m[key]&&m[key].c)||0)+1;m[key]=data;put("games/"+c+"/farts",m);return Promise.resolve();},
  resetFarts:function(c){put("games/"+c+"/farts",{});return Promise.resolve();},
  watchTiers:function(cb){return watch("global/tiers",function(v){cb(v||{});});},
  shiftTier:function(key,from,d){var m=get("global/tiers")||{};m[key]=shifted(m[key]||from,d);put("global/tiers",m);return Promise.resolve();},
  setTiers:function(map){put("global/tiers",map);return Promise.resolve();},
  watchImages:function(cb){return watch("global/images",function(v){cb(v||{});});},
  watchHistory:function(cb){return watch("global/history",function(v){cb(v||{});});},
  saveHistory:function(id,obj){var m=get("global/history")||{};m[id]=obj;put("global/history",m);return Promise.resolve();},
  removeHistory:function(id){var m=get("global/history")||{};delete m[id];put("global/history",m);return Promise.resolve();},
  watchReg:function(cb){return watch("global/players",function(v){cb(v||{});});},
  setElo:function(m){put("global/elo",m);return Promise.resolve();},
  register:function(name){var m=get("global/players")||{};var k=nameKey(name);if(!m[k]){m[k]={name:name,t:Date.now()};put("global/players",m);}return Promise.resolve();},
  setImage:function(key,data){var m=get("global/images")||{};if(data)m[key]=data;else delete m[key];put("global/images",m);return Promise.resolve();},
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
  join:function(c,name,team){var ref=r("games/"+c+"/players");return ref.get().then(function(s){var m=s.val()||{};var ex=null;Object.keys(m).forEach(function(id){if(m[id]&&m[id].name&&m[id].name.toLowerCase()===name.toLowerCase())ex=id;});if(!ex)return ref.push({name:name,t:firebase.database.ServerValue.TIMESTAMP,team:team||""});if(team)return ref.child(ex+"/team").set(team);});},
  removePlayer:function(c,id){return r("games/"+c+"/players/"+id).remove();},
  watchBonus:function(c,cb){return on(r("games/"+c+"/bonus"),function(v){cb(v||{});});},
  incBonus:function(c,idx,rid,d){return r("games/"+c+"/bonus/"+idx+"/"+rid).transaction(function(v){return Math.max(0,(v||0)+d);});},
  watchFarts:function(c,cb){return on(r("games/"+c+"/farts"),function(v){cb(v||{});});},
  sendFart:function(c,key,data){data.t=Date.now();return r("games/"+c+"/farts/"+key).transaction(function(v){data.c=((v&&v.c)||0)+1;return data;});},
  resetFarts:function(c){return r("games/"+c+"/farts").remove();},
  watchTiers:function(cb){return on(r("global/tiers"),function(v){cb(v||{});});},
  shiftTier:function(key,from,d){return r("global/tiers/"+key).transaction(function(v){return shifted(v||from,d);});},
  setTiers:function(map){return r("global/tiers").set(map);},
  watchImages:function(cb){return on(r("global/images"),function(v){cb(v||{});});},
  watchHistory:function(cb){return on(r("global/history"),function(v){cb(v||{});});},
  saveHistory:function(id,obj){return r("global/history/"+id).set(obj);},
  removeHistory:function(id){return r("global/history/"+id).remove();},
  watchReg:function(cb){return on(r("global/players"),function(v){cb(v||{});});},
  setElo:function(m){return r("global/elo").set(m);},
  register:function(name){var ref=r("global/players/"+nameKey(name));return ref.transaction(function(v){return v||{name:name,t:Date.now()};});},
  setImage:function(key,data){return data?r("global/images/"+key).set(data):r("global/images/"+key).remove();},
  watchConn:function(cb){var ref=db.ref(".info/connected");var h=ref.on("value",function(s){cb(!!s.val());});return function(){ref.off("value",h);};}
 };
}

/* ---------------- sound ---------------- */
function unlockAudio(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();preloadClips();}catch(e){}}
document.addEventListener("pointerdown",unlockAudio,{passive:true});
function ding(){try{unlockAudio();var c=AC;if(!c)return;var t=c.currentTime,g=c.createGain(),o=c.createOscillator();g.connect(c.destination);o.type="sine";o.frequency.setValueAtTime(880,t);o.frequency.setValueAtTime(1320,t+.12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.35,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);o.start(t);o.stop(t+.55);}catch(e){}}
var FARTS=[["Scoreggia · Toot","f01"],["Rutto · Classico","r01"],["Scoreggia · Bagnata","f02"],["Rutto · Profondo","r02"],["Scoreggia · Secca","f03"],["Rutto · Cavernoso","r03"],["Scoreggia · Con sorpresa","f04"],["Rutto · Acuto","r04"],["Scoreggia · Infernale","f05"],["Rutto · Doppio","r05"],["Scoreggia · Maratona","f06"],["Rutto · Triplo","r06"],["Scoreggia · Lamento","f07"],["Rutto · In cattedrale","r07"],["Scoreggia · Fanfara","f08"],["Rutto · Tremolante","r08"],["Scoreggia · Tirami il dito","f09"],["Rutto · Al rallentatore","r09"],["Scoreggia · Elefantiaca","f10"],["Rutto · Del gigante","r10"]];
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
function artOf(n){return IMGS[tkey(n)]||null;}
function aCard(n,o){
 o=o||{};var t=tierOf(n),a=abOf(n),bg=o.taken!=null?"#e3e4ee":(TC[t]||"#e9e9f2"),img=artOf(n);
 return '<div class="ac'+(o.taken!=null?' taken':'')+(o.flip?' flip':'')+'" style="background:'+bg+(o.delay?';animation-delay:'+o.delay+'ms':'')+'">'+
  '<div class="ah"><span class="nm">'+esc(n)+'</span>'+(o.fav!==undefined?'<button type="button" class="star'+(o.fav?' on':'')+'" data-act="fav" data-n="'+esc(n)+'" aria-label="'+(o.fav?'Togli dai preferiti ':'Segna come preferito ')+esc(n)+'" aria-pressed="'+(o.fav?'true':'false')+'">'+STAR+'</button>':'')+'<span class="tier" title="Livello">'+(t||'?')+'</span></div>'+
  (img?'<img class="art" src="'+img+'" alt="'+esc(n)+'" loading="lazy">':'')+
  (a[1]?'<div class="ab">'+(a[0]?'<span class="pw">'+esc(a[0])+'</span>':'')+esc(a[1])+'</div>':'<div class="ab mut">Abilità non inserita.</div>')+
  (o.btn||'')+(o.taken!=null?'<div class="stamp">Presa da '+esc(o.taken)+'</div>':'')+'</div>';
}
function orderStrip(order,picks,hideCards){
 var np=Object.keys(picks).length;
 return '<div class="order" aria-label="Ordine di scelta">'+order.map(function(p,k){var cls=k<np?' done':(k===np?' now':'');return '<div class="os'+cls+'">'+dot(p)+'<span>'+(k+1)+'. '+esc(S.names[p])+'</span>'+(k<np&&!hideCards?'<small>· '+esc(picks[p])+'</small>':'')+'</div>';}).join("")+'</div>';
}
function board(){
 var rows=standings(),ri=S.races.length-1,r=cur(),end=S.stage==="end",P=pts(S);
 var h='<div class="board"><div class="lanes" style="--n:'+(RACES+(end?1:0))+'">';
 h+='<div class="lane head"><span></span><span style="text-align:left;padding-left:12px">Team</span>';
 for(var k=0;k<RACES;k++)h+='<span>G'+(k+1)+'<br><small style="font-weight:800;letter-spacing:.04em">'+P[k][0]+'/'+P[k][1]+'</small></span>';
 if(end)h+='<span>Carta<br><small>bonus</small></span>';
 h+='<span><span class="flag"></span> Tot</span></div>';
 rows.forEach(function(x,pos){
  h+='<div class="lane" data-flip="p'+x.i+'"><span class="pos">'+(pos+1)+'</span><span class="pn">'+dot(x.i)+'<span style="display:flex;flex-direction:column;min-width:0;line-height:1.05"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(teamOf(x.i))+'</span><small class="fc">'+esc(x.n)+' · 💨 '+x.f+'</small></span></span>';
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
 h+='<p class="mut" style="margin:14px 0 0">Punti 1°/2°: '+P.map(function(p,k){return 'G'+(k+1)+' '+p[0]+'/'+p[1];}).join(' · ')+'. Bronzo: +1 per stella o potere. Carta finale: S/A +2, B/C +1, D/E 0.</p>';
 return h;
}
function awards(){
 var T=totals(S),n=N(),best=null,silv=S.names.map(function(){return 0;});
 S.races.forEach(function(R,k){if(!R.done)return;if(R.w2!==null)silv[R.w2]++;for(var p=0;p<n;p++){var v=raceScore(R,p);if(!best||v>best.v)best={v:v,p:p,k:k,a:R.picks[p]};}});
 function arg(a){var m=-1,i=-1;a.forEach(function(v,k){if(v>m){m=v;i=k;}});return {i:i,v:m};}
 var bz=arg(T.b),sv=arg(silv),out=[];
 if(bz.v>0)out.push(['Re del bronzo',teamOf(bz.i)+' · '+bz.v+' fiche bronzo']);
 if(sv.v>0)out.push(['Argento vivo',teamOf(sv.i)+' · '+sv.v+' secondi posti']);
 if(best&&best.v>0)out.push(['Colpo grosso',teamOf(best.p)+' · '+best.v+' punti in gara '+(best.k+1)+' con '+best.a]);
 return out;
}
/* ---- cosa sta succedendo (mostrato a tutti) ---- */
function stageInfo(){
 var n=N(),r=cur(),ph=phase(r),k=S.races.length;
 if(S.stage==="pole")return {t:"Pole position",x:"Estratti a caso: chi parte nella gara 1 ("+S.names[S.pole.start]+"), chi sceglie per primo il racer della gara 1 ("+S.names[S.pole.reveal]+") e chi comincia il draft ("+S.names[S.pole.draft]+")."};
 if(S.stage==="draft"){var d=S.dr,np=Object.keys(d.picks).length;return {t:"Draft comune · giro "+(d.round+1)+" di "+DRAFTS,x:"Nella gara 1 parte "+S.names[S.pole.start]+". Si rivelano "+d.revealed.length+" carte e ognuno ne prende una, in senso orario. Ora sceglie "+S.names[d.order[np]]+". La carta che avanza si scarta. Alla fine avrete 5 carte a testa."};}
 if(S.stage==="end")return {t:"Torneo finito",x:"La carta rimasta in mano dà punti bonus: S o A +2, B o C +1, D 0."};
 if(ph==="sel"){var who=r.order[nPicks(r)];return {t:"Gara "+k+" · scelta del racer",x:"Parte "+S.names[r.first]+". "+(k===1?"Si sceglie in senso orario a partire da "+S.names[S.pole.reveal]+" (estratto a caso).":"Si sceglie dalla propria mano, da chi ha più punti.")+" Ora sceglie "+S.names[who]+"."};}
 if(ph==="starter")return {t:"Gara "+k+" · chi parte?",x:S.names[r.starterBy]+" è ultimo in classifica e decide chi parte per primo. Poi si scelgono i racer."};
 if(ph==="race")return {t:"Gara "+k+" in corso",x:startText(r)+" Premete +1 sul telefono per stelle e poteri."};
 if(ph==="result")return {t:"Gara "+k+" · arrivo",x:"Il banco registra 1°, 2° e ultimo. La carta che ha vinto sale di un livello, quella dell'ultimo scende di uno."};
 if(k===0)return {t:"Squadre pronte! Gara 1",x:"Parte "+S.names[S.pole.start]+" (estratto a caso). Si sceglie il racer in senso orario a partire da "+S.names[S.pole.reveal]+"."};
 return {t:"Prossima: gara "+(k+1),x:"Prima l'ultimo in classifica decide chi parte, poi si sceglie il racer dalla propria mano, da chi ha più punti (pari: meno rutti e scoregge, poi livello della carta usata nella gara prima)."};
}
function infoBox(big){var si=stageInfo();return '<div class="st msg" role="status"><div class="lbl">Cosa succede ora</div><div class="t" style="font-size:'+(big?28:22)+'px;margin:2px 0 4px">'+esc(si.t)+'</div><div style="font-weight:700">'+esc(si.x)+'</div></div>';}
function cardPill(c){return '<button type="button" class="pill cardpill" data-act="card" data-n="'+esc(c)+'" style="background:'+(TC[tierOf(c)]||'#e9e9f2')+'" aria-label="Abilità di '+esc(c)+'">'+esc(c)+' · '+(tierOf(c)||'?')+'</button>';}
function handRow(i,label){var h=S.hands[i]||[];return '<div class="st"><div class="lbl">'+(label||'Le tue carte')+' ('+h.length+') · tocca per l\'abilità</div><div class="row" style="margin-top:8px">'+(h.length?h.map(cardPill).join(""):'<span class="mut">nessuna</span>')+'</div></div>';}
function startBanner(i){return '<div class="st startban"><span class="lbl">Chi parte</span><span class="row" style="gap:8px">'+dot(i)+'<b class="t" style="font-size:24px">'+esc(S.names[i])+'</b></span></div>';}
function rosterBox(i,mine){
 var h=S.hands[i]||[],st=playerStats(S.names[i]),av=avgTier(h);
 return '<div class="st rosterbox"><div class="row">'+dot(i)+'<div class="grow" style="min-width:0"><div class="t" style="font-size:22px;line-height:1.05">'+esc(teamOf(i))+'</div><div class="mut">'+esc(S.names[i])+'</div></div>'+(av?'<span class="tierbig" style="background:'+(TC[av.l]||'#e9e9f2')+'" title="Livello medio della squadra">'+av.l+'<small>'+String(av.v).replace(".",",")+'</small></span>':'')+'</div>'+
  '<div class="row" style="gap:8px;margin:10px 0 8px"><span class="pill" style="background:var(--yel)">S.K.U.L.O. '+eloOf(S.names[i])+'</span><span class="pill">Vittorie tornei: '+esc(wrText(st))+'</span>'+(st.rwr!==null?'<span class="pill">Gare vinte: '+st.rwr+'%</span>':'')+'</div>'+
  '<div class="row" style="gap:6px">'+h.map(cardPill).join("")+'</div></div>';
}
function tierChanges(r){return r.tchg&&r.tchg.length?'<div class="st msg" style="margin-top:12px"><div class="lbl">Livelli cambiati</div><div class="row" style="margin-top:6px">'+r.tchg.map(function(c){return '<span class="pill" style="background:'+(TC[c.to]||'#e9e9f2')+'">'+esc(c.n)+' '+c.from+' → '+c.to+(TRANK[c.to]>TRANK[c.from]?' ▲':' ▼')+'</span>';}).join("")+'</div></div>':'';}

/* ---------------- banco ---------------- */
function vBanco(){
 var h=modeBanner()+'<div class="top"><span class="logo t">Magical Outlet</span><span class="pill">Codice '+esc(GAME.code)+'</span><div class="grow"></div><nav class="tabs" aria-label="Sezioni">'+[["live","Diretta"],["board","Tabellone"],["cards","Carte"],["set","Impostazioni"]].map(function(t){return '<button type="button" class="btn sm" data-act="tab" data-v="'+t[0]+'"'+(TAB===t[0]?' aria-current="page"':'')+'>'+t[1]+'</button>';}).join("")+'<button type="button" class="btn sm" data-act="stats">Storico</button></nav></div>';
 if(msg)h+='<div class="st msg" role="status" style="margin-bottom:14px;font-weight:800">'+esc(msg)+'</div>';
 if(TAB==="board")h+='<div class="st"><h2 class="t" style="font-size:28px;margin-bottom:12px">Tabellone</h2>'+board()+'</div>';
 else if(TAB==="cards")h+=vCards();
 else if(TAB==="set")h+=vSet();
 else h+=vLive();
 h+='<p class="sync" style="margin-top:18px">'+(SYNC?'● Collegato':'○ Non collegato: controlla la connessione')+' · Questo dispositivo è il banco · <button type="button" class="btn sm alt" data-act="leave" style="min-height:36px">Esci</button></p>';
 return h;
}
function poleCard(lbl,i,delay){return '<div class="st flip" style="animation-delay:'+delay+'ms;text-align:center;padding:20px"><div class="lbl">'+lbl+'</div><div style="margin:12px 0 6px">'+dot(i)+'</div><div class="t" style="font-size:32px">'+esc(S.names[i])+'</div><div class="mut">'+esc(teamOf(i))+'</div></div>';}
function vLive(){
 var r=cur(),ph=phase(r),n=N(),k=S.races.length,h='';
 if(finished())return vEnd();
 h+='<div style="margin-bottom:16px">'+infoBox(true)+'</div>';
 if(S.stage==="pole"){
  var fl=once("pole");
  h+='<h2 class="t" style="font-size:40px;margin-bottom:14px">Pole position</h2><div class="grid">'+(fl?'':'')+poleCard('Parte nella gara 1',S.pole.start,0)+poleCard('Sceglie per primo il racer della gara 1',S.pole.reveal,400)+poleCard('Comincia il draft',S.pole.draft,800)+'</div>';
  h+='<div style="margin-top:20px"><button type="button" class="btn big acc" data-act="startdraft">Via al draft!</button></div>';
  return h;
 }
 if(S.stage==="draft"){
  var d=S.dr,np=Object.keys(d.picks).length,who=d.order[np],tm={};Object.keys(d.picks).forEach(function(q){tm[d.picks[q]]=+q;});
  h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:36px">Sceglie <span class="name-tag">'+esc(S.names[who])+'</span></h2><span class="pill">Giro '+(d.round+1)+'/'+DRAFTS+'</span><span class="pill" style="background:var(--yel)">Gara 1: parte '+esc(S.names[S.pole.start])+'</span></div>';
  h+='<div style="margin-bottom:18px">'+orderStrip(d.order,d.picks)+'</div>';
  var fl2=once("dr"+d.round+(d.revealed[0]||""));
  h+='<div class="grid">'+d.revealed.map(function(nm,q){var tk=tm[nm];return aCard(nm,{taken:tk!==undefined?S.names[tk]:null,flip:fl2,delay:q*140,btn:tk===undefined?'<button type="button" class="btn sm alt" data-act="drpick" data-n="'+esc(nm)+'" data-w="'+who+'">Scegli per '+esc(S.names[who])+'</button>':''});}).join("")+'</div>';
  if(np>0)h+='<p style="margin-top:16px"><button type="button" class="btn sm alt" data-act="drundo">Annulla l\'ultima scelta</button></p>';
  h+='<p class="mut" style="margin-top:12px">Ognuno sceglie dal proprio telefono. Chi non ha il telefono sceglie qui.</p>';
  return h;
 }
 if(ph==="none"||ph==="done"){
  h+='<div class="st row" style="gap:24px;align-items:center;padding:20px"><div class="grow stack" style="gap:8px"><span class="pill" style="align-self:flex-start">'+raceLabel(k)+'</span><h2 class="t" style="font-size:36px">'+(k===0?'Gara 1: parte '+esc(S.names[S.pole.start]):'Gara '+(k+1)+': l\'ultimo decide chi parte')+'</h2><div><button type="button" class="btn big acc" data-act="newrace">'+(k===0?'Inizia la scelta dei racer':'Inizia la gara '+(k+1))+'</button></div></div></div>';
  if(k===0){var once0=once("rosters");h+='<h2 class="t" style="font-size:30px;margin:20px 0 12px">Le squadre</h2><div class="grid">'+S.names.map(function(_,i){return rosterBox(i);}).join("")+'</div>';}
  if(r&&r.done){h+=lastResult(r,k-1)+tierChanges(r);h+='<p style="margin:10px 0 0"><button type="button" class="btn sm alt" data-act="reopen">Riapri la gara '+k+' per correggere</button></p>';}
  h+='<div class="st" style="margin-top:18px"><h2 class="t" style="font-size:26px;margin-bottom:12px">Tabellone</h2>'+board()+'</div>';
  return h;
 }
 h+='<div class="row" style="margin-bottom:14px"><span class="pill">'+raceLabel(k-1)+'</span><span class="grow"></span><button type="button" class="btn sm alt" data-act="abort">Annulla gara</button></div>';
 if(ph==="sel"){
  var npk=nPicks(r),who2=r.order[npk];
  h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:40px">Sceglie <span class="name-tag">'+esc(S.names[who2])+'</span></h2><span class="grow"></span><span class="pill" style="background:var(--yel);font-size:15px">Parte '+esc(S.names[r.first])+'</span>'+(r.k>0&&npk===0?'<button type="button" class="btn sm alt" data-act="unstart">Cambia chi parte</button>':'')+'</div>';
  h+='<div style="margin-bottom:18px">'+orderStrip(r.order,r.picks)+(r.why&&r.why.length?'<p class="mut" style="margin:10px 0 0">Pareggi: '+esc(r.why.join(" · "))+'.</p>':'')+'</div>';
  h+='<div class="grid">'+r.order.filter(function(p){return r.picks[p]!==undefined;}).map(function(p){return aCard(r.picks[p],{btn:'<div class="row">'+dot(p)+'<b>'+esc(S.names[p])+'</b></div>'});}).join("")+'</div>';
  h+='<div class="st" style="margin-top:16px"><div class="row"><span class="grow mut">'+esc(S.names[who2])+' sceglie dal telefono. Se non ce l\'ha, il banco può scegliere al suo posto (la sua mano diventa visibile a tutti).</span><button type="button" class="btn sm alt" data-act="showhand" data-i="'+who2+'">'+(SHOWHAND===who2?'Nascondi la mano':'Scegli al posto suo')+'</button></div>';
  if(SHOWHAND===who2)h+='<div class="row" style="margin-top:10px">'+(S.hands[who2]||[]).map(function(c){return '<button type="button" class="btn alt" data-act="selpick" data-n="'+esc(c)+'" data-w="'+who2+'">'+esc(c)+' · '+(tierOf(c)||'?')+'</button>';}).join("")+'</div>';
  h+='</div>';
  if(npk>0)h+='<p style="margin-top:16px"><button type="button" class="btn sm alt" data-act="selundo">Annulla l\'ultima scelta</button></p>';
  return h;
 }
 if(ph==="starter"){
  h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:36px"><span class="name-tag">'+esc(S.names[r.starterBy])+'</span> sceglie chi parte</h2></div>';
  h+='<p class="mut" style="margin:0 0 12px">È ultimo in classifica: sceglie dal telefono chi tira per primo (poi si va in senso orario). Oppure tocca qui.</p>';
  var tt=totals(S).p;h+='<div class="row" style="gap:12px">'+S.names.map(function(nm,p){return '<button type="button" class="btn big alt" data-act="setstart" data-i="'+p+'">'+dot(p)+'Parte '+esc(nm)+' <small class="mut">· '+tt[p]+' pt</small></button>';}).join("")+'</div>';
  return h;
 }
 var fo=clockwise(S,r.first);
 if(ph==="race")h+='<div class="row" style="margin-bottom:14px"><h2 class="t" style="font-size:40px">In gara!</h2></div>';
 else h+=resultHead(r);
 h+='<div class="stack" style="gap:10px">'+fo.map(function(p){
  var nm=r.picks[p],a=abOf(nm),t=tierOf(nm),popped=POP[r.id+"_"+p]&&POP[r.id+"_"+p]>Date.now(),img=artOf(nm);
  return '<div class="rem" style="background:'+(TC[t]||'#e9e9f2')+'"><div class="who">'+dot(p)+'<span>'+esc(S.names[p])+'</span>'+(p===r.first?'<span class="first-badge">Parte</span>':'')+'</div>'+
   '<div class="ath">'+(img?'<img class="thumb" src="'+img+'" alt="">':'')+'<b>'+esc(nm)+'</b> <span class="mut">· '+(t||'?')+'</span><div>'+esc(a[1]||'')+'</div></div>'+
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
 var h='<div class="st" style="margin-top:18px">',k=S.races.length,P=pts(S)[r.k]||[0,0];
 if(r.w1===null){
  h+='<h3 class="t" style="font-size:26px;margin-bottom:10px">Chi è arrivato 1°?</h3><p class="mut" style="margin:0 0 10px">Prende '+P[0]+' punti.</p><div class="row">'+S.names.map(function(_,p){return '<button type="button" class="btn alt" data-act="w1" data-i="'+p+'">'+dot(p)+esc(S.names[p])+'</button>';}).join("")+'</div>';
 }else if(r.w2===null){
  h+='<h3 class="t" style="font-size:26px;margin-bottom:10px">Chi è arrivato 2°?</h3><p class="mut" style="margin:0 0 10px">Prende '+P[1]+' punti e la gara finisce.</p><div class="row">'+S.names.map(function(_,p){return p;}).filter(function(p){return p!==r.w1;}).map(function(p){return '<button type="button" class="btn alt" data-act="w2" data-i="'+p+'">'+dot(p)+esc(S.names[p])+'</button>';}).join("")+'</div><p style="margin:12px 0 0"><button type="button" class="btn sm alt" data-act="unw">Annulla il 1°</button></p>';
 }else{
  var cands=lastCands(r),hasLast=r.last!==null&&r.last!==undefined;
  if(cands.length){
   h+='<h3 class="t" style="font-size:26px;margin-bottom:6px">Chi è arrivato ultimo?</h3>';
   if(!TIEMODE){
    h+='<p class="mut" style="margin:0 0 10px">Tocca il giocatore arrivato ultimo. La sua carta scende di un livello, quella del vincitore sale di uno.</p>';
    h+='<div class="row">'+cands.map(function(p){var on=r.last===p;return '<button type="button" class="btn '+(on?'acc':'alt')+'" data-act="pickLast" data-i="'+p+'" aria-pressed="'+on+'">'+dot(p)+esc(S.names[p])+' · '+esc(r.picks[p])+'</button>';}).join("")+'</div>';
    if(hasLast&&r.lastDraw&&r.lastDraw.length>1)h+='<p style="margin:10px 0 0;font-weight:800">Sorteggiato tra '+r.lastDraw.map(function(p){return esc(S.names[p]);}).join(", ")+'.</p>';
    h+='<p style="margin:12px 0 0"><button type="button" class="btn sm alt" data-act="tiemode">Pari all\'ultimo posto? Sorteggia</button></p>';
   }else{
    h+='<p class="mut" style="margin:0 0 10px">Seleziona tutti gli atleti pari all\'ultimo posto, poi sorteggia.</p>';
    h+='<div class="row">'+cands.map(function(p){var on=LASTSEL.indexOf(p)>=0;return '<button type="button" class="btn '+(on?'yel':'alt')+'" data-act="lastsel" data-i="'+p+'" aria-pressed="'+on+'">'+(on?'✓ ':'')+dot(p)+esc(S.names[p])+' · '+esc(r.picks[p])+'</button>';}).join("")+'</div>';
    h+='<div class="row" style="margin-top:12px"><button type="button" class="btn acc" data-act="setlast"'+(LASTSEL.length<2?' disabled':'')+'>Sorteggia tra '+LASTSEL.length+'</button><button type="button" class="btn sm alt" data-act="tiemode">Annulla</button></div>';
   }
  }
  var ready=!cands.length||hasLast;
  if(ready)h+='<div class="st msg" style="margin-top:14px;box-shadow:none"><div class="lbl">Livelli che cambiano</div><div style="font-weight:800">'+tierPreview(r).join(' · ')+'</div></div>';
  h+='<h3 class="t" style="font-size:24px;margin:16px 0 6px">Gara finita!</h3><p class="mut" style="margin:0">Controllate i bronzi qui sopra, poi chiudete la gara.'+(k===RACES?' Chiudendo l\'ultima gara si rivelano le carte bonus.':'')+'</p>';
  h+='<div class="row" style="margin-top:16px"><button type="button" class="btn alt" data-act="unw2">Annulla il 2°</button><span class="grow"></span><button type="button" class="btn big acc" data-act="close"'+(ready?'':' disabled title="Prima indica chi è arrivato ultimo"')+'>Chiudi la gara</button></div>';
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
 var rows=standings(),h='<div class="st" style="text-align:center;padding:24px"><span class="pill">Torneo concluso</span><h2 class="t" style="font-size:46px;margin:10px 0 4px">Vince '+esc(teamOf(rows[0].i))+'!</h2><p class="mut" style="margin:0 0 22px">'+esc(rows[0].n)+'</p><div class="podium">';
 var ord=[1,0,2],hgt=[150,200,115],col=["#d9dee9","#ffc83d","#e8a46b"];
 ord.forEach(function(k,j){var x=rows[k];if(!x)return;h+='<div class="pod">'+dot(x.i)+'<div class="t" style="font-size:24px">'+esc(teamOf(x.i))+'</div><div class="mut">'+esc(x.n)+' · '+x.p+' punti</div><div class="blk" style="height:'+hgt[j]+'px;background:'+col[j]+'">'+(k+1)+'</div></div>';});
 h+='</div></div>';
 if(S.tid&&eloNow().per[S.tid])h+='<div class="st" style="margin-top:18px"><div class="lbl">S.K.U.L.O. dopo questo torneo</div><div class="row" style="gap:8px;margin-top:8px">'+rows.map(function(x){var e=eloInfo(S.tid,x.n);return e?'<span class="pill">'+esc(x.n)+' '+e.a+' <span class="elod'+(e.d>0?' up':(e.d<0?' dn':''))+'">'+eloTxt(e.d)+'</span></span>':'';}).join("")+'</div></div>';
 var fl=once("finalcards");
 h+='<h2 class="t" style="font-size:28px;margin:22px 0 12px">Le carte rimaste (bonus finale)</h2><div class="grid">'+S.names.map(function(nm,i){var c=(S.hands[i]||[])[0];if(!c)return '';return aCard(c,{flip:fl,delay:i*250,btn:'<div class="row">'+dot(i)+'<b class="grow">'+esc(teamOf(i))+'</b><span class="mini-b">+'+tierBonus(c)+'</span></div>'});}).join("")+'</div>';
 var aw=awards();
 if(aw.length)h+='<div class="grid" style="margin-top:18px">'+aw.map(function(a){return '<div class="st award"><span class="disc b mini" aria-hidden="true">★</span><div><div class="lbl">'+esc(a[0])+'</div><div style="font-weight:800">'+esc(a[1])+'</div></div></div>';}).join("")+'</div>';
 h+='<div class="st" style="margin-top:18px">'+board()+'</div>';
 h+='<div class="stack" style="margin-top:18px;gap:10px">'+shareBtn("end")+statsBtn()+'</div>';
 return h;
}

/* ---------------- player ---------------- */
function vPlayer(){
 var i=ME,n=N(),r=cur(),ph=phase(r),rows=standings(),pos=0,pts0=0,k=S.races.length;rows.forEach(function(x,q){if(x.i===i){pos=q+1;pts0=x.p;}});
 var h='<div class="ph stack">'+modeBanner()+'<div class="me">'+dot(i)+'<div class="grow"><div class="t" style="font-size:26px;line-height:1">'+esc(teamOf(i))+'</div><div class="mut">'+esc(S.names[i])+' · '+pts0+' punti · '+pos+'° · 💨 '+fartsOf(S,i)+' · '+esc(GAME.code)+'</div></div><button type="button" class="btn sm alt" data-act="leave">Esci</button></div>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 if(!SYNC&&!BE.local)h+='<div class="banner">Connessione persa: riprovo…</div>';
 if(finished()){var w=rows[0],c=(S.hands[i]||[])[0];return h+'<div class="st turn"><h2 class="t" style="font-size:32px">Torneo finito!</h2><p style="margin:4px 0 0;font-weight:800">Vince '+esc(teamOf(w.i))+' con '+w.p+' punti. Tu sei '+pos+'°.</p>'+(function(){var e=S.tid&&eloInfo(S.tid,S.names[i]);return e?'<p style="margin:6px 0 0;font-weight:900">S.K.U.L.O. '+e.a+' ('+eloTxt(e.d)+')</p>':'';})()+'</div>'+(c?'<div class="lbl">La tua carta bonus: +'+tierBonus(c)+'</div>'+aCard(c):'')+'<p class="mut">Guarda il podio sul tablet.</p>'+statsBtn()+'</div>';}
 if(S.stage==="pole"){
  var you=[];if(S.pole.start===i)you.push('parti tu nella gara 1');if(S.pole.reveal===i)you.push('scegli per primo il racer della gara 1');if(S.pole.draft===i)you.push('cominci tu il draft');
  return h+infoBox()+(you.length?'<div class="st turn"><h2 class="t" style="font-size:28px">Pole position!</h2><p style="margin:4px 0 0;font-weight:800">Tocca a te: '+you.join(', ')+'.</p></div>':'')+'</div>';
 }
 if(S.stage==="draft"){
  var d=S.dr,np=Object.keys(d.picks).length,who=d.order[np],tm={};Object.keys(d.picks).forEach(function(q){tm[d.picks[q]]=+q;});
  var my=d.order.indexOf(i),mine=who===i;
  h+='<div class="row" style="gap:8px"><span class="pill">Draft · giro '+(d.round+1)+' di '+DRAFTS+'</span><span class="grow"></span><span class="chipy">Gara 1: parte '+esc(S.names[S.pole.start])+'</span></div>';
  h+=turnBar(mine,'<span class="odot" style="background:'+pcol(who)+'">'+esc(ini(S.names,who))+'</span><b class="grow">Sceglie '+esc(S.names[who])+'</b><span class="mut">'+(d.picks[i]!==undefined?'hai preso '+esc(d.picks[i]):'tu tra '+(my-np))+'</span>');
  h+=orderDots(d.order,np,i);
  h+='<div class="grid2">'+d.revealed.map(function(c){var tk=tm[c];return miniCard(c,{by:tk!==undefined?S.names[tk]:null,act:(mine&&tk===undefined)?"drpick":null});}).join("")+'</div>';
  return h+teamBar(i,d.picks[i])+'</div>';
 }
 if(ph==="none"||ph==="done"){
  if(r&&r.done){var mine=raceScore(r,i);h+='<div class="st"><div class="lbl">Gara '+k+'</div><p style="margin:4px 0 0;font-weight:800">Con '+esc(r.picks[i])+' hai fatto '+mine+' punt'+(mine===1?'o':'i')+'.</p>'+(r.tchg&&r.tchg.length?'<p class="mut" style="margin:6px 0 0">Livelli cambiati: '+r.tchg.map(function(c){return esc(c.n)+' '+c.from+'→'+c.to;}).join(', ')+'</p>':'')+'</div>';}
  if(k===0)return h+infoBox()+'<h2 class="t" style="font-size:30px;margin:0">La tua squadra</h2>'+rosterBox(i,true)+(S.hands[i]||[]).map(function(c){return aCard(c);}).join("")+'</div>';
  return h+infoBox()+handRow(i)+'</div>';
 }
 h+='<span class="pill" style="align-self:flex-start">'+raceLabel(k-1)+'</span>';
 if(ph==="sel"){
  var npk=nPicks(r),who2=r.order[npk],my2=r.order.indexOf(i),mine2=who2===i&&r.picks[i]===undefined;FARTMINI=true;
  h+='<div class="row" style="gap:8px;margin-top:-6px"><span class="grow"></span><span class="chipy">Parte '+esc(S.names[r.first])+'</span></div>';
  if(r.picks[i]!==undefined)h+='<div class="wait2"><b class="grow">Hai scelto '+esc(r.picks[i])+'</b><span class="mut">'+(npk<N()?'sceglie '+esc(S.names[who2]):'')+'</span></div>';
  else h+=turnBar(mine2,'<span class="odot" style="background:'+pcol(who2)+'">'+esc(ini(S.names,who2))+'</span><b class="grow">Sceglie '+esc(S.names[who2])+'</b><span class="mut">tu tra '+(my2-npk)+'</span>','tocca un racer');
  h+=orderDots(r.order,npk,i);
  var chosen=r.order.filter(function(p){return r.picks[p]!==undefined&&p!==i;});
  if(chosen.length)h+='<div class="row" style="gap:6px"><span class="lbl">Già scelti</span>'+chosen.map(function(p){return '<button type="button" class="pill cardpill" data-act="card" data-n="'+esc(r.picks[p])+'" style="background:'+(TC[tierOf(r.picks[p])]||'#e9e9f2')+'">'+esc(S.names[p])+': '+esc(r.picks[p])+'</button>';}).join("")+'</div>';
  if(r.picks[i]!==undefined)h+='<div class="grid2">'+miniCard(r.picks[i])+'</div><div class="lbl">Ti restano</div><div class="grid2">'+(S.hands[i]||[]).map(function(c){return miniCard(c);}).join("")+'</div>';
  else h+='<div class="lbl">'+(mine2?'Scegli chi corre nella gara '+k:'La tua mano')+'</div><div class="grid2">'+(S.hands[i]||[]).map(function(c){return miniCard(c,{act:mine2?"selpick":null});}).join("")+'</div>';
  return h+'</div>';
 }
 if(ph==="starter"){
  if(r.starterBy===i){
   h+='<div class="st turn"><h2 class="t" style="font-size:30px">Scegli chi parte!</h2><p style="margin:2px 0 0;font-weight:800">Sei ultimo in classifica: decidi chi tira per primo. Poi si va in senso orario.</p></div>';
   h+='<div class="stack" style="gap:10px">'+S.names.map(function(nm,p){return '<button type="button" class="btn big alt" style="justify-content:flex-start" data-act="setstart" data-i="'+p+'">'+dot(p)+esc(nm)+(p===i?' (tu)':'')+'</button>';}).join("")+'</div>';
  }else h+=infoBox();
  return h+handRow(i)+'</div>';
 }
 var b=effBz(r,i),popped=POP[r.id+"_"+i]&&POP[r.id+"_"+i]>Date.now(),myB=BONUS[r.id+"_"+i]||0;
 if(ph==="result"){
  h+='<div class="st"><div class="row"><span class="disc g mini">'+r.g+'</span><b>1° '+esc(S.names[r.w1])+'</b></div>';
  if(r.w2!==null)h+='<div class="row" style="margin-top:6px"><span class="disc s mini">'+r.s+'</span><b>2° '+esc(S.names[r.w2])+'</b></div>';
  h+='</div>';
 }else h+='<p class="mut" style="margin:0">'+esc(startText(r))+'</p>';
 h+=aCard(r.picks[i]);
 h+='<div style="position:relative"><button type="button" class="plusbtn" data-act="plus">+1 punto</button>'+(popped?'<span class="plus1" style="right:20px">+1</span>':'')+'</div>';
 h+='<div class="st row" style="justify-content:space-between"><div><div class="lbl">Bronzo in questa gara</div><div class="t" style="font-size:34px">'+b+'</div></div><button type="button" class="btn sm alt" data-act="minus"'+(myB?'':' disabled')+'>−1 (errore)</button></div>';
 h+='<div class="row"><label for="f_snd" style="margin:0">Suono</label><select id="f_snd"><option value="random">A caso</option>'+FARTS.map(function(f,q){return '<option value="'+q+'">'+esc(f[0])+'</option>';}).join("")+'</select></div>';
 h+=handRow(i,'Ti restano in mano');
 return h+'</div>';
}
var SHOWHAND=null,CONFIRM=null,FARTSEEN=null,FARTTOAST=null,SHEET=null,TEAMBAR=false,FARTMINI=false;
/* carta compatta (2 colonne) e scheda dal basso */
function miniCard(n,o){o=o||{};var t=tierOf(n),a=abOf(n),img=artOf(n),by=o.by;
 return '<button type="button" class="mc'+(by!=null?' taken':'')+'" data-act="sheet" data-n="'+esc(n)+'"'+(o.act?' data-a="'+o.act+'"':'')+(by!=null?' data-by="presa da '+esc(by)+'"':'')+' aria-label="'+esc(n)+(by!=null?', presa da '+esc(by):'')+'">'+
  (img?'<img src="'+img+'" alt="">':'<span class="noimg" style="background:'+(TC[t]||'#e9e9f2')+'">'+esc(n.charAt(0))+'</span>')+'<span class="tb" style="background:'+(TC[t]||'#e9e9f2')+'">'+(t||'?')+'</span><span class="nm2">'+esc(n)+'</span><span class="ab2">'+esc(a[1]||'')+'</span></button>';}
function orderDots(order,np,me){return '<div class="order2"><span class="lbl" style="margin-right:2px">Ordine</span>'+order.map(function(p,k){return '<span class="odot'+(k<np?' done':'')+(k===np?' now':'')+(p===me?' me':'')+'" style="background:'+pcol(p)+'" title="'+esc(S.names[p])+'">'+esc(ini(S.names,p))+'</span>';}).join("")+'</div>';}
function turnBar(mine,txt,sub){return mine?'<div class="turn2"><b class="grow">Tocca a te!</b><span>'+esc(sub||'tocca una carta')+'</span></div>':'<div class="wait2">'+txt+'</div>';}
function teamBar(i,hl){TEAMBAR=true;var h=S.hands[i]||[],slots=[];for(var q=0;q<Math.max(DRAFTS,h.length);q++)slots.push(h[q]||null);
 return '<div class="teambar"><div class="lbl">La tua squadra · tocca per l\'abilità</div><div class="slots">'+slots.map(function(c){return c?'<button type="button" class="f'+(hl===c?' hl':'')+'" data-act="card" data-n="'+esc(c)+'" style="background:'+(TC[tierOf(c)]||'#e9e9f2')+'">'+esc(c)+' <b>'+(tierOf(c)||'?')+'</b></button>':'<span></span>';}).join("")+'</div></div>';}
function vSheet(){var n=SHEET.n,t=tierOf(n),a=abOf(n),img=artOf(n),act=SHEET.a;var lbl=act==="drpick"?'Prendi '+esc(n):(act==="selpick"?'Gioca '+esc(n):'');
 return '<div class="tut cardmodal sheetm" role="dialog" aria-modal="true" aria-label="'+esc(n)+'" data-act="sheetclose"><div class="sheet"><div class="grab"></div>'+(img?'<img src="'+img+'" alt="">':'')+
  '<h3>'+esc(n)+' <span class="tierb" style="background:'+(TC[t]||'#e9e9f2')+'">'+(t||'?')+'</span></h3>'+(a[0]?'<div class="pw">'+esc(a[0])+'</div>':'')+'<p>'+esc(a[1]||'Abilità non inserita.')+'</p>'+
  '<div class="row" style="gap:8px"><button type="button" class="btn alt" data-act="sheetclose" style="flex:1">Chiudi</button>'+(lbl?'<button type="button" class="btn acc big" style="flex:2" data-act="'+act+'" data-n="'+esc(n)+'" data-w="'+ME+'"'+(BUSY?' disabled':'')+'>'+lbl+'</button>':'')+'</div></div></div>';}

function fartKey(){return (GAME&&GAME.name?GAME.name:"x").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,24)||"x";}
function fartBtn(){return '<div class="fartdock'+(TEAMBAR?' up mini':(FARTMINI?' mini':''))+'"><button type="button" class="fartbtn" data-act="fart" aria-label="Rutto o scoreggia: lo sentono tutti, anche sul tablet. Conta negli spareggi"><svg viewBox="0 0 52 34" width="44" height="29" fill="none" stroke="#14121f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11h9M1.5 17h7M3 23h9"/><path d="M19 27a6 6 0 0 1 .5-12 9 9 0 0 1 16.5-3 7.5 7.5 0 0 1 7 11.5A5.5 5.5 0 0 1 38 30H22.5A5 5 0 0 1 19 27z" fill="#ffffff"/><circle cx="29" cy="20" r="1.6" fill="#14121f" stroke="none"/><circle cx="35" cy="20" r="1.6" fill="#14121f" stroke="none"/></svg><span>Rutti e scoregge</span></button></div>';}
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
 var pre=(location.hash||"").replace("#","").toUpperCase().slice(0,4),last=idGet("ma_name",""),lastTeam=idGet("ma_team","");
 var h='<div class="home stack">'+modeBanner()+'<span class="logo t" style="align-self:flex-start">Magical Outlet</span>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 h+='<form class="st stack" id="joinf" autocomplete="off"><h2 class="t" style="font-size:30px">Entra in una partita</h2>'+
  '<div><label for="f_code">Codice partita</label><input id="f_code" class="codein" maxlength="4" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" value="'+esc(pre)+'" placeholder="ABCD" required></div>'+
  (function(){var kp=knownPlayers(),sel=kp.filter(function(n){return nameKey(n)===nameKey(last);})[0]||(last?"__new":"");if(PICKSEL!==null)sel=PICKSEL;
   return '<div><label for="f_pick">Chi sei?</label><select id="f_pick" required><option value=""'+(sel===""?' selected':'')+' disabled>Scegli il tuo nome…</option>'+kp.map(function(n){return '<option value="'+esc(n)+'"'+(sel===n?' selected':'')+'>'+esc(n)+'</option>';}).join("")+'<option value="__new"'+(sel==="__new"?' selected':'')+'>➕ Sono un giocatore nuovo</option></select>'+
   '<div id="newname"'+(sel==="__new"?'':' hidden')+' style="margin-top:8px"><label for="f_name">Il tuo nome</label><input id="f_name" maxlength="16" autocomplete="nickname" value="'+esc(sel==="__new"?last:"")+'" placeholder="Es. Gianni"><p class="mut" style="margin:4px 0 0;font-size:13px">Viene registrato: da lì in poi ha il suo S.K.U.L.O. e le sue statistiche.</p></div></div>';})()+
  '<div><label for="f_team">Nome del tuo team</label><input id="f_team" maxlength="24" value="'+esc(lastTeam)+'" placeholder="Es. I Fulmini di Cà Granda"></div>'+
  '<button type="submit" class="btn big acc"'+(BUSY?' disabled':'')+'>'+(BUSY?'Entro…':'Entra')+'</button></form>';
 h+=tutBtn()+statsBtn();
 h+='<div class="hostbox"><span class="mut">Sei il tablet al centro del tavolo?</span><button type="button" class="btn sm alt" data-act="create"'+(BUSY?' disabled':'')+'>Crea una partita</button></div><p class="mut" style="text-align:center;margin:4px 0 0"><a href="admin.html" style="color:inherit;font-weight:800">Manutenzione</a></p></div>';
 return h;
}
function vLobbyHost(){
 var names=lobbyNames(),h='<div class="stack">'+modeBanner();
 h+='<div class="top" style="margin:0"><span class="logo t">Magical Outlet</span><div class="grow"></div><button type="button" class="btn sm alt" data-act="tab" data-v="'+(TAB==="set"?"live":(TAB==="cards"?"live":"set"))+'">'+(TAB==="live"?'Impostazioni':'Torna alla sala d\'attesa')+'</button>'+(TAB==="live"?'<button type="button" class="btn sm alt" data-act="tab" data-v="cards">Carte e foto</button>':'')+'</div>';
 if(msg)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(msg)+'</div>';
 if(TAB==="set")return h+vSet()+'</div>';
 if(TAB==="cards")return h+vCards()+'</div>';
 h+='<div class="st row" style="gap:28px;padding:22px"><div class="stack" style="gap:10px"><span class="lbl">Codice partita</span><span class="code">'+esc(GAME.code)+'</span><span class="mut">Aprite questo sito sul telefono e inserite il codice,<br>oppure inquadrate il QR.</span><span class="mut" style="word-break:break-all">'+esc(joinUrl())+'</span></div>'+(window.QRCode?'<div class="qr" id="qr" role="img" aria-label="QR code per entrare nella partita"></div>':'')+'</div>';
 h+='<div class="st stack"><div class="row"><h2 class="t grow" style="font-size:28px">Team ('+names.length+')</h2><span class="mut">Mettili nell\'ordine in cui siete seduti: serve per il senso orario.</span></div>';
 if(!names.length)h+='<p class="mut" style="margin:0">Ancora nessuno. Aspetto che entrino dal telefono…</p>';
 h+=names.map(function(n,i){return '<div class="pl">'+dotN(names,i)+'<span class="nm">'+(i+1)+'. '+esc(lobbyTeam(n))+' <small class="fc">'+esc(n)+' · S.K.U.L.O. '+eloOf(n)+'</small></span><button type="button" class="btn sm alt" data-act="seat" data-n="'+esc(n)+'" data-d="-1" aria-label="Sposta su '+esc(n)+'"'+(i===0?' disabled':'')+'>↑</button><button type="button" class="btn sm alt" data-act="seat" data-n="'+esc(n)+'" data-d="1" aria-label="Sposta giù '+esc(n)+'"'+(i===names.length-1?' disabled':'')+'>↓</button><button type="button" class="btn sm alt" data-act="kick" data-n="'+esc(n)+'" aria-label="Togli '+esc(n)+'">✕</button></div>';}).join("");
 var enough=S.roster.length>=names.length*DRAFTS+DRAFTS;
 h+='<div class="row" style="margin-top:6px"><button type="button" class="btn big acc" data-act="start"'+(names.length<2||!enough?' disabled':'')+'>Inizia il torneo (4 gare): pole position!</button>'+(enough?'':'<span class="mut">Troppi giocatori per il numero di carte.</span>')+'</div></div>';
 h+='<p class="sync"><button type="button" class="btn sm alt" data-act="leave">Esci da questa partita</button></p>';
 return h+'</div>';
}
function vLobbyPlayer(){
 var names=lobbyNames(),h='<div class="ph stack">'+modeBanner();
 h+='<div class="me"><span class="dot" style="background:var(--yel)">'+esc(GAME.name.charAt(0).toUpperCase())+'</span><div class="grow"><div class="t" style="font-size:26px;line-height:1">'+esc(lobbyTeam(GAME.name))+'</div><div class="mut">'+esc(GAME.name)+' · partita '+esc(GAME.code)+'</div></div><button type="button" class="btn sm alt" data-act="leave">Esci</button></div>';
 h+='<div class="st turn"><h2 class="t" style="font-size:30px">Sei dentro!</h2><p style="margin:4px 0 0;font-weight:800">Aspetta che il banco inizi il torneo. Intanto ripassa le regole.</p></div>'+tutBtn()+statsBtn();
 h+='<form class="st stack" id="teamf" style="gap:8px"><label for="f_team2" style="margin:0">Nome del team</label><div class="row"><input id="f_team2" class="grow" maxlength="24" value="'+esc(lobbyTeam(GAME.name))+'"><button type="submit" class="btn sm">Salva</button></div></form>';
 h+='<div class="st stack" style="gap:8px"><span class="lbl">In sala d\'attesa</span>'+names.map(function(n,i){return '<div class="row">'+dotN(names,i)+'<b>'+esc(lobbyTeam(n))+'</b><span class="mut">'+esc(n)+(n.toLowerCase()===GAME.name.toLowerCase()?' (tu)':'')+'</span></div>';}).join("")+'</div>';
 return h+'</div>';
}
function vOut(){
 return '<div class="ph stack"><div class="st"><h2 class="t" style="font-size:28px">Torneo già iniziato</h2><p style="font-weight:700">Nella partita '+esc(GAME.code)+' non c\'è nessun giocatore che si chiama «'+esc(GAME.name)+'». Rientra con il nome che avevi usato: '+S.names.map(esc).join(", ")+'.</p><button type="button" class="btn acc" data-act="leave">Torna all\'inizio</button></div></div>';
}
function vCards(){
 var h='<div class="stack"><div class="st"><div class="lbl">Foto delle carte</div><p class="mut" style="margin:6px 0 0">Tocca «Aggiungi foto» su una carta e scatta o scegli un\'immagine (per esempio la foto della tua carta fisica). Viene rimpicciolita e salvata nel tuo database: vale per tutte le partite.</p><p class="mut" style="margin:6px 0 10px">Hai tante foto? Chiamale come la carta (es. <b>Centaur.jpg</b>, <b>Third Wheel.png</b>) e caricale tutte insieme, oppure carica direttamente il file .zip.</p><div class="row"><label class="btn acc" style="margin:0">Carica lo zip<input type="file" accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream" data-bulk="1" style="display:none"></label><label class="btn alt" style="margin:0">Scegli più foto<input type="file" accept="image/*" multiple data-bulk="1" style="display:none"></label></div></div>';
 ["S","A","B","C","D","E",""].forEach(function(t){var l=S.roster.filter(function(x){return x.t===t;});if(!l.length)return;h+='<h2 class="t" style="font-size:28px">'+(t?'Livello '+t:'Senza livello')+'</h2><div class="grid">'+l.map(function(x){var k=tkey(x.n);return aCard(x.n,{btn:'<div class="row"><label class="btn sm alt" style="margin:0">'+(IMGS[k]?'Cambia foto':'Aggiungi foto')+'<input type="file" accept="image/*" data-img="'+esc(x.n)+'" style="display:none"></label>'+(IMGS[k]?'<button type="button" class="btn sm alt" data-act="delimg" data-n="'+esc(x.n)+'">Togli</button>':'')+'</div>'});}).join("")+'</div>';});
 return h+'</div>';
}
function vSet(){
 var P=pts(S),locked=S.started&&S.races.length>0;
 var h='<div class="stack">';
 if(S.started)h+='<div class="st"><span class="lbl">Team in ordine di posto</span><p style="margin:6px 0 0;font-weight:800">'+S.names.map(function(nm,i){return esc(teamOf(i))+' ('+esc(nm)+')';}).join(" → ")+'</p></div>';
 h+='<div class="st"><div class="lbl">Punti per gara (1° / 2°)</div><div class="row" style="margin-top:8px">'+P.map(function(p,k){return '<label style="margin:0;display:flex;align-items:center;gap:6px">G'+(k+1)+' <input id="f_p'+k+'" style="width:90px" value="'+p[0]+'/'+p[1]+'"'+(locked?' disabled':'')+'></label>';}).join("")+'</div>'+(locked?'<p class="mut" style="margin:8px 0 0">I punti si cambiano solo prima della prima gara.</p>':'')+'</div>';
 h+='<div class="st"><label for="f_roster">Atleti: Nome | Livello (S, A, B, C, D) | Abilità facoltativa</label><textarea id="f_roster" style="min-height:280px">'+esc(Core.rosterText(S.roster))+'</textarea></div>';
 h+='<div class="st"><div class="lbl">Livelli permanenti</div><p class="mut" style="margin:6px 0 10px">I livelli cambiano dopo ogni gara (chi vince sale, l\'ultimo scende) e restano salvati per tutte le partite future. Modificandoli qui sopra e salvando, cambi anche quelli salvati.</p><button type="button" class="btn sm alt" data-act="tierreset">Ripristina i livelli originali</button></div>';
 h+='<div><button type="button" class="btn big acc" data-act="save">Salva impostazioni</button></div>';
 if(S.started)h+='<div class="st"><h3 class="t" style="font-size:22px;margin-bottom:10px">Ricomincia</h3>'+(confirmReset?'<div class="row"><button type="button" class="btn acc" data-act="reset2">Sì, azzera e rifai la pole position</button><button type="button" class="btn alt" data-act="reset0">No</button></div>':'<button type="button" class="btn alt" data-act="reset1">Azzera il torneo (tiene i team)</button>')+'</div>';
 return h+'</div>';
}

/* ---------------- carta e storico (finestre) ---------------- */
function statsBtn(){return '<button type="button" class="btn big alt tutbtn" data-act="stats"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>Storico e statistiche</button>';}
function vCardModal(){SHEET={n:CARDV,a:null};var x=vSheet();SHEET=null;return x;}
function vCardModalOld(){return '<div class="tut cardmodal" role="dialog" aria-modal="true" aria-label="'+esc(CARDV)+'" data-act="cardclose"><div class="cm-in">'+aCard(CARDV,{btn:'<button type="button" class="btn" data-act="cardclose">Chiudi</button>'})+'</div></div>';}
function fmtDate(t){try{return new Date(t).toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"});}catch(e){return "";}}
var STATTAB="classifica",STATOPEN=null;
function vStats(){
 var H=histList(),E=eloNow(),names=knownPlayers().filter(function(n){return playerStats(n).t>0;});
 var rows=names.map(function(n){var x=playerStats(n);x.elo=eloOf(n);var ser=E.series[nameKey(n)]||[];x.last=ser.length?ser[ser.length-1].d:0;return x;}).sort(function(a,b){return b.elo-a.elo||b.w-a.w||(b.avg||0)-(a.avg||0);});
 var h='<div class="tut statsv" role="dialog" aria-modal="true" aria-labelledby="st_t"><div class="ph stack" style="max-width:900px;gap:10px">';
 h+='<div class="tuthead stack" style="gap:8px"><div class="row"><span class="logo t" id="st_t">Storico</span><span class="grow"></span><button type="button" class="btn sm" data-act="statsclose">Chiudi</button></div>'+
  '<div class="seg" role="tablist">'+[["classifica","Classifica"],["grafico","Grafico"],["tornei","Tornei"],["tier","Tier"]].map(function(t){return '<button type="button" role="tab" aria-selected="'+(STATTAB===t[0])+'" class="'+(STATTAB===t[0]?'on':'')+'" data-act="stattab" data-v="'+t[0]+'">'+t[1]+'</button>';}).join("")+'</div></div>';
 if(!H.length&&STATTAB!=="tier"){h+='<div class="st"><p style="margin:0;font-weight:800">Ancora nessun torneo nello storico.</p><p class="mut" style="margin:6px 0 0">Ogni torneo finito viene salvato qui da solo, con data, classifica, team e racer usati.</p></div>';return h+'</div></div>';}
 if(STATTAB==="tier"){
  var RR=Core.parseRoster(DEF),BASE={};RR.forEach(function(x){BASE[x.n]=x.t||"D";var g=GTIERS[tkey(x.n)];if(g&&TRANK[g]!==undefined)x.t=g;});
  h+='<div class="st tleg"><div class="lbl">Legenda</div><p><span class="ar up">▲</span> il racer è salito di livello rispetto a quello di partenza</p><p><span class="ar dn">▼</span> il racer è sceso di livello</p><p class="mut">Il racer del 1° classificato sale di un livello, quello dell\'ultimo scende (permanente, da S a E). Carta finale: S/A +2 punti, B/C +1, D/E 0.</p></div>';
  ["S","A","B","C","D","E"].forEach(function(T){var L=RR.filter(function(x){return x.t===T;}).sort(function(a,b){return String(a.n).localeCompare(String(b.n),"it");});
   if(!L.length)return;
   h+='<div class="tiersec"><div class="tierh" style="background:'+(TC[T]||'#e9e9f2')+'"><b class="t">Tier '+T+'</b><span>'+L.length+'</span></div><div class="tgrid">'+L.map(function(x){var im=artOf(x.n);var d=TRANK[x.t]-TRANK[BASE[x.n]],ar=d>0?'<span class="ar up" title="Salito da '+BASE[x.n]+'">▲</span>':(d<0?'<span class="ar dn" title="Sceso da '+BASE[x.n]+'">▼</span>':'');return '<button type="button" class="tr" data-act="card" data-n="'+esc(x.n)+'">'+(im?'<img src="'+im+'" alt="" loading="lazy">':'<span class="ph0"></span>')+'<span class="tn">'+esc(x.n)+'</span>'+ar+'</button>';}).join("")+'</div></div>';});
 }else if(STATTAB==="classifica"){
  h+='<p class="mut" style="margin:0;font-weight:800;font-size:13px">S.K.U.L.O. · <i>Supremazia Konquistata Usando Lanci Onesti</i> · tocca un nome per i dettagli</p><div class="pcs">';
  rows.forEach(function(x,q){var op=STATOPEN==="p"+x.name;
   h+='<button type="button" class="pc'+(q===0?' first':'')+(op?' open':'')+'" data-act="statopen" data-n="p'+esc(x.name)+'" aria-expanded="'+op+'"><span class="rk">'+(q+1)+'</span><span class="nm">'+esc(x.name)+'</span><span class="sk">'+x.elo+(x.last?'<small class="'+(x.last<0?'dn':'')+'">'+eloTxt(x.last)+'</small>':'')+'</span>'+
    '<span class="mini">'+x.t+(x.t===1?' torneo':' tornei')+' · '+x.w+(x.w===1?' vinto':' vinti')+' · media '+String(x.avg).replace(".",",")+'</span>'+
    (op?'<span class="more"><span><b>'+x.wr+'%</b> vittorie</span><span><b>'+x.pod+'</b> podi</span><span>record <b>'+(x.best||0)+'</b></span><span><b>'+x.pts+'</b> punti tot.</span>'+(x.races?'<span>gare vinte <b>'+x.rw+'/'+x.races+'</b></span>':'')+'</span>':'')+'</button>';});
  h+='</div>';
 }else if(STATTAB==="grafico"){
  h+=eloChart();
  var rc={};H.forEach(function(t){(t.races||[]).forEach(function(R){if(R.c1){rc[R.c1]=rc[R.c1]||{w:0};rc[R.c1].w++;}});});
  var top=Object.keys(rc).sort(function(a,b){return rc[b].w-rc[a].w;}).slice(0,8);
  if(top.length)h+='<div class="st"><div class="lbl">Racer che hanno vinto più gare</div><div class="row" style="gap:8px;margin-top:8px">'+top.map(function(c){return '<button type="button" class="pill cardpill" data-act="card" data-n="'+esc(c)+'" style="background:'+(TC[tierOf(c)]||'#e9e9f2')+'">'+esc(c)+' · '+rc[c].w+'</button>';}).join("")+'</div></div>';
 }else{
  h+='<div class="pcs">'+H.map(function(t){var op=STATOPEN==="t"+t.id,ps=t.players.slice().sort(function(a,b){return (a.pos||99)-(b.pos||99);});
   return '<button type="button" class="tcard'+(op?' open':'')+'" data-act="statopen" data-n="t'+esc(t.id)+'" aria-expanded="'+op+'"><span class="row" style="gap:8px"><b class="t" style="font-size:20px">'+esc(fmtDate(t.date))+'</b><span class="mut grow" style="font-weight:700;font-size:13px">'+t.players.length+' giocatori</span><span class="shr" role="button" tabindex="0" data-act="share" data-v="'+esc(t.id)+'" aria-label="Condividi">↗ Condividi</span><span style="font-weight:900">'+(op?'⌄':'›')+'</span></span>'+
    (op?'<span class="stack" style="gap:4px;margin-top:8px">'+ps.map(function(p){var e=eloInfo(t.id,p.name);return '<span class="row" style="gap:8px"><b style="width:28px">'+p.pos+'°</b><b class="grow" style="text-align:left">'+esc(p.name)+'</b><b>'+p.p+' pt</b>'+(e?'<span class="elod'+(e.d>0?' up':(e.d<0?' dn':''))+'">'+eloTxt(e.d)+'</span>':'')+'</span>';}).join("")+'</span>'
     :'<span class="podl">'+ps.slice(0,3).map(function(p,q){return '<span class="'+["g","s","b"][q]+'">'+p.pos+'° '+esc(p.name)+' '+p.p+'</span>';}).join("")+'</span>')+'</button>';}).join("")+'</div>';
 }
 return h+'</div></div>';
}

/* ---------------- condividi (immagine per WhatsApp) ---------------- */
function shareFit(ctx,txt,max,size,wt){var z=size;do{ctx.font=wt+" "+z+"px Nunito,sans-serif";z-=2;}while(ctx.measureText(txt).width>max&&z>14);return txt;}
function shareRR(ctx,x,y,w,h,r,fill,stroke,lw){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=lw||6;ctx.strokeStyle=stroke;ctx.stroke();}}
function shareCanvas(e){
 var P=(e.players||[]).slice().sort(function(a,b){return (a.pos||99)-(b.pos||99);}).slice(0,8),n=P.length,W=1080,rowH=n>6?104:116,H=Math.max(1080,520+n*rowH+170);
 var c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");
 x.fillStyle="#cfd4ff";x.fillRect(0,0,W,H);
 shareRR(x,40,40,W-80,H-80,40,"#ffffff","#111",8);
 x.textAlign="center";x.fillStyle="#111";x.font="64px 'Lilita One',Nunito,sans-serif";
 shareRR(x,W/2-290,84,580,110,30,"#ffe14d","#111",8);x.fillStyle="#111";x.fillText("Magical Outlet",W/2,160);
 x.font="800 34px Nunito,sans-serif";x.fillStyle="#555";x.fillText(fmtDate(e.date)+" · torneo concluso",W/2,250);
 var win=P[0];
 if(win){x.fillStyle="#111";x.font="800 30px Nunito,sans-serif";x.fillText("VINCE",W/2,320);shareFit(x,win.team||win.name,W-200,92,"400");
  x.fillText(win.team||win.name,W/2,408);x.font="800 36px Nunito,sans-serif";x.fillStyle="#555";x.fillText(win.name+" · "+win.p+" punti",W/2,462);}
 var y=500,col=["#ffc83d","#d9dee9","#e8a46b"];
 P.forEach(function(p,q){var yy=y+q*rowH;shareRR(x,80,yy,W-160,rowH-14,26,q===0?"#fff4c2":"#f3f4ff","#111",5);
  x.beginPath();x.arc(140,yy+(rowH-14)/2,32,0,7);x.fillStyle=col[q]||"#e9e9f2";x.fill();x.lineWidth=5;x.strokeStyle="#111";x.stroke();
  x.fillStyle="#111";x.textAlign="center";x.font="900 36px Nunito,sans-serif";x.fillText(String(p.pos||q+1),140,yy+(rowH-14)/2+13);
  x.textAlign="left";x.font="900 38px Nunito,sans-serif";var nm=p.name+(p.team&&p.team!==win.team&&p.team!==p.name?"":"");shareFit(x,nm,470,38,"900");x.fillText(nm,200,yy+(rowH-14)/2-(p.team?2:-12));
  if(p.team){x.font="700 26px Nunito,sans-serif";x.fillStyle="#666";shareFit(x,p.team,470,26,"700");x.fillText(p.team,200,yy+(rowH-14)/2+30);}
  var el=p.elo||eloInfo(e.id||e.tid,p.name);x.textAlign="right";x.fillStyle="#111";x.font="900 44px Nunito,sans-serif";x.fillText(p.p+" pt",el?W-300:W-120,yy+(rowH-14)/2+14);
  if(el){x.font="800 28px Nunito,sans-serif";x.fillStyle=el.d>0?"#0a9b4f":(el.d<0?"#e0245e":"#666");x.fillText(eloTxt(el.d),W-120,yy+(rowH-14)/2-4);x.fillStyle="#666";x.font="700 22px Nunito,sans-serif";x.fillText("SKULO "+el.a,W-120,yy+(rowH-14)/2+26);}
 });
 x.textAlign="center";x.fillStyle="#555";x.font="800 26px Nunito,sans-serif";x.fillText("S.K.U.L.O. · Supremazia Konquistata Usando Lanci Onesti",W/2,H-80);
 return c;
}
async function doShare(e){
 try{if(document.fonts&&document.fonts.load){await Promise.all([document.fonts.load("64px 'Lilita One'"),document.fonts.load("900 38px Nunito"),document.fonts.load("700 26px Nunito")]);}}catch(_){}
 var c=shareCanvas(e);
 c.toBlob(async function(b){if(!b){msg="Non sono riuscito a creare l'immagine.";render();return;}
  var f=new File([b],"magical-outlet-"+new Date(e.date||Date.now()).toISOString().slice(0,10)+".png",{type:"image/png"});
  try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:"Magical Outlet",text:"Magical Outlet · "+fmtDate(e.date)});return;}}catch(er){if(er&&er.name==="AbortError")return;}
  var u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},4000);
 },"image/png");
}
function shareBtn(v,small){return '<button type="button" class="btn '+(small?'sm ':'big ')+'alt sharebtn" data-act="share" data-v="'+esc(v)+'"><svg viewBox="0 0 24 24" width="'+(small?18:24)+'" height="'+(small?18:24)+'" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>Condividi</button>';}
/* ---------------- tutorial ---------------- */
var TUT=false;
function tutBtn(){return '<button type="button" class="btn big alt tutbtn" data-act="tut"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 12h5"/></svg>Tutorial: le regole</button>';}

function vTut(){
 var P=(S&&S.settings&&S.settings.pts)||DEFPTS;
 function step(n,title,body,color){return '<section class="st tstep" style="background:'+(color||'#fff')+'"><div class="row" style="gap:12px;align-items:flex-start"><span class="tnum">'+n+'</span><div class="grow"><h3 class="t" style="font-size:24px;margin-bottom:6px">'+title+'</h3>'+body+'</div></div></section>';}
 var h='<div class="tut" role="dialog" aria-modal="true" aria-labelledby="tut_t"><div class="ph stack">';
 h+='<div class="row tuthead"><span class="logo t" id="tut_t">Come si gioca</span><span class="grow"></span><button type="button" class="btn sm" data-act="tutclose">Chiudi</button></div>';
 h+='<p style="font-weight:800;margin:0">Magical Outlet è un torneo di Magical Athlete a <b>4 gare</b>. Vince il team che fa più punti. Il tablet al centro fa da banco e tabellone, tu giochi dal telefono.</p>';
 h+=step(1,'Entra nella partita','<p class="tp">Il banco crea la partita sul tablet e mostra un <b>codice di 4 lettere</b>. Inseriscilo, tocca il <b>tuo nome</b> (o scrivine uno nuovo: viene registrato) e scegli il <b>nome del tuo team</b> (lo puoi cambiare in sala d\'attesa). Se chiudi il telefono, rientri con lo stesso codice e lo stesso nome.</p>');
 h+=step(2,'Pole position','<p class="tp">All\'inizio l\'app estrae <b>a caso</b> tre cose: chi <b>parte</b> nella gara 1, chi <b>sceglie per primo il racer</b> della gara 1 e chi <b>comincia il draft</b>.</p>','#ffe9a8');
 h+=step(3,'Draft comune','<p class="tp">Prima delle gare si fa tutto il draft: <b>5 giri</b>. A ogni giro si scoprono <b>una carta in più del numero di giocatori</b> e ognuno ne prende una, <b>in senso orario</b>. Il giro dopo comincia il giocatore successivo. La carta che avanza si scarta. Finisci con <b>5 carte</b>.</p>','#d9e6ff');
 h+=step(4,'Prima: chi parte','<p class="tp"><b>Gara 1</b>: parte il giocatore estratto a caso nella pole position (lo vedi già durante il draft).</p><p class="tp"><b>Gare 2–4</b>: <b>l\'ultimo in classifica decide chi parte</b>. Si decide <b>prima</b> di scegliere i racer, così tutti scelgono sapendolo.</p>','#fff');
 h+=step(5,'Poi: quale racer corre','<p class="tp"><b>Gara 1</b>: si sceglie in senso orario a partire dal giocatore estratto nella pole position.</p><p class="tp"><b>Gare 2–4</b>: sceglie per primo <b>chi ha più punti</b>, poi gli altri in ordine di punteggio. Parità: prima chi ha fatto <b>meno rutti e scoregge</b>, poi chi ha usato la carta di livello più alto nella gara precedente, poi il caso. Le scelte sono visibili a tutti. Tocca il nome di un racer per leggerne l\'abilità.</p><p class="tp">Si gioca in senso orario con le regole normali: la gara finisce quando due atleti tagliano il traguardo.</p>','#d2f6e3');
 h+=step(6,'I punti','<div class="row" style="gap:8px;margin:0 0 10px">'+P.map(function(p,k){return '<span class="pill">G'+(k+1)+': 1° '+p[0]+' · 2° '+p[1]+'</span>';}).join("")+'</div><p class="tp"><span class="mini-b">+1</span> <b>Bronzo</b>: ogni casella stella e ogni potere che dà punti vale 1 punto. Lo segni tu con <b>+1 punto</b> sul telefono.</p><p class="tp"><b>I livelli cambiano</b>: a fine gara la carta che ha <b>vinto sale di un livello</b> e quella <b>arrivata ultima scende di uno</b> (pari all\'ultimo posto: sorteggio). I cambi restano per sempre, anche nelle partite successive.</p>','#ffe1d8');
 h+=step(7,'Fine e bonus','<p class="tp">Dopo la gara 4 ti resta 1 carta: vale punti in più secondo il suo livello.</p><div class="row" style="gap:8px;margin:6px 0 10px"><span class="pill" style="background:#ff7a59">S +2</span><span class="pill" style="background:#ffe14d">A +2</span><span class="pill" style="background:#7fb2ff">B +1</span><span class="pill" style="background:#6fe0a3">C +1</span><span class="pill" style="background:#ff9fd2">D 0</span></div><p class="tp">Vince chi ha più punti. Parità: <b>meno rutti e scoregge</b>, poi più vittorie, poi più bronzi. Il risultato finisce nello <b>storico</b>, con le statistiche di ogni giocatore.</p><p class="tp"><b>S.K.U.L.O.</b> (<i>Supremazia Konquistata Usando Lanci Onesti</i>): si parte tutti da 1500. A fine torneo ogni coppia di giocatori conta come uno scontro: chi ha fatto più punti vince, pari punti è pareggio. Battere chi ha lo S.K.U.L.O. più alto rende di più (K 24, doppio nei primi 3 tornei).</p>','#efe2ff');
 h+=step(8,'I tasti del telefono','<p class="tp"><b>Tocca a te</b>: il telefono suona e vibra quando devi scegliere.</p><p class="tp"><b>+1 punto</b>: per stelle e poteri, durante la gara. Sbagliato? C\'è il −1.</p><p class="tp"><b>Rutti e scoregge</b>: in basso, sempre disponibile. Lo sentono tutti, anche il tablet. Attenzione: <b>ogni pressione viene contata</b> e negli spareggi vince chi ne ha fatti di meno.</p>');
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
 document.querySelectorAll("#app input,#app textarea").forEach(function(e){if(e.id)vals[e.id]=e.value;});var pk0=document.getElementById("f_pick");if(pk0)PICKSEL=pk0.value;
 var tutEl=document.querySelector(".tut:not(.cardmodal)"),tutTop=tutEl?tutEl.scrollTop:0;
 var m=flipCapture();pendingSeen=[];TEAMBAR=false;FARTMINI=false;var html;
 if(!GAME)html=vHome();
 else if(!S)html='<div class="home stack"><span class="logo t">Magical Outlet</span><div class="st">Collegamento alla partita '+esc(GAME.code)+'…</div><button type="button" class="btn alt" data-act="leave">Annulla</button></div>';
 else if(!S.started)html=GAME.role==="banco"?vLobbyHost():vLobbyPlayer();
 else if(ME==="banco")html=vBanco();
 else if(ME==="out")html=vOut();
 else html=vPlayer();
 if(GAME&&GAME.role==="player"&&S)html+=fartBtn();
 if(GAME&&GAME.role==="banco")html=fartToast()+html;
 if(CONFIRM==="leave")html=html.replace(/(data-act="leave"[^>]*>)[^<]*</g,'$1Tocca ancora per uscire<');
 if(CONFIRM==="tierreset")html=html.replace(/(data-act="tierreset"[^>]*>)[^<]*</g,'$1Tocca ancora per ripristinare<');
 if(CONFIRM==="abort")html=html.replace(/(data-act="abort"[^>]*>)[^<]*</g,'$1Tocca ancora: annullo la gara<');
 if(TUT)html+=vTut();
 if(STATSV)html+=vStats();
 if(CARDV)html+=vCardModal();
 if(SHEET)html+=vSheet();
 a.innerHTML=html;
 Object.keys(vals).forEach(function(k){var e=document.getElementById(k);if(e&&!e.disabled&&k!=="f_code"&&k!=="f_name"&&k!=="f_team")e.value=vals[k];else if(e&&(k==="f_code"||k==="f_name"||k==="f_team")&&vals[k])e.value=vals[k];});
 var se=document.getElementById("f_snd");if(se)se.value=SND;
 pendingSeen.forEach(function(k){SEEN[k]=1;});
 var tutEl2=document.querySelector(".tut:not(.cardmodal)");if(tutEl2&&tutTop)tutEl2.scrollTop=tutTop;
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
  FARTMAP=m||{};var sig={};Object.keys(m||{}).forEach(function(k){var v=m[k]||{};sig[k]=String(v.t)+"|"+v.n;});
  if(FARTSEEN===null){FARTSEEN=sig;safeRender();return;}
  Object.keys(sig).forEach(function(k){if(sig[k]!==FARTSEEN[k]){var v=m[k];if(GAME.role==="banco"){playClip(v.clip||"f01");FARTTOAST={name:v.name||"?",until:Date.now()+2200};safeRender();setTimeout(safeRender,2300);}}});
  FARTSEEN=sig;safeRender();
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
  var ds=defState();applyGlobalTiers(ds);await BE.create(code,JSON.stringify(ds));
  GAME={code:code,role:"banco"};idSet("ma_game",GAME);TAB="live";msg="";connect();
 }catch(e){msg="Non riesco a creare la partita: "+(e.message||e);}
 BUSY=false;render();
}
function cleanTeam(s){return String(s||"").trim().replace(/\s+/g," ").slice(0,24);}
async function joinGame(code,name,team){
 code=(code||"").toUpperCase().replace(/[^A-Z]/g,"");name=(name||"").trim().replace(/\s+/g," ");team=cleanTeam(team);
 if(code.length!==4){msg="Il codice ha 4 lettere.";render();return;}
 if(name.length<1){msg="Scrivi il tuo nome.";render();return;}
 BUSY=true;msg="";render();
 try{
  var str=await BE.getState(code);
  if(str===null||str===undefined){msg="Nessuna partita con il codice "+code+".";BUSY=false;render();return;}
  var o=migrate(JSON.parse(str));
  if(o.started){var ok=o.names.some(function(n){return n.toLowerCase()===name.toLowerCase();});if(!ok){msg="Il torneo è già iniziato. Usa il nome con cui eri entrato: "+o.names.join(", ")+".";BUSY=false;render();return;}name=o.names.filter(function(n){return n.toLowerCase()===name.toLowerCase();})[0];}
  else{var kn=knownPlayers().filter(function(x){return nameKey(x)===nameKey(name);})[0];if(kn)name=kn;await BE.join(code,name,team);}
  if(!REG[nameKey(name)])BE.register(name).catch(function(){});
  idSet("ma_name",name);idSet("ma_team",team);GAME={code:code,role:"player",name:name};idSet("ma_game",GAME);connect();
  try{history.replaceState(null,"",location.pathname+"#"+code);}catch(e){}
 }catch(e){msg="Non riesco a entrare: "+(e.message||e);}
 BUSY=false;render();
}
function leave(){disconnect();GAME=null;idSet("ma_game",null);msg="";TAB="live";render();}

/* ---------------- actions ---------------- */
document.getElementById("app").addEventListener("submit",function(ev){
 if(ev.target.id==="joinf"){ev.preventDefault();var tm=document.getElementById("f_team"),pk=document.getElementById("f_pick").value,nm0=pk==="__new"?document.getElementById("f_name").value:pk;if(!pk){msg="Scegli il tuo nome dall'elenco.";render();return;}joinGame(document.getElementById("f_code").value,nm0,tm?tm.value:"");}
 if(ev.target.id==="teamf"){ev.preventDefault();var tv=cleanTeam(document.getElementById("f_team2").value);idSet("ma_team",tv);BE.join(GAME.code,GAME.name,tv).then(function(){msg=tv?"Team salvato.":"";var a=document.activeElement;if(a&&a.blur)a.blur();render();});}
});
function resizeImage(file){
 return new Promise(function(res,rej){
  var fr=new FileReader();fr.onerror=rej;fr.onload=function(){var im=new Image();im.onerror=rej;im.onload=function(){
   var M=360,w=im.width,h=im.height,s=Math.min(1,M/Math.max(w,h));var c=document.createElement("canvas");c.width=Math.round(w*s);c.height=Math.round(h*s);
   var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",0.72));};im.src=fr.result;};fr.readAsDataURL(file);
 });
}
document.getElementById("app").addEventListener("change",function(ev){
 var t=ev.target;
 if(t.id==="f_pick"){PICKSEL=t.value;var nn=document.getElementById("newname");if(nn){nn.hidden=t.value!=="__new";if(t.value==="__new"){var fi=document.getElementById("f_name");fi&&fi.focus();}}return;}
 if(t.id==="f_snd"){SND=t.value;lsSet("ma_snd",SND);funny();return;}
 if(t.getAttribute&&t.getAttribute("data-bulk")&&t.files&&t.files.length){bulkImages(Array.prototype.slice.call(t.files));return;}
 var nm=t.getAttribute&&t.getAttribute("data-img");
 if(nm&&t.files&&t.files[0]){msg="Carico la foto di "+nm+"…";render();
  resizeImage(t.files[0]).then(function(d){return BE.setImage(tkey(nm),d);}).then(function(){msg="Foto di "+nm+" salvata.";render();}).catch(function(e){var em=String((e&&e.message)||"formato non letto");msg=/permission|denied/i.test(em)?"Firebase non accetta le foto: aggiorna le Regole del database.":"Foto non salvata: "+em;render();});}
});
function normKey(x){return String(x).toLowerCase().replace(/\.[a-z0-9]+$/,"").replace(/[^a-z0-9]/g,"");}
function withTimeout(p,ms){return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error("connessione lenta o assente"));},ms);})]);}
function loadJSZip(){if(window.JSZip)return Promise.resolve(window.JSZip);return new Promise(function(res,rej){var sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";sc.onload=function(){res(window.JSZip);};sc.onerror=function(){rej(new Error("non riesco a leggere lo zip"));};document.head.appendChild(sc);});}
async function expandZips(files){
 var out=[];for(var q=0;q<files.length;q++){var f=files[q];
  if(/\.zip$/i.test(f.name)||/zip/.test(f.type)){msg="Apro "+f.name+"…";render();var Z=await loadJSZip();var z=await Z.loadAsync(f);var ents=Object.keys(z.files).filter(function(p){return !z.files[p].dir&&/\.(jpe?g|png|webp)$/i.test(p)&&p.indexOf("__MACOSX")<0;});
   for(var e=0;e<ents.length;e++){var bl=await z.files[ents[e]].async("blob");var nm=ents[e].split("/").pop();out.push(new File([bl],nm,{type:/png$/i.test(nm)?"image/png":"image/jpeg"}));}}
  else out.push(f);}
 return out;
}
async function bulkImages(files){
 try{files=await expandZips(files);}catch(e){msg="Zip non letto: "+(e.message||e);render();return;}
 var map={};S.roster.forEach(function(x){map[normKey(x.n)]=x.n;});var ok=[],miss=[],bad=[],err=null;
 if(!files.length){msg="Nessuna immagine trovata nel file scelto.";render();return;}
 for(var q=0;q<files.length;q++){var f=files[q],n=map[normKey(f.name)];if(!n){miss.push(f.name);continue;}
  msg="Carico "+(q+1)+" di "+files.length+": "+n+"…";render();
  var d;try{d=await resizeImage(f);}catch(e){bad.push(f.name);continue;}
  try{await withTimeout(BE.setImage(tkey(n),d),15000);ok.push(n);}catch(e){err=e;break;}}
 if(err){var em=String((err&&err.message)||err);msg=/permission|denied/i.test(em)?"Firebase non accetta le foto: aggiorna le Regole del database (vedi istruzioni). Caricate finora: "+ok.length+".":"Caricamento interrotto ("+em+"). Caricate finora: "+ok.length+".";render();return;}
 msg="Foto caricate: "+ok.length+" di "+files.length+"."+(miss.length?" Nome non riconosciuto: "+miss.join(", ")+".":"")+(bad.length?" Immagini non leggibili: "+bad.join(", ")+".":"");render();
}
function askConfirm(k){CONFIRM=k;render();setTimeout(function(){if(CONFIRM===k){CONFIRM=null;safeRender();}},4000);}
function rm(arr,x){var k=arr.indexOf(x);if(k>=0)arr.splice(k,1);return k>=0;}
function newRaceObj(o){return {id:"r"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36),k:o.races.length,picks:{},order:[],bz:o.names.map(function(){return 0;}),w1:null,w2:null,g:0,s:0,last:null,first:null,starterBy:null,done:false};}
function afterPick(p){BUSY=false;if(!p)msg="Non riuscito: forse qualcuno ha appena scelto o non è il tuo turno.";render();}
function actor(W){return typeof ME==="number"?ME:(ME==="banco"?W:null);}
function parsePts(){var out=[];for(var k=0;k<RACES;k++){var e=document.getElementById("f_p"+k);if(!e)return null;var m=String(e.value).match(/(\d+)\D+(\d+)/);if(!m)return false;out.push([+m[1],+m[2]]);}return out;}
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
 case "card":if(!NM)return;CARDV=NM;render();return;
 case "sheet":if(!NM)return;SHEET={n:NM,a:t.getAttribute("data-a")};render();return;
 case "sheetclose":if(ev.target.closest(".sheet")&&!ev.target.closest("button"))return;SHEET=null;CARDV=null;render();return;
 case "cardclose":if(ev.target.closest(".cm-in")&&!ev.target.closest("button"))return;CARDV=null;render();return;
 case "stats":STATSV=true;render();try{var sx=document.querySelector(".tut");if(sx)sx.scrollTop=0;}catch(e){}return;
 case "statsclose":STATSV=false;render();return;
 case "share":{var sv=t.getAttribute("data-v"),en=null;if(sv==="end"){en=buildHistory(S);en.id=S.tid;}else{en=histList().filter(function(x){return String(x.id)===sv;})[0];}if(en)doShare(en);return;}
 case "stattab":STATTAB=t.getAttribute("data-v");STATOPEN=null;render();try{document.querySelector(".tut").scrollTop=0;}catch(e){}return;
 case "statopen":STATOPEN=STATOPEN===NM?null:NM;render();return;
 case "elotip":ELOTIP=NM||"";render();return;
 case "pickname":var fn=document.getElementById("f_name");if(fn){fn.value=NM;}document.querySelectorAll(".namechips .chip").forEach(function(c){c.classList.toggle("on",c.getAttribute("data-n")===NM);});return;
 case "delimg":BE.setImage(tkey(NM),null).then(function(){msg="Foto di "+NM+" tolta.";render();});return;
 case "tiemode":TIEMODE=!TIEMODE;LASTSEL=[];render();return;
 case "pickLast":
  var cur0=cur();var same=cur0&&cur0.last===I;
  commit(function(o){var r=curOf(o);if(!r||r.w2===null||r.done)return false;if(I===r.w1||I===r.w2)return false;if(same){r.last=null;r.lastDraw=null;}else{r.last=I;r.lastDraw=[I];}});return;
 case "lastsel":var li=LASTSEL.indexOf(I);if(li>=0)LASTSEL.splice(li,1);else LASTSEL.push(I);render();return;
 case "setlast":
  var sel=LASTSEL.slice();if(!sel.length)return;
  commit(function(o){var r=curOf(o);if(!r||r.w2===null||r.done)return false;var c=sel.filter(function(p){return p!==r.w1&&p!==r.w2;});if(!c.length)return false;r.last=c[Math.floor(Math.random()*c.length)];r.lastDraw=c;}).then(function(){LASTSEL=[];TIEMODE=false;render();});return;
 case "reopen":
  var RV=null,RVH=null;commit(function(o){RV=null;RVH=null;var r=curOf(o);if(!r||!r.done)return false;RV=(r.tchg||[]).slice();RV.slice().reverse().forEach(function(c){setTier(o,c.n,c.from);});r.tchg=null;r.done=false;if(o.stage==="end"){o.stage="races";RVH=o.tid||null;}}).then(function(ok){if(ok&&RV)RV.forEach(function(c){BE.shiftTier(tkey(c.n),c.to,TRANK[c.to]>TRANK[c.from]?-1:1);});if(ok&&RVH){BE.removeHistory(RVH).catch(function(){});BE.setElo(Core.elo(histList().filter(function(x){return x.id!==RVH;})).ratings).catch(function(){});}});return;
 case "showhand":SHOWHAND=SHOWHAND===I?null:I;render();return;
 case "plus":case "minus":
  var r1=cur();if(!r1||r1.done||typeof ME!=="number")return;var ph1=phase(r1);if(ph1!=="race"&&ph1!=="result")return;var key=r1.id+"_"+ME;
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
  var order=lobbyNames(),teams=order.map(lobbyTeam);BE.resetFarts(GAME.code);
  commit(function(o){if(o.started||order.length<2)return false;if(o.roster.length<(order.length+1)*DRAFTS)return false;startTournament(o,order,teams);});return;
 /* --- draft comune --- */
 case "startdraft":
  commit(function(o){if(o.stage!=="pole"||!o.pole)return false;startDraft(o);});return;
 case "drpick":
  SHEET=null;var who0=actor(W);if(who0===null||isNaN(who0))return;BUSY=typeof ME==="number";render();
  commit(function(o){if(o.stage!=="draft"||!o.dr)return false;var d=o.dr,n=o.names.length,np=Object.keys(d.picks).length,who=d.order[np];if(who!==who0)return false;
   if(d.revealed.indexOf(NM)<0)return false;var taken=Object.keys(d.picks).map(function(k){return d.picks[k];});if(taken.indexOf(NM)>=0)return false;
   d.picks[who]=NM;o.hands[who].push(NM);np++;
   if(np>=n){d.round++;if(d.round>=DRAFTS){o.dr=null;o.stage="races";}else{d.order=clockwise(o,(o.pole.draft+d.round)%n);d.revealed=o.deck.splice(0,Math.min(n+1,o.deck.length));d.picks={};}}
  }).then(afterPick);return;
 case "drundo":
  commit(function(o){if(o.stage!=="draft"||!o.dr)return false;var d=o.dr,np=Object.keys(d.picks).length;if(!np)return false;var who=d.order[np-1];rm(o.hands[who],d.picks[who]);delete d.picks[who];});return;
 /* --- gare --- */
 case "newrace":
  commit(function(o){if(o.stage!=="races")return false;var r=curOf(o);if(r&&!r.done)return false;if(o.races.length>=RACES)return false;var nr=newRaceObj(o);
   if(o.races.length===0){nr.order=clockwise(o,o.pole.reveal);nr.first=o.pole.start;}
   else{var co=chooseOrder(o);nr.order=co.order;nr.why=co.why;var st=standings(o);nr.starterBy=st[st.length-1].i;}
   o.races.push(nr);});return;
 case "selpick":
  SHEET=null;var who1=actor(W);if(who1===null||isNaN(who1))return;BUSY=typeof ME==="number";SHOWHAND=null;render();
  commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="sel")return false;var who=r.order[nPicks(r)];if(who!==who1)return false;if(!rm(o.hands[who],NM))return false;r.picks[who]=NM;}).then(afterPick);return;
 case "selundo":
  commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="sel")return false;var np=nPicks(r);if(!np)return false;var who=r.order[np-1];o.hands[who].push(r.picks[who]);delete r.picks[who];});return;
 case "setstart":
  commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="starter")return false;if(typeof ME==="number"&&ME!==r.starterBy)return false;if(!(I>=0&&I<o.names.length))return false;r.first=I;}).then(afterPick);return;
 case "unstart":
  commit(function(o){var r=curOf(o);if(!r||r.k===0||phaseOf(o,r)!=="sel"||nPicks(r)>0)return false;r.first=null;});return;
 case "w1":commit(function(o){var r=curOf(o);if(!r||phaseOf(o,r)!=="race")return false;r.w1=I;r.g=(pts(o)[r.k]||[0,0])[0];});return;
 case "w2":commit(function(o){var r=curOf(o);if(!r||r.w1===null||r.w2!==null||I===r.w1)return false;r.w2=I;r.s=(pts(o)[r.k]||[0,0])[1];});return;
 case "unw":commit(function(o){var r=curOf(o);if(!r||r.w1===null||r.w2!==null)return false;r.w1=null;r.g=0;});delete SEEN[(cur()||{}).id+"g"];return;
 case "unw2":commit(function(o){var r=curOf(o);if(!r||r.w2===null||r.done)return false;r.w2=null;r.s=0;r.last=null;r.lastDraw=null;});delete SEEN[(cur()||{}).id+"s"];return;
 case "bz":
  var rb=cur();if(!rb)return;var extra=BONUS[rb.id+"_"+I]||0;
  commit(function(o){var r=curOf(o);if(!r||r.done)return false;r.bz[I]=Math.max(-extra,(r.bz[I]||0)+D);});
  if(D>0){funny();popAt(rb.id+"_"+I);}return;
 case "close":
  var CH=null,HX=null;commit(function(o){CH=null;var r=curOf(o);if(!r||r.w2===null||r.done)return false;var others=o.names.map(function(_,p){return p;}).filter(function(p){return p!==r.w1&&p!==r.w2;});if(others.length&&(r.last===null||r.last===undefined))return false;
   r.tchg=[];var up=r.picks[r.w1],f1=tierIn(o,up),t1=shifted(f1,1);if(t1!==f1){setTier(o,up,t1);r.tchg.push({n:up,from:f1,to:t1});}
   if(r.last!==null&&r.last!==undefined){var dn=r.picks[r.last],f2=tierIn(o,dn),t2=shifted(f2,-1);if(t2!==f2){setTier(o,dn,t2);r.tchg.push({n:dn,from:f2,to:t2});}}
   r.done=true;CH=r.tchg.slice();TIEMODE=false;HX=null;if(o.races.length===RACES){o.stage="end";if(!o.tid)o.tid=Date.now().toString(36);HX={id:o.tid,obj:buildHistory(o)};}}).then(function(ok){if(ok&&CH)CH.forEach(function(c){BE.shiftTier(tkey(c.n),c.from,TRANK[c.to]>TRANK[c.from]?1:-1);});if(ok&&HX){var hl=histList().filter(function(x){return x.id!==HX.id;});HX.obj.id=HX.id;hl.push(HX.obj);var ee=Core.eloAnnotate(hl);delete HX.obj.id;BE.setElo(ee.ratings).catch(function(){});}
   if(ok&&HX)BE.saveHistory(HX.id,HX.obj).then(function(){msg="Torneo salvato nello storico.";render();}).catch(function(e){msg="Storico non salvato: "+(/permission|denied/i.test(String(e&&e.message))?"aggiorna le regole di Firebase (pagina Manutenzione).":((e&&e.message)||e));render();});});LASTSEL=[];return;
 case "abort":
  if(CONFIRM!=="abort"){askConfirm("abort");return;}CONFIRM=null;
  commit(function(o){var r=curOf(o);if(!r||r.done)return false;o.races.pop();Object.keys(r.picks).forEach(function(p){o.hands[p].push(r.picks[p]);});});return;
 /* --- impostazioni --- */
 case "save":
  var locked=S.started&&S.races.length>0,P=null;
  if(!locked){P=parsePts();if(P===false){msg="Scrivi i punti come 3/1 (primo/secondo).";render();return;}}
  var ro=Core.parseRoster(document.getElementById("f_roster").value);
  if(S.started){var used=[];S.hands.forEach(function(h){h.forEach(function(c){used.push(c);});});S.races.forEach(function(r){Object.keys(r.picks).forEach(function(k){used.push(r.picks[k]);});});if(S.dr)S.dr.revealed.forEach(function(c){used.push(c);});var miss=used.filter(function(c){return !ro.some(function(x){return x.n===c;});});if(miss.length){msg="Non puoi togliere atleti già in gioco: "+miss.join(", ")+".";render();return;}}
  BE.setTiers(rosterTierMap(ro));commit(function(o){o.roster=ro;if(!(o.started&&o.races.length>0)&&P)o.settings.pts=P;}).then(function(ok){msg=ok?"Impostazioni salvate.":msg;render();});return;
 case "tierreset":
  if(CONFIRM!=="tierreset"){askConfirm("tierreset");return;}CONFIRM=null;
  var base=Core.parseRoster(DEF);BE.setTiers(rosterTierMap(base));commit(function(o){o.roster.forEach(function(x){var b0=base.filter(function(y){return y.n===x.n;})[0];if(b0)x.t=b0.t;});}).then(function(){msg="Livelli riportati a quelli originali.";render();});return;
 case "reset1":confirmReset=true;render();return;
 case "reset0":confirmReset=false;render();return;
 case "reset2":confirmReset=false;TAB="live";BE.resetFarts(GAME.code);commit(function(o){startTournament(o,o.names.slice(),(o.teams||[]).slice());});return;
 }
});
document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;if(SHEET){SHEET=null;render();}else if(CARDV){CARDV=null;render();}else if(STATSV){STATSV=false;render();}else if(TUT){TUT=false;render();}});
/* ---------------- boot ---------------- */
(function boot(){
 SND=lsGet("ma_snd","random");FAV=lsGet("ma_fav",{})||{};
 var cfg=window.FIREBASE_CONFIG;
 try{BE=(cfg&&window.firebase)?makeFirebaseBackend(cfg):makeLocalBackend();}catch(e){BE=makeLocalBackend();msg="Firebase non si avvia: "+e.message;}
 GAME=idGet("ma_game",null);
 var h=(location.hash||"").replace("#","").toUpperCase();
 if(GAME&&h&&/^[A-Z]{4}$/.test(h)&&h!==GAME.code)GAME=null;
 BE.watchTiers(function(m){GTIERS=m||{};});
 BE.watchImages(function(m){IMGS=m||{};safeRender();});
 BE.watchHistory(function(m){HIST=m||{};safeRender();});
 BE.watchReg(function(m){REG=m||{};safeRender();});
 if(GAME)connect();
 render();
})();
