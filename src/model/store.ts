import { create } from "zustand";
import { clampPitch, emptySong, midi, nearestPitch, newId, resolveAccidentals, type NameStyle } from "./music";
import { audition } from "./playback";
import { addSection, deleteSection, renameSection, sectionsOf, setForm, splitSection, verseOf, withVerse } from "./sections";
import type { Alter, Duration, NoteEvent, Song, SongInfo } from "./types";

const UNDO_LIMIT = 200;

export type Zoom = number | "width" | "page";
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

function loadZoom(): Zoom {
  try {
    const v = localStorage.getItem("zoom");
    if (v === "width" || v === "page") return v;
    const n = Number(v);
    return v && n >= 0.25 && n <= 4 ? n : "width";
  } catch {
    return "width";
  }
}

export function setZoom(zoom: Zoom) {
  set({ zoom });
  remember("zoom", String(zoom));
}

/** Next zoom step up (1) or down (-1) from what is shown now, also when a fit mode is on. */
export function stepZoom(dir: 1 | -1) {
  const cur = get().viewZoom;
  const next = dir > 0 ? ZOOM_STEPS.find((z) => z > cur + 0.01) : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.01);
  if (next) setZoom(next);
}

export interface InputState {
  dur: Duration;
  dots: 0 | 1;
  rest: boolean;
}

interface State {
  song: Song;
  /** Songs saved in this browser, most recently changed first. */
  songs: SongInfo[];
  undo: Song[];
  redo: Song[];
  sel: number | null;
  /** Other end of a range selection (Shift); the range runs from `anchor` to `sel`. */
  anchor: number | null;
  input: InputState;
  /** Note sounding during playback, an index into `playingSong`. */
  playing: number | null;
  isPlaying: boolean;
  /** The song as it was when playback started; other songs can be opened meanwhile. */
  playingSong: Song | null;
  /** For each note of `playingSong` (the form written out), its index in the song. */
  playingSrc: number[] | null;
  /** View: read and play only, with a slim bar (the default on phones). Edit: all tools. */
  mode: "view" | "edit";
  /** Compact: each section once, as written. Expanded: the form written out. */
  view: "compact" | "expanded";
  /** Chosen zoom: a factor, or fit the page width / the whole page into the window. */
  zoom: Zoom;
  /** Zoom actually shown, which the score works out for the fit modes. */
  viewZoom: number;
  dialog: "about" | "keys" | null;
  showPiano: boolean;
  /** Note names above the staff, in English or German naming. */
  showNames: boolean;
  nameStyle: NameStyle;
  /** Note whose lyric syllable is being typed. */
  lyricEdit: number | null;
  /** Lyric line being typed: 0 = first verse. */
  lyricVerse: number;
  /** Bumped by every change of the song, which schedules an autosave. */
  revision: number;
  savedAt: Date | null;
  saveError: string | null;
}

export const useStore = create<State>(() => ({
  song: emptySong(),
  songs: [],
  undo: [],
  redo: [],
  sel: null,
  anchor: null,
  input: { dur: 4, dots: 0, rest: false },
  playing: null,
  isPlaying: false,
  playingSong: null,
  playingSrc: null,
  mode: isPhone() ? "view" : "edit",
  view: loadFlag("expanded", false) ? "expanded" : "compact",
  zoom: loadZoom(),
  viewZoom: 1,
  dialog: null,
  showPiano: loadFlag("showPiano", true),
  showNames: loadFlag("showNames", false),
  nameStyle: loadNameStyle(),
  lyricEdit: null,
  lyricVerse: 0,
  revision: 0,
  savedAt: null,
  saveError: null,
}));

function loadFlag(key: string, def: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "1";
  } catch {
    return def;
  }
}

/** Narrow screens start in view mode, where the score and the play button get the room. */
function isPhone() {
  try {
    return matchMedia("(max-width: 700px)").matches;
  } catch {
    return false;
  }
}

export function setMode(mode: "view" | "edit") {
  set({ mode, lyricEdit: null, ...(mode === "view" && { anchor: null }) });
}

/** Remembers a view setting in this browser; storage can be unavailable, then it is only kept for now. */
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* only a convenience */
  }
}

function loadNameStyle(): NameStyle {
  try {
    return localStorage.getItem("nameStyle") === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

export function setShowPiano(on: boolean) {
  set({ showPiano: on });
  remember("showPiano", on ? "1" : "0");
}

export function setShowNames(on: boolean) {
  set({ showNames: on });
  remember("showNames", on ? "1" : "0");
}

export function setNameStyle(style: NameStyle) {
  set({ nameStyle: style });
  remember("nameStyle", style);
}

/** First and last selected note, or null. */
export function selRange(s: Pick<State, "sel" | "anchor">): [number, number] | null {
  if (s.sel === null) return null;
  const a = s.anchor ?? s.sel;
  return [Math.min(a, s.sel), Math.max(a, s.sel)];
}

/** The sounding note if playback is of the open song, else null. */
export const playingHere = (s: State) => (s.playingSong?.id === s.song.id ? s.playing : null);

const get = useStore.getState;
const set = useStore.setState;

/** Shows `song` with a fresh undo history; `dirty` saves it right away. */
export function openSong(song: Song, dirty = false) {
  set((s) => ({ song, undo: [], redo: [], sel: null, anchor: null, lyricEdit: null, revision: dirty ? s.revision + 1 : s.revision }));
}

/**
 * Applies a change to the song. With `record` the state before it becomes an undo step; a drag
 * records once at its start and then updates without recording.
 */
export function change(fn: (song: Song) => Song, opts: { record?: boolean; sel?: number | null; anchor?: number | null } = {}) {
  const { song, undo, revision } = get();
  const next = { ...fn(song), updatedAt: Date.now() };
  const record = opts.record ?? true;
  set({
    song: next,
    revision: revision + 1,
    ...(record && { undo: [...undo.slice(-UNDO_LIMIT + 1), song], redo: [] }),
    ...("sel" in opts && { sel: opts.sel, anchor: opts.anchor ?? null }),
  });
}

export function recordUndo() {
  const { song, undo } = get();
  set({ undo: [...undo.slice(-UNDO_LIMIT + 1), song], redo: [] });
}

export function undo() {
  const { undo, redo, song, revision, sel } = get();
  const prev = undo[undo.length - 1];
  if (!prev) return;
  set({ song: prev, undo: undo.slice(0, -1), redo: [...redo, song], revision: revision + 1, sel: clampSel(sel, prev), anchor: null });
}

export function redo() {
  const { undo, redo, song, revision, sel } = get();
  const next = redo[redo.length - 1];
  if (!next) return;
  set({ song: next, redo: redo.slice(0, -1), undo: [...undo, song], revision: revision + 1, sel: clampSel(sel, next), anchor: null });
}

const clampSel = (sel: number | null, song: Song) => (sel === null || !song.notes.length ? null : Math.min(sel, song.notes.length - 1));

const updateNotes = (fn: (notes: NoteEvent[]) => NoteEvent[]) => (s: Song) => ({ ...s, notes: fn(s.notes) });

/** Where entered notes go: after the selection, or at the end. */
const insertionPoint = () => {
  const r = selRange(get());
  return r ? r[1] + 1 : get().song.notes.length;
};

/** Changes every selected note (one undo step); `fn` returns the note unchanged to skip it. */
function updateSelected(fn: (n: NoteEvent) => NoteEvent) {
  const r = selRange(get());
  if (!r) return;
  const notes = get().song.notes;
  const next = notes.map((n, j) => (j >= r[0] && j <= r[1] ? fn(n) : n));
  if (next.every((n, j) => n === notes[j])) return;
  change((s) => ({ ...s, notes: next }));
}

/** Copy of `n` with `patch`; undefined values remove the field. */
function patched(n: NoteEvent, patch: Partial<NoteEvent>): NoteEvent {
  const next = { ...n, ...patch };
  for (const k of Object.keys(patch) as (keyof NoteEvent)[]) if (patch[k] === undefined) delete next[k];
  return next;
}

/** Plays the note at `i` the way it sounds in context. */
export function auditionAt(i: number) {
  const { song } = get();
  const n = song.notes[i];
  if (!n || n.rest || get().isPlaying) return;
  audition(midi(n.pitch, resolveAccidentals(song)[i].actual));
}

/**
 * Section for notes entered at the insertion point: the selected note's, or the last section's at
 * the end. Clicks pass the section of the system they hit.
 */
function sectionForInsert(): string | undefined {
  const { song } = get();
  if (!song.sections?.length) return undefined;
  const r = selRange(get());
  return (r && song.notes[r[1]]?.sec) || song.sections[song.sections.length - 1].id;
}

export function insertNote(index: number, pitch: number, rest = get().input.rest, sec = sectionForInsert()) {
  const { dur, dots } = get().input;
  const n: NoteEvent = { id: newId(), dur, pitch: clampPitch(pitch) };
  if (dots) n.dots = 1;
  if (rest) n.rest = true;
  if (sec) n.sec = sec;
  change(updateNotes((ns) => [...ns.slice(0, index), n, ...ns.slice(index)]), { sel: index });
  auditionAt(index);
}

/** Letter entry: the note goes after the selection, in the octave closest to the note before it. */
export function insertStep(step: number) {
  const { song } = get();
  const index = insertionPoint();
  const ref = song.notes[index - 1]?.pitch ?? (song.clef === "bass" ? 21 : 33);
  insertNote(index, nearestPitch(step, ref), false);
}

/** Piano entry: the exact pitch and alteration go after the selection. */
export function insertPitch(pitch: number, alter: Alter) {
  const { input } = get();
  const index = insertionPoint();
  const n: NoteEvent = { id: newId(), dur: input.dur, pitch: clampPitch(pitch), alter };
  if (input.dots) n.dots = 1;
  const sec = sectionForInsert();
  if (sec) n.sec = sec;
  change(updateNotes((ns) => [...ns.slice(0, index), n, ...ns.slice(index)]), { sel: index });
  if (input.rest) set({ input: { ...input, rest: false } });
  auditionAt(index);
}

/** Sets the syllable of verse `v` on note `i`; a trailing "-" joins it to the next syllable. */
export function setLyric(i: number, lyric: string, v = 0) {
  const n = get().song.notes[i];
  if (!n || (verseOf(n, v) ?? "") === lyric) return;
  change(updateNotes((ns) => ns.map((m, j) => (j === i ? withVerse(m, v, lyric) : m))));
}

/** Starts typing lyrics at note `i` (the selection, or the first note), in verse `v`. */
export function editLyric(i: number | null, v = get().lyricVerse) {
  const { song } = get();
  if (i === null || !song.notes[i]) return set({ lyricEdit: null });
  // Lyrics are typed where each verse has its own line: in the compact view.
  set({ lyricEdit: i, lyricVerse: Math.max(0, Math.min(9, v)), sel: i, anchor: null, view: "compact" });
}

export function setView(view: "compact" | "expanded") {
  set({ view, lyricEdit: null });
  remember("expanded", view === "expanded" ? "1" : "0");
}

// --- Sections and form ----------------------------------------------------------------------

/** Starts a new section at the selected note (its first note if a range is selected). */
export function splitAtSelection(name: string) {
  const r = selRange(get());
  if (!r) return;
  const before = get().song;
  const next = splitSection(before, r[0], name);
  if (next !== before) change(() => next);
}

/** Adds an empty section at the end of the song and of the form. */
export function newSection(name: string) {
  change((s) => addSection(s, name).song, { sel: null });
}

export function renameSectionTo(id: string, name: string) {
  change((s) => renameSection(s, id, name));
}

export function removeSection(id: string) {
  change((s) => deleteSection(s, id), { sel: null });
}

export function changeForm(form: string[]) {
  change((s) => setForm(s, form));
}

export const hasSections = (song: Song) => sectionsOf(song).length > 1 || !!sectionsOf(song)[0].name;

export function insertRest() {
  const { song } = get();
  const index = insertionPoint();
  insertNote(index, song.notes[index - 1]?.pitch ?? 34, true);
}

export function updateNote(i: number, patch: Partial<NoteEvent>, record = true) {
  change(
    updateNotes((ns) =>
      ns.map((n, j) => (j === i ? patched(n, patch) : n)),
    ),
    { record },
  );
}

export function deleteNote(i: number) {
  change(updateNotes((ns) => ns.filter((_, j) => j !== i)), {
    sel: get().song.notes.length <= 1 ? null : Math.max(0, i - 1),
  });
}

/** Deletes the selected notes; the note before them becomes the selection. */
export function deleteSelection() {
  const r = selRange(get());
  if (!r) return;
  const left = get().song.notes.length - (r[1] - r[0] + 1);
  change(updateNotes((ns) => ns.filter((_, j) => j < r[0] || j > r[1])), { sel: left ? Math.max(0, r[0] - 1) : null });
}

/** Transposes the selected notes by diatonic steps; written accidentals go away. */
export function moveSelected(steps: number) {
  updateSelected((n) => {
    const pitch = clampPitch(n.pitch + steps);
    return n.rest || pitch === n.pitch ? n : patched(n, { pitch, alter: undefined });
  });
  const { sel } = get();
  if (sel !== null) auditionAt(sel);
}

/** Sets an accidental on the selected notes, or removes it when the current note already has it. */
export function toggleAlter(alter: Alter) {
  const { sel, song } = get();
  const n = sel !== null ? song.notes[sel] : undefined;
  if (!n || n.rest) return;
  const value = n.alter === alter ? undefined : alter;
  updateSelected((m) => (m.rest ? m : patched(m, { alter: value })));
  auditionAt(sel!);
}

/** Sets the value for new notes and for the selected ones. */
export function setDuration(dur: Duration) {
  set({ input: { ...get().input, dur } });
  updateSelected((n) => (n.dur === dur ? n : { ...n, dur }));
}

export function toggleDot() {
  const { sel, song, input } = get();
  const n = sel !== null ? song.notes[sel] : undefined;
  const dots = (n ? (n.dots ? 0 : 1) : input.dots ? 0 : 1) as 0 | 1;
  set({ input: { ...input, dots } });
  updateSelected((m) => patched(m, { dots: dots || undefined }));
}

/** Switches rest entry; selected notes become rests or back. */
export function toggleRest() {
  const { sel, song, input } = get();
  const n = sel !== null ? song.notes[sel] : undefined;
  if (n) {
    updateSelected((m) => patched(m, { rest: n.rest ? undefined : true }));
    set({ input: { ...input, rest: !n.rest } });
  } else set({ input: { ...input, rest: !input.rest } });
}

/** Selects note `i`; with `extend` (Shift) the selection grows from its anchor to `i`. */
export function select(i: number | null, extend = false) {
  const { song, input, sel, anchor } = get();
  const n = i !== null ? song.notes[i] : undefined;
  if (extend && n && sel !== null) return set({ sel: i, anchor: anchor ?? sel });
  // The toolbar reflects the selected note, so the next note continues with its value.
  set({ sel: n ? i : null, anchor: null, ...(n && { input: { ...input, dur: n.dur, dots: n.dots ?? 0, rest: !!n.rest } }) });
}

export function selectAll() {
  const len = get().song.notes.length;
  if (len) set({ anchor: 0, sel: len - 1 });
}

export function selectedNotes(): NoteEvent[] {
  const r = selRange(get());
  return r ? get().song.notes.slice(r[0], r[1] + 1) : [];
}

/** Inserts copies of `notes` after the selection (or at the end) and selects them. */
export function pasteNotes(notes: NoteEvent[]) {
  if (!notes.length) return;
  const at = insertionPoint();
  const sec = sectionForInsert();
  const copies = notes.map((n) => {
    const copy = { ...n, id: newId() };
    if (sec) copy.sec = sec;
    else delete copy.sec;
    return copy;
  });
  change(updateNotes((ns) => [...ns.slice(0, at), ...copies, ...ns.slice(at)]), { sel: at + copies.length - 1, anchor: copies.length > 1 ? at : null });
}

export function setMeta(patch: Partial<Pick<Song, "title" | "composer" | "tempo" | "beats" | "beatType" | "fifths" | "clef">>) {
  change((s) => ({ ...s, ...patch }));
}

export const infoOf = (s: Song): SongInfo => ({ id: s.id, title: s.title, composer: s.composer, updatedAt: s.updatedAt });
