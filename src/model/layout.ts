import { measureTicks, resolveAccidentals, splitMeasures, ticks, type Resolved } from "./music";
import { sectionIds, sectionsOf, verseCount, verseOf } from "./sections";
import type { Song } from "./types";
import { voiceSong } from "./voices";

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
  /** Notes of the first voice in this measure; an empty measure has start === end. */
  start: number;
  end: number;
  /** Notes of the second voice in this measure. */
  start2: number;
  end2: number;
  x: number;
  width: number;
  /** The empty measure after the last one, where new notes are appended (not printed). */
  extra?: boolean;
  /** The song's last measure: ends with the final bar line. */
  last?: boolean;
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
  /** Top line of the second voice's staff, and its notes; null without a second voice. */
  y2: number | null;
  start2: number;
  end2: number;
  /** Section the system belongs to, and its name if the section starts here. */
  section: string;
  label: string | null;
  /** The section's last system: ends with a double bar line. */
  sectionEnd: boolean;
  /** The second voice's staff (see staffOf): no section label or measure number. */
  lower?: boolean;
}

export interface ScoreLayout {
  pages: SystemLayout[][];
  /** x of every note head, by note index. */
  noteX: number[];
  accidentals: Resolved[];
  /** Lyric lines under each system. */
  verses: number;
  /** The same for the second voice (empty without one). */
  noteX2: number[];
  accidentals2: Resolved[];
  verses2: number;
}

/**
 * One staff of a system as a system of its own: voice 0 is the system itself, voice 1 the second
 * staff with its notes, so the drawing code works the same for both.
 */
export function staffOf(sys: SystemLayout, v: 0 | 1): SystemLayout {
  if (v === 0 || sys.y2 === null) return sys;
  return {
    ...sys,
    y: sys.y2,
    start: sys.start2,
    end: sys.end2,
    measures: sys.measures.map((m) => ({ ...m, start: m.start2, end: m.end2 })),
    label: null,
    lower: true,
  };
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
  const voices = song.second ? [song, voiceSong(song, 1)] : [song];
  const acc = voices.map((v) => resolveAccidentals(v));
  const verseLines = voices.map((v) => Math.max(1, verseCount(v.notes)));
  const hasLyrics = voices.map((v) => verseCount(v.notes) > 0);
  const noteX = voices.map((v) => new Array<number>(v.notes.length).fill(0));
  const len = measureTicks(song);
  const measures = voices.map((v) => splitMeasures(v));
  const ids = voices.map((v) => sectionIds(v));

  // A measure column holds one measure of each voice. Its notes are spaced by time: every moment
  // a note starts in either voice gets room by the time to the next one (like a single voice gets
  // by its note values), so notes that sound together stand above each other.
  type Range = { start: number; end: number; ticks: number };
  type Column = { r: Range[]; w: number; sec: string; secStart: boolean; extra?: boolean; number: number; at: Map<number, number> };
  const accAt = (r: Range[], t: Map<number, boolean>) => {
    r.forEach((m, v) => {
      let o = 0;
      for (let j = m.start; j < m.end; j++) {
        if (acc[v][j].shown !== null) t.set(o, true);
        o += ticks(voices[v].notes[j]);
      }
    });
  };
  /** Positions (from the column's left edge, unscaled) of every onset, and the natural width. */
  const space = (r: Range[], append: boolean) => {
    const starts = new Map<number, { lyric: number }>();
    let endT = 0;
    r.forEach((m, v) => {
      let o = 0;
      for (let j = m.start; j < m.end; j++) {
        const n = voices[v].notes[j];
        let need = 0;
        for (let k = 0; k < verseLines[v]; k++) {
          const text = verseOf(n, k);
          if (text) need = Math.max(need, lyricWidth(text) + (text.endsWith("-") ? 2 * S : 0.8 * S));
        }
        starts.set(o, { lyric: Math.max(starts.get(o)?.lyric ?? 0, need) });
        o += ticks(n);
      }
      endT = Math.max(endT, o);
    });
    const accs = new Map<number, boolean>();
    accAt(r, accs);
    const times = [...starts.keys()].sort((a, b) => a - b);
    const at = new Map<number, number>();
    let x = PAD_L;
    times.forEach((t, i) => {
      at.set(t, x + (accs.get(t) ? 1.3 * S : 0));
      const gap = (times[i + 1] ?? endT) - t;
      x += Math.max(noteWidth(gap, !!accs.get(t)), starts.get(t)!.lyric);
    });
    return { at, w: times.length ? x + PAD_R + (append ? APPEND_ROOM : 0) : EXTRA_W };
  };

  const columns: Column[] = [];
  const pos = voices.map(() => 0);
  let number = 0;
  for (const sec of sectionsOf(song)) {
    const per = measures.map((ms, v) => ms.filter((m) => ids[v][m.start] === sec.id));
    per.forEach((ms, v) => ms.length && (pos[v] = ms[ms.length - 1].end));
    const count = Math.max(0, ...per.map((ms) => ms.length));
    // A voice can take new notes in this section if its last measure has room or an empty
    // measure of this section waits for it; otherwise an extra measure is added.
    const canAppend = per.map((ms) => ms.length < count || (ms.length > 0 && ms[ms.length - 1].ticks < len));
    const extra = count === 0 || canAppend.some((c) => !c);
    for (let k = 0; k < count + (extra ? 1 : 0); k++) {
      const r = per.map((ms, v) => ms[k] ?? { start: pos[v], end: pos[v], ticks: 0 });
      const append = per.some((ms) => k === ms.length - 1 && ms[k].ticks < len);
      const isExtra = k >= count;
      const { at, w } = space(r, append);
      columns.push({ r, w: isExtra ? EXTRA_W : w, sec: sec.id, secStart: k === 0, extra: isExtra || undefined, number: isExtra ? number + 1 : ++number, at });
    }
  }
  const lastReal = columns.reduce((last, c, i) => (c.extra ? last : i), -1);
  const names = new Map(sectionsOf(song).map((x) => [x.id, x.name]));

  // Second staff below the first one's lyrics; each staff's lyric lines add room.
  const lyricRoom = (v: number) => (hasLyrics[v] ? (verseLines[v] - 1) * VERSE_DY + 2.5 * S : 0);
  const staffGap = song.second ? 8 * S + lyricRoom(0) : 0;
  const step = staffGap + SYSTEM_STEP + (verseLines[voices.length - 1] - 1) * VERSE_DY;
  const pages: SystemLayout[][] = [[]];
  let y = TOP_FIRST + (opts.formLine ? FORM_LINE_H : 0);
  let k = 0;
  while (k < columns.length) {
    const first = k === 0;
    const x0 = MARGIN_X;
    const x1 = PAGE_W - MARGIN_X;
    const contentX = x0 + CLEF_W + keyWidth(song.fifths) + (first ? TIME_W : 0);
    const avail = x1 - contentX;
    const row: Column[] = [];
    let sum = 0;
    // A system holds measures of one section; each section starts a new one.
    while (k < columns.length && (row.length === 0 || (!columns[k].secStart && sum + columns[k].w <= avail))) {
      sum += columns[k].w;
      row.push(columns[k++]);
    }
    // Justify full systems; the short last one of a section keeps natural spacing.
    const lastRow = k >= columns.length || columns[k].secStart;
    const scale = lastRow && sum < avail * 0.75 ? 1 : avail / sum;

    // Room for the section's label above its first system.
    if (!first && row[0].secStart) y += SECTION_GAP;
    if (y + staffGap + 4 * S > PAGE_H - BOTTOM && pages[pages.length - 1].length) {
      pages.push([]);
      y = TOP;
    }
    let x = contentX;
    const ms: MeasureLayout[] = row.map((c) => {
      const width = c.w * scale;
      c.r.forEach((m, v) => {
        let o = 0;
        for (let j = m.start; j < m.end; j++) {
          noteX[v][j] = x + (c.at.get(o) ?? PAD_L) * scale;
          o += ticks(voices[v].notes[j]);
        }
      });
      const r2 = c.r[1] ?? { start: 0, end: 0 };
      const ml: MeasureLayout = { number: c.number, start: c.r[0].start, end: c.r[0].end, start2: r2.start, end2: r2.end, x, width, extra: c.extra };
      if (columns.indexOf(c) === lastReal) ml.last = true;
      x += width;
      return ml;
    });
    const sec = row[0].sec;
    const r2a = row[0].r[1];
    const r2b = row[row.length - 1].r[1];
    pages[pages.length - 1].push({
      y,
      x0,
      x1: scale === 1 ? x : x1,
      first,
      contentX,
      measures: ms,
      start: row[0].r[0].start,
      end: row[row.length - 1].r[0].end,
      y2: song.second ? y + staffGap : null,
      start2: r2a ? r2a.start : 0,
      end2: r2b ? r2b.end : 0,
      section: sec,
      label: row[0].secStart && names.get(sec) ? names.get(sec)! : null,
      sectionEnd: lastRow,
    });
    y += step;
  }
  return {
    pages,
    noteX: noteX[0],
    accidentals: acc[0],
    verses: verseLines[0],
    noteX2: noteX[1] ?? [],
    accidentals2: acc[1] ?? [],
    verses2: verseLines[1] ?? 1,
  };
}

/** y of a pitch in a system; `bottom` is the pitch of the bottom staff line. */
export const pitchY = (sys: Pick<SystemLayout, "y">, pitch: number, bottom: number) => sys.y + 4 * S - ((pitch - bottom) * S) / 2;
export const yPitch = (sys: Pick<SystemLayout, "y">, y: number, bottom: number) => Math.round(((sys.y + 4 * S - y) * 2) / S) + bottom;

/** Where a click at `x` inserts a note: before the first note to its right. */
export function insertIndex(sys: SystemLayout, noteX: number[], x: number) {
  for (let i = sys.start; i < sys.end; i++) if (noteX[i] > x - S * 0.6) return i;
  return sys.end;
}
