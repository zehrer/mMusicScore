import { clampPitch, durationForTicks, emptySong, keyAlter, newId, octave, resolveAccidentals, splitMeasures, step, STEP_NAMES, ticks } from "./music";
import { expand } from "./sections";
import type { Alter, Duration, NoteEvent, Song } from "./types";

/** Ticks per quarter; MusicXML's <divisions>. */
const DIVISIONS = 16;
const TYPE_NAMES: Record<Duration, string> = { 1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "16th" };
const ACCIDENTAL_NAMES: Record<Alter, string> = { [-1]: "flat", 0: "natural", 1: "sharp" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Single-part MusicXML 4.0, readable by MuseScore, Finale, Sibelius, Dorico … */
export function toMusicXML(written: Song): string {
  // Other programs get the form written out; each section's start carries its name.
  const song = expand(written).song;
  const names = new Map((song.sections ?? []).map((x) => [x.id, x.name]));
  const resolved = resolveAccidentals(song);
  const measures = splitMeasures(song);
  if (!measures.length) measures.push({ start: 0, end: 0, ticks: 0 });
  const body = measures
    .map((m, mi) => {
      const parts: string[] = [];
      if (mi === 0) {
        const clef = song.clef === "bass" ? "<sign>F</sign><line>4</line>" : "<sign>G</sign><line>2</line>";
        parts.push(
          `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${song.fifths}</fifths></key>` +
            `<time><beats>${song.beats}</beats><beat-type>${song.beatType}</beat-type></time><clef>${clef}</clef></attributes>`,
          `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${song.tempo}</per-minute></metronome></direction-type><sound tempo="${song.tempo}"/></direction>`,
        );
      }
      const sec = song.notes[m.start]?.sec;
      const label = sec && sec !== song.notes[m.start - 1]?.sec ? names.get(sec) : "";
      if (label) parts.push(`<direction placement="above"><direction-type><rehearsal>${esc(label)}</rehearsal></direction-type></direction>`);
      for (let i = m.start; i < m.end; i++) {
        const n = song.notes[i];
        const { actual, shown } = resolved[i];
        const lyric = n.lyric && !n.rest ? lyricXML(n.lyric, joinedBefore(song.notes, i)) : "";
        const pitch = n.rest
          ? "<rest/>"
          : `<pitch><step>${STEP_NAMES[step(n.pitch)]}</step>${actual ? `<alter>${actual}</alter>` : ""}<octave>${octave(n.pitch)}</octave></pitch>`;
        parts.push(
          `<note>${pitch}<duration>${ticks(n)}</duration><voice>1</voice><type>${TYPE_NAMES[n.dur]}</type>${n.dots ? "<dot/>" : ""}` +
            `${shown !== null ? `<accidental>${ACCIDENTAL_NAMES[shown]}</accidental>` : ""}${lyric}</note>`,
        );
      }
      if (mi === measures.length - 1) parts.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
      return `  <measure number="${mi + 1}">\n    ${parts.join("\n    ")}\n  </measure>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
 <work><work-title>${esc(song.title)}</work-title></work>
 <identification>${song.composer ? `<creator type="composer">${esc(song.composer)}</creator>` : ""}<encoding><software>mMusicScore</software></encoding></identification>
 <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
 <part id="P1">
${body}
 </part>
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
 * Reads the first voice of the first part. Chords keep their top-listed note, grace notes and
 * other voices are skipped, values shorter than a sixteenth become sixteenths.
 */
export function fromMusicXML(text: string): Song {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("The MusicXML file cannot be read.");
  const root = doc.documentElement;
  if (root.nodeName === "score-timewise") throw new Error("Timewise MusicXML is not supported.");
  const part = root.querySelector("part");
  if (!part) throw new Error("The file contains no part.");
  const txt = (el: Element | null | undefined, sel: string) => el?.querySelector(sel)?.textContent?.trim() ?? "";

  const song = emptySong(txt(root, "work > work-title") || txt(root, "movement-title") || "Imported");
  song.composer = txt(root, 'identification > creator[type="composer"]');
  let divisions = 1;
  let voice: string | null = null;
  let tempoSet = false;

  for (const measure of Array.from(part.children).filter((e) => e.nodeName === "measure")) {
    // Accidentals as written carry through the measure; translate them into the app's model.
    const state = new Map<number, Alter>();
    for (const el of Array.from(measure.children)) {
      if (el.nodeName === "attributes") {
        divisions = Number(txt(el, "divisions")) || divisions;
        if (el.querySelector("key > fifths")) song.fifths = Math.max(-7, Math.min(7, Number(txt(el, "key > fifths")) || 0));
        if (el.querySelector("time > beats")) {
          song.beats = Math.max(1, Math.min(16, parseInt(txt(el, "time > beats")) || 4));
          song.beatType = Number(txt(el, "time > beat-type")) || 4;
        }
        if (el.querySelector("clef > sign")) song.clef = txt(el, "clef > sign") === "F" ? "bass" : "treble";
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
          const current = state.get(n.pitch) ?? keyAlter(song.fifths, step(n.pitch));
          if (alter !== current) {
            n.alter = alter;
            state.set(n.pitch, alter);
          }
          const lyric = el.querySelector("lyric");
          const text = txt(lyric, "text");
          if (text) n.lyric = text + (["begin", "middle"].includes(txt(lyric, "syllabic")) ? "-" : "");
        } else {
          n.rest = true;
          const prev = song.notes[song.notes.length - 1];
          if (prev) n.pitch = prev.pitch;
        }
        song.notes.push(n);
      }
    }
  }
  if (![1, 2, 4, 8, 16].includes(song.beatType)) song.beatType = 4;
  return song;
}
