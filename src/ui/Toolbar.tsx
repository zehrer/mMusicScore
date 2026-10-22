import { DURATION_NAMES, DURATIONS, KEY_NAMES, pitchName, resolveAccidentals } from "../model/music";
import { editLyric, redo, setDuration, setMeta, setShowNames, setShowPiano, setZoom, stepZoom, ZOOM_STEPS, toggleAlter, toggleDot, toggleRest, undo, useStore } from "../model/store";
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
      <button title={`Undo (${MOD}Z)`} disabled={!s.undo.length} onClick={undo}>
        ↶
      </button>
      <button title={`Redo (⇧${MOD}Z)`} disabled={!s.redo.length} onClick={redo}>
        ↷
      </button>
      <span className="sep" />
      <div className="segmented" role="group" aria-label="Note value">
        {DURATIONS.map((d, k) => (
          <button key={d} className={`mus-btn${input.dur === d ? " on" : ""}`} title={`${DURATION_NAMES[d]} (${7 - k})`} onClick={() => setDuration(d)}>
            <span className="mus-icon">{input.rest ? REST[d] : NOTE_ICON[d]}</span>
          </button>
        ))}
      </div>
      <button className={`mus-btn${input.dots ? " on" : ""}`} title="Dot (.)" onClick={toggleDot}>
        <span className="dot-icon">•</span>
      </button>
      <button className={`mus-btn${input.rest ? " on" : ""}`} title="Rest instead of note (R)" onClick={toggleRest}>
        <span className="mus-icon">{REST[4]}</span>
      </button>
      <span className="sep" />
      {alterBtn(1, "Sharp", "#")}
      {alterBtn(-1, "Flat", "-")}
      {alterBtn(0, "Natural", "=")}
      <span className="sep" />
      <button
        className={s.lyricEdit !== null ? "on" : ""}
        title="Lyrics: type text under the notes (L)"
        disabled={!song.notes.length}
        onClick={() => editLyric(s.lyricEdit !== null ? null : (s.sel ?? 0))}
      >
        Lyrics
      </button>
      <button className={s.showNames ? "on" : ""} title="Show note names above the staff (naming: View menu)" onClick={() => setShowNames(!s.showNames)}>
        Names
      </button>
      <button className={s.showPiano ? "on" : ""} title="Show piano" onClick={() => setShowPiano(!s.showPiano)}>
        Piano
      </button>
      <span className="sep" />
      <button className={`play${s.isPlaying ? " on" : ""}`} title="Play / stop (Space)" disabled={!song.notes.length} onClick={A.togglePlay}>
        {s.isPlaying ? "■ Stop" : "▶ Play"}
      </button>
      <span className="sep" />
      <label title="Clef">
        <select value={song.clef} onChange={(e) => setMeta({ clef: e.target.value as "treble" | "bass" })}>
          <option value="treble">Treble clef</option>
          <option value="bass">Bass clef</option>
        </select>
      </label>
      <label title="Key signature">
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
      <label title="Time signature">
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
      <label className="tempo-input" title="Tempo (quarter notes per minute)">
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
      <span className="sep" />
      <div className="zoom" role="group" aria-label="Zoom">
        <button title="Zoom out" disabled={s.viewZoom <= ZOOM_STEPS[0] + 0.01} onClick={() => stepZoom(-1)}>
          −
        </button>
        <select
          title="Zoom"
          value={String(s.zoom)}
          onChange={(e) => {
            const v = e.target.value;
            setZoom(v === "width" || v === "page" ? v : Number(v));
          }}
        >
          <option value="width">Fit width{s.zoom === "width" ? ` · ${Math.round(s.viewZoom * 100)} %` : ""}</option>
          <option value="page">Fit page{s.zoom === "page" ? ` · ${Math.round(s.viewZoom * 100)} %` : ""}</option>
          {ZOOM_STEPS.map((z) => (
            <option key={z} value={String(z)}>
              {z * 100} %
            </option>
          ))}
          {typeof s.zoom === "number" && !ZOOM_STEPS.includes(s.zoom) && <option value={String(s.zoom)}>{Math.round(s.zoom * 100)} %</option>}
        </select>
        <button title="Zoom in" disabled={s.viewZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.01} onClick={() => stepZoom(1)}>
          +
        </button>
      </div>
      <span className="spacer" />
      <span className="sel-info">{s.anchor !== null && s.anchor !== s.sel ? `${Math.abs(s.anchor - s.sel!) + 1} notes selected` : n ? `${n.rest ? "Rest" : pitchName(n.pitch, resolveAccidentals(song)[s.sel!].actual)} · ${DURATION_NAMES[n.dur]}${n.dots ? " dotted" : ""}` : ""}</span>
    </div>
  );
}
