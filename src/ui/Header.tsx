import { useState } from "react";
import { deleteSong } from "../model/persist";
import { change, deleteSelection, redo, selectAll, setNameStyle, setShowNames, setZoom, stepZoom, ZOOM_STEPS, setMeta, setShowPiano, undo, useStore } from "../model/store";
import * as A from "./actions";
import { About, Shortcuts } from "./Dialogs";
import { MenuList, type MenuItem } from "./Menu";

const { MOD } = A;

export function Header() {
  const [open, setOpen] = useState<number | null>(null);
  const s = useStore();
  const saved = s.songs.some((x) => x.id === s.song.id);

  const menus: { label: string; items: MenuItem[] }[] = [
    {
      label: "File",
      items: [
        { label: "New song", shortcut: "⌥N", action: A.newSong },
        { label: "Duplicate song", action: () => A.duplicateSong() },
        "-",
        { label: "Import (JSON, MusicXML)…", shortcut: `${MOD}O`, action: A.importFile },
        { label: "Add sample songs", action: A.addSamples },
        "-",
        { label: "Export song as MusicXML", action: () => A.exportMusicXML() },
        { label: "Export song as JSON", action: () => A.exportSongJSON() },
        { label: "Export song as HTML (view and play in any browser)", action: () => A.exportHTML() },
        { label: "Export whole library (JSON)", action: A.exportLibrary },
        "-",
        { label: "Print / save as PDF…", shortcut: `${MOD}P`, action: A.printScore },
        "-",
        {
          label: "Delete song…",
          disabled: !saved,
          action: () => confirm(`Delete "${s.song.title}" permanently?`) && deleteSong(s.song.id),
        },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: `${MOD}Z`, disabled: !s.undo.length, action: undo },
        { label: "Redo", shortcut: `⇧${MOD}Z`, disabled: !s.redo.length, action: redo },
        "-",
        { label: "Cut", shortcut: `${MOD}X`, disabled: s.sel === null, action: () => A.copySelection(true) },
        { label: "Copy", shortcut: `${MOD}C`, disabled: s.sel === null, action: () => A.copySelection() },
        { label: "Paste", shortcut: `${MOD}V`, action: A.pasteFromMenu },
        "-",
        { label: "Select all", shortcut: `${MOD}A`, disabled: !s.song.notes.length, action: selectAll },
        { label: s.anchor !== null && s.anchor !== s.sel ? "Delete notes" : "Delete note", shortcut: "⌫", disabled: s.sel === null, action: deleteSelection },
        {
          label: "Delete all notes…",
          disabled: !s.song.notes.length,
          action: () => confirm("Delete all notes of this song?") && change((song) => ({ ...song, notes: [] }), { sel: null }),
        },
      ],
    },
    {
      label: "Playback",
      items: [{ label: s.isPlaying ? "Stop" : s.sel !== null ? "Play from selection" : "Play", shortcut: "Space", disabled: !s.song.notes.length, action: A.togglePlay }],
    },
    {
      label: "View",
      items: [
        { label: `${s.showPiano ? "✓ " : "\u2003"}Piano`, action: () => setShowPiano(!s.showPiano) },
        { label: `${s.showNames ? "✓ " : "\u2003"}Note names`, action: () => setShowNames(!s.showNames) },
        { heading: "Note names" },
        { label: `${s.nameStyle === "en" ? "✓ " : "\u2003"}English (C D E F G A B, C♯, B♭)`, action: () => setNameStyle("en") },
        { label: `${s.nameStyle === "de" ? "✓ " : "\u2003"}German (C D E F G A H, Cis, B)`, action: () => setNameStyle("de") },
        "-",
        { heading: "Zoom" },
        { label: `${s.zoom === "width" ? "✓ " : "\u2003"}Fit width`, action: () => setZoom("width") },
        { label: `${s.zoom === "page" ? "✓ " : "\u2003"}Fit page`, action: () => setZoom("page") },
        ...ZOOM_STEPS.map((z) => ({
          label: `${s.zoom === z ? "✓ " : "\u2003"}${z * 100} %`,
          action: () => setZoom(z),
        })),
        "-",
        { label: "Zoom in", action: () => stepZoom(1) },
        { label: "Zoom out", action: () => stepZoom(-1) },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Keyboard shortcuts", shortcut: "?", action: () => useStore.setState({ dialog: "keys" }) },
        { label: "About mMusicScore", action: () => useStore.setState({ dialog: "about" }) },
      ],
    },
  ];

  return (
    <header className="header">
      <svg className="logo" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#0b57d0" />
        <path d="M13 23V8l11-3v15" stroke="white" strokeWidth="2.4" fill="none" />
        <ellipse cx="10" cy="23" rx="3.6" ry="2.8" fill="white" />
        <ellipse cx="21" cy="20" rx="3.6" ry="2.8" fill="white" />
      </svg>
      <div className="title-block">
        <div className="title-row">
          <input className="title" value={s.song.title} onChange={(e) => setMeta({ title: e.target.value })} aria-label="Title" />
          <input className="composer" value={s.song.composer} placeholder="Composer" onChange={(e) => setMeta({ composer: e.target.value })} aria-label="Composer" />
        </div>
        <nav className="menubar">
          {menus.map((m, i) => (
            <div key={m.label} className="menu-anchor">
              <button className={open === i ? "open" : ""} onClick={() => setOpen(open === i ? null : i)} onMouseEnter={() => open !== null && setOpen(i)}>
                {m.label}
              </button>
              {open === i && <MenuList items={m.items} onClose={() => setOpen(null)} />}
            </div>
          ))}
        </nav>
      </div>
      <span className="save-status" title={s.saveError ?? "Saved automatically in this browser"}>
        {s.saveError ? "⚠ Saving failed" : s.savedAt ? `Saved ${s.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Local in your browser"}
      </span>
      {s.dialog === "about" && <About onClose={() => useStore.setState({ dialog: null })} />}
      {s.dialog === "keys" && <Shortcuts onClose={() => useStore.setState({ dialog: null })} />}
    </header>
  );
}

