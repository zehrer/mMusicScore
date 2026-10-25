import { midi, resolveAccidentals, ticks } from "./music";
import type { Instrument, Song } from "./types";
import { instrumentOf, onsets, voiceSong, type VoiceIndex } from "./voices";

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

const AudioCtor = () => (typeof window === "undefined" ? undefined : window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

/** The audio context, or null where the browser has no Web Audio (then the app stays silent). */
function audio(): AudioContext | null {
  const Ctor = AudioCtor();
  if (!Ctor) return null;
  playbackCategory();
  ctx ??= new Ctor();
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
 * A flute-like note: a nearly pure tone with a little second and third harmonic, breath noise
 * that puffs at the start and then stays faint, a soft attack, and a vibrato that sets in after
 * a moment. Unlike the piano it holds its volume until released.
 *
 * Self-contained on purpose: the HTML export embeds this function's source to sound the same.
 */
export function fluteTone(ac: AudioContext, out: AudioNode, m: number, at: number, len: number): () => void {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const end = at + Math.max(len, 0.08);
  const nodes: AudioScheduledSourceNode[] = [];

  const body = ac.createGain();
  body.gain.setValueAtTime(0.0001, at);
  body.gain.linearRampToValueAtTime(0.2, at + 0.06);
  body.gain.setTargetAtTime(0.16, at + 0.06, 0.15);
  body.gain.setTargetAtTime(0.0001, end, 0.05);
  const soft = ac.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = Math.min(12000, f * 5);
  soft.connect(body).connect(out);

  // Vibrato: about 5 Hz, fading in after the attack.
  const lfo = ac.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = ac.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.setValueAtTime(0, at + 0.18);
  depth.gain.linearRampToValueAtTime(f * 0.005, at + 0.55);
  lfo.connect(depth);
  lfo.start(at);
  lfo.stop(end + 0.4);
  nodes.push(lfo);

  [
    [1, 1],
    [2, 0.22],
    [3, 0.08],
  ].forEach(([h, amp]) => {
    const o = ac.createOscillator();
    o.frequency.value = f * h;
    const g = ac.createGain();
    g.gain.value = amp;
    // The vibrato bends every harmonic by the same share of its pitch.
    const d = ac.createGain();
    d.gain.value = h;
    depth.connect(d).connect(o.frequency);
    o.connect(g).connect(soft);
    o.start(at);
    o.stop(end + 0.4);
    nodes.push(o);
  });

  // Breath: band-passed noise, a puff at the start, then a faint hiss.
  const n = Math.ceil(ac.sampleRate * 0.5);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = Math.min(9000, f * 2);
  band.Q.value = 0.8;
  const breath = ac.createGain();
  breath.gain.setValueAtTime(0.0001, at);
  breath.gain.linearRampToValueAtTime(0.12, at + 0.03);
  breath.gain.setTargetAtTime(0.025, at + 0.03, 0.08);
  breath.gain.setTargetAtTime(0.0001, end, 0.04);
  noise.connect(band).connect(breath).connect(out);
  noise.start(at);
  noise.stop(end + 0.4);
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

/** Plays one note right away in the given sound, e.g. when it is entered or moved. */
export function auditionWith(instrument: Instrument, m: number) {
  const ac = audio();
  if (!ac) return;
  (instrument === "flute" ? fluteTone : pianoTone)(ac, ac.destination, m, ac.currentTime, 0.6);
}

/**
 * iOS starts audio only from a completed tap (touchend or click), not from pointerdown, which the
 * piano and note entry use; the first tap anywhere therefore wakes the audio context up.
 */
export function unlockAudioOnFirstTap() {
  const unlock = () => {
    const Ctor = AudioCtor();
    if (Ctor) {
      ctx ??= new Ctor();
      if (ctx.state !== "running") void ctx.resume();
    }
    document.removeEventListener("touchend", unlock);
    document.removeEventListener("click", unlock);
  };
  document.addEventListener("touchend", unlock);
  document.addEventListener("click", unlock);
}

/**
 * Plays the song from note `from`. `onNote` gets the index of each note as it starts, `onEnd` runs
 * at the end or when stopped.
 */
/** Sounding note of each voice (null when the voice is silent or over). */
export type Playing = [number | null, number | null];

/**
 * Plays the song from tick `from` (time from the start), both voices together, each with its own
 * sound. `onNote` gets the sounding note of each voice whenever one changes, `onEnd` runs at the
 * end or when stopped.
 */
export function play(song: Song, from: number, onNote: (p: Playing) => void, onEnd: () => void) {
  stop();
  const ac = audio();
  if (!ac) return onEnd();
  const master = ac.createGain();
  master.connect(ac.destination);
  const tickSec = 60 / song.tempo / 16;
  const start = ac.currentTime + 0.08;
  const stops: (() => void)[] = [];
  const voices = (song.second ? [0, 1] : [0]) as VoiceIndex[];
  // Per voice: start time and index of every scheduled note, and when the voice falls silent.
  const tracks = voices.map((v) => {
    const vs = voiceSong(song, v);
    const tone = instrumentOf(song, v) === "flute" ? fluteTone : pianoTone;
    const resolved = resolveAccidentals(vs);
    const times: number[] = [];
    const idx: number[] = [];
    const at = onsets(vs.notes);
    let end = start;
    vs.notes.forEach((n, i) => {
      if (at[i] < from) return;
      const t = start + (at[i] - from) * tickSec;
      const len = ticks(n) * tickSec;
      times.push(t);
      idx.push(i);
      end = t + len;
      const next = vs.notes[i + 1];
      const restAfter = next?.rest ? ticks(next) * tickSec : 0;
      if (!n.rest) stops.push(tone(ac, master, midi(n.pitch, resolved[i].actual), t, holdTime(len, restAfter)));
    });
    return { times, idx, end };
  });
  const end = Math.max(start, ...tracks.map((t) => t.end));
  let raf = 0;
  let last = "";
  const tick = () => {
    const now = ac.currentTime;
    if (now >= end) return finish();
    const cur = tracks.map(({ times, idx, end: e }) => {
      if (now < start || now >= e || !times.length || times[0] > now) return null;
      let k = times.length - 1;
      while (k > 0 && times[k] > now) k--;
      return idx[k];
    });
    const p: Playing = [cur[0] ?? null, cur[1] ?? null];
    const key = p.join();
    if (key !== last && (p[0] !== null || p[1] !== null)) onNote(p);
    last = key;
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
