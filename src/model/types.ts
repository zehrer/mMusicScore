/** Note value as the denominator of a whole note: 1 = whole … 16 = sixteenth. */
export type Duration = 1 | 2 | 4 | 8 | 16;
/** Chromatic alteration: flat, natural, sharp. */
export type Alter = -1 | 0 | 1;
export type Clef = "treble" | "bass";
export type Instrument = "piano" | "flute";

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
  /** Syllables of further verses (verse 2, 3, …) under the same note. */
  verses?: string[];
  /** Section the note belongs to; without one it is in the first section. */
  sec?: string;
}

/** A part of a song (verse, chorus, …) written once and played wherever the form lists it. */
export interface Section {
  id: string;
  name: string;
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
  /** Notes of all sections, section after section in the order of `sections`. */
  notes: NoteEvent[];
  /** Without sections the song is a single unnamed section. */
  sections?: Section[];
  /** Order in which sections are played, by id; may repeat. Without one, each section once. */
  form?: string[];
  /** Sound of the first voice; piano when not set. */
  instrument?: Instrument;
  /** A second voice on its own staff below the first, in the same sections. */
  second?: Voice;
  createdAt: number;
  updatedAt: number;
}

export interface Voice {
  clef: Clef;
  instrument?: Instrument;
  /** Like Song.notes: section after section. */
  notes: NoteEvent[];
}

/** What the library list shows without loading every song. */
export interface SongInfo {
  id: string;
  title: string;
  composer: string;
  updatedAt: number;
}
