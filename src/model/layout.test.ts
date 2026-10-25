import { describe, expect, it } from "vitest";
import { insertIndex, layoutScore, MARGIN_X, PAGE_W } from "./layout";
import { emptySong, parseMelody } from "./music";
import { addSection, splitSection } from "./sections";
import { sampleSongs } from "./samples";

describe("layout", () => {
  it("offers an empty measure to append to in an empty song", () => {
    const l = layoutScore(emptySong());
    expect(l.pages).toHaveLength(1);
    expect(l.pages[0][0].measures).toEqual([expect.objectContaining({ extra: true, start: 0, end: 0 })]);
  });

  it("breaks long songs into justified systems and pages", () => {
    const s = { ...emptySong(), notes: parseMelody(Array(400).fill("C4/8").join(" ")) };
    const l = layoutScore(s);
    expect(l.pages.length).toBeGreaterThan(1);
    const sys = l.pages[0][0];
    const last = sys.measures[sys.measures.length - 1];
    expect(last.x + last.width).toBeCloseTo(PAGE_W - MARGIN_X);
    // Notes run left to right.
    for (let i = 1; i < sys.end; i++) expect(l.noteX[i]).toBeGreaterThan(l.noteX[i - 1]);
  });

  it("inserts before the note right of the click", () => {
    const s = sampleSongs()[0];
    const l = layoutScore(s);
    const sys = l.pages[0][0];
    expect(insertIndex(sys, l.noteX, l.noteX[2] - 10)).toBe(2);
    expect(insertIndex(sys, l.noteX, PAGE_W)).toBe(sys.end);
  });

  it("starts every section on a new system with its label, empty ones too", () => {
    const split = splitSection({ ...emptySong(), notes: parseMelody("C4 D4 E4 F4 G4 A4 B4 C5") }, 4, "Chorus");
    const { song, id } = addSection(split, "Bridge");
    const systems = layoutScore(song).pages.flat();
    expect(systems.map((s) => [s.start, s.end, s.label])).toEqual([
      [0, 4, null],
      [4, 8, "Chorus"],
      [8, 8, "Bridge"],
    ]);
    expect(systems[2].section).toBe(id);
    expect(systems[2].measures[0].extra).toBe(true);
  });
});

describe("layout with a second voice", () => {
  const two = (a: string, b: string) => ({ ...emptySong(), notes: parseMelody(a), second: { clef: "bass" as const, notes: parseMelody(b) } });

  it("puts notes that sound together above each other", () => {
    const l = layoutScore(two("C4/2 D4/2 | E4/1", "C3 D3 E3 F3 | G3/1"));
    expect(l.noteX[0]).toBe(l.noteX2[0]);
    expect(l.noteX[1]).toBe(l.noteX2[2]);
    expect(l.noteX[2]).toBe(l.noteX2[4]);
    // Quarter notes in between get their own places.
    expect(l.noteX2[1]).toBeGreaterThan(l.noteX[0]);
    expect(l.noteX2[1]).toBeLessThan(l.noteX[1]);
    const sys = l.pages[0][0];
    expect(sys.y2).toBeGreaterThan(sys.y + 40);
    expect(sys.measures.map((m) => [m.start, m.end, m.start2, m.end2, !!m.last])).toEqual([
      [0, 2, 0, 4, false],
      [2, 3, 4, 5, true],
      [3, 3, 5, 5, false],
    ]);
  });

  it("gives a shorter second voice empty measures to fill", () => {
    const l = layoutScore(two("C4/1 | D4/1", "C3/1"));
    const ms = l.pages[0][0].measures;
    expect(ms.map((m) => [m.start2, m.end2, !!m.extra])).toEqual([
      [0, 1, false],
      [1, 1, false],
      [1, 1, true],
    ]);
  });
});
