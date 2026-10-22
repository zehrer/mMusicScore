import { midi, resolveAccidentals, ticks } from "./music";
import type { Song } from "./types";

let ctx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;

function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
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
