import { beforeEach, describe, expect, it } from "vitest";
import { fromJSON, songToJSON } from "./io";
import { emptySong, parseMelody } from "./music";
import { fromMusicXML, toMusicXML } from "./musicxml";
import { expand, setForm, splitSection } from "./sections";
import { addVoice, insertStep, openSong, removeVoice, select, setVoice, setVoiceMeta, undo, useStore } from "./store";
import type { Song } from "./types";

const pitches = (notes: { pitch: number }[]) => notes.map((n) => n.pitch);
const duet = (): Song => ({
  ...emptySong(),
  notes: parseMelody("C5 D5 E5 F5 | G5/2 G5/2"),
  second: { clef: "treble", instrument: "flute", notes: parseMelody("E4/2 F4/2 | G4/1") },
});

describe("second voice", () => {
  beforeEach(() => openSong({ ...emptySong(), notes: parseMelody("C4 D4") }));

  it("is added, edited and removed through the active voice", () => {
    addVoice();
    expect(useStore.getState().voice).toBe(1);
    insertStep(4); // G
    insertStep(5); // A
    const s = useStore.getState().song;
    expect(pitches(s.notes)).toEqual([28, 29]);
    expect(s.second!.notes).toHaveLength(2);
    setVoiceMeta({ clef: "bass", instrument: "flute" });
    expect(useStore.getState().song.second).toMatchObject({ clef: "bass", instrument: "flute" });
    expect(useStore.getState().song.clef).toBe("treble");
    setVoice(0);
    select(1);
    insertStep(2); // E after D in voice 1
    expect(pitches(useStore.getState().song.notes)).toEqual([28, 29, 30]);
    expect(useStore.getState().song.second!.notes).toHaveLength(2);
    undo();
    expect(useStore.getState().song.notes).toHaveLength(2);
    removeVoice();
    expect(useStore.getState().song.second).toBeUndefined();
    expect(useStore.getState().voice).toBe(0);
  });

  it("splits sections at the same moment in both voices", () => {
    const s = splitSection(duet(), 4, "B");
    const b = s.sections![1].id;
    expect(s.notes.map((n) => n.sec === b)).toEqual([false, false, false, false, true, true]);
    expect(s.second!.notes.map((n) => n.sec === b)).toEqual([false, false, true]);
    const ex = expand(setForm(s, [s.sections![0].id, b, b]));
    expect(pitches(ex.song.second!.notes)).toEqual([30, 31, 32, 32]);
    expect(ex.src2).toEqual([0, 1, 2, 2]);
  });

  it("survives JSON and MusicXML", () => {
    const song = duet();
    const [back] = fromJSON(songToJSON(song));
    expect(back.second).toMatchObject({ clef: "treble", instrument: "flute" });
    expect(pitches(back.second!.notes)).toEqual(pitches(song.second!.notes));
    const xml = toMusicXML({ ...song, second: { ...song.second!, clef: "bass", notes: parseMelody("C3/1") } });
    expect(xml.match(/<part id=/g)).toHaveLength(2);
    // The shorter part gets a whole-measure rest so both have two measures.
    expect(xml).toContain('<rest measure="yes"/>');
    const read = fromMusicXML(xml);
    expect(pitches(read.notes)).toEqual(pitches(song.notes));
    expect(read.second?.clef).toBe("bass");
    expect(pitches(read.second!.notes.filter((n) => !n.rest))).toEqual([21]);
  });
});
