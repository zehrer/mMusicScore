import { createElement } from "react";
import { extractSongJSON, toHTML } from "../model/html-export";
import { download, fileName, fromJSON, libraryToJSON, songToJSON } from "../model/io";
import { emptySong, newId } from "../model/music";
import { fromMusicXML, toMusicXML } from "../model/musicxml";
import { addSong, addSongs, deleteSong, loadAll } from "../model/persist";
import { play, stop } from "../model/playback";
import { sampleSongs } from "../model/samples";
import { expand } from "../model/sections";
import { onsets, voiceSong } from "../model/voices";
import { deleteSelection, pasteNotes, playedVoices, selectedNotes, useStore } from "../model/store";
import type { NoteEvent, Song } from "../model/types";

const state = useStore.getState;

export const MOD = navigator.platform.startsWith("Mac") ? "⌘" : "Ctrl+";

export const newSong = () => addSong(emptySong());

export function duplicateSong(song: Song = state().song) {
  return addSong({ ...structuredClone(song), id: newId(), title: `${song.title} (copy)`, createdAt: Date.now(), updatedAt: Date.now() });
}

export async function confirmDelete(id: string, title: string) {
  if (confirm(`Delete "${title}" permanently?`)) await deleteSong(id);
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
  const file = await pickFile(".json,.musicxml,.xml,.html,.htm,application/json,application/vnd.recordare.musicxml+xml,text/html");
  if (!file) return;
  try {
    if (/\.mxl$/i.test(file.name)) throw new Error("Compressed MusicXML (.mxl) is not supported – please export as .musicxml.");
    const text = await file.text();
    // An HTML export carries its song as JSON; other markup is MusicXML.
    const embedded = /<html[\s>]/i.test(text) ? extractSongJSON(text) : null;
    if (/<html[\s>]/i.test(text) && !embedded) throw new Error("This HTML file was not exported from mMusicScore.");
    const songs = embedded ? fromJSON(embedded) : text.trimStart().startsWith("<") ? [fromMusicXML(text)] : fromJSON(text);
    await addSongs(songs);
  } catch (e) {
    alert(`Import failed: ${(e as Error).message}`);
  }
}

export async function exportLibrary() {
  download(`mMusicScore-library-${new Date().toISOString().slice(0, 10)}.json`, libraryToJSON(await loadAll()), "application/json");
}

export function exportSongJSON(song: Song = state().song) {
  download(fileName(song.title, "json"), songToJSON(song), "application/json");
}

export function exportMusicXML(song: Song = state().song) {
  download(fileName(song.title, "musicxml"), toMusicXML(song), "application/vnd.recordare.musicxml+xml");
}

/** The Bravura font as base64, for embedding in the HTML export. */
async function fontBase64() {
  const { default: url } = await import("@vexflow-fonts/bravura/bravura.woff2?url");
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** A single HTML file that shows and plays the song, with a button to open it here again. */
export async function exportHTML(song: Song = state().song) {
  // The renderer is only loaded for an export.
  const [{ renderToStaticMarkup }, { StaticScore }, font] = await Promise.all([import("react-dom/server"), import("./StaticScore"), fontBase64()]);
  // The page shows and plays the form written out; the original song is embedded for re-import.
  const { showNames, nameStyle } = state();
  const played = expand(song).song;
  const pages = renderToStaticMarkup(createElement(StaticScore, { song: played, names: showNames ? nameStyle : null }));
  download(fileName(song.title, "html"), toHTML(song, pages, font, location.origin + location.pathname, played), "text/html");
}

export function printScore() {
  useStore.setState({ sel: null });
  setTimeout(() => print(), 50);
}

/** Starts playback at note `i` (view mode: tap a note), also while playing. */
export function playFrom(i: number) {
  if (state().isPlaying) stop();
  useStore.setState({ sel: i, anchor: null });
  startPlayback(true);
}

/**
 * Plays the song through its form, from the selected note's first appearance (or the beginning),
 * or stops playback.
 */
export function togglePlay() {
  if (state().isPlaying) return stop();
  startPlayback(false);
}

/** `exact`: start at the selected note even if it is the last one (a tapped note). */
function startPlayback(exact: boolean) {
  const { song, sel, voice, playVoices } = state();
  const { song: played, src, src2 } = expand(song);
  if (!played.notes.length && !played.second?.notes.length) return;
  // Start where the selected note (of the voice being edited) first comes up in the form; from
  // the beginning when nothing is selected or the selection is the last note (at the end).
  const atEnd = !exact && sel !== null && sel === voiceSong(song, voice).notes.length - 1;
  const k = sel === null || atEnd ? -1 : (voice === 0 ? src : src2).indexOf(sel);
  const from = k < 0 ? 0 : onsets(voiceSong(played, voice).notes)[k];
  useStore.setState({ isPlaying: true, playingSong: played, playingSrc: src, playingSrc2: src2, playing: null, playing2: null });
  play(
    played,
    from,
    ([a, b]) => useStore.setState({ playing: a, playing2: b }),
    () => useStore.setState({ playing: null, playing2: null, isPlaying: false, playingSong: null, playingSrc: null, playingSrc2: null }),
    playedVoices(song, playVoices),
  );
}

// --- Copy & paste ---------------------------------------------------------------------------
// Notes travel as JSON text on the system clipboard, so they can be pasted into another song or
// tab. A copy in memory covers browsers that only fire clipboard events in text fields (Safari).

const CLIP_FORMAT = "mmusicscore-notes";
let clip: NoteEvent[] = [];

const clipText = (notes: NoteEvent[]) => JSON.stringify({ format: CLIP_FORMAT, notes });

function parseClip(text: string): NoteEvent[] | null {
  try {
    const data = JSON.parse(text);
    return data?.format === CLIP_FORMAT && Array.isArray(data.notes) ? fromJSON(JSON.stringify({ notes: data.notes }))[0].notes : null;
  } catch {
    return null;
  }
}

export function copySelection(cut = false) {
  const notes = selectedNotes();
  if (!notes.length) return;
  clip = notes;
  navigator.clipboard?.writeText(clipText(notes)).catch(() => {});
  if (cut) deleteSelection();
}

// Set when the browser fired its own clipboard event for a shortcut, so the fallback stays out.
let handled = false;
/** Notes a Cmd+C / Cmd+X just took; the copy or cut event that follows only puts them on the clipboard. */
let fromShortcut: NoteEvent[] | null = null;

/**
 * Cmd+C / Cmd+X: the selection is taken (and cut) right away, so a quick Esc or click afterwards
 * cannot change what is copied. The copy or cut event then puts it on the system clipboard;
 * without that event (some browsers fire it only in text fields) the clipboard API is used.
 */
export function copySoon(cut: boolean) {
  const notes = selectedNotes();
  if (!notes.length) return;
  clip = fromShortcut = notes;
  handled = false;
  if (cut) deleteSelection();
  setTimeout(() => {
    if (!handled) navigator.clipboard?.writeText(clipText(notes)).catch(() => {});
    fromShortcut = null;
  }, 60);
}

/** Cmd+V: the paste event brings the system clipboard; without one, the copy in memory is used. */
export function pasteSoon() {
  handled = false;
  setTimeout(() => !handled && pasteNotes(clip), 60);
}

/** Edit → Paste: reads the system clipboard where the browser allows it, else the copy in memory. */
export async function pasteFromMenu() {
  try {
    const notes = parseClip(await navigator.clipboard.readText());
    if (notes) return pasteNotes(notes);
  } catch {
    /* no permission: fall back */
  }
  pasteNotes(clip);
}

function onPaste(e: ClipboardEvent) {
  if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
  handled = true;
  e.preventDefault();
  pasteNotes(parseClip(e.clipboardData?.getData("text/plain") ?? "") ?? clip);
}

function onCopy(e: ClipboardEvent, cut: boolean) {
  if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
  const notes = fromShortcut ?? selectedNotes();
  if (!notes.length) return;
  handled = true;
  e.preventDefault();
  e.clipboardData?.setData("text/plain", clipText(notes));
  clip = notes;
  // A shortcut already cut; only the menu's own cut (e.g. Safari's Edit menu) deletes here.
  if (cut && !fromShortcut) deleteSelection();
  fromShortcut = null;
}

/** Clipboard events for the score; returns a function that removes them. */
export function listenClipboard() {
  const copy = (e: ClipboardEvent) => onCopy(e, false);
  const cut = (e: ClipboardEvent) => onCopy(e, true);
  document.addEventListener("copy", copy);
  document.addEventListener("cut", cut);
  document.addEventListener("paste", onPaste);
  return () => {
    document.removeEventListener("copy", copy);
    document.removeEventListener("cut", cut);
    document.removeEventListener("paste", onPaste);
  };
}
