import { useEffect } from "react";
import { DURATIONS } from "../model/music";
import { deleteNote, insertRest, insertStep, moveSelected, redo, select, setDuration, toggleAlter, toggleDot, undo, useStore } from "../model/store";
import * as A from "./actions";
import { Header } from "./Header";
import { Library } from "./Library";
import { Score } from "./Score";
import { Toolbar } from "./Toolbar";

/** Note names; H is accepted as B, as in German. */
const STEP_KEYS: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6, h: 6 };

function onKey(e: KeyboardEvent) {
  if ((e.target instanceof Element && e.target.closest("input, select, textarea, dialog")) || e.defaultPrevented) return;
  const { sel, song } = useStore.getState();
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key;
  const handled = () => e.preventDefault();

  if (mod) {
    if (k.toLowerCase() === "z") (e.shiftKey ? redo() : undo(), handled());
    else if (k === "y") (redo(), handled());
    else if (k === "o") (A.importFile(), handled());
    else if (k === "p") (A.printScore(), handled());
    else if (k === "ArrowUp") (moveSelected(7), handled());
    else if (k === "ArrowDown") (moveSelected(-7), handled());
    return;
  }
  if (e.altKey && e.code === "KeyN") return void (A.newSong(), handled());
  if (e.altKey) return;

  if (STEP_KEYS[k.toLowerCase()] !== undefined) return void (insertStep(STEP_KEYS[k.toLowerCase()]), handled());
  switch (k) {
    case "r":
    case "R":
    case "0":
      return void (insertRest(), handled());
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
      return void (setDuration(DURATIONS[7 - Number(k)]), handled());
    case ".":
      return void (toggleDot(), handled());
    case "#":
    case "+":
      return void (toggleAlter(1), handled());
    case "-":
      return void (toggleAlter(-1), handled());
    case "=":
      return void (toggleAlter(0), handled());
    case "ArrowUp":
      return void (moveSelected(1), handled());
    case "ArrowDown":
      return void (moveSelected(-1), handled());
    case "ArrowLeft":
      if (song.notes.length) select(sel === null ? song.notes.length - 1 : Math.max(0, sel - 1));
      return handled();
    case "ArrowRight":
      if (song.notes.length) select(sel === null ? 0 : Math.min(song.notes.length - 1, sel + 1));
      return handled();
    case "Backspace":
    case "Delete":
      if (sel !== null) deleteNote(sel);
      return handled();
    case "Escape":
      return void select(null);
    case " ":
      return void (A.togglePlay(), handled());
    case "?":
      return void useStore.setState({ dialog: "keys" });
  }
}

export function App() {
  useEffect(() => {
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="app">
      <Header />
      <Toolbar />
      <main>
        <Library />
        <Score />
      </main>
    </div>
  );
}
