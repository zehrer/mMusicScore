/**
 * Fingerings of a soprano recorder, by written note: it sounds an octave higher, so the lowest
 * hole pattern (everything closed) is the written C4.
 */

/** Thumb (back), then holes 1–7 from the top; 6 and 7 are double holes. */
export type Hole = "closed" | "open" | "half";
export type FingeringSystem = "baroque" | "german";

const LOWEST = 60; // written C4
const H: Record<string, Hole> = { x: "closed", o: "open", h: "half" };

// T1234567; for the thumb "h" means pinched (half open), for 6 and 7 one of the two holes.
const BAROQUE = [
  "xxxxxxxx", // C
  "xxxxxxxh", // C♯
  "xxxxxxxo", // D
  "xxxxxxho", // D♯
  "xxxxxxoo", // E
  "xxxxxoxx", // F
  "xxxxoxxo", // F♯
  "xxxxoooo", // G
  "xxxoxxho", // G♯
  "xxxooooo", // A
  "xxoxxooo", // B♭
  "xxoooooo", // B
  "xoxooooo", // C
  "oxxooooo", // C♯
  "ooxooooo", // D
  "ooxxxxxo", // D♯
  "hxxxxxoo", // E
  "hxxxxoxo", // F
  "hxxxoxoo", // F♯
  "hxxxoooo", // G
  "hxxoxooo", // G♯
  "hxxooooo", // A
  "hxxoxxxo", // B♭
  "hxxoxxoo", // B
  "hxooxxoo", // C
];

/** German fingering differs in the F and F♯ of both octaves. */
const GERMAN: Record<number, string> = { 5: "xxxxxooo", 6: "xxxxoxxx", 17: "hxxxxooo" };

/** Range of written notes the chart covers (MIDI numbers). */
export const RECORDER_RANGE = [LOWEST, LOWEST + BAROQUE.length - 1] as const;

/** The holes for a written MIDI note, or null outside the range. */
export function fingering(midi: number, system: FingeringSystem = "baroque"): Hole[] | null {
  const k = midi - LOWEST;
  const pattern = (system === "german" && GERMAN[k]) || BAROQUE[k];
  return pattern ? [...pattern].map((c) => H[c]) : null;
}
