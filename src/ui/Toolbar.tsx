import { DURATION_NAMES, DURATIONS, KEY_NAMES, pitchName, resolveAccidentals } from "../model/music";
import { redo, setDuration, setMeta, toggleAlter, toggleDot, toggleRest, undo, useStore } from "../model/store";
import type { Alter } from "../model/types";
import * as A from "./actions";
import { ACCIDENTAL, NOTE_ICON, REST } from "./glyphs";
import { MOD } from "./actions";

const TIMES = ["2/4", "3/4", "4/4", "5/4", "6/8", "3/8", "9/8", "12/8", "2/2"];

export function Toolbar() {
  const s = useStore();
  const { input, song } = s;
  const n = s.sel !== null ? song.notes[s.sel] : undefined;
  const note = n && !n.rest;
  const time = `${song.beats}/${song.beatType}`;
  const alterBtn = (a: Alter, title: string, key: string) => (
    <button className={`mus-btn${note && n.alter === a ? " on" : ""}`} disabled={!note} title={`${title} (${key})`} onClick={() => toggleAlter(a)}>
      <span className="mus-icon">{ACCIDENTAL[a]}</span>
    </button>
  );

  return (
    <div className="toolbar">
      <button title={`Rückgängig (${MOD}Z)`} disabled={!s.undo.length} onClick={undo}>
        ↶
      </button>
      <button title={`Wiederholen (⇧${MOD}Z)`} disabled={!s.redo.length} onClick={redo}>
        ↷
      </button>
      <span className="sep" />
      <div className="segmented" role="group" aria-label="Notenwert">
        {DURATIONS.map((d, k) => (
          <button key={d} className={`mus-btn${input.dur === d ? " on" : ""}`} title={`${DURATION_NAMES[d]} (${7 - k})`} onClick={() => setDuration(d)}>
            <span className="mus-icon">{input.rest ? REST[d] : NOTE_ICON[d]}</span>
          </button>
        ))}
      </div>
      <button className={`mus-btn${input.dots ? " on" : ""}`} title="Punktierung (.)" onClick={toggleDot}>
        <span className="dot-icon">•</span>
      </button>
      <button className={`mus-btn${input.rest ? " on" : ""}`} title="Pause statt Note (R)" onClick={toggleRest}>
        <span className="mus-icon">{REST[4]}</span>
      </button>
      <span className="sep" />
      {alterBtn(1, "Kreuz", "#")}
      {alterBtn(-1, "Be", "b")}
      {alterBtn(0, "Auflösungszeichen", "=")}
      <span className="sep" />
      <button className={`play${s.isPlaying ? " on" : ""}`} title="Abspielen / Stopp (Leertaste)" disabled={!song.notes.length} onClick={A.togglePlay}>
        {s.isPlaying ? "■ Stopp" : "▶ Abspielen"}
      </button>
      <span className="sep" />
      <label title="Schlüssel">
        <select value={song.clef} onChange={(e) => setMeta({ clef: e.target.value as "treble" | "bass" })}>
          <option value="treble">Violinschlüssel</option>
          <option value="bass">Bassschlüssel</option>
        </select>
      </label>
      <label title="Tonart">
        <select value={song.fifths} onChange={(e) => setMeta({ fifths: Number(e.target.value) })}>
          {Object.entries(KEY_NAMES)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([f, name]) => (
              <option key={f} value={f}>
                {name}
              </option>
            ))}
        </select>
      </label>
      <label title="Taktart">
        <select
          value={time}
          onChange={(e) => {
            const [beats, beatType] = e.target.value.split("/").map(Number);
            setMeta({ beats, beatType });
          }}
        >
          {(TIMES.includes(time) ? TIMES : [time, ...TIMES]).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="tempo-input" title="Tempo (Viertel pro Minute)">
        ♩=
        <input
          type="number"
          min={20}
          max={300}
          value={song.tempo}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= 20 && v <= 300) setMeta({ tempo: Math.round(v) });
          }}
        />
      </label>
      <span className="spacer" />
      <span className="sel-info">{n ? `${n.rest ? "Pause" : pitchName(n.pitch, resolveAccidentals(song)[s.sel!].actual)} · ${DURATION_NAMES[n.dur]}${n.dots ? " punktiert" : ""}` : ""}</span>
    </div>
  );
}
