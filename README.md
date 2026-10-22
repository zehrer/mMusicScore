# mMusicScore

**mMusicScore** is a simple music notation editor for single-line melodies that runs entirely in the browser.

There is no server: songs are saved automatically in the browser (IndexedDB) and never leave your device unless you export them.

Live: https://zehrer.github.io/mMusicScore/

## Concept

- **Song library** (left): every song in this browser, with search. ⋯ on a song: duplicate, export, delete.
- **Score**: A4 pages like paper, with title, composer, tempo, clef, key and time signature. Bar lines, system and page breaks are laid out automatically.
- **Edit in place**: click on the staff to insert a note at that position (a grey preview shows pitch and value); click a note to select it, drag it up or down to change its pitch.
- **Piano** below the score: click a key to insert that note after the selection, in the current note value (View → Piano hides it).
- **Note names** above the staff (Names button or View → Note names), in English (C♯, B♭, B) or German naming (Cis, B, H); also in the HTML export when shown.
- **Lyrics**: one syllable per note under the staff (Lyrics button or **L**). Exported to and imported from MusicXML.
- **Accidentals** carry through the rest of the measure as usual; the key signature is applied automatically.
- **Cursor**: the selected note is blue with a highlight, a blinking bar shows where the next note goes (after the selection, or at the end). During **playback** from the selection the sounding note turns red and the score scrolls along. Playback keeps going when you open another song; a small "now playing" window in the corner then follows the playing song (Open jumps back, ■ stops).
- **Import / export**: the whole library or single songs as JSON, single songs as **MusicXML** (MuseScore, Finale, Sibelius, Dorico …). Imports JSON and uncompressed MusicXML (first voice of the first part).
- **HTML export** (File → Export song as HTML): a single file that shows the score in any browser and plays it (▶ Play, or click a note to start there). Its **Open in mMusicScore** button adds the song to the app again; File → Import also reads the file.
- **Print / PDF** via File → Print; only the score pages are printed.

## Usage

| | |
|---|---|
| Insert a note | Click on the staff, or type **A–G** (after the selection, in the nearest octave; H works as B) |
| Insert from the piano | Click a key below the score |
| Lyrics | **L** or the Lyrics button, then type; **Space** / **Tab** next note, **-** joins syllables (Twin-kle), **Enter** / **Esc** stops; click a syllable to edit it |
| Insert a rest | **R** or **0**, or switch the toolbar to rests |
| Note value | **3 4 5 6 7** = sixteenth, eighth, quarter, half, whole; **.** = dot |
| Pitch | **↑ ↓** one step, **⌘↑ ⌘↓** an octave, or drag the note |
| Accidentals | **#** / **+** sharp, **-** flat, **=** natural (press again to remove it) |
| Selection | **← →**, **Esc** clears it; **⌫** deletes the selected notes |
| Several notes | **Shift+click** or **⇧← ⇧→**, **⌘A** all; then ↑ ↓, note values, dot and accidentals change all of them |
| Copy / paste | **⌘C** / **⌘X** / **⌘V** – pasted after the selection, also into another song |
| Zoom | Toolbar: − / + and Fit width, Fit page or a fixed size |
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
