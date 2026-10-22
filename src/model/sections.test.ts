import { describe, expect, it } from "vitest";
import { emptySong, parseMelody, splitMeasures } from "./music";
import { addSection, deleteSection, expand, formOf, renameSection, sectionRange, setForm, splitSection, withVerse } from "./sections";
import type { Song } from "./types";

const song = (melody: string): Song => ({ ...emptySong(), notes: parseMelody(melody) });
const pitches = (s: Song) => s.notes.map((n) => n.pitch);

describe("sections", () => {
  it("treats a song without sections as one section played once", () => {
    const s = song("C4 D4 E4");
    expect(formOf(s)).toHaveLength(1);
    expect(expand(s).song.notes.map((n) => n.pitch)).toEqual([28, 29, 30]);
  });

  it("splits a section so the song sounds the same", () => {
    const s = splitSection(song("C4 D4 E4 F4 | G4 A4"), 4, "Chorus");
    expect(s.sections!.map((x) => x.name)).toEqual(["", "Chorus"]);
    expect(sectionRange(s, s.sections![1].id)).toEqual([4, 6]);
    expect(pitches(expand(s).song)).toEqual(pitches(s));
  });

  it("plays sections in the order of the form, with repeats", () => {
    let s = splitSection(song("C4 D4 | G4 A4"), 2, "Chorus");
    const [verse, chorus] = s.sections!.map((x) => x.id);
    s = setForm(s, [verse, chorus, verse, chorus, chorus]);
    const ex = expand(s);
    expect(pitches(ex.song)).toEqual([28, 29, 32, 33, 28, 29, 32, 33, 32, 33]);
    expect(ex.src).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 2, 3]);
    expect(new Set(ex.song.notes.map((n) => n.id)).size).toBe(10);
    expect(ex.song.sections!.map((x) => x.name)).toEqual(["", "Chorus", "", "Chorus", "Chorus"]);
  });

  it("starts each section with a new measure", () => {
    const s = splitSection(song("C4 D4 E4 F4 G4 A4"), 2, "B");
    expect(splitMeasures(s).map((m) => [m.start, m.end])).toEqual([[0, 2], [2, 6]]);
  });

  it("sings verse n on the n-th repeat, a single-verse chorus each time", () => {
    let s = splitSection(song("C4 D4 | G4"), 2, "Chorus");
    s = { ...s, notes: s.notes.map((n, i) => (i === 0 ? withVerse(withVerse(n, 0, "one"), 1, "two") : i === 2 ? withVerse(n, 0, "la") : n)) };
    const [verse, chorus] = s.sections!.map((x) => x.id);
    s = setForm(s, [verse, chorus, verse, chorus]);
    expect(expand(s).song.notes.map((n) => n.lyric ?? "")).toEqual(["one", "", "la", "two", "", "la"]);
  });

  it("adds, renames and deletes sections", () => {
    const { song: s1, id } = addSection(song("C4"), "Bridge");
    expect(formOf(s1)).toHaveLength(2);
    expect(sectionRange(s1, id)).toEqual([1, 1]);
    const s2 = renameSection(s1, id, "Outro");
    expect(s2.sections![1].name).toBe("Outro");
    const s3 = deleteSection(s2, s2.sections![0].id);
    expect(s3.notes).toHaveLength(0);
    expect(deleteSection(s3, id)).toBe(s3);
  });

  it("keeps verses tidy", () => {
    const n = withVerse(withVerse({ id: "a", dur: 4, pitch: 28 }, 2, "three"), 2, "");
    expect(n.verses).toBeUndefined();
  });
});

describe("sections in JSON", () => {
  it("survive export and import, with verses", async () => {
    const { fromJSON, songToJSON } = await import("./io");
    let s = splitSection(song("C4 D4 | G4"), 2, "Chorus");
    s = { ...s, notes: s.notes.map((n, i) => (i === 0 ? withVerse(withVerse(n, 0, "one"), 1, "two") : n)) };
    s = setForm(s, [s.sections![0].id, s.sections![1].id, s.sections![0].id]);
    const [back] = fromJSON(songToJSON(s));
    expect(back.sections).toEqual(s.sections);
    expect(back.form).toEqual(s.form);
    expect(back.notes.map((n) => [n.sec, n.lyric, n.verses])).toEqual(s.notes.map((n) => [n.sec, n.lyric, n.verses]));
  });
});

describe("sections in MusicXML", () => {
  it("writes the form out with rehearsal marks", async () => {
    const { toMusicXML, fromMusicXML } = await import("./musicxml");
    let s = splitSection(song("C4 D4 E4 F4 | G4 A4 B4 C5"), 4, "Chorus");
    s = renameSection(s, s.sections![0].id, "Verse");
    s = setForm(s, [s.sections![0].id, s.sections![1].id, s.sections![1].id]);
    const xml = toMusicXML(s);
    expect(xml.match(/<rehearsal>/g)).toHaveLength(3);
    expect(fromMusicXML(xml).notes.map((n) => n.pitch)).toEqual(pitches(expand(s).song));
  });
});
