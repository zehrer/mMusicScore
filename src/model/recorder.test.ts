import { describe, expect, it } from "vitest";
import { fingering, RECORDER_RANGE } from "./recorder";

describe("recorder fingering", () => {
  it("closes every hole for the lowest note and opens all but the thumb for B", () => {
    expect(fingering(60)).toEqual(Array(8).fill("closed"));
    expect(fingering(71)).toEqual(["closed", "closed", ...Array(6).fill("open")]);
  });

  it("pinches the thumb in the upper octave", () => {
    expect(fingering(76)![0]).toBe("half");
  });

  it("uses German fingering for F only where asked", () => {
    expect(fingering(65)!.join()).toBe("closed,closed,closed,closed,closed,open,closed,closed");
    expect(fingering(65, "german")!.join()).toBe("closed,closed,closed,closed,closed,open,open,open");
    expect(fingering(67, "german")).toEqual(fingering(67));
  });

  it("knows nothing outside the range", () => {
    expect(fingering(RECORDER_RANGE[0] - 1)).toBeNull();
    expect(fingering(RECORDER_RANGE[1] + 1)).toBeNull();
  });
});
