/* Magical Outlet — pagina di manutenzione (Firebase): controlli, regole da copiare, pulizia partite, foto e livelli */
var HIST=null,REGP=null;
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
 try{var s=await wt(DB.ref("games").get(),12000);var v=s.val()||{};GAMES=Object.keys(v).map(function(c){var g=v[c]||{},st=null;try{st=JSON.parse(g.state);}catch(e){}var pl=g.players?Object.keys(g.players).length:0;
  return {code:c,created:g.created||0,stage:st?st.stage:"?",players:pl,races:st&&st.races?st.races.length:0,started:st&&st.started};}).sort(function(a,b){return (b.created||0)-(a.created||0);});}
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
  h+='<p class="mut" style="margin:0">'+GAMES.length+' partit'+(GAMES.length===1?'a':'e')+' salvat'+(GAMES.length===1?'a':'e')+'. Cancellare una partita non tocca foto e livelli.</p>';
  GAMES.forEach(function(g){h+='<div class="gm"><span class="code">'+esc(g.code)+'</span><span class="grow mut">'+g.players+' giocator'+(g.players===1?'e':'i')+' · '+(g.started?('gara '+g.races+' di 4'):'in sala d\'attesa')+' · '+esc(ageTxt(g.created))+'</span><button type="button" class="btn sm alt" data-act="delgame" data-c="'+esc(g.code)+'">'+(CONF==="g"+g.code?'Tocca ancora: cancello':'Cancella')+'</button></div>';});
  var old=GAMES.filter(function(g){return !g.created||(Date.now()-g.created)>7*86400000;}).length;
  if(GAMES.length)h+='<div class="row" style="margin-top:8px"><button type="button" class="btn sm alt" data-act="delold"'+(old?'':' disabled')+'>'+(CONF==="old"?'Tocca ancora: cancello':'Cancella le partite più vecchie di 7 giorni ('+old+')')+'</button></div>';
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
  hl.forEach(function(x){var w=(x.players||[]).filter(function(p){return p.pos===1;})[0];h+='<div class="gm"><span class="grow"><b>'+esc(new Date(x.date||0).toLocaleDateString("it-IT"))+'</b> · '+((x.players||[]).length)+' giocatori'+(w?' · vince '+esc(w.name)+' ('+w.p+' pt)':'')+'</span><button type="button" class="btn sm alt" data-act="delhist" data-c="'+esc(x.id)+'">'+(CONF==="h"+x.id?'Tocca ancora: cancello':'Cancella')+'</button></div>';});}
 h+='</section>';
 // 7 giocatori
 h+='<section class="st stack" style="gap:6px"><h2 class="t" style="font-size:28px">7 · Giocatori registrati</h2>';
 if(REGP===null)h+='<p class="mut" style="margin:0">Carico…</p>';
 else if(REGP===false)h+='<p class="mut" style="margin:0">Non riesco a leggere i giocatori: aggiorna le regole.</p>';
 else{var rk=Object.keys(REGP);h+='<p class="mut" style="margin:0">Luigi, Riccardo, Mirko, Simone, Luca e Fabio ci sono sempre. Qui sotto i nomi aggiunti ('+rk.length+'). Togliere un nome non cancella i suoi tornei.</p>';
  rk.forEach(function(k){h+='<div class="gm"><b class="grow">'+esc((REGP[k]||{}).name||k)+'</b><button type="button" class="btn sm alt" data-act="delplayer" data-c="'+esc(k)+'">'+(CONF==="p"+k?'Tocca ancora: tolgo':'Togli')+'</button></div>';});}
 h+='</section>';
 h+='<p class="mut" style="text-align:center">Pagina riservata alla manutenzione: non ha password, quindi non condividerne il link.</p>';
 a.innerHTML=h;
}
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
 if(a==="delold"){if(CONF!=="old"){ask("old");return;}CONF=null;var del=GAMES.filter(function(g){return !g.created||(Date.now()-g.created)>7*86400000;});for(var i=0;i<del.length;i++)await wt(DB.ref("games/"+del[i].code).remove());MSG=del.length+" partite cancellate.";loadGames();return;}
 if(a==="delhist"){var hc=t.getAttribute("data-c");if(CONF!=="h"+hc){ask("h"+hc);return;}CONF=null;await wt(DB.ref("global/history/"+hc).remove());delete HIST[hc];MSG="Torneo tolto dallo storico.";draw();return;}
 if(a==="delplayer"){var pc=t.getAttribute("data-c");if(CONF!=="p"+pc){ask("p"+pc);return;}CONF=null;await wt(DB.ref("global/players/"+pc).remove());delete REGP[pc];MSG="Giocatore tolto.";draw();return;}
 if(a==="delimgs"){if(CONF!=="imgs"){ask("imgs");return;}CONF=null;await wt(DB.ref("global/images").remove());IMGS={};MSG="Foto tolte.";draw();return;}
 if(a==="tierreset"){if(CONF!=="tiers"){ask("tiers");return;}CONF=null;var m={};Core.parseRoster(DEF).forEach(function(x){m[tkey(x.n)]=x.t||"D";});await wt(DB.ref("global/tiers").set(m));TIERS=m;MSG="Livelli ripristinati.";draw();return;}
 }catch(e){MSG="Non riuscito: "+errTxt(e)+(/permesso/.test(errTxt(e))?". Aggiorna le regole (punto 2).":"");draw();}
});
(function boot(){
 try{if(CFG&&window.firebase){firebase.apps.length||firebase.initializeApp(CFG);DB=firebase.database();}}catch(e){}
 draw();loadRules();
 if(DB){runChecks().then(function(){loadGames();loadGlobal();});}
})();
