import type { Alter, Clef, Duration, NoteEvent, Song } from "./types";

export const DURATIONS: Duration[] = [1, 2, 4, 8, 16];
export const TICKS_WHOLE = 64;
export const STEP_NAMES = ["C", "D", "E", "F", "G", "A", "B"];
const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
/** Steps (C = 0) in the order sharps and flats enter a key signature. */
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
/** Pitch of the bottom staff line. */
export const BOTTOM_LINE: Record<Clef, number> = { treble: 30, bass: 18 };
export const PITCH_MIN = 7; // C1
export const PITCH_MAX = 56; // C8

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const ticks = (n: Pick<NoteEvent, "dur" | "dots">) => (TICKS_WHOLE / n.dur) * (n.dots ? 1.5 : 1);
export const measureTicks = (s: Pick<Song, "beats" | "beatType">) => (s.beats * TICKS_WHOLE) / s.beatType;
export const step = (pitch: number) => ((pitch % 7) + 7) % 7;
export const octave = (pitch: number) => Math.floor(pitch / 7);
export const clampPitch = (p: number) => Math.max(PITCH_MIN, Math.min(PITCH_MAX, p));
/** Middle staff line; notes on or above it get a stem down. */
export const middleLine = (clef: Clef) => BOTTOM_LINE[clef] + 4;

export function keyAlter(fifths: number, s: number): Alter {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(s) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(s) ? -1 : 0;
  return 0;
}

/** Pitches at which the key signature's accidentals are drawn. */
export function keySignaturePitches(fifths: number, clef: Clef): number[] {
  const treble = fifths > 0 ? [38, 35, 39, 36, 33, 37, 34] : [34, 37, 33, 36, 32, 35, 31];
  const shift = clef === "bass" ? -14 : 0;
  return treble.slice(0, Math.abs(fifths)).map((p) => p + shift);
}

export const midi = (pitch: number, alter: number) => 12 + octave(pitch) * 12 + STEP_SEMITONES[step(pitch)] + alter;

export function pitchName(pitch: number, alter: number) {
  return STEP_NAMES[step(pitch)] + (alter > 0 ? "♯" : alter < 0 ? "♭" : "") + octave(pitch);
}

/** The pitch with the given step that is closest to `near`. */
export function nearestPitch(s: number, near: number) {
  const base = octave(near) * 7 + s;
  const best = [base - 7, base, base + 7].reduce((a, b) => (Math.abs(b - near) < Math.abs(a - near) ? b : a));
  return clampPitch(best);
}

export interface Measure {
  /** Index of the first note and one past the last. */
  start: number;
  end: number;
  ticks: number;
}

/** Groups the notes into measures; a note that crosses a bar line stays in the measure it starts in. */
export function splitMeasures(song: Pick<Song, "notes" | "beats" | "beatType">): Measure[] {
  const len = measureTicks(song);
  const measures: Measure[] = [];
  let cur: Measure = { start: 0, end: 0, ticks: 0 };
  song.notes.forEach((n, i) => {
    cur.end = i + 1;
    cur.ticks += ticks(n);
    if (cur.ticks >= len) {
      measures.push(cur);
      cur = { start: i + 1, end: i + 1, ticks: 0 };
    }
  });
  if (cur.end > cur.start) measures.push(cur);
  return measures;
}

export interface Resolved {
  /** Sounding alteration. */
  actual: Alter;
  /** Accidental to print, or null when the key or the measure already implies it. */
  shown: Alter | null;
}

/** Applies key signature and accidentals that carry through the rest of their measure. */
export function resolveAccidentals(song: Pick<Song, "notes" | "beats" | "beatType" | "fifths">): Resolved[] {
  const out: Resolved[] = new Array(song.notes.length);
  for (const m of splitMeasures(song)) {
    const state = new Map<number, Alter>();
    for (let i = m.start; i < m.end; i++) {
      const n = song.notes[i];
      if (n.rest) {
        out[i] = { actual: 0, shown: null };
        continue;
      }
      const current = state.get(n.pitch) ?? keyAlter(song.fifths, step(n.pitch));
      if (n.alter === undefined || n.alter === current) {
        out[i] = { actual: current, shown: null };
      } else {
        state.set(n.pitch, n.alter);
        out[i] = { actual: n.alter, shown: n.alter };
      }
    }
  }
  return out;
}

/** Duration and dot that make up `t` ticks, or the closest shorter value. */
export function durationForTicks(t: number): { dur: Duration; dots: 0 | 1 } {
  for (const dur of DURATIONS) {
    if (ticks({ dur, dots: 1 }) === t) return { dur, dots: 1 };
    if (ticks({ dur }) <= t) return { dur, dots: 0 };
  }
  return { dur: 16, dots: 0 };
}

/**
 * Compact melody notation used by the samples and tests: `C4 F#4/8 Bb3/2. r/4 |`.
 * Letter, optional # / b / n, octave, optional /duration, optional dot; `r` is a rest; `|` is ignored.
 */
export function parseMelody(src: string): NoteEvent[] {
  const out: NoteEvent[] = [];
  let last = 28 + 4;
  for (const tok of src.split(/[\s|]+/).filter(Boolean)) {
    const m = /^(?:([A-G])([#bn]?)(\d)|r)(?:\/(\d+))?(\.)?$/.exec(tok);
    if (!m) throw new Error(`Unknown note: ${tok}`);
    const dur = Number(m[4] ?? 4) as Duration;
    if (!DURATIONS.includes(dur)) throw new Error(`Unknown duration: ${tok}`);
    const n: NoteEvent = { id: newId(), dur, pitch: last };
    if (m[5]) n.dots = 1;
    if (m[1]) {
      n.pitch = last = Number(m[3]) * 7 + STEP_NAMES.indexOf(m[1]);
      if (m[2]) n.alter = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
    } else n.rest = true;
    out.push(n);
  }
  return out;
}

export const KEY_NAMES: Record<number, string> = {
  [-7]: "C♭ major / A♭ minor",
  [-6]: "G♭ major / E♭ minor",
  [-5]: "D♭ major / B♭ minor",
  [-4]: "A♭ major / F minor",
  [-3]: "E♭ major / C minor",
  [-2]: "B♭ major / G minor",
  [-1]: "F major / D minor",
  0: "C major / A minor",
  1: "G major / E minor",
  2: "D major / B minor",
  3: "A major / F♯ minor",
  4: "E major / C♯ minor",
  5: "B major / G♯ minor",
  6: "F♯ major / D♯ minor",
  7: "C♯ major / A♯ minor",
};

export const DURATION_NAMES: Record<Duration, string> = { 1: "Whole", 2: "Half", 4: "Quarter", 8: "Eighth", 16: "Sixteenth" };

export function emptySong(title = "New song"): Song {
  const now = Date.now();
  return { id: newId(), title, composer: "", tempo: 100, beats: 4, beatType: 4, fifths: 0, clef: "treble", notes: [], createdAt: now, updatedAt: now };
}
