import { midi, octave, resolveAccidentals, step } from "../model/music";
import { insertPitch, playingHere, useStore } from "../model/store";
import type { Alter } from "../model/types";

const WHITE_W = 26;
const WHITE_H = 92;
const BLACK_W = 16;
const BLACK_H = 58;
/** Steps (C = 0) with a black key to their right. */
const HAS_BLACK = [0, 1, 3, 4, 5];

type Key = { pitch: number; alter: Alter; midi: number; x: number; black: boolean };

/** Three octaves around the clef's range, plus the top C. */
function keys(lowest: number, fifths: number): Key[] {
  const white: Key[] = [];
  const black: Key[] = [];
  for (let k = 0; k <= 21; k++) {
    const pitch = lowest + k;
    white.push({ pitch, alter: 0, midi: midi(pitch, 0), x: k * WHITE_W, black: false });
    if (k < 21 && HAS_BLACK.includes(step(pitch))) {
      // Spell black keys with flats in flat keys, with sharps otherwise.
      const key = fifths < 0 ? { pitch: pitch + 1, alter: -1 as Alter } : { pitch, alter: 1 as Alter };
      black.push({ ...key, midi: midi(pitch, 1), x: (k + 1) * WHITE_W - BLACK_W / 2, black: true });
    }
  }
  return [...white, ...black];
}

/** A small keyboard below the score: a click enters the note after the selection. */
export function Piano() {
  const song = useStore((s) => s.song);
  const sel = useStore((s) => s.sel);
  const playing = useStore(playingHere);
  const lowest = song.clef === "bass" ? 14 : 21; // C2 or C3
  const resolved = resolveAccidentals(song);
  const lit = new Set(
    [playing ?? sel].filter((i): i is number => i !== null && !!song.notes[i] && !song.notes[i].rest).map((i) => midi(song.notes[i].pitch, resolved[i].actual)),
  );
  const all = keys(lowest, song.fifths);
  const width = 22 * WHITE_W;

  return (
    <div className="piano">
      <svg viewBox={`0 0 ${width + 1} ${WHITE_H + 1}`} width={width + 1} height={WHITE_H + 1} role="group" aria-label="Piano">
        {all.map((k) => (
          <g
            key={`${k.midi}-${k.black}`}
            className={`key ${k.black ? "black" : "white"}${lit.has(k.midi) ? " lit" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              insertPitch(k.pitch, k.alter);
            }}
          >
            <rect x={k.x + 0.5} y={0.5} width={k.black ? BLACK_W : WHITE_W} height={k.black ? BLACK_H : WHITE_H} rx={k.black ? 2 : 3} />
            {!k.black && step(k.pitch) === 0 && (
              <text x={k.x + WHITE_W / 2 + 0.5} y={WHITE_H - 8} textAnchor="middle">
                C{octave(k.pitch)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
