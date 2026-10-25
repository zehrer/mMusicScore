import { newId, ticks } from "./music";
import type { NoteEvent, Section, Song } from "./types";

/** The section a song without sections consists of. */
export const MAIN = "main";

export const sectionsOf = (song: Pick<Song, "sections">): Section[] => (song.sections?.length ? song.sections : [{ id: MAIN, name: "" }]);

/** Section of every note, by index. */
export function sectionIds(song: Pick<Song, "notes" | "sections">): string[] {
  const first = sectionsOf(song)[0].id;
  return song.notes.map((n) => n.sec ?? first);
}

/** The order sections are played in; unknown ids are dropped. */
export function formOf(song: Pick<Song, "sections" | "form">): string[] {
  const ids = sectionsOf(song).map((s) => s.id);
  return song.form ? song.form.filter((id) => ids.includes(id)) : ids;
}

/** Notes [start, end) of a section; an empty section sits where it would start. */
export function sectionRange(song: Pick<Song, "notes" | "sections">, id: string): [number, number] {
  const secs = sectionIds(song);
  const order = sectionsOf(song).map((s) => s.id);
  const at = order.indexOf(id);
  let start = 0;
  while (start < secs.length && order.indexOf(secs[start]) < at) start++;
  let end = start;
  while (end < secs.length && secs[end] === id) end++;
  return [start, end];
}

export const verseOf = (n: NoteEvent, v: number) => (v === 0 ? n.lyric : n.verses?.[v - 1]);

/** Number of lyric lines under the notes. */
export const verseCount = (notes: NoteEvent[]) => notes.reduce((m, n) => Math.max(m, n.lyric ? 1 : 0, n.verses?.length ? n.verses.length + 1 : 0), 0);

/** Sets syllable `text` of verse `v` (0 = first) on a note. */
export function withVerse(n: NoteEvent, v: number, text: string): NoteEvent {
  const next: NoteEvent = { ...n };
  if (v === 0) {
    if (text) next.lyric = text;
    else delete next.lyric;
    return next;
  }
  const verses = [...(n.verses ?? [])];
  while (verses.length < v) verses.push("");
  verses[v - 1] = text;
  while (verses.length && !verses[verses.length - 1]) verses.pop();
  if (verses.length) next.verses = verses;
  else delete next.verses;
  return next;
}

export interface Expanded {
  /** The song played through its form: one section per occurrence, one lyric line each. */
  song: Song;
  /** Index of each note of `song` in the original song. */
  src: number[];
  /** The same for the second voice. */
  src2: number[];
}

/** One voice's notes written out along the form. */
function expandNotes(song: Song, form: string[]): { notes: NoteEvent[]; src: number[] } {
  const seen = new Map<string, number>();
  const notes: NoteEvent[] = [];
  const src: number[] = [];
  for (const id of form) {
    const k = seen.get(id) ?? 0;
    seen.set(id, k + 1);
    const occ = `${id}~${k}`;
    const [start, end] = sectionRange(song, id);
    const part = song.notes.slice(start, end);
    const v = k > 0 && part.some((n) => verseOf(n, k)) ? k : 0;
    part.forEach((n, j) => {
      const { verses: _, ...rest } = n;
      const copy: NoteEvent = { ...rest, id: `${n.id}~${k}`, sec: occ };
      const text = verseOf(n, v);
      if (text) copy.lyric = text;
      else delete copy.lyric;
      notes.push(copy);
      src.push(start + j);
    });
  }
  return { notes, src };
}

/**
 * Writes the form out, for both voices. The n-th time a section comes up it is sung with verse n;
 * a section that has fewer verses (a chorus with one text) repeats its first.
 */
export function expand(song: Song): Expanded {
  const secs = sectionsOf(song);
  const form = formOf(song);
  const seen = new Map<string, number>();
  const sections: Section[] = form.map((id) => {
    const k = seen.get(id) ?? 0;
    seen.set(id, k + 1);
    return { id: `${id}~${k}`, name: secs.find((s) => s.id === id)!.name };
  });
  const one = expandNotes(song, form);
  const two = song.second ? expandNotes({ ...song, notes: song.second.notes }, form) : { notes: [], src: [] };
  const { form: _, ...rest } = song;
  const out: Song = { ...rest, notes: one.notes, sections };
  if (song.second) out.second = { ...song.second, notes: two.notes };
  return { song: out, src: one.src, src2: two.src };
}

const withSec = (notes: NoteEvent[], ids: string[]) => notes.map((n, i) => (n.sec === ids[i] ? n : { ...n, sec: ids[i] }));

/** Gives every note (of both voices) an explicit section, so sections can be renamed, reordered or deleted. */
export function materialize(song: Song): Song {
  const sections = sectionsOf(song);
  const out: Song = { ...song, sections, form: formOf(song), notes: withSec(song.notes, sectionIds(song)) };
  if (song.second) out.second = { ...song.second, notes: withSec(song.second.notes, sectionIds({ ...song, notes: song.second.notes })) };
  return out;
}

/** Ticks from the start of note `index`'s section to the note. */
function offsetInSection(song: Pick<Song, "notes" | "sections">, index: number): number {
  const id = sectionIds(song)[index];
  const [start] = sectionRange(song, id);
  let t = 0;
  for (let i = start; i < index; i++) t += ticks(song.notes[i]);
  return t;
}

/**
 * Starts a new section at note `index` of voice `voice`: from that point in time, the rest of its
 * section moves into the new one, in both voices. Wherever the old section is in the form, the new
 * one follows, so the song sounds the same.
 */
export function splitSection(song: Song, index: number, name: string, voice: 0 | 1 = 0): Song {
  const s = materialize(song);
  const notes = voice === 1 && s.second ? s.second.notes : s.notes;
  const id = notes[index]?.sec;
  if (!id) return song;
  const at = offsetInSection({ ...s, notes }, index);
  if (at === 0) return song;
  const sec: Section = { id: newId(), name };
  // Notes of the section that start at or after the split move to the new section.
  const move = (list: NoteEvent[]) => {
    let t = 0;
    return list.map((n) => {
      if (n.sec !== id) return n;
      const start = t;
      t += ticks(n);
      return start >= at ? { ...n, sec: sec.id } : n;
    });
  };
  const pos = s.sections!.findIndex((x) => x.id === id);
  const out: Song = {
    ...s,
    sections: [...s.sections!.slice(0, pos + 1), sec, ...s.sections!.slice(pos + 1)],
    form: s.form!.flatMap((f) => (f === id ? [f, sec.id] : [f])),
    notes: move(s.notes),
  };
  if (s.second) out.second = { ...s.second, notes: move(s.second.notes) };
  return out;
}

/** Adds an empty section at the end and to the end of the form. */
export function addSection(song: Song, name: string): { song: Song; id: string } {
  const s = materialize(song);
  const sec: Section = { id: newId(), name };
  return { song: { ...s, sections: [...s.sections!, sec], form: [...s.form!, sec.id] }, id: sec.id };
}

export function renameSection(song: Song, id: string, name: string): Song {
  const s = materialize(song);
  return { ...s, sections: s.sections!.map((x) => (x.id === id ? { ...x, name } : x)) };
}

/** Removes a section with its notes; the last section cannot be removed. */
export function deleteSection(song: Song, id: string): Song {
  const s = materialize(song);
  if (s.sections!.length < 2) return song;
  const out: Song = { ...s, sections: s.sections!.filter((x) => x.id !== id), form: s.form!.filter((f) => f !== id), notes: s.notes.filter((n) => n.sec !== id) };
  if (s.second) out.second = { ...s.second, notes: s.second.notes.filter((n) => n.sec !== id) };
  return out;
}

export function setForm(song: Song, form: string[]): Song {
  return { ...materialize(song), form };
}
