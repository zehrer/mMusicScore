# mMusicScore

**mMusicScore** is a simple music notation editor for single-line melodies that runs entirely in the browser.

There is no server: songs are saved automatically in the browser (IndexedDB) and never leave your device unless you export them.

Live: https://zehrer.github.io/mMusicScore/

## Concept

- **Song library** (left): every song in this browser, with search. ⋯ on a song: duplicate, export, delete. **☰** hides or shows it (on phones it slides in over the music).
- **Score**: A4 pages like paper, with title, composer, tempo, clef, key and time signature. Bar lines, system and page breaks are laid out automatically.
- **Edit in place**: click on the staff to insert a note at that position (a grey preview shows pitch and value); click a note to select it, drag it up or down to change its pitch.
- **Piano** below the score: click a key to insert that note after the selection, in the current note value (View → Piano hides it).
- **Note names** above the staff (Names button or View → Note names), in English (C♯, B♭, B) or German naming (Cis, B, H); also in the HTML export when shown.
- **Lyrics**: one syllable per note under the staff (Lyrics button or **L**). Exported to and imported from MusicXML.
- **Sections and form**: write a chorus once and play it as often as the song needs. Select the first note of a part and choose **Split at selection** (form bar above the score), or add an empty section. The form – e.g. Verse · Chorus · Verse · Chorus – is a row of chips: drag to reorder, click for options, **+** to repeat a section. **Compact** shows each section once with the form above the music; **Expanded** writes the whole song out, and edits there change the section everywhere. Playback, the HTML export and MusicXML follow the form.
- **Verses**: several lyric lines under the same notes (while typing lyrics, **↓ / ↑** switch the line). The n-th time a section comes up it is sung with verse n; a chorus with one text repeats it.
- **Accidentals** carry through the rest of the measure as usual; the key signature is applied automatically.
- **Second voice** (＋ Voice in the toolbar, or Edit → Add second voice): a staff of its own below the first, joined by a bracket, with its own clef and sound. Notes that sound together stand above each other. **1 | 2** in the toolbar chooses the voice you edit (clicking a note or staff of a voice does too); the other one is dimmed. Sections apply to both voices, playback plays both, MusicXML writes (and reads) two parts.
- **Sound** per voice: **Piano** (stretched overtones, hammer, damper) or **Flute** (breath, soft attack, vibrato); the same in the HTML export.
- **Cursor**: the selected note is blue with a highlight, a blinking bar shows where the next note goes (after the selection, or at the end). During **playback** from the selection the sounding note turns red and the score scrolls along line by line. Playback keeps going when you open another song; a small "now playing" window in the corner then follows the playing song (Open jumps back, ■ stops).
- **Import / export**: the whole library or single songs as JSON, single songs as **MusicXML** (MuseScore, Finale, Sibelius, Dorico …). Imports JSON and uncompressed MusicXML (first voice of the first part).
- **HTML export** (File → Export song as HTML): a single file that shows the score in any browser and plays it (▶ Play, or click a note to start there). Its **Open in mMusicScore** button adds the song to the app again; File → Import also reads the file.
- **Print / PDF** via File → Print; only the score pages are printed.

- **View mode**: a slim bar with a big **▶ Play** (plus song choice and ＋ New while the song list is hidden, and ⛶ full screen where the browser allows it); tap a note to play from there. Phones start in it, ✎ Edit switches to all tools (and View back). On iPhone, playback also works with the ring/silent switch on (iOS 17 and later; older versions use a silent audio element for the same effect).

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
| Delete by touch | Quick **swipe left** across the music deletes the last input (like ⌫), with Undo in the notice |
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
