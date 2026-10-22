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
          <button className="primary">Schließen</button>
        </footer>
      </form>
    </dialog>
  );
}

/** Hilfe → Über: version and how the app keeps data. */
export function About({ onClose }: { onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <h3>mMusicScore</h3>
      <p className="version">
        Version {__APP_VERSION__} · Build {__APP_BUILD__}
      </p>
      <p>Ein einfaches Notensatzprogramm für einstimmige Melodien, das vollständig im Browser läuft.</p>
      <h4>Deine Lieder bleiben in diesem Browser</h4>
      <p>
        Es gibt keinen Server und kein Konto. Die Lieder werden nur im Speicher dieses Browsers (IndexedDB) auf diesem Gerät
        abgelegt; nichts wird hochgeladen.
      </p>
      <p>
        Deshalb werden sie auch nicht mit anderen Browsern oder Geräten abgeglichen, und das Löschen der Websitedaten löscht
        sie. Mit <b>Datei → Ganze Bibliothek exportieren</b> sicherst du sie oder nimmst sie mit.
      </p>
      <p className="hint">Notenschrift: Bravura von Steinberg (SIL Open Font License).</p>
    </Dialog>
  );
}

const KEYS: [string, string][] = [
  ["Klick ins Notensystem", "Note (oder Pause) an dieser Stelle einfügen"],
  ["Klick auf eine Note", "Auswählen; ziehen ändert die Tonhöhe"],
  ["C D E F G A H", "Note nach der Auswahl einfügen, in der nächstgelegenen Oktave"],
  ["R oder 0", "Pause nach der Auswahl einfügen"],
  ["3 4 5 6 7", "Sechzehntel, Achtel, Viertel, Halbe, Ganze"],
  [".", "Punktierung an/aus"],
  ["↑ ↓", "Tonhöhe um eine Stufe ändern"],
  [`${MOD}↑ ${MOD}↓`, "Um eine Oktave verschieben"],
  ["# oder +   b oder -   =", "Kreuz, Be, Auflösungszeichen (erneut drücken entfernt es)"],
  ["← →", "Vorherige / nächste Note auswählen"],
  ["⌫ Entf", "Ausgewählte Note löschen"],
  ["Esc", "Auswahl aufheben"],
  ["Leertaste", "Abspielen ab Auswahl / Stopp"],
  [`${MOD}Z  ⇧${MOD}Z`, "Rückgängig / Wiederholen"],
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <Dialog onClose={onClose} className="keys">
      <h3>Bedienung</h3>
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
