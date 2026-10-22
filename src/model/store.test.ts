import { beforeEach, describe, expect, it } from "vitest";
import { emptySong, parseMelody } from "./music";
import { deleteLast, deleteSelection, openSong, pasteNotes, select, selectedNotes, selRange, setDuration, undo, useStore } from "./store";

const names = () => useStore.getState().song.notes.map((n) => n.pitch);

describe("range selection", () => {
  beforeEach(() => openSong({ ...emptySong(), notes: parseMelody("C4 D4 E4 F4 G4") }));

  it("extends from the anchor with shift, either direction", () => {
    select(3);
    select(1, true);
    expect(selRange(useStore.getState())).toEqual([1, 3]);
    select(4, true);
    expect(selRange(useStore.getState())).toEqual([3, 4]);
    select(0);
    expect(selRange(useStore.getState())).toEqual([0, 0]);
  });

  it("pastes copies after the selection and selects them", () => {
    select(0);
    select(1, true);
    const copied = selectedNotes();
    select(4);
    pasteNotes(copied);
    expect(names()).toEqual([28, 29, 30, 31, 32, 28, 29]);
    expect(selRange(useStore.getState())).toEqual([5, 6]);
    const ids = useStore.getState().song.notes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("changes and deletes the whole range in one undo step", () => {
    select(1);
    select(3, true);
    setDuration(8);
    expect(useStore.getState().song.notes.map((n) => n.dur)).toEqual([4, 8, 8, 8, 4]);
    deleteSelection();
    expect(names()).toEqual([28, 32]);
    expect(useStore.getState().sel).toBe(0);
    undo();
    expect(names()).toEqual([28, 29, 30, 31, 32]);
  });

  it("deletes backwards by gesture: the selection, then the note before", () => {
    select(2);
    deleteLast();
    expect(names()).toEqual([28, 29, 31, 32]);
    deleteLast();
    expect(names()).toEqual([28, 31, 32]);
    select(null);
    deleteLast();
    expect(names()).toEqual([28, 31]);
    expect(useStore.getState().toast?.undo).toBe(true);
  });
});
