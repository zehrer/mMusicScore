import { midi, noteLabel, octave, resolveAccidentals } from "../model/music";
import { fingering, type Hole } from "../model/recorder";
import { playingHere, playingHere2, setFingering, useStore } from "../model/store";
import type { Song } from "../model/types";
import { instrumentOf, voiceSong, type VoiceIndex } from "../model/voices";

/** Front holes 1–7: y position; 6 and 7 are double holes. */
const HOLES = [62, 86, 110, 150, 174, 198, 222];
const CX = 46;

/** The note of `song`'s voice `v` at index `i`, as written MIDI number and name. */
function noteAt(song: Song, v: VoiceIndex, i: number | null, style: "en" | "de") {
  const vs = voiceSong(song, v);
  const n = i !== null ? vs.notes[i] : undefined;
  if (!n) return null;
  if (n.rest) return { rest: true as const };
  const alter = resolveAccidentals(vs)[i!].actual;
  return { rest: false as const, midi: midi(n.pitch, alter), name: noteLabel(n.pitch, alter, style) + octave(n.pitch) };
}

function hole(state: Hole, x: number, y: number, r: number, key: string, side?: "left" | "right") {
  const fill = state === "closed" || (state === "half" && side === "left") ? "closed" : "open";
  return <circle key={key} className={`hole ${fill}`} cx={x} cy={y} r={r} />;
}

/**
 * A soprano recorder on the right that shows which holes to cover for the selected note, or for
 * the sounding one during playback (a voice with the recorder sound first).
 */
export function Recorder() {
  const song = useStore((s) => s.song);
  const voice = useStore((s) => s.voice);
  const sel = useStore((s) => s.sel);
  const style = useStore((s) => s.nameStyle);
  const system = useStore((s) => s.fingering);
  const playingSong = useStore((s) => s.playingSong);
  const p1 = useStore(playingHere);
  const p2 = useStore(playingHere2);

  let note = null;
  if (playingSong && (p1 !== null || p2 !== null)) {
    const order: VoiceIndex[] = instrumentOf(playingSong, 1) === "flute" && instrumentOf(playingSong, 0) !== "flute" ? [1, 0] : [0, 1];
    for (const v of order) note ??= noteAt(playingSong, v, v === 0 ? p1 : p2, style);
  } else note = noteAt(song, voice, sel, style);

  const holes = note && !note.rest ? fingering(note.midi, system) : null;
  const caption = !note ? "Select a note" : note.rest ? "Rest" : note.name;

  return (
    <aside className="recorder" aria-label="Recorder fingering">
      <div className="recorder-note">{caption}</div>
      <svg viewBox="0 0 92 300" width="92" height="300" className={holes ? "" : "none"}>
        {/* Head with the window, body, foot */}
        <path className="body" d="M34 4h24l-2 20h-20z" />
        <rect className="window" x="40" y="26" width="12" height="6" rx="1" />
        <path className="body" d="M35 24h22l-2 222h-18z" />
        <path className="body" d="M37 246h18l3 40h-24z" />
        {/* Thumb hole on the back, shown beside the body */}
        <text className="label" x="8" y="45">T</text>
        {hole(holes?.[0] ?? "open", 16, 41, 6, "t")}
        {holes?.[0] === "half" && <path className="half" d="M16 35a6 6 0 0 0 0 12z" />}
        {HOLES.map((y, k) => {
          const s = holes?.[k + 1] ?? "open";
          const label = <text key={`l${k}`} className="label" x="70" y={y + 4}>{k + 1}</text>;
          if (k < 5) return [hole(s, CX, y, 6.5, `h${k}`), label];
          // Double holes: closed covers both, half only the larger left one.
          return [hole(s, CX - 4.5, y, 4.2, `h${k}a`, "left"), hole(s, CX + 5, y, 3, `h${k}b`, "right"), label];
        })}
        <line className="hands" x1="22" x2="66" y1="130" y2="130" />
      </svg>
      {note && !note.rest && !holes && <div className="recorder-hint">Out of range (C4–C6)</div>}
      <div className="segmented fingering" role="group" aria-label="Fingering">
        <button className={system === "baroque" ? "on" : ""} title="Baroque (English) fingering" onClick={() => setFingering("baroque")}>
          Baroque
        </button>
        <button className={system === "german" ? "on" : ""} title="German fingering" onClick={() => setFingering("german")}>
          German
        </button>
      </div>
    </aside>
  );
}
