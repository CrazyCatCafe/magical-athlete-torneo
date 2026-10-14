# Magical Outlet

App per il torneo «Magical Outlet» (varianti da torneo di Magical Athlete): ogni giocatore usa il proprio telefono, un tablet fa da banco e tabellone.

## Regole (Magical Outlet)
- 6 gare, in 2 megaround da 3.
- **Megaround 1**: draft a passaggio. Ognuno riceve 4 carte, ne tiene 1 e passa le altre al giocatore successivo (ordine dei posti); alla fine 4 carte a testa.
- **Gara 1**: l'app assegna a ognuno una carta a caso dalla sua mano.
- **Gare 2–6**: ognuno sceglie dalla propria mano, a partire da chi ha più punti. Pari: prima chi ha usato la carta di livello più alto nella gara precedente; ancora pari: a caso.
- **Megaround 2**: si rimischiano tutte le carte tranne quella rimasta a ognuno; 3 giri in cui si rivelano 6 carte e si sceglie una a testa, da chi ha meno punti.
- In gara parte chi ha meno punti (pari: si tira un dado). Il 1° prende una fiche oro coperta (3,4,4,5,5,6), il 2° una argento (1,1,2,2,2,3); le fiche bronzo (+1) si segnano dal telefono.
- **Fine**: la carta rimasta in mano dà S/A +2, B/C +1, D 0 (senza livello +1).
- Il tasto 💨 sul telefono fa partire una scoreggia anche sul tablet, quando vuoi.

## Come si usa
1. Sul tablet: **Crea una partita** → codice di 4 lettere e QR.
2. Ognuno apre il sito sul telefono, inserisce codice e nome.
3. Sul tablet: ordina i giocatori come siete seduti e **Inizia il torneo**.

## Configurazione
- `config.js`: configurazione web del progetto Firebase (Realtime Database).
- `database.rules.json`: regole da incollare in Firebase → Realtime Database → Regole.
- Senza configurazione l'app funziona in modalità prova (solo schede dello stesso browser).

## Suoni
Le 10 scoregge sono clip audio vere: crediti e licenze in `sounds/CREDITS.md`.
