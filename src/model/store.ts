import { create } from "zustand";
import { clampPitch, emptySong, midi, nearestPitch, newId, resolveAccidentals } from "./music";
import { audition } from "./playback";
import type { Alter, Duration, NoteEvent, Song, SongInfo } from "./types";

const UNDO_LIMIT = 200;

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
  input: InputState;
  /** Note sounding during playback. */
  playing: number | null;
  isPlaying: boolean;
  zoom: number;
  dialog: "about" | "keys" | null;
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
  input: { dur: 4, dots: 0, rest: false },
  playing: null,
  isPlaying: false,
  zoom: 1,
  dialog: null,
  revision: 0,
  savedAt: null,
  saveError: null,
}));

const get = useStore.getState;
const set = useStore.setState;

/** Shows `song` with a fresh undo history; `dirty` saves it right away. */
export function openSong(song: Song, dirty = false) {
  set((s) => ({ song, undo: [], redo: [], sel: null, playing: null, revision: dirty ? s.revision + 1 : s.revision }));
}

/**
 * Applies a change to the song. With `record` the state before it becomes an undo step; a drag
 * records once at its start and then updates without recording.
 */
export function change(fn: (song: Song) => Song, opts: { record?: boolean; sel?: number | null } = {}) {
  const { song, undo, revision } = get();
  const next = { ...fn(song), updatedAt: Date.now() };
  const record = opts.record ?? true;
  set({
    song: next,
    revision: revision + 1,
    ...(record && { undo: [...undo.slice(-UNDO_LIMIT + 1), song], redo: [] }),
    ...("sel" in opts && { sel: opts.sel }),
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
  set({ song: prev, undo: undo.slice(0, -1), redo: [...redo, song], revision: revision + 1, sel: clampSel(sel, prev) });
}

export function redo() {
  const { undo, redo, song, revision, sel } = get();
  const next = redo[redo.length - 1];
  if (!next) return;
  set({ song: next, redo: redo.slice(0, -1), undo: [...undo, song], revision: revision + 1, sel: clampSel(sel, next) });
}

const clampSel = (sel: number | null, song: Song) => (sel === null || !song.notes.length ? null : Math.min(sel, song.notes.length - 1));

const updateNotes = (fn: (notes: NoteEvent[]) => NoteEvent[]) => (s: Song) => ({ ...s, notes: fn(s.notes) });

/** Plays the note at `i` the way it sounds in context. */
export function auditionAt(i: number) {
  const { song } = get();
  const n = song.notes[i];
  if (!n || n.rest || get().isPlaying) return;
  audition(midi(n.pitch, resolveAccidentals(song)[i].actual));
}

export function insertNote(index: number, pitch: number, rest = get().input.rest) {
  const { dur, dots } = get().input;
  const n: NoteEvent = { id: newId(), dur, pitch: clampPitch(pitch) };
  if (dots) n.dots = 1;
  if (rest) n.rest = true;
  change(updateNotes((ns) => [...ns.slice(0, index), n, ...ns.slice(index)]), { sel: index });
  auditionAt(index);
}

/** Letter entry: the note goes after the selection, in the octave closest to the note before it. */
export function insertStep(step: number) {
  const { song, sel } = get();
  const index = sel === null ? song.notes.length : sel + 1;
  const ref = song.notes[index - 1]?.pitch ?? (song.clef === "bass" ? 21 : 33);
  insertNote(index, nearestPitch(step, ref), false);
}

export function insertRest() {
  const { song, sel } = get();
  const index = sel === null ? song.notes.length : sel + 1;
  insertNote(index, song.notes[index - 1]?.pitch ?? 34, true);
}

export function updateNote(i: number, patch: Partial<NoteEvent>, record = true) {
  change(
    updateNotes((ns) =>
      ns.map((n, j) => {
        if (j !== i) return n;
        const next = { ...n, ...patch };
        for (const k of Object.keys(patch) as (keyof NoteEvent)[]) if (patch[k] === undefined) delete next[k];
        return next;
      }),
    ),
    { record },
  );
}

export function deleteNote(i: number) {
  change(updateNotes((ns) => ns.filter((_, j) => j !== i)), {
    sel: get().song.notes.length <= 1 ? null : Math.max(0, i - 1),
  });
}

/** Moves the selected note by diatonic steps; its written accidental goes away. */
export function moveSelected(steps: number) {
  const { sel, song } = get();
  const n = sel !== null ? song.notes[sel] : undefined;
  if (!n || n.rest) return;
  const pitch = clampPitch(n.pitch + steps);
  if (pitch === n.pitch) return;
  updateNote(sel!, { pitch, alter: undefined });
  auditionAt(sel!);
}

/** Sets the accidental of the selected note, or removes it when it is already set. */
export function toggleAlter(alter: Alter) {
  const { sel, song } = get();
  const n = sel !== null ? song.notes[sel] : undefined;
  if (!n || n.rest) return;
  updateNote(sel!, { alter: n.alter === alter ? undefined : alter });
  auditionAt(sel!);
}

/** Sets the value for new notes and for the selected one. */
export function setDuration(dur: Duration) {
  const { sel, song, input } = get();
  set({ input: { ...input, dur } });
  if (sel !== null && song.notes[sel] && song.notes[sel].dur !== dur) updateNote(sel, { dur });
}

export function toggleDot() {
  const { sel, song, input } = get();
  const n = sel !== null ? song.notes[sel] : undefined;
  const dots = (n ? (n.dots ? 0 : 1) : input.dots ? 0 : 1) as 0 | 1;
  set({ input: { ...input, dots } });
  if (n) updateNote(sel!, { dots: dots || undefined });
}

/** Switches rest entry; a selected note becomes a rest or back. */
export function toggleRest() {
  const { sel, song, input } = get();
  const n = sel !== null ? song.notes[sel] : undefined;
  if (n) {
    updateNote(sel!, { rest: n.rest ? undefined : true });
    set({ input: { ...input, rest: !n.rest } });
  } else set({ input: { ...input, rest: !input.rest } });
}

export function select(i: number | null) {
  const { song, input } = get();
  const n = i !== null ? song.notes[i] : undefined;
  // The toolbar reflects the selected note, so the next note continues with its value.
  set({ sel: n ? i : null, ...(n && { input: { ...input, dur: n.dur, dots: n.dots ?? 0, rest: !!n.rest } }) });
}

export function setMeta(patch: Partial<Pick<Song, "title" | "composer" | "tempo" | "beats" | "beatType" | "fifths" | "clef">>) {
  change((s) => ({ ...s, ...patch }));
}

export const infoOf = (s: Song): SongInfo => ({ id: s.id, title: s.title, composer: s.composer, updatedAt: s.updatedAt });
