import { describe, expect, it } from "vitest";
import { fromJSON, libraryToJSON } from "./io";
import { fromMusicXML, toMusicXML } from "./musicxml";
import { sampleSongs } from "./samples";

const strip = (notes: { id: string }[]) => notes.map(({ id: _, ...n }) => n);

describe("import / export", () => {
  it("round-trips the library as JSON with new ids", () => {
    const songs = sampleSongs();
    const back = fromJSON(libraryToJSON(songs));
    expect(back.map((s) => s.title)).toEqual(songs.map((s) => s.title));
    expect(back[0].id).not.toBe(songs[0].id);
    expect(strip(back[1].notes)).toEqual(strip(songs[1].notes));
  });

  it("rejects files without songs", () => {
    expect(() => fromJSON('{"foo": 1}')).toThrow();
  });

  it("round-trips MusicXML", () => {
    for (const song of sampleSongs()) {
      const back = fromMusicXML(toMusicXML(song));
      expect(back.title).toBe(song.title);
      expect(back.composer).toBe(song.composer);
      expect([back.fifths, back.beats, back.beatType, back.tempo, back.clef]).toEqual([song.fifths, song.beats, song.beatType, song.tempo, song.clef]);
      expect(strip(back.notes)).toEqual(strip(song.notes));
    }
  });

  it("reads accidentals from MusicXML into the measure model", () => {
    const xml = `<score-partwise><part-list/><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><rest/><duration>2</duration></note>
      <note><chord/><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration></note>
    </measure></part></score-partwise>`;
    const s = fromMusicXML(xml);
    expect(s.notes.map((n) => [n.pitch, n.alter, !!n.rest, n.dur])).toEqual([
      [31, 1, false, 4],
      [31, undefined, false, 4],
      [31, 0, false, 4],
      [31, undefined, true, 4],
    ]);
  });
});
