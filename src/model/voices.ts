import { ticks } from "./music";
import type { Instrument, NoteEvent, Song } from "./types";

export type VoiceIndex = 0 | 1;

export const instrumentOf = (song: Song, v: VoiceIndex): Instrument => (v === 0 ? song.instrument : song.second?.instrument) ?? "piano";

/**
 * A voice seen as a song of its own (its notes and clef, the song's key, time and sections), so
 * everything that works on a song's notes works on either voice.
 */
export function voiceSong(song: Song, v: VoiceIndex): Song {
  if (v === 0 || !song.second) return song;
  return { ...song, notes: song.second.notes, clef: song.second.clef, instrument: song.second.instrument };
}

/** Puts the notes, clef and sound of `vs` (a voiceSong) back into voice `v` of `song`. */
export function withVoice(song: Song, v: VoiceIndex, vs: Song): Song {
  if (v === 0 || !song.second) return vs;
  const { notes, clef, instrument, ...rest } = vs;
  const second = { ...song.second, notes, clef };
  if (instrument) second.instrument = instrument;
  else delete second.instrument;
  return { ...rest, notes: song.notes, clef: song.clef, instrument: song.instrument, second };
}

/** Start of every note in ticks, counted from `from` (e.g. the start of its section). */
export function onsets(notes: NoteEvent[], from = 0): number[] {
  const out: number[] = [];
  let t = from;
  for (const n of notes) {
    out.push(t);
    t += ticks(n);
  }
  return out;
}

export function addSecondVoice(song: Song): Song {
  if (song.second) return song;
  return { ...song, second: { clef: song.clef, notes: [] } };
}

export function removeSecondVoice(song: Song): Song {
  const { second: _, ...rest } = song;
  return rest;
}
