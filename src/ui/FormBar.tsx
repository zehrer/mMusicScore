import { useState } from "react";
import { formOf, sectionRange, sectionsOf } from "../model/sections";
import { changeForm, hasSections, newSection, removeSection, renameSectionTo, select, setView, splitAtSelection, useStore } from "../model/store";
import type { Song } from "../model/types";
import { MenuList, type MenuItem } from "./Menu";

const nameOf = (song: Song, id: string) => {
  const secs = sectionsOf(song);
  const i = secs.findIndex((s) => s.id === id);
  return secs[i]?.name || `Section ${i + 1}`;
};

/**
 * Sections and form: each section is written once; the form lists the order they are played in,
 * with repeats. Chips can be dragged to reorder; a click opens their menu.
 */
export function FormBar() {
  const song = useStore((s) => s.song);
  const view = useStore((s) => s.view);
  const sel = useStore((s) => s.sel);
  const [menu, setMenu] = useState<{ items: MenuItem[]; x: number; y: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const sectioned = hasSections(song);
  const form = formOf(song);
  const secs = sectionsOf(song);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= form.length) return;
    const next = [...form];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    changeForm(next);
  };
  const ask = (title: string, value: string) => {
    const name = prompt(title, value);
    return name === null ? null : name.trim();
  };
  const at = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: r.left, y: r.bottom + 4 };
  };

  const chipMenu = (p: number): MenuItem[] => {
    const id = form[p];
    return [
      { heading: nameOf(song, id) },
      {
        label: "Go to section",
        disabled: sectionRange(song, id)[0] === sectionRange(song, id)[1],
        action: () => {
          setView("compact");
          select(sectionRange(song, id)[0]);
        },
      },
      { label: "Play it again after this", action: () => changeForm([...form.slice(0, p + 1), id, ...form.slice(p + 1)]) },
      { label: "Move left", disabled: p === 0, action: () => move(p, p - 1) },
      { label: "Move right", disabled: p === form.length - 1, action: () => move(p, p + 1) },
      { label: "Remove from form", action: () => changeForm(form.filter((_, q) => q !== p)) },
      "-",
      {
        label: "Rename section…",
        action: () => {
          const name = ask("Section name", nameOf(song, id));
          if (name !== null) renameSectionTo(id, name);
        },
      },
      {
        label: "Delete section and its notes…",
        disabled: secs.length < 2,
        action: () => confirm(`Delete "${nameOf(song, id)}" with all its notes? It is removed from the form too.`) && removeSection(id),
      },
    ];
  };
  const addMenu = (): MenuItem[] => [
    { heading: "Add to the end of the form" },
    ...secs.map((s, i) => ({ label: s.name || `Section ${i + 1}`, action: () => changeForm([...form, s.id]) })),
  ];

  return (
    <div className="form-bar">
      <div className="segmented" role="group" aria-label="View">
        <button className={view === "compact" || !sectioned ? "on" : ""} title="Each section once, as written" onClick={() => setView("compact")}>
          Compact
        </button>
        <button className={view === "expanded" && sectioned ? "on" : ""} disabled={!sectioned} title="The whole song in the order of the form" onClick={() => setView("expanded")}>
          Expanded
        </button>
      </div>
      <span className="form-label">Form</span>
      <div className="form-chips">
        {!sectioned && <span className="form-hint">Select the first note of a chorus and choose “Split at selection” to make it a section.</span>}
        {sectioned &&
          form.map((id, p) => (
            <button
              key={`${id}-${p}`}
              className={`chip${dragFrom === p ? " dragging" : ""}`}
              draggable
              onDragStart={(e) => {
                setDragFrom(p);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(p));
              }}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                move(Number(e.dataTransfer.getData("text/plain")), p);
                setDragFrom(null);
              }}
              onClick={(e) => setMenu({ items: chipMenu(p), ...at(e) })}
              title="Click for options, drag to reorder"
            >
              {nameOf(song, id)}
            </button>
          ))}
        {sectioned && (
          <button className="chip add" title="Add a section to the form" onClick={(e) => setMenu({ items: addMenu(), ...at(e) })}>
            +
          </button>
        )}
      </div>
      <span className="spacer" />
      <button
        className="form-action"
        disabled={sel === null}
        title="Start a new section at the selected note; the song still sounds the same"
        onClick={() => {
          const name = ask("Name of the new section (e.g. Chorus)", "Chorus");
          if (name !== null) splitAtSelection(name);
        }}
      >
        Split at selection
      </button>
      <button
        className="form-action"
        title="Add an empty section at the end"
        onClick={() => {
          const name = ask("Name of the new section", "Bridge");
          if (name !== null) newSection(name);
        }}
      >
        ＋ New section
      </button>
      {menu && <MenuList items={menu.items} at={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
