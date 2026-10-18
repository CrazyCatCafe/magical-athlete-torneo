# Magical Outlet

App per il torneo «Magical Outlet» (varianti da torneo di Magical Athlete): ogni giocatore usa il proprio telefono, un tablet fa da banco e tabellone.

## Regole (Magical Outlet)
- Sempre **4 gare**. Punti 1°/2°: gara 1 **3/1**, gara 2 **4/2**, gara 3 **4/2**, gara 4 **5/3**; bronzo (+1) dal telefono per stelle e poteri.
- **Pole position** (a caso): chi parte nella gara 1, chi sceglie per primo il racer della gara 1, chi comincia il draft.
- **Draft comune** prima delle gare: 5 giri. A ogni giro si rivelano N+1 carte (N = giocatori) e se ne prende una a testa in senso orario; il giro dopo comincia il giocatore successivo. La carta avanzata si scarta. 5 carte a testa.
- **Prima chi parte, poi il racer.** Gara 1: parte il giocatore estratto in pole (visibile già durante il draft); si sceglie il racer in senso orario dal giocatore estratto. Gare 2–4: l'ultimo in classifica decide chi parte, poi si sceglie il racer da chi ha più punti (pari: meno rutti e scoregge, poi livello della carta usata nella gara prima, poi caso).
- **Squadre**: finito il draft, ognuno vede la sua squadra di 5 racer, la media dei livelli e la sua percentuale di vittorie. Toccando il nome di un racer si legge l'abilità.
- **Giocatori e storico**: Luigi, Riccardo, Mirko, Simone, Luca e Fabio sono già in elenco; un nome nuovo viene registrato. Ogni torneo finito si salva nello storico (`global/history`) con classifica, team e racer: da lì le statistiche (tornei, vittorie, % vittorie, podi, punti medi, gare vinte).
- **S.K.U.L.O.** (Supremazia Konquistata Usando Lanci Onesti): tutti partono da 1500. Ogni torneo = scontri a coppie tra tutti (più punti vince, pari punti = pareggio); variazione = K/(N−1)·Σ(risultato − atteso), K 24 (48 nei primi 3 tornei). Salvato in `global/elo` e in ogni torneo (prima/dopo/variazione); la pagina Manutenzione lo ricalcola se si cancella un torneo.
- Ogni giocatore sceglie il **nome del team** quando entra (si cambia in sala d'attesa).
- **Foto delle carte**: dal tablet, Carte → «Aggiungi foto». Le immagini vengono rimpicciolite e salvate nel vostro Firebase (`global/images`).
- **Livelli che cambiano**: a fine gara la carta del 1° sale di un livello (max S), quella dell'ultimo scende di uno (min D); ultimo a pari merito: sorteggio. I cambi di livello sono permanenti: valgono anche per le partite successive (si possono ripristinare dalle Impostazioni).
- **Fine**: la carta rimasta in mano dà S/A +2, B/C +1, D 0. Parità finale: meno rutti e scoregge, poi più vittorie, poi più bronzi.
- Il tasto **Rutti e scoregge** sul telefono fa partire un suono anche sul tablet, quando vuoi. Ogni pressione viene contata e pesa negli spareggi.

## Come si usa
1. Sul tablet: **Crea una partita** → codice di 4 lettere e QR.
2. Ognuno apre il sito sul telefono, inserisce codice e nome.
3. Sul tablet: ordina i giocatori come siete seduti e **Inizia il torneo**.

## Configurazione
- `config.js`: configurazione web del progetto Firebase (Realtime Database).
- `database.rules.json`: regole da incollare in Firebase → Realtime Database → Regole. Si fa comodamente da telefono con `admin.html` (link «Manutenzione» in fondo alla home): controllo dello stato, copia delle regole, pulizia di partite, storico, giocatori, foto e livelli.
- Senza configurazione l'app funziona in modalità prova (solo schede dello stesso browser).

## Suoni
Le 10 scoregge e i rutti sono clip audio vere (i rutti: una registrazione e 9 variazioni): crediti e licenze in `sounds/CREDITS.md`.
