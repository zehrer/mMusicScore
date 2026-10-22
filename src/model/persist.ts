import { del, get, set } from "idb-keyval";
import { fromJSON } from "./io";
import { emptySong } from "./music";
import { sampleSongs } from "./samples";
import { infoOf, openSong, useStore } from "./store";
import type { Song, SongInfo } from "./types";

// IndexedDB layout: an index of all songs, one entry per song, and the last opened id.
const INDEX = "songs";
const LAST = "lastSong";
const key = (id: string) => `song:${id}`;

const listSongs = async () => (await get<SongInfo[]>(INDEX)) ?? [];

/** Opens the last used song (samples on first start) and autosaves every change (debounced). */
export async function initPersistence() {
  try {
    let songs = await listSongs();
    if (!songs.length && !(await get(LAST))) {
      const samples = sampleSongs();
      for (const s of samples) await set(key(s.id), s);
      await set(INDEX, (songs = samples.map(infoOf)));
    }
    const lastId = await get<string>(LAST);
    const info = songs.find((s) => s.id === lastId) ?? songs[0];
    const song = info && (await get<Song>(key(info.id)));
    openSong(song ?? emptySong(), !song);
    useStore.setState({ songs });
  } catch (e) {
    useStore.setState({ saveError: String(e) });
  }
  useStore.subscribe((s, prev) => {
    if (s.revision !== prev.revision) schedule();
  });
  addEventListener("pagehide", () => void flush());
  receiveFromExport();
}

/**
 * "Open in mMusicScore" in an HTML export opens this app with #import and sends the embedded song
 * by postMessage once we report ready. The user confirms before anything is added.
 */
export function receiveFromExport() {
  if (location.hash !== "#import" || !window.opener) return;
  history.replaceState(null, "", location.pathname + location.search);
  let done = false;
  addEventListener("message", async (e: MessageEvent) => {
    if (done || e.source !== window.opener || e.data?.type !== "mmusicscore-data" || typeof e.data.json !== "string") return;
    done = true;
    const name = String(e.data.name || "Imported");
    if (!confirm(`Add "${name}" from the exported file to the songs in this browser?`)) return;
    try {
      await addSongs(fromJSON(e.data.json));
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    }
  });
  window.opener.postMessage({ type: "mmusicscore-ready" }, "*");
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pending = false;

function schedule() {
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

/** Writes the open song now if it has unsaved changes. */
export async function flush() {
  if (!pending) return;
  pending = false;
  clearTimeout(timer);
  const { song } = useStore.getState();
  try {
    await set(key(song.id), song);
    const songs = [infoOf(song), ...(await listSongs()).filter((s) => s.id !== song.id)];
    await set(INDEX, songs);
    await set(LAST, song.id);
    useStore.setState({ songs, savedAt: new Date(), saveError: null });
  } catch (e) {
    useStore.setState({ saveError: String(e) });
  }
}

/** Saves the open song, then opens `song` as a new entry of the library. */
export async function addSong(song: Song) {
  await flush();
  openSong(song, true);
}

/** Adds imported songs to the library and opens the first. */
export async function addSongs(list: Song[]) {
  await flush();
  for (const s of list.slice(1)) await set(key(s.id), s);
  const songs = [...list.slice(1).map(infoOf), ...(await listSongs())];
  await set(INDEX, songs);
  useStore.setState({ songs });
  openSong(list[0], true);
}

export async function openSaved(id: string) {
  if (id === useStore.getState().song.id) return;
  await flush();
  const song = await get<Song>(key(id));
  if (!song) return;
  openSong(song);
  await set(LAST, id);
}

export async function loadAll(): Promise<Song[]> {
  await flush();
  const songs = await Promise.all((await listSongs()).map((i) => get<Song>(key(i.id))));
  return songs.filter((s): s is Song => !!s);
}

/** Deletes a saved song; if it is open, switches to the most recent other one. */
export async function deleteSong(id: string) {
  const songs = (await listSongs()).filter((s) => s.id !== id);
  await del(key(id));
  await set(INDEX, songs);
  useStore.setState({ songs });
  if (useStore.getState().song.id === id) {
    pending = false;
    clearTimeout(timer);
    const next = songs[0] && (await get<Song>(key(songs[0].id)));
    if (next) {
      openSong(next);
      await set(LAST, next.id);
    } else openSong(emptySong(), true);
  }
}
