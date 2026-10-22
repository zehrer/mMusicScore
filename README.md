# mMusicScore

**mMusicScore** ist ein einfaches Notensatzprogramm für einstimmige Melodien, das vollständig im Browser läuft.

Es gibt keinen Server: Die Lieder werden automatisch im Browser (IndexedDB) gespeichert und verlassen das Gerät nur, wenn du sie exportierst.

Live: https://zehrer.github.io/mMusicScore/

## Konzept

- **Liederdatenbank** (links): alle Lieder in diesem Browser, mit Suche. ⋯ an einem Lied: duplizieren, exportieren, löschen.
- **Notenblatt**: A4-Seiten wie auf Papier, mit Titel, Komponist, Tempo, Schlüssel, Tonart und Taktart. Taktstriche, Zeilen- und Seitenumbrüche entstehen automatisch.
- **Direkt bearbeiten**: in das Notensystem klicken setzt eine Note an dieser Stelle (eine graue Vorschau zeigt Tonhöhe und Wert); eine Note anklicken wählt sie aus, nach oben/unten ziehen ändert die Tonhöhe.
- **Vorzeichen** gelten wie gewohnt bis zum Taktende; Tonart-Vorzeichen werden automatisch berücksichtigt.
- **Wiedergabe** ab der Auswahl mit einfachem Synthesizer; die klingende Note wird rot markiert.
- **Import / Export**: ganze Bibliothek oder einzelne Lieder als JSON, einzelne Lieder als **MusicXML** (MuseScore, Finale, Sibelius, Dorico …). Import von JSON und unkomprimiertem MusicXML (erste Stimme des ersten Instruments).
- **Drucken / PDF** über Datei → Drucken; gedruckt werden nur die Notenblätter.

## Bedienung

| | |
|---|---|
| Note einfügen | Klick ins Notensystem, oder Buchstaben **C D E F G A H** (nach der Auswahl, nächstgelegene Oktave) |
| Pause einfügen | **R** oder **0**, oder in der Werkzeugleiste auf Pause umschalten |
| Notenwert | **3 4 5 6 7** = Sechzehntel, Achtel, Viertel, Halbe, Ganze; **.** = Punktierung |
| Tonhöhe | **↑ ↓** eine Stufe, **⌘↑ ⌘↓** eine Oktave, oder Note ziehen |
| Vorzeichen | **#** / **+** Kreuz, **b** / **-** Be, **=** Auflösungszeichen (nochmal drücken entfernt es) |
| Auswahl | **← →**, **Esc** hebt sie auf; **⌫** löscht die Note |
| Wiedergabe | **Leertaste** |
| Rückgängig | **⌘Z** / **⇧⌘Z** |

## Entwicklung

Stack: Vite, React, TypeScript, Zustand, Vitest; Notenschrift [Bravura](https://github.com/steinbergmedia/bravura) (SIL Open Font License). Benötigt ein aktuelles Node.js LTS.

```bash
npm install
npm run dev
```

```bash
npm test
```

Ein Push auf `main` baut die App mit GitHub Actions und veröffentlicht `dist/` im Branch `gh-pages`. Einmalig in den Repository-Einstellungen unter **Pages** die Quelle „Deploy from a branch“ → `gh-pages` / `(root)` wählen.
