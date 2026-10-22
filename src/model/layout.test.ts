import { describe, expect, it } from "vitest";
import { insertIndex, layoutScore, MARGIN_X, PAGE_W } from "./layout";
import { emptySong, parseMelody } from "./music";
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
});
