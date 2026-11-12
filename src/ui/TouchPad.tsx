import { DURATION_NAMES, DURATIONS } from "../model/music";
import { cur, deleteLast, insertRest, redo, setDuration, stepSelection, toggleDot, undo, useStore } from "../model/store";
import { NOTE_ICON, REST } from "./glyphs";

/**
 * iPad: the keyboard's note entry as big buttons above the piano – note value, dot, rest,
 * cursor left/right, delete, undo. Pitches come from the piano keys below.
 */
export function TouchPad() {
  const input = useStore((s) => s.input);
  const canUndo = useStore((s) => s.undo.length > 0);
  const canRedo = useStore((s) => s.redo.length > 0);
  useStore((s) => s.song);
  const hasNotes = cur().notes.length > 0;
  return (
    <div className="touch-pad" role="toolbar" aria-label="Note entry">
      <div className="group">
        <button title="Previous note" aria-label="Previous note" disabled={!hasNotes} onClick={() => stepSelection(-1)}>
          ◀
        </button>
        <button title="Next note" aria-label="Next note" disabled={!hasNotes} onClick={() => stepSelection(1)}>
          ▶
        </button>
      </div>
      <div className="group">
        {DURATIONS.map((d) => (
          <button key={d} className={input.dur === d ? "on" : ""} title={DURATION_NAMES[d]} aria-label={DURATION_NAMES[d]} onClick={() => setDuration(d)}>
            <span className="mus-icon">{input.rest ? REST[d] : NOTE_ICON[d]}</span>
          </button>
        ))}
        <button className={input.dots ? "on" : ""} title="Dot" aria-label="Dot" onClick={toggleDot}>
          <span className="dot-icon">•</span>
        </button>
      </div>
      <div className="group">
        <button className="wide" title="Insert a rest" onClick={insertRest}>
          <span className="mus-icon">{REST[input.dur]}</span> Rest
        </button>
        <button className="wide" title="Delete the selected note, or the last one" disabled={!hasNotes} onClick={deleteLast}>
          ⌫
        </button>
      </div>
      <div className="group">
        <button title="Undo" aria-label="Undo" disabled={!canUndo} onClick={undo}>
          ↶
        </button>
        <button title="Redo" aria-label="Redo" disabled={!canRedo} onClick={redo}>
          ↷
        </button>
      </div>
    </div>
  );
}
