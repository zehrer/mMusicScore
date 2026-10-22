import { describe, expect, it } from "vitest";
import { durationForTicks, keyAlter, midi, nearestPitch, noteLabel, parseMelody, resolveAccidentals, splitMeasures } from "./music";

const song = (melody: string, fifths = 0) => ({ notes: parseMelody(melody), beats: 4, beatType: 4, fifths });

describe("music", () => {
  it("maps pitches to MIDI", () => {
    expect(midi(28, 0)).toBe(60);
    expect(midi(33, 0)).toBe(69);
    expect(midi(31, 1)).toBe(66);
  });

  it("knows key signatures", () => {
    expect(keyAlter(1, 3)).toBe(1); // F♯ in G major
    expect(keyAlter(1, 0)).toBe(0);
    expect(keyAlter(-2, 2)).toBe(-1); // E♭ in B♭ major
  });

  it("splits measures, a note crossing a bar line stays in its measure", () => {
    expect(splitMeasures(song("C4 D4 E4 F4 | G4/2 G4/2 | A4")).map((m) => [m.start, m.end])).toEqual([[0, 4], [4, 6], [6, 7]]);
    expect(splitMeasures(song("C4/2. D4/2 E4")).map((m) => [m.start, m.end])).toEqual([[0, 2], [2, 3]]);
  });

  it("carries accidentals through the measure and resets at the bar line", () => {
    const r = resolveAccidentals(song("F#4 F4 Fn4 F4 | F4"));
    expect(r.map((x) => x.actual)).toEqual([1, 1, 0, 0, 0]);
    expect(r.map((x) => x.shown)).toEqual([1, null, 0, null, null]);
  });

  it("follows the key signature", () => {
    const r = resolveAccidentals(song("F4 Fn4 F4 C4", 2));
    expect(r.map((x) => x.actual)).toEqual([1, 0, 0, 1]);
    expect(r.map((x) => x.shown)).toEqual([null, 0, null, null]);
  });

  it("picks the nearest octave for letter entry", () => {
    expect(nearestPitch(0, 33)).toBe(35); // A4 → C5
    expect(nearestPitch(4, 29)).toBe(32); // D4 → G4
  });

  it("finds durations for ticks", () => {
    expect(durationForTicks(48)).toEqual({ dur: 2, dots: 1 });
    expect(durationForTicks(16)).toEqual({ dur: 4, dots: 0 });
    expect(durationForTicks(20)).toEqual({ dur: 4, dots: 0 });
  });

  it("names notes in English and German", () => {
    expect([noteLabel(34, 0, "en"), noteLabel(34, -1, "en"), noteLabel(31, 1, "en")]).toEqual(["B", "B♭", "F♯"]);
    expect([noteLabel(34, 0, "de"), noteLabel(34, -1, "de"), noteLabel(31, 1, "de"), noteLabel(30, -1, "de"), noteLabel(33, -1, "de")]).toEqual(["H", "B", "Fis", "Es", "As"]);
  });
});
