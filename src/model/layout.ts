import { measureTicks, resolveAccidentals, splitMeasures, ticks, type Resolved } from "./music";
import type { Song } from "./types";

/** Staff space in px; every other size derives from it. */
export const S = 10;
/** A4 at 96 dpi. */
export const PAGE_W = 794;
export const PAGE_H = 1123;
export const MARGIN_X = 64;
const TOP_FIRST = 190;
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
}

export interface ScoreLayout {
  pages: SystemLayout[][];
  /** x of every note head, by note index. */
  noteX: number[];
  accidentals: Resolved[];
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

export function layoutScore(song: Song): ScoreLayout {
  const accidentals = resolveAccidentals(song);
  // A note gets at least the room its syllable needs.
  const slot = (j: number) => {
    const n = song.notes[j];
    const w = noteWidth(ticks(n), accidentals[j].shown !== null);
    return n.lyric ? Math.max(w, lyricWidth(n.lyric) + (n.lyric.endsWith("-") ? 2 * S : 0.8 * S)) : w;
  };
  const noteX: number[] = new Array(song.notes.length).fill(0);
  const measures = splitMeasures(song);
  const last = measures[measures.length - 1];
  const appendInLast = last && last.ticks < measureTicks(song);

  const natural = measures.map((m, i) => {
    let w = PAD_L + PAD_R;
    for (let j = m.start; j < m.end; j++) w += slot(j);
    return w + (appendInLast && i === measures.length - 1 ? APPEND_ROOM : 0);
  });
  const items: { m: (typeof measures)[number]; w: number; extra?: boolean }[] = measures.map((m, i) => ({ m, w: natural[i] }));
  if (!appendInLast) items.push({ m: { start: song.notes.length, end: song.notes.length, ticks: 0 }, w: EXTRA_W, extra: true });

  const pages: SystemLayout[][] = [[]];
  let y = TOP_FIRST;
  let k = 0;
  while (k < items.length) {
    const first = k === 0;
    const x0 = MARGIN_X;
    const x1 = PAGE_W - MARGIN_X;
    const contentX = x0 + CLEF_W + keyWidth(song.fifths) + (first ? TIME_W : 0);
    const avail = x1 - contentX;
    const row: typeof items = [];
    let sum = 0;
    while (k < items.length && (row.length === 0 || sum + items[k].w <= avail)) {
      sum += items[k].w;
      row.push(items[k++]);
    }
    // Justify full systems; a short last one keeps natural spacing.
    const lastRow = k >= items.length;
    const scale = lastRow && sum < avail * 0.75 ? 1 : avail / sum;

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
      const ml: MeasureLayout = { number: measures.indexOf(it.m) + 1, start: it.m.start, end: it.m.end, x, width, extra: it.extra };
      if (it.extra) ml.number = measures.length + 1;
      x += width;
      return ml;
    });
    pages[pages.length - 1].push({ y, x0, x1: scale === 1 ? x : x1, first, contentX, measures: ms, start: row[0].m.start, end: row[row.length - 1].m.end });
    y += SYSTEM_STEP;
  }
  return { pages, noteX, accidentals };
}

/** y of a pitch in a system; `bottom` is the pitch of the bottom staff line. */
export const pitchY = (sys: Pick<SystemLayout, "y">, pitch: number, bottom: number) => sys.y + 4 * S - ((pitch - bottom) * S) / 2;
export const yPitch = (sys: Pick<SystemLayout, "y">, y: number, bottom: number) => Math.round(((sys.y + 4 * S - y) * 2) / S) + bottom;

/** Where a click at `x` inserts a note: before the first note to its right. */
export function insertIndex(sys: SystemLayout, noteX: number[], x: number) {
  for (let i = sys.start; i < sys.end; i++) if (noteX[i] > x - S * 0.6) return i;
  return sys.end;
}
