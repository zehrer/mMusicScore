import type { Alter, Duration } from "../model/types";

/** SMuFL code points, drawn with the Bravura font (font size = 4 staff spaces). */
export const G = {
  gClef: "",
  fClef: "",
  noteheadWhole: "",
  noteheadHalf: "",
  noteheadBlack: "",
  flag8thUp: "",
  flag8thDown: "",
  flag16thUp: "",
  flag16thDown: "",
  dot: "",
  timeSig: (n: number) =>
    String(n)
      .split("")
      .map((d) => String.fromCharCode(0xe080 + Number(d)))
      .join(""),
};

export const REST: Record<Duration, string> = { 1: "", 2: "", 4: "", 8: "", 16: "" };
export const ACCIDENTAL: Record<Alter, string> = { [-1]: "", 0: "", 1: "" };
/** Note values as single glyphs (stem up) for buttons. */
export const NOTE_ICON: Record<Duration, string> = { 1: "", 2: "", 4: "", 8: "", 16: "" };
