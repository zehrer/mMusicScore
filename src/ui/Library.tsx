import { useState } from "react";
import { openSaved } from "../model/persist";
import { closeLibraryOnPhone, useStore } from "../model/store";
import type { SongInfo } from "../model/types";
import * as A from "./actions";
import { MenuList } from "./Menu";

/** The song database: every song saved in this browser. */
export function Library() {
  const songs = useStore((s) => s.songs);
  const current = useStore((s) => s.song);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ info: SongInfo; x: number; y: number } | null>(null);
  // The open song shows its live title before the next autosave.
  const list = songs.some((s) => s.id === current.id) ? songs.map((s) => (s.id === current.id ? { ...s, title: current.title, composer: current.composer } : s)) : songs;
  const q = query.trim().toLowerCase();
  const shown = q ? list.filter((s) => `${s.title} ${s.composer}`.toLowerCase().includes(q)) : list;

  const withSong = async (info: SongInfo, fn: () => unknown) => {
    await openSaved(info.id);
    fn();
  };

  return (
    <aside className="library">
      <div className="library-head">
        <h2>Songs</h2>
        <button
          className="new"
          onClick={() => {
            void A.newSong();
            closeLibraryOnPhone();
          }}
          title="New song"
        >
          ＋ New
        </button>
      </div>
      <input className="search" type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {shown.map((s) => (
          <li
            key={s.id}
            className={s.id === current.id ? "on" : ""}
            onClick={() => {
              void openSaved(s.id);
              closeLibraryOnPhone();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ info: s, x: e.clientX, y: e.clientY });
            }}
          >
            <div className="song-name">{s.title || "Untitled"}</div>
            <div className="song-meta">
              {s.composer && <span>{s.composer} · </span>}
              {new Date(s.updatedAt).toLocaleDateString()}
            </div>
            <button
              className="more"
              title="More actions"
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                setMenu({ info: s, x: r.left, y: r.bottom });
              }}
            >
              ⋯
            </button>
          </li>
        ))}
        {!shown.length && <li className="empty">{q ? "No matches" : "No songs yet"}</li>}
      </ul>
      <div className="library-foot">
        <button onClick={A.importFile}>Import…</button>
        <button onClick={A.exportLibrary} disabled={!songs.length}>
          Export
        </button>
      </div>
      {menu && (
        <MenuList
          at={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "Open", action: () => openSaved(menu.info.id) },
            { label: "Duplicate", action: () => withSong(menu.info, () => A.duplicateSong()) },
            { label: "Export as MusicXML", action: () => withSong(menu.info, () => A.exportMusicXML()) },
            { label: "Export as JSON", action: () => withSong(menu.info, () => A.exportSongJSON()) },
            { label: "Export as HTML", action: () => withSong(menu.info, () => A.exportHTML()) },
            "-",
            { label: "Delete…", action: () => A.confirmDelete(menu.info.id, menu.info.title) },
          ]}
        />
      )}
    </aside>
  );
}
