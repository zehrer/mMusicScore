import { clampPitch, DURATIONS, emptySong, newId } from "./music";
import type { Alter, Duration, NoteEvent, Song } from "./types";

export const FORMAT = "mmusicscore";

/** A library export: every song of this browser in one file. */
export function libraryToJSON(songs: Song[]) {
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), songs }, null, 1);
}

export function songToJSON(song: Song) {
  return libraryToJSON([song]);
}

/**
 * Reads a library export, a single song or an array of songs. Every song gets a new id, so
 * importing never overwrites a song that is already in the library.
 */
export function fromJSON(text: string): Song[] {
  const data = JSON.parse(text);
  const list: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.songs) ? data.songs : [data];
  const songs = list.map(normalizeSong);
  if (!songs.length) throw new Error("The file contains no songs.");
  return songs;
}

const num = (v: unknown, def: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : def;
const str = (v: unknown, def = "") => (typeof v === "string" ? v : def);

export function normalizeSong(raw: unknown): Song {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Song).notes)) throw new Error("Not a valid song.");
  const r = raw as Partial<Song>;
  const base = emptySong();
  return {
    ...base,
    title: str(r.title, base.title),
    composer: str(r.composer),
    tempo: num(r.tempo, 100, 20, 300),
    beats: num(r.beats, 4, 1, 16),
    beatType: [1, 2, 4, 8, 16].includes(r.beatType as number) ? (r.beatType as number) : 4,
    fifths: num(r.fifths, 0, -7, 7),
    clef: r.clef === "bass" ? "bass" : "treble",
    notes: (r.notes as unknown[]).map(normalizeNote),
    createdAt: num(r.createdAt, base.createdAt, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(r.updatedAt, base.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

function normalizeNote(raw: unknown): NoteEvent {
  const r = (raw ?? {}) as Partial<NoteEvent>;
  const n: NoteEvent = {
    id: newId(),
    dur: DURATIONS.includes(r.dur as Duration) ? (r.dur as Duration) : 4,
    pitch: clampPitch(num(r.pitch, 32, 0, 70)),
  };
  if (r.dots) n.dots = 1;
  if (r.rest) n.rest = true;
  if (r.alter === -1 || r.alter === 0 || r.alter === 1) n.alter = r.alter as Alter;
  return n;
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File name without characters that file systems reject. */
export const fileName = (title: string, ext: string) => `${title.replace(/[\\/:*?"<>|]+/g, "").trim() || "Song"}.${ext}`;
