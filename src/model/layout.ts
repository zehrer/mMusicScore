import { measureTicks, resolveAccidentals, splitMeasures, ticks, type Measure, type Resolved } from "./music";
import { sectionIds, sectionsOf, verseCount, verseOf } from "./sections";
import type { Song } from "./types";

/** Staff space in px; every other size derives from it. */
export const S = 10;
/** A4 at 96 dpi. */
export const PAGE_W = 794;
export const PAGE_H = 1123;
export const MARGIN_X = 64;
const TOP_FIRST = 190;
/** Room for the form line ("Verse – Chorus – …") under the heading. */
export const FORM_LINE_H = 22;
const SECTION_GAP = 3 * S;
const TOP = 80;
const BOTTOM = 80;
/** Distance between the top lines of two systems. */
const SYSTEM_STEP = 12 * S;

export interface MeasureLayout {
  number: number;
  start: number;
  end: number;
  x: number;
  width: number;
  /** The empty measure after the last one, where new notes are appended (not printed). */
  extra?: boolean;
}

export interface SystemLayout {
  /** y of the top staff line. */
  y: number;
  x0: number;
  x1: number;
  first: boolean;
  /** x where the clef, key and time signature end. */
  contentX: number;
  measures: MeasureLayout[];
  /** Notes of this system and their x; `start`/`end` bound them in the song. */
  start: number;
  end: number;
  /** Section the system belongs to, and its name if the section starts here. */
  section: string;
  label: string | null;
  /** The section's last system: ends with a double bar line. */
  sectionEnd: boolean;
}

export interface ScoreLayout {
  pages: SystemLayout[][];
  /** x of every note head, by note index. */
  noteX: number[];
  accidentals: Resolved[];
  /** Lyric lines under each system. */
  verses: number;
}

export const keyWidth = (fifths: number) => (fifths ? Math.abs(fifths) * 1.05 * S + 0.6 * S : 0);
const CLEF_W = 3.6 * S;
const TIME_W = 2.6 * S;
const PAD_L = 1.6 * S;
const PAD_R = 1.2 * S;
/** Room after the last note for clicking in new ones. */
const APPEND_ROOM = 5 * S;
const EXTRA_W = 10 * S;

/** Natural width of a note: longer values get more room, roughly by the square root of their length. */
export const noteWidth = (t: number, accidental: boolean) => S * (1.4 + 2.3 * Math.sqrt(t / 16)) + (accidental ? 1.3 * S : 0);

/** Rough width of a lyric syllable in the score's font. */
export const lyricWidth = (text: string) => text.replace(/-$/, "").length * 7.2;

/** Extra room per additional lyric line. */
export const VERSE_DY = 1.9 * S;

export function layoutScore(song: Song, opts: { formLine?: boolean } = {}): ScoreLayout {
  const accidentals = resolveAccidentals(song);
  const verses = Math.max(1, verseCount(song.notes));
  // A note gets at least the room its longest syllable needs.
  const slot = (j: number) => {
    const n = song.notes[j];
    let w = noteWidth(ticks(n), accidentals[j].shown !== null);
    for (let v = 0; v < verses; v++) {
      const text = verseOf(n, v);
      if (text) w = Math.max(w, lyricWidth(text) + (text.endsWith("-") ? 2 * S : 0.8 * S));
    }
    return w;
  };
  const noteX: number[] = new Array(song.notes.length).fill(0);
  const len = measureTicks(song);
  const measures = splitMeasures(song);
  const ids = sectionIds(song);

  // Measures section by section; a section that is empty, or whose last measure is full, gets an
  // empty measure to click notes into (only shown while editing).
  type Item = { m: Measure; w: number; sec: string; secStart: boolean; extra?: boolean; number: number };
  const items: Item[] = [];
  let pos = 0;
  let number = 0;
  for (const sec of sectionsOf(song)) {
    const ms = measures.filter((m) => ids[m.start] === sec.id);
    ms.forEach((m, k) => {
      let w = PAD_L + PAD_R;
      for (let j = m.start; j < m.end; j++) w += slot(j);
      const last = k === ms.length - 1;
      if (last && m.ticks < len) w += APPEND_ROOM;
      items.push({ m, w, sec: sec.id, secStart: k === 0, number: ++number });
    });
    const last = ms[ms.length - 1];
    if (last) pos = last.end;
    if (!last || last.ticks >= len) items.push({ m: { start: pos, end: pos, ticks: 0 }, w: EXTRA_W, sec: sec.id, secStart: !last, extra: true, number: number + 1 });
  }
  const names = new Map(sectionsOf(song).map((x) => [x.id, x.name]));

  const step = SYSTEM_STEP + (verses - 1) * VERSE_DY;
  const pages: SystemLayout[][] = [[]];
  let y = TOP_FIRST + (opts.formLine ? FORM_LINE_H : 0);
  let k = 0;
  while (k < items.length) {
    const first = k === 0;
    const x0 = MARGIN_X;
    const x1 = PAGE_W - MARGIN_X;
    const contentX = x0 + CLEF_W + keyWidth(song.fifths) + (first ? TIME_W : 0);
    const avail = x1 - contentX;
    const row: Item[] = [];
    let sum = 0;
    // A system holds measures of one section; each section starts a new one.
    while (k < items.length && (row.length === 0 || (!items[k].secStart && sum + items[k].w <= avail))) {
      sum += items[k].w;
      row.push(items[k++]);
    }
    // Justify full systems; the short last one of a section keeps natural spacing.
    const lastRow = k >= items.length || items[k].secStart;
    const scale = lastRow && sum < avail * 0.75 ? 1 : avail / sum;

    // Room for the section's label above its first system.
    if (!first && row[0].secStart) y += SECTION_GAP;
    if (y + 4 * S > PAGE_H - BOTTOM && pages[pages.length - 1].length) {
      pages.push([]);
      y = TOP;
    }
    let x = contentX;
    const ms: MeasureLayout[] = row.map((it) => {
      const width = it.w * scale;
      let nx = x + PAD_L * scale;
      for (let j = it.m.start; j < it.m.end; j++) {
        const acc = accidentals[j].shown !== null;
        noteX[j] = nx + (acc ? 1.3 * S * scale : 0);
        nx += slot(j) * scale;
      }
      const ml: MeasureLayout = { number: it.number, start: it.m.start, end: it.m.end, x, width, extra: it.extra };
      x += width;
      return ml;
    });
    const sec = row[0].sec;
    pages[pages.length - 1].push({
      y,
      x0,
      x1: scale === 1 ? x : x1,
      first,
      contentX,
      measures: ms,
      start: row[0].m.start,
      end: row[row.length - 1].m.end,
      section: sec,
      label: row[0].secStart && names.get(sec) ? names.get(sec)! : null,
      sectionEnd: lastRow,
    });
    y += step;
  }
  return { pages, noteX, accidentals, verses };
}

/** y of a pitch in a system; `bottom` is the pitch of the bottom staff line. */
export const pitchY = (sys: Pick<SystemLayout, "y">, pitch: number, bottom: number) => sys.y + 4 * S - ((pitch - bottom) * S) / 2;
export const yPitch = (sys: Pick<SystemLayout, "y">, y: number, bottom: number) => Math.round(((sys.y + 4 * S - y) * 2) / S) + bottom;

/** Where a click at `x` inserts a note: before the first note to its right. */
export function insertIndex(sys: SystemLayout, noteX: number[], x: number) {
  for (let i = sys.start; i < sys.end; i++) if (noteX[i] > x - S * 0.6) return i;
  return sys.end;
}
