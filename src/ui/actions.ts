import { download, fileName, fromJSON, libraryToJSON, songToJSON } from "../model/io";
import { emptySong, newId } from "../model/music";
import { fromMusicXML, toMusicXML } from "../model/musicxml";
import { addSong, addSongs, deleteSong, loadAll } from "../model/persist";
import { play, stop } from "../model/playback";
import { sampleSongs } from "../model/samples";
import { useStore } from "../model/store";
import type { Song } from "../model/types";

const state = useStore.getState;

export const MOD = navigator.platform.startsWith("Mac") ? "⌘" : "Ctrl+";

export const newSong = () => addSong(emptySong());

export function duplicateSong(song: Song = state().song) {
  return addSong({ ...structuredClone(song), id: newId(), title: `${song.title} (Kopie)`, createdAt: Date.now(), updatedAt: Date.now() });
}

export async function confirmDelete(id: string, title: string) {
  if (confirm(`„${title}“ endgültig löschen?`)) await deleteSong(id);
}

export const addSamples = () => addSongs(sampleSongs());

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept });
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** Imports a library or song (JSON) or a MusicXML file as new songs. */
export async function importFile() {
  const file = await pickFile(".json,.musicxml,.xml,application/json,application/vnd.recordare.musicxml+xml");
  if (!file) return;
  try {
    if (/\.mxl$/i.test(file.name)) throw new Error("Komprimiertes MusicXML (.mxl) wird nicht unterstützt – bitte als .musicxml exportieren.");
    const text = await file.text();
    const songs = text.trimStart().startsWith("<") ? [fromMusicXML(text)] : fromJSON(text);
    await addSongs(songs);
  } catch (e) {
    alert(`Import fehlgeschlagen: ${(e as Error).message}`);
  }
}

export async function exportLibrary() {
  download(`mMusicScore-Bibliothek-${new Date().toISOString().slice(0, 10)}.json`, libraryToJSON(await loadAll()), "application/json");
}

export function exportSongJSON(song: Song = state().song) {
  download(fileName(song.title, "json"), songToJSON(song), "application/json");
}

export function exportMusicXML(song: Song = state().song) {
  download(fileName(song.title, "musicxml"), toMusicXML(song), "application/vnd.recordare.musicxml+xml");
}

export function printScore() {
  useStore.setState({ sel: null });
  setTimeout(() => print(), 50);
}

/** Starts playback at the selection (or the beginning), or stops it. */
export function togglePlay() {
  const { isPlaying, song, sel } = state();
  if (isPlaying) return stop();
  if (!song.notes.length) return;
  useStore.setState({ isPlaying: true });
  play(
    song,
    sel ?? 0,
    (i) => useStore.setState({ playing: i }),
    () => useStore.setState({ playing: null, isPlaying: false }),
  );
}
