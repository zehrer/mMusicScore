import { useMemo } from "react";
import { layoutScore, pitchY, S } from "../model/layout";
import { BOTTOM_LINE } from "../model/music";
import { openSaved } from "../model/persist";
import { stop } from "../model/playback";
import { useStore } from "../model/store";
import { Lyrics, NoteGlyph, Staff } from "./Score";

/** Visible part of the system around the sounding note, in score units. */
const VIEW_W = 300;
const VIEW_TOP = 5.5 * S;
const VIEW_H = 14.5 * S;

/**
 * While another song is open, a small window in the corner keeps showing the song that is playing:
 * the staff scrolls along with the sounding note.
 */
export function MiniPlayer() {
  const playingSong = useStore((s) => s.playingSong);
  const playing = useStore((s) => s.playing);
  const openId = useStore((s) => s.song.id);
  const layout = useMemo(() => playingSong && layoutScore(playingSong), [playingSong]);
  if (!playingSong || !layout || playingSong.id === openId) return null;

  const systems = layout.pages.flat();
  const i = playing ?? 0;
  const sys = systems.find((s) => i >= s.start && i < s.end) ?? systems[0];
  const measure = sys.measures.find((m) => i >= m.start && i < m.end);
  const bottom = BOTTOM_LINE[playingSong.clef];
  // Keep the note a third from the left, but never scroll past the start or end of the system.
  const left = Math.max(sys.x0 - S, Math.min((layout.noteX[i] ?? sys.x0) - VIEW_W / 3, sys.x1 + S - VIEW_W));
  const progress = playingSong.notes.length ? ((playing ?? 0) + 1) / playingSong.notes.length : 0;

  return (
    <div className="mini-player" role="status" aria-label="Now playing">
      <div className="mini-head">
        <span className="mini-eq" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="mini-title" title={playingSong.title}>
          {playingSong.title || "Untitled"}
        </span>
        <span className="mini-bar">{measure ? `Bar ${measure.number}` : ""}</span>
        <button title="Open this song" onClick={() => openSaved(playingSong.id)}>
          Open
        </button>
        <button title="Stop (Space)" onClick={stop}>
          ■
        </button>
      </div>
      <svg className="mini-staff" viewBox={`0 ${sys.y - VIEW_TOP} ${VIEW_W} ${VIEW_H}`} onClick={() => openSaved(playingSong.id)}>
        <g className="mini-scroll" style={{ transform: `translateX(${-left}px)` }}>
          <Staff sys={sys} song={playingSong} final={sys.end === playingSong.notes.length} />
          {playingSong.notes.slice(sys.start, sys.end).map((n, k) => {
            const j = sys.start + k;
            const y = n.rest ? sys.y + 2 * S : pitchY(sys, n.pitch, bottom);
            return (
              <g key={n.id} className={`note${j === playing ? " playing" : ""}`}>
                <NoteGlyph n={n} x={layout.noteX[j]} y={y} sys={sys} bottom={bottom} clef={playingSong.clef} shown={layout.accidentals[j].shown} />
              </g>
            );
          })}
          <Lyrics sys={sys} song={playingSong} noteX={layout.noteX} editing={null} />
        </g>
      </svg>
      <div className="mini-progress">
        <div style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
