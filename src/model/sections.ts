import { newId } from "./music";
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
}

/**
 * Writes the form out. The n-th time a section comes up it is sung with verse n; a section that
 * has fewer verses (a chorus with one text) repeats its first.
 */
export function expand(song: Song): Expanded {
  const secs = sectionsOf(song);
  const seen = new Map<string, number>();
  const notes: NoteEvent[] = [];
  const src: number[] = [];
  const sections: Section[] = [];
  for (const id of formOf(song)) {
    const k = seen.get(id) ?? 0;
    seen.set(id, k + 1);
    const occ = `${id}~${k}`;
    sections.push({ id: occ, name: secs.find((s) => s.id === id)!.name });
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
  const { form: _, ...rest } = song;
  return { song: { ...rest, notes, sections }, src };
}

/** Gives every note an explicit section, so sections can be renamed, reordered or deleted. */
export function materialize(song: Song): Song {
  const sections = sectionsOf(song);
  const ids = sectionIds(song);
  return { ...song, sections, form: formOf(song), notes: song.notes.map((n, i) => (n.sec === ids[i] ? n : { ...n, sec: ids[i] })) };
}

/**
 * Starts a new section at note `index`: it and the rest of its section move into it. Wherever the
 * old section is in the form, the new one follows, so the song sounds the same.
 */
export function splitSection(song: Song, index: number, name: string): Song {
  const s = materialize(song);
  const id = s.notes[index]?.sec;
  if (!id) return song;
  const [start, end] = sectionRange(s, id);
  if (index === start) return song;
  const sec: Section = { id: newId(), name };
  const at = s.sections!.findIndex((x) => x.id === id);
  return {
    ...s,
    sections: [...s.sections!.slice(0, at + 1), sec, ...s.sections!.slice(at + 1)],
    form: s.form!.flatMap((f) => (f === id ? [f, sec.id] : [f])),
    notes: s.notes.map((n, i) => (i >= index && i < end ? { ...n, sec: sec.id } : n)),
  };
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
  return { ...s, sections: s.sections!.filter((x) => x.id !== id), form: s.form!.filter((f) => f !== id), notes: s.notes.filter((n) => n.sec !== id) };
}

export function setForm(song: Song, form: string[]): Song {
  return { ...materialize(song), form };
}
