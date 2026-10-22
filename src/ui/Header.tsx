import { useState } from "react";
import { deleteSong } from "../model/persist";
import { change, deleteNote, redo, setMeta, undo, useStore } from "../model/store";
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
      label: "Datei",
      items: [
        { label: "Neues Lied", shortcut: "⌥N", action: A.newSong },
        { label: "Lied duplizieren", action: () => A.duplicateSong() },
        "-",
        { label: "Importieren (JSON, MusicXML)…", shortcut: `${MOD}O`, action: A.importFile },
        { label: "Beispiellieder hinzufügen", action: A.addSamples },
        "-",
        { label: "Lied exportieren als MusicXML", action: () => A.exportMusicXML() },
        { label: "Lied exportieren als JSON", action: () => A.exportSongJSON() },
        { label: "Ganze Bibliothek exportieren (JSON)", action: A.exportLibrary },
        "-",
        { label: "Drucken / als PDF sichern…", shortcut: `${MOD}P`, action: A.printScore },
        "-",
        {
          label: "Lied löschen…",
          disabled: !saved,
          action: () => confirm(`„${s.song.title}“ endgültig löschen?`) && deleteSong(s.song.id),
        },
      ],
    },
    {
      label: "Bearbeiten",
      items: [
        { label: "Rückgängig", shortcut: `${MOD}Z`, disabled: !s.undo.length, action: undo },
        { label: "Wiederholen", shortcut: `⇧${MOD}Z`, disabled: !s.redo.length, action: redo },
        "-",
        { label: "Note löschen", shortcut: "⌫", disabled: s.sel === null, action: () => deleteNote(s.sel!) },
        {
          label: "Alle Noten löschen…",
          disabled: !s.song.notes.length,
          action: () => confirm("Alle Noten dieses Liedes löschen?") && change((song) => ({ ...song, notes: [] }), { sel: null }),
        },
      ],
    },
    {
      label: "Wiedergabe",
      items: [{ label: s.isPlaying ? "Stopp" : s.sel !== null ? "Ab Auswahl abspielen" : "Abspielen", shortcut: "Leertaste", disabled: !s.song.notes.length, action: A.togglePlay }],
    },
    {
      label: "Ansicht",
      items: [50, 75, 100, 125, 150, 200].map((z) => ({
        label: `${Math.round(s.zoom * 100) === z ? "✓ " : " "}${z} %`,
        action: () => useStore.setState({ zoom: z / 100 }),
      })),
    },
    {
      label: "Hilfe",
      items: [
        { label: "Tastenkürzel", shortcut: "?", action: () => useStore.setState({ dialog: "keys" }) },
        { label: "Über mMusicScore", action: () => useStore.setState({ dialog: "about" }) },
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
          <input className="title" value={s.song.title} onChange={(e) => setMeta({ title: e.target.value })} aria-label="Titel" />
          <input className="composer" value={s.song.composer} placeholder="Komponist" onChange={(e) => setMeta({ composer: e.target.value })} aria-label="Komponist" />
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
      <span className="save-status" title={s.saveError ?? "Wird automatisch in diesem Browser gespeichert"}>
        {s.saveError ? "⚠ Speichern fehlgeschlagen" : s.savedAt ? `Gespeichert ${s.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Lokal im Browser"}
      </span>
      {s.dialog === "about" && <About onClose={() => useStore.setState({ dialog: null })} />}
      {s.dialog === "keys" && <Shortcuts onClose={() => useStore.setState({ dialog: null })} />}
    </header>
  );
}

