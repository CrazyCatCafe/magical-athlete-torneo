# Torneo Magical Athlete

App per gestire un torneo di Magical Athlete: ogni giocatore usa il proprio telefono, un tablet fa da banco e tabellone.

## Come si gioca
1. Sul tablet apri il sito e tocca **Crea una partita**: compare un codice di 4 lettere (e un QR).
2. Ognuno apre il sito sul telefono, inserisce il codice e il proprio nome.
3. Sul tablet metti i giocatori nell'ordine in cui siete seduti e tocca **Inizia il torneo**.
4. Per ogni gara: il tablet rivela 6 atleti (2 megaround da 18), si sceglie dal telefono in ordine di classifica (chi è dietro sceglie prima), si gioca, il tablet registra 1° (fiche oro coperta) e 2° (fiche argento coperta). Le fiche bronzo si aggiungono dal telefono con **+1**.

## Configurazione
- `config.js`: configurazione web del progetto Firebase (Realtime Database).
- `database.rules.json`: regole da incollare in Firebase → Realtime Database → Regole.
- Senza configurazione l'app funziona in modalità prova (solo schede dello stesso browser).
