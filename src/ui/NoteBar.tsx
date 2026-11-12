import { cur, deleteLast, moveSelected, select, toggleAlter, useStore } from "../model/store";
import type { Alter } from "../model/types";
import { ACCIDENTAL } from "./glyphs";

/**
 * iPad: big buttons below the selected note to change it with the finger – pitch, octave,
 * accidental, delete. (`x`, `y`: where it sits in the scrolling score, below the note's staff.)
 */
export function NoteBar({ x, y }: { x: number; y: number }) {
  const sel = useStore((s) => s.sel);
  useStore((s) => s.song); // follow edits of the note
  const n = sel !== null ? cur().notes[sel] : undefined;
  if (!n) return null;
  const note = !n.rest;
  const alter = (a: Alter, title: string) => (
    <button className={n.alter === a ? "on" : ""} disabled={!note} title={title} aria-label={title} onClick={() => toggleAlter(a)}>
      <span className="mus-icon">{ACCIDENTAL[a]}</span>
    </button>
  );
  return (
    // pointerdown stays here: it must not reach the paper, which clears the selection.
    <div className="note-bar" style={{ left: x, top: y }} role="toolbar" aria-label="Change note" onPointerDown={(e) => e.stopPropagation()}>
      <button disabled={!note} title="Step up" aria-label="Step up" onClick={() => moveSelected(1)}>
        ▲
      </button>
      <button disabled={!note} title="Step down" aria-label="Step down" onClick={() => moveSelected(-1)}>
        ▼
      </button>
      <span className="sep" />
      <button disabled={!note} title="Octave up" aria-label="Octave up" onClick={() => moveSelected(7)}>
        8<small>▲</small>
      </button>
      <button disabled={!note} title="Octave down" aria-label="Octave down" onClick={() => moveSelected(-7)}>
        8<small>▼</small>
      </button>
      <span className="sep" />
      {alter(1, "Sharp")}
      {alter(-1, "Flat")}
      {alter(0, "Natural")}
      <span className="sep" />
      <button className="danger" title="Delete" aria-label="Delete" onClick={deleteLast}>
        🗑
      </button>
      <button title="Done (deselect)" aria-label="Done" onClick={() => select(null)}>
        ✕
      </button>
    </div>
  );
}
