import { midi, resolveAccidentals, ticks } from "./music";
import type { Song } from "./types";

let ctx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;

/**
 * On iPhone and iPad, Web Audio is silent while the ring/silent switch is on, unless the page
 * asks to be a media player. iOS 17+ has navigator.audioSession for that; older versions switch
 * when an <audio> element plays, so a silent one loops while the page is visible.
 */
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let silent: HTMLAudioElement | null = null;

function silentWav() {
  // 0.1 s of 8-bit mono silence at 8 kHz.
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, n, true);
  b.fill(128, 44);
  return "data:audio/wav;base64," + btoa(String.fromCharCode(...b));
}

function playbackCategory() {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = "playback";
    } catch {
      /* not allowed here */
    }
    return;
  }
  if (!isIOS()) return;
  if (!silent) {
    silent = Object.assign(new Audio(silentWav()), { loop: true });
    silent.setAttribute("playsinline", "");
    document.addEventListener("visibilitychange", () => (document.hidden ? silent?.pause() : void silent?.play().catch(() => {})));
  }
  void silent.play().catch(() => {});
}

function audio() {
  playbackCategory();
  ctx ??= new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
  if (ctx.state !== "running") void ctx.resume();
  return ctx;
}

const freq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** A soft, slightly plucked tone: triangle plus a quiet octave, with a decaying envelope. */
function tone(ac: AudioContext, out: AudioNode, m: number, at: number, len: number) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.32, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.14, at + Math.min(0.25, len * 0.6));
  gain.gain.setValueAtTime(0.14, at + Math.max(0.02, len - 0.05));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.08);
  gain.connect(out);
  const oscs = [
    { type: "triangle" as OscillatorType, f: freq(m), g: 1 },
    { type: "sine" as OscillatorType, f: freq(m) * 2, g: 0.18 },
  ].map(({ type, f, g }) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const og = ac.createGain();
    og.gain.value = g;
    o.connect(og).connect(gain);
    o.start(at);
    o.stop(at + len + 0.1);
    return o;
  });
  return () => oscs.forEach((o) => o.stop());
}

/**
 * iOS starts audio only from a completed tap (touchend or click), not from pointerdown, which the
 * piano and note entry use; the first tap anywhere therefore wakes the audio context up.
 */
export function unlockAudioOnFirstTap() {
  const unlock = () => {
    ctx ??= new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    if (ctx.state !== "running") void ctx.resume();
    document.removeEventListener("touchend", unlock);
    document.removeEventListener("click", unlock);
  };
  document.addEventListener("touchend", unlock);
  document.addEventListener("click", unlock);
}

/** Plays one note right away, e.g. when it is entered or moved. */
export function audition(m: number) {
  const ac = audio();
  tone(ac, ac.destination, m, ac.currentTime, 0.35);
}

/**
 * Plays the song from note `from`. `onNote` gets the index of each note as it starts, `onEnd` runs
 * at the end or when stopped.
 */
export function play(song: Song, from: number, onNote: (i: number) => void, onEnd: () => void) {
  stop();
  const ac = audio();
  const master = ac.createGain();
  master.connect(ac.destination);
  const tickSec = 60 / song.tempo / 16;
  const resolved = resolveAccidentals(song);
  const start = ac.currentTime + 0.08;
  const times: number[] = [];
  const stops: (() => void)[] = [];
  let t = start;
  for (let i = from; i < song.notes.length; i++) {
    const n = song.notes[i];
    const len = ticks(n) * tickSec;
    times.push(t);
    if (!n.rest) stops.push(tone(ac, master, midi(n.pitch, resolved[i].actual), t, len * 0.92));
    t += len;
  }
  const end = t;
  let raf = 0;
  let last = -2;
  const tick = () => {
    const now = ac.currentTime;
    if (now >= end) return finish();
    let k = times.length - 1;
    while (k > 0 && times[k] > now) k--;
    const idx = now < start ? -1 : from + k;
    if (idx !== last && idx >= 0) onNote(idx);
    last = idx;
    raf = requestAnimationFrame(tick);
  };
  const finish = () => {
    cancelAnimationFrame(raf);
    master.gain.setTargetAtTime(0, ac.currentTime, 0.02);
    setTimeout(() => {
      stops.forEach((s) => {
        try {
          s();
        } catch {
          /* already stopped */
        }
      });
      master.disconnect();
    }, 120);
    stopCurrent = null;
    onEnd();
  };
  stopCurrent = finish;
  raf = requestAnimationFrame(tick);
}

export function stop() {
  stopCurrent?.();
}

export const isPlaying = () => stopCurrent !== null;
