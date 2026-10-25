import { describe, expect, it } from "vitest";
import { fluteTone, holdTime, pianoTone } from "./playback";

/** Just enough of the Web Audio API to see what a note schedules. */
function fakeAudio() {
  const log: string[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} });
  const node = (kind: string) => ({
    kind,
    gain: param(),
    frequency: param(),
    detune: param(),
    Q: param(),
    type: "",
    buffer: null as unknown,
    connect(n: unknown) {
      return n;
    },
    start(at: number) {
      log.push(`${kind} start ${at}`);
    },
    stop() {
      log.push(`${kind} stop`);
    },
  });
  const ac = {
    sampleRate: 8000,
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createOscillator: () => node("osc"),
    createBufferSource: () => node("noise"),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  };
  return { ac: ac as unknown as AudioContext, log };
}

describe("piano sound", () => {
  it("strikes overtones and a hammer, and can be stopped", () => {
    const { ac, log } = fakeAudio();
    const stop = pianoTone(ac, {} as AudioNode, 60, 1, 0.5);
    expect(log.filter((l) => l === "osc start 1")).toHaveLength(7);
    expect(log).toContain("noise start 1");
    log.length = 0;
    stop();
    expect(log.filter((l) => l.endsWith("stop")).length).toBe(8);
  });

  it("has fewer overtones for very high notes", () => {
    const { ac, log } = fakeAudio();
    pianoTone(ac, {} as AudioNode, 108, 0, 0.2);
    expect(log.filter((l) => l.startsWith("osc start")).length).toBeLessThan(7);
  });

  it("works as embedded source, as in the HTML export", () => {
    const fn = new Function(`return ${pianoTone.toString()}`)() as typeof pianoTone;
    const { ac, log } = fakeAudio();
    fn(ac, {} as AudioNode, 72, 0, 0.3);
    expect(log.some((l) => l.startsWith("osc start"))).toBe(true);
  });

  it("lets a note ring into a following rest, otherwise releases just before the next", () => {
    expect(holdTime(0.5, 0)).toBeCloseTo(0.475);
    expect(holdTime(0.5, 0.5)).toBeCloseTo(0.8);
    expect(holdTime(0.5, 4)).toBeCloseTo(2);
    expect(new Function(`return ${holdTime.toString()}`)()(0.5, 0.5)).toBeCloseTo(0.8);
  });

  it("plays a flute: three harmonics, vibrato and breath, also as embedded source", () => {
    for (const fn of [fluteTone, new Function(`return ${fluteTone.toString()}`)() as typeof fluteTone]) {
      const { ac, log } = fakeAudio();
      const stop = fn(ac, {} as AudioNode, 72, 0, 0.5);
      expect(log.filter((l) => l === "osc start 0")).toHaveLength(4); // 3 harmonics + vibrato
      expect(log).toContain("noise start 0");
      log.length = 0;
      stop();
      expect(log.filter((l) => l.endsWith("stop"))).toHaveLength(5);
    }
  });
});
