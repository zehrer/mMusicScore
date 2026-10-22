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


/** A soft, slightly plucked tone: triangle plus a quiet octave, with a decaying envelope. */
/**
 * How long a key is held: a little short of the note's length, so repeated notes are struck
 * again; before a rest the note rings on into it and fades there instead of stopping dead.
 * Self-contained: the HTML export embeds its source.
 */
export function holdTime(len: number, restAfter: number): number {
  return restAfter > 0 ? len + Math.min(restAfter * 0.6, 1.5) : len * 0.95;
}

/**
 * A piano-like note: a few slightly stretched overtones (as on real strings) that fade faster the
 * higher they are, a short hammer knock, a tone that darkens while it decays, and a damper that
 * stops it when the key is released after `len` seconds. Low notes ring longer than high ones.
 *
 * Self-contained on purpose: the HTML export embeds this function's source to sound the same.
 */
export function pianoTone(ac: AudioContext, out: AudioNode, m: number, at: number, len: number): () => void {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const ring = Math.max(0.7, 4.2 - (m - 40) * 0.07);
  const end = at + len;
  const nodes: AudioScheduledSourceNode[] = [];

  const body = ac.createGain();
  body.gain.setValueAtTime(0.0001, at);
  body.gain.exponentialRampToValueAtTime(0.32, at + 0.004);
  // Damper: a soft release of a few tenths of a second, not a hard cut.
  body.gain.setTargetAtTime(0.0001, end, 0.12);
  const tone = ac.createBiquadFilter();
  tone.type = "lowpass";
  tone.Q.value = 0.4;
  tone.frequency.setValueAtTime(Math.min(16000, f * 10), at);
  tone.frequency.setTargetAtTime(Math.min(6000, f * 3), at + 0.02, ring * 0.25);
  tone.connect(body).connect(out);

  for (let n = 1; n <= 7; n++) {
    const pf = f * n * Math.sqrt(1 + 0.0004 * n * n);
    if (pf > 18000) break;
    const o = ac.createOscillator();
    o.frequency.value = pf;
    // A whisper of detune on the fundamental, like the two or three strings of a piano note.
    if (n === 1) o.detune.value = 1.5;
    const g = ac.createGain();
    const amp = (n === 1 ? 1 : 0.55 / Math.pow(n, 1.2)) * (m > 84 ? 0.7 : 1);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.003);
    g.gain.setTargetAtTime(0.0001, at + 0.003, ring / (1 + 0.8 * (n - 1)) / 4);
    o.connect(g).connect(tone);
    o.start(at);
    o.stop(end + 1.2);
    nodes.push(o);
  }

  // Hammer: 25 ms of filtered noise.
  const len25 = Math.ceil(ac.sampleRate * 0.025);
  const buf = ac.createBuffer(1, len25, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len25; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len25);
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = Math.min(8000, f * 4);
  band.Q.value = 1.2;
  const ng = ac.createGain();
  ng.gain.value = 0.12;
  noise.connect(band).connect(ng).connect(body);
  noise.start(at);
  nodes.push(noise);

  return () =>
    nodes.forEach((x) => {
      try {
        x.stop();
      } catch {
        /* already stopped */
      }
    });
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
  pianoTone(ac, ac.destination, m, ac.currentTime, 0.6);
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
    const next = song.notes[i + 1];
    const restAfter = next?.rest ? ticks(next) * tickSec : 0;
    if (!n.rest) stops.push(pianoTone(ac, master, midi(n.pitch, resolved[i].actual), t, holdTime(len, restAfter)));
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
