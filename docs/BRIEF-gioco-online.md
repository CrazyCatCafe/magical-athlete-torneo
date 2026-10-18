# Magical Outlet · Gioco online — documento di partenza

Da incollare (o far leggere dal repository) all'inizio della nuova chat. Usa **Opus**.

## 1. Obiettivo
Un gioco di **Magical Athlete giocabile online**, fedele al **regolamento ufficiale**, con in più la **modalità torneo «Magical Outlet»** già costruita nell'app esistente. Si gioca dal telefono; un tablet può fare da tabellone condiviso.

## 2. Cosa esiste già (da riusare)
- **Repository**: `CrazyCatCafe/magical-athlete-torneo` (GitHub Pages: `crazycatcafe.github.io/magical-athlete-torneo/`). Sito statico in HTML/CSS/JS senza build: `index.html`, `style.css`, `core.js` (elenco racer, livelli, abilità in italiano, calcolo S.K.U.L.O.), `app.js` (app torneo), `admin.html` + `admin.js` (Manutenzione, codice 2409), `database.rules.json`, `sounds/`.
- **Firebase Realtime Database** (progetto `magical-athlete-torneo`, europe-west1). Configurazione in `config.js`. Percorsi usati:
  - `games/{CODICE}` — partite del torneo (`state` = JSON in stringa, `players`, `bonus`, `farts`)
  - `global/tiers` — livelli permanenti delle carte (S/A/B/C/D)
  - `global/images` — foto delle carte (dataURL JPEG ~360px), caricate dall'utente
  - `global/players` — giocatori registrati (Luigi, Riccardo, Mirko, Simone, Luca, Fabio sono predefiniti)
  - `global/history` — storico tornei; `global/elo` — S.K.U.L.O. salvato
- **Stile grafico «sticker pop»**: sfondo lavanda `#cfd6ff`, contorni neri spessi, ombre piene, font Lilita One + Nunito. Componenti in `style.css`. Pensato prima per il telefono: niente scroll superfluo, barre fisse in basso, carte compatte su 2 colonne con scheda che sale dal basso.
- **Suoni**: 10 scoregge + 10 rutti (`sounds/`), tasto «Rutti e scoregge» che conta negli spareggi.

## 3. Regole base di Magical Athlete (dal regolamento ufficiale)
- **Draft**: si girano 2× carte rispetto ai giocatori; tiro di dado per chi sceglie primo; **doppio snake draft** → 4 racer a testa.
- **4 gare**, piste alternate **Mild Mile / Wild Wilds** (Mild, Wild, Mild, Wild). Prima della gara tutti rivelano insieme un racer.
- **Turno**: tiri il dado e muovi = **main move** (molti poteri si attivano solo sul main move).
- La gara finisce quando **2 racer** tagliano il traguardo: 1° prende il gettone **oro** in cima alla pila, 2° l'**argento**. Gettoni bronzo da 1 punto per caselle stella e poteri.
- Chi era **più indietro** (o eliminato per primo) nella gara precedente parte per primo nella successiva.
- **Caselle**: freccia (muovi del numero indicato, non è main move), TRIP (inciampi), stella (+1 bronzo). La partenza conta come casella.
- **Ordine dei poteri simultanei**: caselle della pista → giocatore di turno → altri giocatori in senso orario.
- **Termini**: avanti/dietro, condividere una casella (solo se fermi), solo, ultimo, in testa, sorpasso, **trip** (salti il prossimo main move), **warp** (teletrasporto: non è movimento), «muovere 0» non è muovere.
- **Dettagli**: un rilancio cancella il tiro precedente; arrivi simultanei non attivano i poteri «fermi insieme»; poteri «all'inizio del turno» una volta per turno; i poteri si spengono quando il racer finisce o esce; loop infiniti → una volta in ordine e stop; ultimo racer rimasto → prende il posto rimasto; modificatori al movimento in ordine di turno; parità per testa/ultimo → sceglie il giocatore.
- **36 racer** con abilità: testi italiani in `core.js` (oggetto `ABIL`), chiarimenti ufficiali nel regolamento (pagine «Racer info»).

## 4. Modalità torneo «Magical Outlet» (già in uso, da replicare identica)
- **Sempre 4 gare**. Punti 1°/2°: G1 **3/1**, G2 **4/2**, G3 **4/2**, G4 **5/3**. Bronzo +1 per stelle e poteri.
- **Pole position** a caso: chi parte in gara 1, chi sceglie per primo il racer in gara 1, chi comincia il draft.
- **Draft comune** prima delle gare: **5 giri**, ogni giro si rivelano **N+1 carte**, una a testa in senso orario; il giro dopo comincia il successivo; la carta avanzata si scarta.
- **Ogni gara: prima si decide chi parte, poi si sceglie il racer.** Gara 1: parte l'estratto, si sceglie in senso orario dall'estratto. Gare 2–4: **l'ultimo in classifica sceglie chi parte**, poi sceglie il racer chi ha più punti (pari: meno rutti e scoregge, poi livello della carta usata nella gara prima, poi caso).
- **Livelli permanenti** S/A/B/C/D: la carta del vincitore sale di 1, quella dell'ultimo scende di 1 (pari all'ultimo posto: sorteggio).
- **Fine**: la carta rimasta dà S/A +2, B/C +1, D 0. Spareggio finale: meno rutti e scoregge, poi più vittorie, poi più bronzi.
- **Team** con nome scelto dal giocatore; **storico** con statistiche; **S.K.U.L.O.** (*Supremazia Konquistata Usando Lanci Onesti*): Elo multigiocatore, partenza 1500, ogni coppia di giocatori è uno scontro (più punti vince, pari punti = pareggio), K 24 (48 nei primi 3 tornei), posti condivisi «Luigi/Fabio» ammessi. Codice in `core.js` (`Core.elo`).

## 5. Cosa serve ancora dall'utente
1. **Foto dall'alto delle due piste** (Mild Mile e Wild Wilds): numero di caselle, curve (Blimp usa «la seconda curva»), frecce, TRIP, stelle.
2. **Valori dei gettoni oro e argento** della pila ufficiale (per la modalità «regolamento vero»).
3. Decisioni:
   - online vero (ognuno da casa) **e/o** stesso tavolo con tablet come tabellone;
   - avversari controllati dal computer sì/no;
   - immagini: foto delle carte dal Firebase privato (come oggi) oppure nomi/disegni propri.

## 6. Architettura proposta
- **Motore di gioco puro** (`engine.js`), senza grafica: stato + azioni → nuovo stato + elenco di eventi. Coda di trigger per i poteri, nell'ordine ufficiale. Dado con seme registrato (partite riproducibili e verificabili).
- **Test automatici per ogni racer** (Node), compresi i casi limite del regolamento (Copy Cat, Twin, Egg, Huge Baby, Scoocher/Suckerfish, Mastermind, Skipper, Inchworm…).
- **Multigiocatore senza server**: un dispositivo «host» esegue il motore e scrive lo stato su Firebase (`online/{CODICE}`); gli altri inviano solo le loro scelte (tiro, opzioni dei poteri «posso»). Riconnessione con codice + nome, come nell'app torneo.
- **Interfaccia**: pista disegnata in SVG, pedine animate passo-passo, registro di gioco leggibile («Banana fa inciampare Romantic»), richieste di scelta sul telefono solo quando un potere è opzionale.
- Tornei del gioco online salvati nello **stesso storico** e nello stesso S.K.U.L.O.

## 7. Tappe
1. Pista + movimento base + 8–10 racer semplici, partita in locale.
2. Multigiocatore online con Firebase.
3. Tutti i 36 racer, uno alla volta con test.
4. Modalità regolamento (draft snake, gettoni) e modalità torneo Magical Outlet.
5. Rifinitura grafica, suoni, storico/S.K.U.L.O. condivisi.
