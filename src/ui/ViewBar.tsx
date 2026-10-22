import { openSaved } from "../model/persist";
import { hasSections, setMode, setShowNames, setView, setZoom, useStore } from "../model/store";
import * as A from "./actions";

/**
 * The bar of view mode: pick a song, play it, and switch to editing. On phones the app starts
 * here, so the score and the play button get the room.
 */
export function ViewBar() {
  const s = useStore();
  const sectioned = hasSections(s.song);
  const known = s.songs.some((x) => x.id === s.song.id);
  return (
    <div className="view-bar">
      <select className="song-pick" value={s.song.id} onChange={(e) => openSaved(e.target.value)} aria-label="Song">
        {!known && <option value={s.song.id}>{s.song.title || "Untitled"}</option>}
        {s.songs.map((x) => (
          <option key={x.id} value={x.id}>
            {x.id === s.song.id ? s.song.title || "Untitled" : x.title || "Untitled"}
          </option>
        ))}
      </select>
      <button className={`play big${s.isPlaying ? " on" : ""}`} disabled={!s.song.notes.length} onClick={A.togglePlay} title="Play / stop (Space); tap a note to start there">
        {s.isPlaying ? "■ Stop" : "▶ Play"}
      </button>
      <span className="view-tools">
        {sectioned && (
          <button className={s.view === "expanded" ? "on" : ""} title="Write the form out" onClick={() => setView(s.view === "expanded" ? "compact" : "expanded")}>
            Expanded
          </button>
        )}
        <button className={s.showNames ? "on" : ""} title="Note names" onClick={() => setShowNames(!s.showNames)}>
          Names
        </button>
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
