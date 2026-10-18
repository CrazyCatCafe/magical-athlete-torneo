/* Magical Outlet — pagina di manutenzione (Firebase): controlli, regole da copiare, pulizia partite, foto e livelli */
var HIST=null,REGP=null,EDIT=null,ELODIRTY=false,RAW={};
var DEFPLAYERS=["Luigi","Riccardo","Mirko","Simone","Luca","Fabio"];
var CFG=window.FIREBASE_CONFIG,DB=null,CHECKS=[],RULES="",GAMES=null,IMGS=null,TIERS=null,MSG="",CONF=null,BUSYX=false,CONNECTED=null;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function tkey(n){return String(n).replace(/[^A-Za-z0-9]/g,"_");}
function consoleUrl(){return "https://console.firebase.google.com/project/"+encodeURIComponent((CFG&&CFG.projectId)||"")+"/database/"+encodeURIComponent((CFG&&CFG.databaseURL||"").replace(/^https:\/\//,"").split(".")[0])+"/rules";}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function wt(p,ms){return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error("timeout"));},ms||8000);})]);}
function errTxt(e){var m=String((e&&e.message)||e);return /permission|denied/i.test(m)?"permesso negato dalle regole":(m==="timeout"?"nessuna risposta (connessione?)":m);}

async function runChecks(){
 CHECKS=[];BUSYX=true;draw();
 function add(label,ok,detail,fix){CHECKS.push({label:label,ok:ok,detail:detail||"",fix:fix||""});draw();}
 if(!CFG||!window.firebase){add("Configurazione Firebase",false,"config.js non è caricato o Firebase non si avvia.","Controlla config.js nel repository.");BUSYX=false;draw();return;}
 add("Configurazione Firebase",true,"Progetto «"+CFG.projectId+"» · "+CFG.databaseURL.replace("https://","").split(".")[0]);
 try{
  var on=await wt(DB.ref(".info/connected").get(),6000);
  CONNECTED=!!on.val();
 }catch(e){CONNECTED=false;}
 // il test vero è una lettura
 try{await wt(DB.ref("global/tiers").get());add("Connessione al database",true,"Il database risponde.");}
 catch(e){add("Connessione al database",false,errTxt(e),/permesso/.test(errTxt(e))?"Le regole non permettono nemmeno la lettura dei livelli: incolla le regole qui sotto e pubblicale.":"Controlla la rete del telefono e l'indirizzo databaseURL in config.js.");BUSYX=false;draw();return;}
 var k="TEST";
 try{await wt(DB.ref("games/"+k+"/check").set(Date.now()));await wt(DB.ref("games/"+k+"/check").get());await wt(DB.ref("games/"+k).remove());add("Partite: lettura e scrittura",true,"Si possono creare e cancellare partite.");}
 catch(e){add("Partite: lettura e scrittura",false,errTxt(e),"Incolla le regole qui sotto e pubblicale.");}
 try{await wt(DB.ref("games").get());add("Elenco delle partite",true,"Le partite si possono elencare e pulire da questa pagina.");}
 catch(e){add("Elenco delle partite",false,errTxt(e),"Le regole sono quelle della versione precedente: incolla le nuove e pubblicale. Il gioco funziona lo stesso, ma qui non si può fare pulizia.");}
 var imgOk=false;
 try{await wt(DB.ref("global/images/_check").set("data:image/png;base64,AAAA"));await wt(DB.ref("global/images/_check").remove());imgOk=true;add("Foto delle carte",true,"Le foto si possono salvare.");}
 catch(e){add("Foto delle carte",false,errTxt(e),"Mancano le regole per le foto: incolla le nuove e pubblicale.");}
 if(imgOk)try{await wt(DB.ref("global/images/_bad").set("non-e-una-foto"));await wt(DB.ref("global/images/_bad").remove());add("Controllo sulle foto",false,"Il database accetta anche dati che non sono foto.","Le regole non sono l'ultima versione: aggiornale.");}
 catch(e){add("Controllo sulle foto",true,"Il database rifiuta ciò che non è una foto (come previsto).");}
 try{await wt(DB.ref("global/tiers/_check").set("D"));await wt(DB.ref("global/tiers/_check").remove());add("Livelli permanenti",true,"I livelli si possono salvare.");}
 catch(e){add("Livelli permanenti",false,errTxt(e),"Incolla le regole qui sotto e pubblicale.");}
 try{await wt(DB.ref("global/history/_check").set({date:1,players:[{name:"x"}]}));await wt(DB.ref("global/history/_check").remove());add("Storico dei tornei",true,"I tornei finiti si possono salvare.");}
 catch(e){add("Storico dei tornei",false,errTxt(e),"Mancano le regole per lo storico: incolla le nuove e pubblicale. Senza, i tornei finiti non vengono salvati.");}
 try{await wt(DB.ref("global/players/_check").set({name:"x"}));await wt(DB.ref("global/players/_check").remove());add("Giocatori registrati",true,"I nomi nuovi si possono registrare.");}
 catch(e){add("Giocatori registrati",false,errTxt(e),"Mancano le regole per i giocatori: incolla le nuove e pubblicale.");}
 BUSYX=false;draw();
}
async function loadRules(){try{var r=await fetch("database.rules.json?t="+Date.now());RULES=await r.text();}catch(e){RULES="Non riesco a leggere database.rules.json: "+errTxt(e);}draw();}
async function loadGames(){
 try{var s=await wt(DB.ref("games").get(),12000);var v=s.val()||{};RAW={};GAMES=Object.keys(v).map(function(c){var g=v[c]||{},st=null;try{st=JSON.parse(g.state);}catch(e){}RAW[c]={g:g,st:st};var pl=g.players?Object.keys(g.players).length:0;var np=st&&st.started&&st.names?st.names.length:pl;
  var done=st&&st.races?st.races.filter(function(r){return r&&r.done;}).length:0;
  return {code:c,created:g.created||0,stage:st?st.stage:"?",players:np,races:done,started:st&&st.started,ended:st&&st.stage==="end"};}).sort(function(a,b){return (b.created||0)-(a.created||0);});}
 catch(e){GAMES=false;}
 draw();
}
async function loadGlobal(){
 try{var a=await wt(DB.ref("global/images").get(),12000);IMGS=a.val()||{};}catch(e){IMGS=false;}
 try{var b=await wt(DB.ref("global/tiers").get(),12000);TIERS=b.val()||{};}catch(e){TIERS=false;}
 try{var c=await wt(DB.ref("global/history").get(),12000);HIST=c.val()||{};}catch(e){HIST=false;}
 try{var d=await wt(DB.ref("global/players").get(),12000);REGP=d.val()||{};}catch(e){REGP=false;}
 draw();
}
function oldOk(g){return (!g.created||(Date.now()-g.created)>7*86400000)&&(!g.players||histByCode(g.code));}
function nk(n){return Core.nameKey(n);}
function knownNames(){var seen={},out=[];function add(n){n=String(n||"").trim();if(!n||seen[nk(n)])return;seen[nk(n)]=1;out.push(n);}DEFPLAYERS.forEach(add);Object.keys(REGP||{}).forEach(function(k){add((REGP[k]||{}).name);});Object.keys(HIST||{}).forEach(function(k){((HIST[k]||{}).players||[]).forEach(function(p){Core.members(p.name).forEach(add);});});return out;}
var ALIAS={mirco:"Mirko"};
function normName(n){n=String(n||"").trim();var k=nk(n);if(ALIAS[k])return ALIAS[k];var m=knownNames().filter(function(x){return nk(x)===k;})[0];return m||(n.charAt(0).toUpperCase()+n.slice(1));}
function normSeat(n){return Core.members(n).map(normName).join(" / ");}
async function registerNames(list){for(var i=0;i<list.length;i++){var ms=Core.members(list[i]);for(var j=0;j<ms.length;j++){var rk=nk(ms[j]);if(DEFPLAYERS.every(function(x){return nk(x)!==rk;})&&!(REGP||{})[rk]){try{await wt(DB.ref("global/players/"+rk).set({name:ms[j],t:Date.now()}));(REGP=REGP||{})[rk]={name:ms[j]};}catch(e){}}}}}
/* ---- importazione di risultati scritti a mano ---- */
var IMPTXT="Magical Athlete torneo\nluca 10\nLuigi 10\nRiccardo 3\nsimone 39\nmirco 8\n\nMagical Athlete torneo\nLuca 9\nRiccardo 11\nLuigi 8\nMirco 9\nSimone 15\n\nMagical Athlete\nStefano 5\nCostanzo 5\nLuca 6\nSimone 12\nLuigi/fabio 3\nRiccardo 7",IMP=null;
function parseImport(txt){
 var blocks=[],cur=null;String(txt||"").split(/\n/).forEach(function(line){var l=line.trim();if(!l){cur=null;return;}
  var m=l.match(/^(.+?)[\s:=-]+(-?\d+)\s*(pt|punti)?$/i);
  if(!m||/^magical/i.test(l)){cur={rows:[]};blocks.push(cur);return;}
  if(!cur){cur={rows:[]};blocks.push(cur);}cur.rows.push({name:normSeat(m[1]),p:parseInt(m[2],10)});});
 blocks=blocks.filter(function(b){return b.rows.length>=2;});
 blocks.forEach(function(b){b.rows.sort(function(x,y){return y.p-x.p;});});
 return blocks;
}
function guessGame(b,used){var best=null,bs=0;(GAMES||[]).forEach(function(g){if(!g.players||used[g.code])return;var names=suggestFromGame(g.code).map(function(r){return nk(normName(r.name));});var bk=[];b.rows.forEach(function(r){Core.members(r.name).forEach(function(m){bk.push(nk(m));});});
 var ov=bk.filter(function(k){return names.indexOf(k)>=0;}).length/Math.max(bk.length,names.length);if(ov>bs){bs=ov;best=g;}});return bs>=0.5?best:null;}
function prepImport(){var bl=parseImport(IMPTXT),used={};IMP=bl.map(function(b,i){var g=guessGame(b,used);if(g)used[g.code]=1;return {rows:b.rows,code:g?g.code:"",date:isoDay(g?g.created:(Date.now()-(bl.length-i)*7*864e5))};});draw();}
function impBox(){
 var h='<section class="st stack" style="gap:8px"><h2 class="t" style="font-size:28px">8 · Importa risultati</h2><p class="mut" style="margin:0">Incolla i risultati scritti a mano: un torneo per blocco, una riga per giocatore («Nome punti»). Due nomi con «/» (es. Luigi/Fabio) condividono il posto: il risultato vale per entrambi.</p>';
 h+='<textarea class="code" id="imptxt" style="min-height:160px">'+esc(IMPTXT)+'</textarea><div class="row"><button type="button" class="btn alt" data-act="impprev">Leggi i risultati</button></div>';
 if(IMP){if(!IMP.length)h+='<p class="mut">Non trovo tornei: controlla il formato.</p>';
  IMP.forEach(function(t,i){h+='<div class="edbox stack" style="gap:6px"><div class="row"><b class="grow">Torneo '+(i+1)+' · '+t.rows.length+' posti</b><label style="margin:0;display:flex;gap:6px;align-items:center">Data <input type="date" data-imp-d="'+i+'" value="'+esc(t.date)+'" style="width:auto"></label></div>'+
   '<label style="margin:0;display:flex;gap:6px;align-items:center;flex-wrap:wrap">Partita <select data-imp-c="'+i+'"><option value="">nessuna (torneo a parte)</option>'+(GAMES||[]).filter(function(g){return g.players;}).map(function(g){return '<option value="'+esc(g.code)+'"'+(g.code===t.code?' selected':'')+'>'+esc(g.code)+' · '+g.players+' giocatori · '+esc(ageTxt(g.created))+(histByCode(g.code)?' (sostituisce lo storico)':'')+'</option>';}).join("")+'</select></label>'+
   t.rows.map(function(r,q){var tie=t.rows.filter(function(x){return x.p===r.p;}).length>1;return '<div class="row" style="gap:8px"><b style="width:28px">'+(q+1)+'°</b><b class="grow">'+esc(r.name)+'</b><b>'+r.p+' pt</b>'+(tie?'<span class="mut">pari</span>':'')+'</div>';}).join("")+'</div>';});
  if(IMP.length)h+='<button type="button" class="btn big acc" data-act="impsave">Salva '+IMP.length+' tornei e aggiorna lo S.K.U.L.O.</button>';}
 return h+'</section>';
}
function histByCode(code){var id=null;Object.keys(HIST||{}).forEach(function(k){if(HIST[k]&&HIST[k].code===code)id=k;});return id;}
function tierBonusRaw(st,card){var t="D";(st.roster||[]).forEach(function(x){if(x.n===card)t=x.t||"D";});return (t==="S"||t==="A")?2:(t==="D"?0:1);}
function suggestFromGame(code){
 var R=RAW[code]||{},g=R.g||{},st=R.st,rows=[];
 if(st&&st.started&&st.names&&st.names.length){
  var bon=g.bonus||{};
  rows=st.names.map(function(n,i){var p=0;(st.races||[]).forEach(function(r){if(!r||!r.done)return;if(r.w1===i)p+=r.g||0;if(r.w2===i)p+=r.s||0;p+=Math.max(0,((r.bz&&r.bz[i])||0)+(((bon[i]||{})[r.id])||0));});
   if(st.stage==="end"&&st.hands&&st.hands[i]&&st.hands[i][0])p+=tierBonusRaw(st,st.hands[i][0]);
   return {name:n,team:(st.teams&&st.teams[i])||"",p:p};});
 }else{var pm=g.players||{};rows=Object.keys(pm).map(function(k){return {name:(pm[k]||{}).name||"?",team:(pm[k]||{}).team||"",p:0};});}
 rows.sort(function(a,b){return b.p-a.p;});return rows;
}
function isoDay(t){var d=new Date(t||Date.now());return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);}
function openEditor(where,id,code,date,rows){EDIT={where:where,id:id,code:code||"",date:isoDay(date),rows:rows.map(function(r){return {name:r.name,team:r.team||"",p:+r.p||0};})};draw();}
function syncEdit(){if(!EDIT)return;document.querySelectorAll("[data-ed-n]").forEach(function(e){var i=+e.getAttribute("data-ed-n");if(EDIT.rows[i])EDIT.rows[i].name=e.value;});document.querySelectorAll("[data-ed-p]").forEach(function(e){var i=+e.getAttribute("data-ed-p");if(EDIT.rows[i])EDIT.rows[i].p=parseInt(e.value,10)||0;});var d=document.getElementById("ed_date");if(d&&d.value)EDIT.date=d.value;}
function edBox(){
 var h='<div class="edbox stack" style="gap:8px"><div class="lbl">Classifica finale · nome e punti, dal 1° all\'ultimo</div>';
 h+='<datalist id="knownnames">'+knownNames().map(function(n){return '<option value="'+esc(n)+'">';}).join("")+'</datalist>';
 EDIT.rows.forEach(function(r,i){h+='<div class="edrow"><b class="pos">'+(i+1)+'°</b><input data-ed-n="'+i+'" list="knownnames" value="'+esc(r.name)+'" aria-label="Nome '+(i+1)+'°" maxlength="16"><input data-ed-p="'+i+'" type="number" inputmode="numeric" value="'+r.p+'" aria-label="Punti '+(i+1)+'°" class="pts" title="Punti"><button type="button" class="btn sm alt" data-act="edup" data-i="'+i+'"'+(i===0?' disabled':'')+' aria-label="Sposta su">↑</button><button type="button" class="btn sm alt" data-act="eddown" data-i="'+i+'"'+(i===EDIT.rows.length-1?' disabled':'')+' aria-label="Sposta giù">↓</button><button type="button" class="btn sm alt" data-act="edrm" data-i="'+i+'" aria-label="Togli">✕</button></div>';});
 h+='<div class="row"><button type="button" class="btn sm alt" data-act="edadd">+ Aggiungi giocatore</button><label style="margin:0;display:flex;align-items:center;gap:6px">Data <input id="ed_date" type="date" value="'+esc(EDIT.date)+'" style="width:auto"></label></div>';
 h+='<p class="mut" style="margin:0">L\'ordine è la classifica. A pari punti lo scontro conta come pareggio per lo S.K.U.L.O.</p>';
 h+='<div class="row"><button type="button" class="btn acc" data-act="edsave">Salva nello storico</button><button type="button" class="btn sm alt" data-act="edcancel">Annulla</button></div></div>';
 return h;
}
function eloBanner(){return ELODIRTY?'<div class="st msg" style="box-shadow:none;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b class="grow">Lo storico è cambiato: aggiorna lo S.K.U.L.O.</b><button type="button" class="btn acc" data-act="recalc">Aggiorna lo S.K.U.L.O.</button></div>':'';}
function ageTxt(t){if(!t)return "data sconosciuta";var d=(Date.now()-t)/86400000;if(d<1){var h=Math.round(d*24);return h<1?"meno di un'ora fa":h+" h fa";}return Math.floor(d)+" giorni fa";}
function ic(c){return '<span class="ic '+(c.ok?'ok':'ko')+'" aria-hidden="true">'+(c.ok?'✓':'!')+'</span>';}
function draw(){
 var a=document.getElementById("app"),h='';
 h+='<div class="row"><span class="logo t">Magical Outlet</span><span class="pill">Manutenzione</span><span class="grow"></span><a class="btn sm alt" href="./">← Torna al gioco</a></div>';
 if(MSG)h+='<div class="st msg" role="status" style="font-weight:800">'+esc(MSG)+'</div>';
 // 1 stato
 var bad=CHECKS.filter(function(c){return !c.ok;}).length,done=CHECKS.length>0&&!BUSYX;
 h+='<section class="st stack" style="gap:6px"><div class="row"><h2 class="t grow" style="font-size:28px">1 · Controllo dello stato</h2><button type="button" class="btn sm acc" data-act="check"'+(BUSYX?' disabled':'')+'>'+(BUSYX?'Controllo…':(CHECKS.length?'Ripeti il controllo':'Avvia il controllo'))+'</button></div>';
 if(!CHECKS.length)h+='<p class="mut" style="margin:0">Prova a leggere e scrivere sul database e ti dice cosa funziona e cosa no. Non tocca le partite vere.</p>';
 CHECKS.forEach(function(c){h+='<div class="chk">'+ic(c)+'<div><b>'+esc(c.label)+'</b><div class="mut">'+esc(c.detail)+'</div>'+(c.ok?'':'<div style="font-weight:800;margin-top:2px">→ '+esc(c.fix)+'</div>')+'</div></div>';});
 if(done)h+='<div class="st msg" style="box-shadow:none;margin-top:8px;font-weight:900">'+(bad?(bad===1?'1 cosa da sistemare':bad+' cose da sistemare')+': aggiorna le regole qui sotto.':'Tutto a posto: il database è pronto.')+'</div>';
 h+='</section>';
 // 2 regole
 h+='<section class="st stack" style="gap:10px"><h2 class="t" style="font-size:28px">2 · Aggiorna le regole</h2><p class="mut" style="margin:0">Le regole decidono chi può leggere e scrivere. Firebase non permette di cambiarle da un sito, quindi si fa in 4 tocchi:</p><ol class="steps"><li>Tocca <b>Copia le regole</b>.</li><li>Tocca <b>Apri le regole su Firebase</b> (accedi con il tuo account Google).</li><li>Tocca nel riquadro, <b>Seleziona tutto</b> e <b>Incolla</b>.</li><li>Tocca <b>Pubblica</b>, poi torna qui e ripeti il controllo.</li></ol>';
 h+='<div class="row"><button type="button" class="btn acc" data-act="copy">Copia le regole</button><a class="btn alt" href="'+esc(consoleUrl())+'" target="_blank" rel="noopener">Apri le regole su Firebase</a></div>';
 h+='<textarea class="code" id="rules" readonly aria-label="Regole del database">'+esc(RULES||"Carico…")+'</textarea></section>';
 // 3 partite
 h+='<section class="st stack" style="gap:6px"><div class="row"><h2 class="t grow" style="font-size:28px">3 · Partite</h2><button type="button" class="btn sm alt" data-act="reloadgames">Aggiorna</button></div>';
 if(GAMES===null)h+='<p class="mut" style="margin:0">Carico…</p>';
 else if(GAMES===false)h+='<p class="mut" style="margin:0">Non riesco a elencare le partite: aggiorna le regole (punto 2).</p>';
 else{
  var empty=GAMES.filter(function(g){return !g.players;});
  h+='<p class="mut" style="margin:0">'+GAMES.length+' partit'+(GAMES.length===1?'a':'e')+' salvat'+(GAMES.length===1?'a':'e')+'. Per quelle con giocatori puoi scrivere o correggere la classifica finale: finisce nello storico e conta per lo S.K.U.L.O.</p>'+eloBanner();
  if(empty.length)h+='<div class="row"><button type="button" class="btn sm acc" data-act="delempty">'+(CONF==="empty"?'Tocca ancora: cancello':'Cancella le '+empty.length+' partite senza giocatori')+'</button></div>';
  GAMES.forEach(function(g){var hid=histByCode(g.code);h+='<div class="gm"><span class="code">'+esc(g.code)+'</span><span class="grow mut">'+g.players+' giocator'+(g.players===1?'e':'i')+' · '+(g.ended?'finita':(g.started?(g.races+' gare chiuse'):'in sala d\'attesa'))+' · '+esc(ageTxt(g.created))+(hid?' · <b style="color:#0b7a3e">nello storico</b>':'')+'</span><span class="acts">'+(g.players?'<button type="button" class="btn sm '+(hid?'alt':'yel')+'" data-act="edgame" data-c="'+esc(g.code)+'">'+(hid?'Modifica classifica':'Scrivi classifica')+'</button>':'')+'<button type="button" class="btn sm alt" data-act="delgame" data-c="'+esc(g.code)+'">'+(CONF==="g"+g.code?'Tocca ancora: cancello':'Cancella')+'</button></span></div>';
   if(EDIT&&EDIT.where==="g"+g.code)h+=edBox();});
  var old=GAMES.filter(oldOk).length;
  if(GAMES.length)h+='<div class="row" style="margin-top:8px"><button type="button" class="btn sm alt" data-act="delold"'+(old?'':' disabled')+'>'+(CONF==="old"?'Tocca ancora: cancello':'Cancella le partite vecchie già nello storico ('+old+')')+'</button></div>';
 }
 h+='</section>';
 // 4 foto
 h+='<section class="st stack" style="gap:8px"><div class="row"><h2 class="t grow" style="font-size:28px">4 · Foto delle carte</h2><button type="button" class="btn sm alt" data-act="reloadglobal">Aggiorna</button></div>';
 if(IMGS===null)h+='<p class="mut" style="margin:0">Carico…</p>';
 else if(IMGS===false)h+='<p class="mut" style="margin:0">Non riesco a leggere le foto: aggiorna le regole.</p>';
 else{var ks=Object.keys(IMGS);h+='<p class="mut" style="margin:0">'+ks.length+(ks.length===1?' foto salvata':' foto salvate')+' su 36 carte. Per caricarle o cambiarle: gioco → banco → Carte e foto.</p>';
  if(ks.length)h+='<div class="thumbs">'+ks.map(function(k){return '<img src="'+esc(IMGS[k])+'" alt="'+esc(k.replace(/_/g," "))+'" title="'+esc(k.replace(/_/g," "))+'" loading="lazy">';}).join("")+'</div><div class="row"><button type="button" class="btn sm alt" data-act="delimgs">'+(CONF==="imgs"?'Tocca ancora: tolgo tutte le foto':'Togli tutte le foto')+'</button></div>';}
 h+='</section>';
 // 5 livelli
 h+='<section class="st stack" style="gap:8px"><h2 class="t" style="font-size:28px">5 · Livelli permanenti</h2>';
 if(TIERS===null)h+='<p class="mut" style="margin:0">Carico…</p>';
 else if(TIERS===false)h+='<p class="mut" style="margin:0">Non riesco a leggere i livelli: aggiorna le regole.</p>';
 else{var base={};try{Core.parseRoster(DEF).forEach(function(x){base[tkey(x.n)]=x.t||"D";});}catch(e){}var ch=Object.keys(TIERS).filter(function(k){return base[k]&&base[k]!==TIERS[k];});
  h+='<p class="mut" style="margin:0">'+ch.length+' carte hanno un livello diverso da quello originale'+(ch.length?': '+ch.map(function(k){return esc(k.replace(/_/g," "))+' '+base[k]+'→'+TIERS[k];}).join(', '):'')+'.</p>';
  h+='<div class="row"><button type="button" class="btn sm alt" data-act="tierreset"'+(ch.length?'':' disabled')+'>'+(CONF==="tiers"?'Tocca ancora: ripristino':'Ripristina i livelli originali')+'</button></div>';}
 h+='</section>';
 // 6 storico
 h+='<section class="st stack" style="gap:6px"><h2 class="t" style="font-size:28px">6 · Storico dei tornei</h2>';
 if(HIST===null)h+='<p class="mut" style="margin:0">Carico…</p>';
 else if(HIST===false)h+='<p class="mut" style="margin:0">Non riesco a leggere lo storico: aggiorna le regole.</p>';
 else{var hl=Object.keys(HIST).map(function(k){var x=HIST[k]||{};x.id=k;return x;}).sort(function(a,b){return (b.date||0)-(a.date||0);});
  h+='<p class="mut" style="margin:0">'+hl.length+' tornei salvati. Cancella quelli di prova: spariscono anche dalle statistiche.</p>';
  h+=eloBanner();if(hl.length&&!ELODIRTY)h+='<div class="row"><button type="button" class="btn sm alt" data-act="recalc">Ricalcola lo S.K.U.L.O.</button></div>';
  hl.forEach(function(x){var w=(x.players||[]).filter(function(p){return p.pos===1;})[0];h+='<div class="gm gl"><span class="grow"><b>'+esc(new Date(x.date||0).toLocaleDateString("it-IT"))+'</b> · '+((x.players||[]).length)+' giocatori'+(w?' · vince '+esc(w.name)+' ('+w.p+' pt)':'')+'</span><button type="button" class="btn sm alt" data-act="edhist" data-c="'+esc(x.id)+'">Modifica</button><button type="button" class="btn sm alt" data-act="delhist" data-c="'+esc(x.id)+'">'+(CONF==="h"+x.id?'Tocca ancora: cancello':'Cancella')+'</button></div>';if(EDIT&&EDIT.where==="h"+x.id)h+=edBox();});}
 h+='</section>';
 // 7 giocatori
 h+='<section class="st stack" style="gap:6px"><h2 class="t" style="font-size:28px">7 · Giocatori registrati</h2>';
 if(REGP===null)h+='<p class="mut" style="margin:0">Carico…</p>';
 else if(REGP===false)h+='<p class="mut" style="margin:0">Non riesco a leggere i giocatori: aggiorna le regole.</p>';
 else{var rk=Object.keys(REGP);h+='<p class="mut" style="margin:0">Luigi, Riccardo, Mirko, Simone, Luca e Fabio ci sono sempre. Qui sotto i nomi aggiunti ('+rk.length+'). Togliere un nome non cancella i suoi tornei.</p>';
  rk.forEach(function(k){h+='<div class="gm gl"><b class="grow">'+esc((REGP[k]||{}).name||k)+'</b><button type="button" class="btn sm alt" data-act="delplayer" data-c="'+esc(k)+'">'+(CONF==="p"+k?'Tocca ancora: tolgo':'Togli')+'</button></div>';});}
 h+='</section>';
 h+=impBox();
 h+='<p class="mut" style="text-align:center">Pagina riservata alla manutenzione: non ha password, quindi non condividerne il link.</p>';
 a.innerHTML=h;
}
async function recalcElo(){var hl=Object.keys(HIST||{}).map(function(k){var x=HIST[k];x.id=k;return x;});var e=Core.eloAnnotate(hl);
 for(var i=0;i<hl.length;i++){var x=hl[i],id=x.id;delete x.id;await wt(DB.ref("global/history/"+id+"/players").set(x.players));x.id=id;}
 await wt(DB.ref("global/elo").set(e.ratings));}
function ask(k){CONF=k;draw();setTimeout(function(){if(CONF===k){CONF=null;draw();}},4000);}
document.getElementById("app").addEventListener("click",async function(ev){
 var t=ev.target.closest("[data-act]");if(!t||t.disabled)return;var a=t.getAttribute("data-act");MSG="";
 try{
 if(a==="check"){runChecks();return;}
 if(a==="reloadgames"){GAMES=null;draw();loadGames();return;}
 if(a==="reloadglobal"){IMGS=null;TIERS=null;HIST=null;REGP=null;draw();loadGlobal();return;}
 if(a==="copy"){var ta=document.getElementById("rules");var ok=false;try{await navigator.clipboard.writeText(RULES);ok=true;}catch(e){try{ta.removeAttribute("readonly");ta.focus();ta.select();ta.setSelectionRange(0,999999);ok=document.execCommand("copy");ta.setAttribute("readonly","");}catch(x){}}
  MSG=ok?"Regole copiate. Ora aprile su Firebase e incolla.":"Non riesco a copiare da solo: tieni premuto nel riquadro, scegli Seleziona tutto e poi Copia.";draw();return;}
 if(a==="delgame"){var c=t.getAttribute("data-c");if(CONF!=="g"+c){ask("g"+c);return;}CONF=null;await wt(DB.ref("games/"+c).remove());MSG="Partita "+c+" cancellata.";GAMES=GAMES.filter(function(g){return g.code!==c;});draw();return;}
 if(a==="delold"){if(CONF!=="old"){ask("old");return;}CONF=null;var del=GAMES.filter(oldOk);for(var i=0;i<del.length;i++)await wt(DB.ref("games/"+del[i].code).remove());MSG=del.length+" partite cancellate.";loadGames();return;}
 if(a==="delhist"){var hc=t.getAttribute("data-c");if(CONF!=="h"+hc){ask("h"+hc);return;}CONF=null;await wt(DB.ref("global/history/"+hc).remove());delete HIST[hc];await recalcElo();ELODIRTY=false;MSG="Torneo tolto dallo storico. S.K.U.L.O. ricalcolato.";draw();return;}
 if(a==="recalc"){await recalcElo();ELODIRTY=false;var er=Core.elo(Object.keys(HIST||{}).map(function(k){var x=HIST[k];x.id=k;return x;})).ratings;MSG="S.K.U.L.O. aggiornato: "+Object.keys(er).map(function(k){return er[k];}).sort(function(a,b){return b.r-a.r;}).map(function(x){return x.name+" "+x.r;}).join(" · ");draw();return;}
 if(a==="delplayer"){var pc=t.getAttribute("data-c");if(CONF!=="p"+pc){ask("p"+pc);return;}CONF=null;await wt(DB.ref("global/players/"+pc).remove());delete REGP[pc];MSG="Giocatore tolto.";draw();return;}
 if(a==="impprev"){var it=document.getElementById("imptxt");if(it)IMPTXT=it.value;prepImport();return;}
 if(a==="impsave"){if(!IMP||!IMP.length)return;document.querySelectorAll("[data-imp-d]").forEach(function(e){IMP[+e.getAttribute("data-imp-d")].date=e.value;});document.querySelectorAll("[data-imp-c]").forEach(function(e){IMP[+e.getAttribute("data-imp-c")].code=e.value;});
  var codes={},dupc=false;IMP.forEach(function(t){if(t.code){if(codes[t.code])dupc=true;codes[t.code]=1;}});if(dupc){MSG="Due tornei puntano alla stessa partita: cambia la scelta.";draw();return;}
  for(var ii=0;ii<IMP.length;ii++){var tt=IMP[ii],gg2=(GAMES||[]).filter(function(g){return g.code===tt.code;})[0],hid2=tt.code?histByCode(tt.code):null,dt2=new Date(tt.date+"T20:00:00").getTime();
   var id2=hid2||(tt.code?"g_"+tt.code+"_"+((gg2&&gg2.created)||dt2):"m_"+dt2+"_"+ii);
   var pos=0,lastP=null;var ent2={date:isNaN(dt2)?Date.now():dt2,code:tt.code||"",races:[],manual:true,players:tt.rows.map(function(r,q){return {name:r.name,team:"",pos:q+1,p:r.p,rw:0,b:0,f:0,fb:0,cards:[],last:""};})};
   await wt(DB.ref("global/history/"+id2).set(ent2));HIST[id2]=ent2;await registerNames(tt.rows.map(function(r){return r.name;}));}
  await recalcElo();ELODIRTY=false;var er2=Core.elo(Object.keys(HIST||{}).map(function(k){var x=HIST[k];x.id=k;return x;})).ratings;
  MSG=IMP.length+" tornei salvati. S.K.U.L.O.: "+Object.keys(er2).map(function(k){return er2[k];}).sort(function(a,b){return b.r-a.r;}).map(function(x){return x.name+" "+x.r;}).join(" · ");IMP=null;draw();window.scrollTo(0,0);return;}
 if(a==="delempty"){if(CONF!=="empty"){ask("empty");return;}CONF=null;var em=GAMES.filter(function(g){return !g.players;});for(var j=0;j<em.length;j++)await wt(DB.ref("games/"+em[j].code).remove());MSG=em.length+" partite vuote cancellate.";loadGames();return;}
 if(a==="edgame"){var gc=t.getAttribute("data-c"),gg=GAMES.filter(function(x){return x.code===gc;})[0]||{},hid=histByCode(gc);
  if(hid){var he=HIST[hid];openEditor("g"+gc,hid,gc,he.date,(he.players||[]).slice().sort(function(a,b){return (a.pos||99)-(b.pos||99);}));}
  else openEditor("g"+gc,"g_"+gc+"_"+(gg.created||Date.now()),gc,gg.created||Date.now(),suggestFromGame(gc));return;}
 if(a==="edhist"){var hc2=t.getAttribute("data-c"),he2=HIST[hc2];if(!he2)return;openEditor("h"+hc2,hc2,he2.code,he2.date,(he2.players||[]).slice().sort(function(a,b){return (a.pos||99)-(b.pos||99);}));return;}
 if(a==="edcancel"){EDIT=null;draw();return;}
 if(a==="edup"||a==="eddown"){syncEdit();var ii=+t.getAttribute("data-i"),jj=ii+(a==="edup"?-1:1);if(jj<0||jj>=EDIT.rows.length)return;var tmp=EDIT.rows[ii];EDIT.rows[ii]=EDIT.rows[jj];EDIT.rows[jj]=tmp;draw();return;}
 if(a==="edrm"){syncEdit();EDIT.rows.splice(+t.getAttribute("data-i"),1);draw();return;}
 if(a==="edadd"){syncEdit();EDIT.rows.push({name:"",team:"",p:0});draw();return;}
 if(a==="edsave"){syncEdit();var rows=EDIT.rows.filter(function(r){return String(r.name).trim();});
  if(rows.length<2){MSG="Servono almeno 2 giocatori.";draw();return;}
  var names={},dup=false;rows.forEach(function(r){Core.members(r.name).forEach(function(m){var k=nk(m);if(names[k])dup=true;names[k]=1;});});if(dup){MSG="Lo stesso nome compare due volte.";draw();return;}
  rows.forEach(function(r){r.name=normSeat(r.name);});
  var old=HIST[EDIT.id]||{},dt=new Date(EDIT.date+"T20:00:00").getTime();
  var ent={date:isNaN(dt)?(old.date||Date.now()):dt,code:EDIT.code||old.code||"",tid:old.tid||"",races:old.races||[],manual:true,
   players:rows.map(function(r,q){var o=(old.players||[]).filter(function(p){return nk(p.name)===nk(r.name);})[0]||{};return {name:r.name,team:r.team||o.team||"",pos:q+1,p:r.p,rw:o.rw||0,b:o.b||0,f:o.f||0,fb:o.fb||0,cards:o.cards||[],last:o.last||""};})};
  await wt(DB.ref("global/history/"+EDIT.id).set(ent));HIST[EDIT.id]=ent;
  await registerNames(rows.map(function(r){return r.name;}));
  EDIT=null;ELODIRTY=true;MSG="Classifica salvata nello storico. Ora tocca «Aggiorna lo S.K.U.L.O.».";draw();return;}
 if(a==="delimgs"){if(CONF!=="imgs"){ask("imgs");return;}CONF=null;await wt(DB.ref("global/images").remove());IMGS={};MSG="Foto tolte.";draw();return;}
 if(a==="tierreset"){if(CONF!=="tiers"){ask("tiers");return;}CONF=null;var m={};Core.parseRoster(DEF).forEach(function(x){m[tkey(x.n)]=x.t||"D";});await wt(DB.ref("global/tiers").set(m));TIERS=m;MSG="Livelli ripristinati.";draw();return;}
 }catch(e){MSG="Non riuscito: "+errTxt(e)+(/permesso/.test(errTxt(e))?". Aggiorna le regole (punto 2).":"");draw();}
});
/* ---- codice d'accesso ---- */
var PINH="9f08015a017fe9e7aa8853f36dd4a6c0c0271823fef04838e30f5b33b4dea5d7",PINERR="";
async function sha(t){var b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return Array.prototype.map.call(new Uint8Array(b),function(x){return ("0"+x.toString(16)).slice(-2);}).join("");}
function unlocked(){try{return sessionStorage.getItem("ma_admin")==="1";}catch(e){return false;}}
function drawPin(){
 document.getElementById("app").innerHTML='<div class="row"><span class="logo t">Magical Outlet</span><span class="pill">Manutenzione</span><span class="grow"></span><a class="btn sm alt" href="./">← Torna al gioco</a></div>'+
  '<form class="st stack" id="pinf" style="max-width:420px;align-self:center;width:100%;gap:12px"><h2 class="t" style="font-size:28px">Codice d\'accesso</h2><label for="pin" style="margin:0">Inserisci il codice di 4 cifre</label><input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" style="font:400 34px/1 \'Lilita One\',sans-serif;letter-spacing:.4em;text-align:center">'+
  (PINERR?'<div style="font-weight:900;color:var(--red)" role="alert">'+esc(PINERR)+'</div>':'')+'<button type="submit" class="btn big acc">Entra</button></form>';
 var i=document.getElementById("pin");if(i)i.focus();
}
function start(){
 try{if(CFG&&window.firebase){firebase.apps.length||firebase.initializeApp(CFG);DB=firebase.database();}}catch(e){}
 draw();loadRules();
 if(DB){runChecks().then(function(){loadGames();loadGlobal();});}
}
document.getElementById("app").addEventListener("submit",async function(ev){
 if(ev.target.id!=="pinf")return;ev.preventDefault();var v=(document.getElementById("pin").value||"").trim(),ok=false;
 try{ok=(await sha("magical-outlet:"+v))===PINH;}catch(e){ok=false;}
 if(ok){try{sessionStorage.setItem("ma_admin","1");}catch(e){}PINERR="";start();}
 else{PINERR="Codice sbagliato.";drawPin();}
});
(function boot(){if(unlocked())start();else drawPin();})();
