import { clampPitch, durationForTicks, emptySong, keyAlter, measureTicks, newId, octave, resolveAccidentals, splitMeasures, step, STEP_NAMES, ticks } from "./music";
import { expand, sectionIds, sectionsOf } from "./sections";
import type { Alter, Clef, Duration, NoteEvent, Song } from "./types";
import { voiceSong, type VoiceIndex } from "./voices";

/** Ticks per quarter; MusicXML's <divisions>. */
const DIVISIONS = 16;
const TYPE_NAMES: Record<Duration, string> = { 1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "16th" };
const ACCIDENTAL_NAMES: Record<Alter, string> = { [-1]: "flat", 0: "natural", 1: "sharp" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Range = { start: number; end: number };

/**
 * Measures of both voices side by side, section by section (each section starts a new measure);
 * where one voice has fewer measures in a section, it gets empty ones, so both parts line up.
 */
function measureColumns(song: Song): Range[][] {
  const voices = song.second ? [song, voiceSong(song, 1)] : [song];
  const measures = voices.map((v) => splitMeasures(v));
  const ids = voices.map((v) => sectionIds(v));
  const pos = voices.map(() => 0);
  const out: Range[][] = [];
  for (const sec of sectionsOf(song)) {
    const per = measures.map((ms, v) => ms.filter((m) => ids[v][m.start] === sec.id));
    per.forEach((ms, v) => ms.length && (pos[v] = ms[ms.length - 1].end));
    const count = Math.max(0, ...per.map((ms) => ms.length));
    for (let k = 0; k < count; k++) out.push(per.map((ms, v) => ms[k] ?? { start: pos[v], end: pos[v] }));
  }
  return out.length ? out : [voices.map(() => ({ start: 0, end: 0 }))];
}

/** MusicXML 4.0 with one part per voice, readable by MuseScore, Finale, Sibelius, Dorico … */
export function toMusicXML(written: Song): string {
  // Other programs get the form written out; each section's start carries its name.
  const song = expand(written).song;
  const names = new Map((song.sections ?? []).map((x) => [x.id, x.name]));
  const columns = measureColumns(song);
  const measureLen = measureTicks(song);
  const part = (v: VoiceIndex) => {
    const vs = voiceSong(song, v);
    const resolved = resolveAccidentals(vs);
    return columns
      .map((col, mi) => {
        const m = col[v];
        const parts: string[] = [];
        if (mi === 0) {
          const clef = vs.clef === "bass" ? "<sign>F</sign><line>4</line>" : "<sign>G</sign><line>2</line>";
          parts.push(
            `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${song.fifths}</fifths></key>` +
              `<time><beats>${song.beats}</beats><beat-type>${song.beatType}</beat-type></time><clef>${clef}</clef></attributes>`,
          );
          if (v === 0)
            parts.push(
              `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${song.tempo}</per-minute></metronome></direction-type><sound tempo="${song.tempo}"/></direction>`,
            );
        }
        if (v === 0) {
          const sec = vs.notes[m.start]?.sec;
          const label = sec && sec !== vs.notes[m.start - 1]?.sec ? names.get(sec) : "";
          if (label) parts.push(`<direction placement="above"><direction-type><rehearsal>${esc(label)}</rehearsal></direction-type></direction>`);
        }
        if (m.start === m.end) parts.push(`<note><rest measure="yes"/><duration>${measureLen}</duration><voice>1</voice></note>`);
        for (let i = m.start; i < m.end; i++) {
          const n = vs.notes[i];
          const { actual, shown } = resolved[i];
          const lyric = n.lyric && !n.rest ? lyricXML(n.lyric, joinedBefore(vs.notes, i)) : "";
          const pitch = n.rest
            ? "<rest/>"
            : `<pitch><step>${STEP_NAMES[step(n.pitch)]}</step>${actual ? `<alter>${actual}</alter>` : ""}<octave>${octave(n.pitch)}</octave></pitch>`;
          parts.push(
            `<note>${pitch}<duration>${ticks(n)}</duration><voice>1</voice><type>${TYPE_NAMES[n.dur]}</type>${n.dots ? "<dot/>" : ""}` +
              `${shown !== null ? `<accidental>${ACCIDENTAL_NAMES[shown]}</accidental>` : ""}${lyric}</note>`,
          );
        }
        if (mi === columns.length - 1) parts.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
        return `  <measure number="${mi + 1}">\n    ${parts.join("\n    ")}\n  </measure>`;
      })
      .join("\n");
  };
  const voices: VoiceIndex[] = song.second ? [0, 1] : [0];
  const partName = (v: VoiceIndex) => (song.second ? `Voice ${v + 1}` : "Melody");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
 <work><work-title>${esc(song.title)}</work-title></work>
 <identification>${song.composer ? `<creator type="composer">${esc(song.composer)}</creator>` : ""}<encoding><software>mMusicScore</software></encoding></identification>
 <part-list>${voices.map((v) => `<score-part id="P${v + 1}"><part-name>${partName(v)}</part-name></score-part>`).join("")}</part-list>
${voices.map((v) => ` <part id="P${v + 1}">\n${part(v)}\n </part>`).join("\n")}
</score-partwise>
`;
}

/** Whether the previous sung note's syllable ends with a hyphen, i.e. this one continues a word. */
function joinedBefore(notes: NoteEvent[], i: number) {
  for (let j = i - 1; j >= 0; j--) if (!notes[j].rest) return !!notes[j].lyric?.endsWith("-");
  return false;
}

function lyricXML(lyric: string, continues: boolean) {
  const joins = lyric.endsWith("-");
  const syllabic = continues ? (joins ? "middle" : "end") : joins ? "begin" : "single";
  return `<lyric number="1"><syllabic>${syllabic}</syllabic><text>${esc(lyric.replace(/-$/, ""))}</text></lyric>`;
}

const TYPES_BY_NAME: Record<string, Duration> = { whole: 1, half: 2, quarter: 4, eighth: 8, "16th": 16 };

/**
 * Reads the first voice of the first part, and of the second part into the second voice. Chords
 * keep their top-listed note, grace notes and other voices are skipped, values shorter than a
 * sixteenth become sixteenths.
 */
export function fromMusicXML(text: string): Song {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("The MusicXML file cannot be read.");
  const root = doc.documentElement;
  if (root.nodeName === "score-timewise") throw new Error("Timewise MusicXML is not supported.");
  const parts = Array.from(root.children).filter((e) => e.nodeName === "part");
  if (!parts.length) throw new Error("The file contains no part.");

  const song = emptySong(txt(root, "work > work-title") || txt(root, "movement-title") || "Imported");
  song.composer = txt(root, 'identification > creator[type="composer"]');
  const first = readPart(parts[0], song, true);
  song.notes = first.notes;
  song.clef = first.clef;
  if (parts[1]) {
    const second = readPart(parts[1], song, false);
    song.second = { clef: second.clef, notes: second.notes };
  }
  if (![1, 2, 4, 8, 16].includes(song.beatType)) song.beatType = 4;
  return song;
}

const txt = (el: Element | null | undefined, sel: string) => el?.querySelector(sel)?.textContent?.trim() ?? "";

/** One part's first voice. The first part also sets key, time and tempo of `song`. */
function readPart(part: Element, song: Song, main: boolean): { notes: NoteEvent[]; clef: Clef } {
  const notes: NoteEvent[] = [];
  let clef: Clef = "treble";
  let divisions = 1;
  let fifths = song.fifths;
  let voice: string | null = null;
  let tempoSet = !main;

  for (const measure of Array.from(part.children).filter((e) => e.nodeName === "measure")) {
    // Accidentals as written carry through the measure; translate them into the app's model.
    const state = new Map<number, Alter>();
    for (const el of Array.from(measure.children)) {
      if (el.nodeName === "attributes") {
        divisions = Number(txt(el, "divisions")) || divisions;
        if (el.querySelector("key > fifths")) {
          fifths = Math.max(-7, Math.min(7, Number(txt(el, "key > fifths")) || 0));
          if (main) song.fifths = fifths;
        }
        if (main && el.querySelector("time > beats")) {
          song.beats = Math.max(1, Math.min(16, parseInt(txt(el, "time > beats")) || 4));
          song.beatType = Number(txt(el, "time > beat-type")) || 4;
        }
        if (el.querySelector("clef > sign")) clef = txt(el, "clef > sign") === "F" ? "bass" : "treble";
      } else if ((el.nodeName === "direction" || el.nodeName === "sound") && !tempoSet) {
        const sound = el.nodeName === "sound" ? el : el.querySelector("sound");
        const t = Number(sound?.getAttribute("tempo"));
        if (t > 0) {
          song.tempo = Math.round(Math.max(20, Math.min(300, t)));
          tempoSet = true;
        }
      } else if (el.nodeName === "note") {
        if (el.querySelector("chord, grace, cue")) continue;
        const v = txt(el, "voice") || "1";
        if (voice === null) voice = v;
        if (v !== voice) continue;

        const type = TYPES_BY_NAME[txt(el, "type")];
        const fromTicks = durationForTicks(Math.round((Number(txt(el, "duration")) / divisions) * DIVISIONS));
        const n: NoteEvent = { id: newId(), dur: type ?? fromTicks.dur, pitch: 32 };
        if (type ? el.querySelector("dot") : fromTicks.dots) n.dots = 1;
        const p = el.querySelector("pitch");
        if (p) {
          n.pitch = clampPitch(Number(txt(p, "octave")) * 7 + Math.max(0, STEP_NAMES.indexOf(txt(p, "step"))));
          const alter = Math.max(-1, Math.min(1, Math.round(Number(txt(p, "alter")) || 0))) as Alter;
          const current = state.get(n.pitch) ?? keyAlter(fifths, step(n.pitch));
          if (alter !== current) {
            n.alter = alter;
            state.set(n.pitch, alter);
          }
          const lyric = el.querySelector("lyric");
          const text = txt(lyric, "text");
          if (text) n.lyric = text + (["begin", "middle"].includes(txt(lyric, "syllabic")) ? "-" : "");
        } else {
          n.rest = true;
          const prev = notes[notes.length - 1];
          if (prev) n.pitch = prev.pitch;
        }
        notes.push(n);
      }
    }
  }
  return { notes, clef };
}
