import { DURATION_NAMES, DURATIONS, KEY_NAMES, pitchName, resolveAccidentals } from "../model/music";
import { addVoice, editLyric, redo, setMode, setVoice, setVoiceMeta, setDuration, setMeta, setShowNames, setShowPiano, setZoom, stepZoom, ZOOM_STEPS, toggleAlter, toggleDot, toggleRest, undo, useStore } from "../model/store";
import type { Alter, Instrument } from "../model/types";
import { instrumentOf, voiceSong } from "../model/voices";
import * as A from "./actions";
import { ACCIDENTAL, NOTE_ICON, REST } from "./glyphs";
import { LyricsIcon, NamesIcon, PianoIcon } from "./icons";
import { MOD } from "./actions";
import { PlayVoicesSelect } from "./PlayVoices";

const TIMES = ["2/4", "3/4", "4/4", "5/4", "6/8", "3/8", "9/8", "12/8", "2/2"];

export function Toolbar() {
  const s = useStore();
  const { input } = s;
  // Notes, clef and sound of the voice being edited.
  const song = voiceSong(s.song, s.voice);
  const n = s.sel !== null ? song.notes[s.sel] : undefined;
  const hasNotes = s.song.notes.length > 0 || !!s.song.second?.notes.length;
  const note = n && !n.rest;
  const time = `${song.beats}/${song.beatType}`;
  const alterBtn = (a: Alter, title: string, key: string) => (
    <button className={`mus-btn${note && n.alter === a ? " on" : ""}`} disabled={!note} title={`${title} (${key})`} onClick={() => toggleAlter(a)}>
      <span className="mus-icon">{ACCIDENTAL[a]}</span>
    </button>
  );

  return (
    <div className="toolbar">
      <button className="view-btn" title="View mode: read and play, no editing" onClick={() => setMode("view")}>
        View
      </button>
      <span className="sep" />
      {s.song.second ? (
        <div className="segmented voices" role="group" aria-label="Voice being edited">
          {([0, 1] as const).map((v) => (
            <button key={v} className={s.voice === v ? "on" : ""} title={`Edit voice ${v + 1}`} onClick={() => setVoice(v)}>
              {v + 1}
            </button>
          ))}
        </div>
      ) : (
        <button className="add-voice" title="Add a second voice on its own staff" onClick={addVoice}>
          ＋ Voice
        </button>
      )}
      <span className="sep" />
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
        className={`icon-btn${s.lyricEdit !== null ? " on" : ""}`}
        title="Lyrics: type text under the notes (L)"
        aria-label="Lyrics"
        disabled={!song.notes.length}
        onClick={() => editLyric(s.lyricEdit !== null ? null : (s.sel ?? 0))}
      >
        <LyricsIcon />
      </button>
      <button className={`icon-btn${s.showNames ? " on" : ""}`} title="Note names above the staff (naming: View menu)" aria-label="Note names" onClick={() => setShowNames(!s.showNames)}>
        <NamesIcon />
      </button>
      <button className={`icon-btn${s.showPiano ? " on" : ""}`} title="Piano" aria-label="Piano" onClick={() => setShowPiano(!s.showPiano)}>
        <PianoIcon />
      </button>
      <span className="sep" />
      <button className={`play${s.isPlaying ? " on" : ""}`} title="Play / stop (Space)" disabled={!hasNotes} onClick={A.togglePlay}>
        {s.isPlaying ? "■ Stop" : "▶ Play"}
      </button>
      <PlayVoicesSelect />
      <span className="sep" />
      <label title={s.song.second ? `Clef of voice ${s.voice + 1}` : "Clef"}>
        <select value={song.clef} onChange={(e) => setVoiceMeta({ clef: e.target.value as "treble" | "bass" })}>
          <option value="treble">Treble clef</option>
          <option value="bass">Bass clef</option>
        </select>
      </label>
      <label title={s.song.second ? `Sound of voice ${s.voice + 1}` : "Sound"}>
        <select value={instrumentOf(s.song, s.voice)} onChange={(e) => setVoiceMeta({ instrument: e.target.value as Instrument })}>
          <option value="piano">Piano</option>
          <option value="flute">Recorder</option>
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
