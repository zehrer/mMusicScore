import { useEffect, useState } from "react";
import { openSaved } from "../model/persist";
import { hasSections, setMode, setShowNames, setView, setZoom, useStore } from "../model/store";
import * as A from "./actions";
import { NamesIcon } from "./icons";

/** Browser full screen, where pages may use it (not on iPhone). */
function useFullscreen() {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  return { available: !!document.fullscreenEnabled, on, toggle };
}

/**
 * The bar of view mode: pick a song, play it, and switch to editing. On phones the app starts
 * here, so the score and the play button get the room. Song choice and New appear here only
 * while the song list on the left is hidden.
 */
export function ViewBar() {
  const s = useStore();
  const full = useFullscreen();
  const sectioned = hasSections(s.song);
  const known = s.songs.some((x) => x.id === s.song.id);
  return (
    <div className="view-bar">
      {!s.showLibrary && (
        <select className="song-pick" value={s.song.id} onChange={(e) => openSaved(e.target.value)} aria-label="Song">
          {!known && <option value={s.song.id}>{s.song.title || "Untitled"}</option>}
          {s.songs.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id === s.song.id ? s.song.title || "Untitled" : x.title || "Untitled"}
            </option>
          ))}
        </select>
      )}
      {!s.showLibrary && (
        <button
          className="new-song"
          title="New song (opens the editor)"
          onClick={() => {
            void A.newSong();
            setMode("edit");
          }}
        >
          ＋ New
        </button>
      )}
      <button className={`play big${s.isPlaying ? " on" : ""}`} disabled={!s.song.notes.length} onClick={A.togglePlay} title="Play / stop (Space); tap a note to start there">
        {s.isPlaying ? "■ Stop" : "▶ Play"}
      </button>
      <span className="view-tools">
        {sectioned && (
          <button className={s.view === "expanded" ? "on" : ""} title="Write the form out" onClick={() => setView(s.view === "expanded" ? "compact" : "expanded")}>
            Expanded
          </button>
        )}
        <button className={`icon-btn${s.showNames ? " on" : ""}`} title="Note names" aria-label="Note names" onClick={() => setShowNames(!s.showNames)}>
          <NamesIcon />
        </button>
        {full.available && (
          <button className={full.on ? "on" : ""} title={full.on ? "Leave full screen (Esc)" : "Full screen"} onClick={full.toggle}>
            {full.on ? "Exit full screen" : "⛶ Full screen"}
          </button>
        )}
        <button title={s.zoom === "page" ? "Fit the width" : "Show the whole page"} onClick={() => setZoom(s.zoom === "page" ? "width" : "page")}>
          {s.zoom === "page" ? "Fit width" : "Fit page"}
        </button>
      </span>
      <button className="edit-btn" onClick={() => setMode("edit")} title="Edit the song">
        ✎ Edit
      </button>
    </div>
  );
}
