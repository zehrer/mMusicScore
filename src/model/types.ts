/** Note value as the denominator of a whole note: 1 = whole … 16 = sixteenth. */
export type Duration = 1 | 2 | 4 | 8 | 16;
/** Chromatic alteration: flat, natural, sharp. */
export type Alter = -1 | 0 | 1;
export type Clef = "treble" | "bass";

export interface NoteEvent {
  id: string;
  dur: Duration;
  dots?: 0 | 1;
  rest?: boolean;
  /** Diatonic index, C0 = 0, C4 (middle C) = 28. Rests keep one so they can become notes again. */
  pitch: number;
  /** Written accidental. Without one the note follows the key and earlier accidentals in its measure. */
  alter?: Alter;
  /** Lyric syllable sung on this note; a trailing "-" joins it to the next one. */
  lyric?: string;
}

export interface Song {
  id: string;
  title: string;
  composer: string;
  /** Quarter notes per minute. */
  tempo: number;
  beats: number;
  beatType: number;
  /** Key signature: number of sharps (> 0) or flats (< 0). */
  fifths: number;
  clef: Clef;
  notes: NoteEvent[];
  createdAt: number;
  updatedAt: number;
}

/** What the library list shows without loading every song. */
export interface SongInfo {
  id: string;
  title: string;
  composer: string;
  updatedAt: number;
}
