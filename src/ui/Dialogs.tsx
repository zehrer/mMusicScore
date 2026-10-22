import { useEffect, useRef, type ReactNode } from "react";
import { MOD } from "./actions";

function Dialog({ onClose, className, children }: { onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog ref={ref} className={`dialog ${className ?? ""}`} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <form method="dialog">
        {children}
        <footer>
          <button className="primary">Close</button>
        </footer>
      </form>
    </dialog>
  );
}

/** Help → About: version and how the app keeps data. */
export function About({ onClose }: { onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <h3>mMusicScore</h3>
      <p className="version">
        Version {__APP_VERSION__} · build {__APP_BUILD__}
      </p>
      <p>A simple music notation editor for single-line melodies that runs entirely in the browser.</p>
      <h4>Your songs stay in this browser</h4>
      <p>
        There is no server and no account. Songs are saved only in this browser's storage (IndexedDB) on this device;
        nothing is uploaded.
      </p>
      <p>
        This also means they are not synced to other browsers or devices, and clearing this site's data deletes them. Use{" "}
        <b>File → Export whole library</b> to keep a backup or to move them.
      </p>
      <p className="hint">Music font: Bravura by Steinberg (SIL Open Font License).</p>
    </Dialog>
  );
}

const KEYS: [string, string][] = [
  ["Click on the staff", "Insert a note (or rest) at that position"],
  ["Click a note", "Select it; drag to change its pitch"],
  ["C D E F G A B", "Insert a note after the selection, in the nearest octave"],
  ["R or 0", "Insert a rest after the selection"],
  ["Piano key", "Insert that note after the selection (View → Piano shows or hides it)"],
  ["L", "Type lyrics under the selected note: Space or Tab goes to the next note, - joins syllables, Enter or Esc stops"],
  ["3 4 5 6 7", "Sixteenth, eighth, quarter, half, whole"],
  [".", "Dot on/off"],
  ["↑ ↓", "Move up / down one step"],
  [`${MOD}↑ ${MOD}↓`, "Move by an octave"],
  ["# or +   -   =", "Sharp, flat, natural (press again to remove it)"],
  ["← →", "Select previous / next note"],
  ["Shift+click   ⇧← ⇧→", "Select several notes; ↑ ↓, note values, dot and accidentals then change all of them"],
  [`${MOD}C  ${MOD}X  ${MOD}V`, "Copy, cut, paste (pasted after the selection, also into another song)"],
  [`${MOD}A`, "Select all notes"],
  ["⌫ Del", "Delete the selected notes"],
  ["Esc", "Clear the selection"],
  ["Space", "Play from the selection / stop"],
  [`${MOD}Z  ⇧${MOD}Z`, "Undo / redo"],
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <Dialog onClose={onClose} className="keys">
      <h3>Keyboard and mouse</h3>
      <table>
        <tbody>
          {KEYS.map(([k, v]) => (
            <tr key={k}>
              <td>
                <kbd>{k}</kbd>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
