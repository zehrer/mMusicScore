# mMusicScore

**mMusicScore** is a simple music notation editor for single-line melodies that runs entirely in the browser.

There is no server: songs are saved automatically in the browser (IndexedDB) and never leave your device unless you export them.

Live: https://zehrer.github.io/mMusicScore/

## Concept

- **Song library** (left): every song in this browser, with search. ⋯ on a song: duplicate, export, delete.
- **Score**: A4 pages like paper, with title, composer, tempo, clef, key and time signature. Bar lines, system and page breaks are laid out automatically.
- **Edit in place**: click on the staff to insert a note at that position (a grey preview shows pitch and value); click a note to select it, drag it up or down to change its pitch.
- **Accidentals** carry through the rest of the measure as usual; the key signature is applied automatically.
- **Playback** from the selection with a simple synthesizer; the sounding note turns red.
- **Import / export**: the whole library or single songs as JSON, single songs as **MusicXML** (MuseScore, Finale, Sibelius, Dorico …). Imports JSON and uncompressed MusicXML (first voice of the first part).
- **Print / PDF** via File → Print; only the score pages are printed.

## Usage

| | |
|---|---|
| Insert a note | Click on the staff, or type **A–G** (after the selection, in the nearest octave; H works as B) |
| Insert a rest | **R** or **0**, or switch the toolbar to rests |
| Note value | **3 4 5 6 7** = sixteenth, eighth, quarter, half, whole; **.** = dot |
| Pitch | **↑ ↓** one step, **⌘↑ ⌘↓** an octave, or drag the note |
| Accidentals | **#** / **+** sharp, **-** flat, **=** natural (press again to remove it) |
| Selection | **← →**, **Esc** clears it; **⌫** deletes the note |
| Playback | **Space** |
| Undo / redo | **⌘Z** / **⇧⌘Z** |

## Development

Stack: Vite, React, TypeScript, Zustand, Vitest; music font [Bravura](https://github.com/steinbergmedia/bravura) (SIL Open Font License). Requires a current Node.js LTS.

```bash
npm install
npm run dev
```

```bash
npm test
```

A push to `main` builds the app with GitHub Actions and publishes `dist/` to the `gh-pages` branch.
