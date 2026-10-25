import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { insertIndex, keyWidth, layoutScore, staffOf, PAGE_H, PAGE_W, pitchY, S, VERSE_DY, yPitch, type SystemLayout } from "../model/layout";
import { BOTTOM_LINE, clampPitch, keySignaturePitches, middleLine, noteLabel, pitchName, type NameStyle, type Resolved } from "../model/music";
import { expand, formOf, sectionRange, sectionsOf, verseOf } from "../model/sections";
import { auditionAt, cur, deleteLast, editLyric, hasSections, insertNote, playingHere, playingHere2, recordUndo, select, selRange, setLyric, setVoice, updateNote, useStore } from "../model/store";
import { voiceSong, type VoiceIndex } from "../model/voices";
import type { Alter, Duration, NoteEvent, Song } from "../model/types";
import { playFrom } from "./actions";
import { follow } from "./follow";
import { ACCIDENTAL, G, REST } from "./glyphs";

export const HEAD_W = (dur: Duration) => (dur === 1 ? 1.69 * S : 1.18 * S);
const LINE = 0.13 * S;

type Hover = { sys: SystemLayout; v: VoiceIndex; x: number; pitch: number } | null;
type Drag = { i: number; y0: number; pitch0: number; recorded: boolean } | null;

/** Converts a pointer position into page coordinates of its SVG, whatever the zoom. */
function svgPoint(e: { clientX: number; clientY: number }, el: Element) {
  const svg = el instanceof SVGSVGElement ? el : (el as SVGElement).ownerSVGElement!;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  return { x: p.x, y: p.y };
}

export function Score() {
  const song = useStore((s) => s.song);
  const voice = useStore((s) => s.voice);
  const sel = useStore((s) => s.sel);
  const anchor = useStore((s) => s.anchor);
  const range = selRange({ sel, anchor });
  const playing1 = useStore(playingHere);
  const playing2 = useStore(playingHere2);
  const playingSrc1 = useStore((s) => s.playingSrc);
  const playingSrc2 = useStore((s) => s.playingSrc2);
  const view = useStore((s) => s.view);
  const editing = useStore((s) => s.mode === "edit");
  const root = useRef<HTMLDivElement>(null);
  const zoomMode = useStore((s) => s.zoom);
  const [box, setBox] = useState({ w: 0, h: 0 });
  // The fit modes follow the size of the score area.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Measured right away too: the observer reports only once the page renders (not while hidden).
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      removeEventListener("resize", measure);
    };
  }, []);
  const PAD = 48;
  const fitW = box.w ? (box.w - PAD) / PAGE_W : 1;
  const fitH = box.h ? (box.h - PAD) / PAGE_H : 1;
  const zoom = Math.max(0.25, Math.min(4, zoomMode === "width" ? fitW : zoomMode === "page" ? Math.min(fitW, fitH) : zoomMode));
  useEffect(() => useStore.setState({ viewZoom: zoom }), [zoom]);
  const input = useStore((s) => s.input);
  const lyricEdit = useStore((s) => s.lyricEdit);
  const lyricVerse = useStore((s) => s.lyricVerse);
  const names = useStore((s) => (s.showNames ? s.nameStyle : null));

  // What is shown: the song as written (compact) or its form written out (expanded). `src` maps a
  // shown note to the note of the song it stands for; every edit goes to that note.
  const sectioned = hasSections(song);
  const expanded = view === "expanded" && sectioned;
  const shown = useMemo(() => (expanded ? expand(song) : { song, src: null, src2: null }), [song, expanded]);
  const dsong = shown.song;
  const formLine = sectioned && !expanded;
  const layout = useMemo(() => layoutScore(dsong, { formLine }), [dsong, formLine]);
  const [hover, setHover] = useState<Hover>(null);
  const drag = useRef<Drag>(null);
  const systems = layout.pages.flat();
  const voices: VoiceIndex[] = song.second ? [0, 1] : [0];

  /** Everything the drawing of voice `v` needs. */
  const per = voices.map((v) => {
    const map = v === 0 ? shown.src : shown.src2;
    const src = (k: number) => (map ? map[k] : k);
    const playing = v === 0 ? playing1 : playing2;
    const playingSrc = v === 0 ? playingSrc1 : playingSrc2;
    const active = v === voice;
    const written = voiceSong(song, v);
    // Playback runs through the form; in the compact view its notes map back to the written ones.
    const dPlaying = playing === null ? null : expanded || !playingSrc ? playing : (playingSrc[playing] ?? null);
    const inSel = (k: number) => active && !!range && src(k) >= range[0] && src(k) <= range[1];
    return {
      v,
      vs: voiceSong(dsong, v),
      written,
      src,
      map,
      active,
      dPlaying,
      inSel,
      noteX: v === 0 ? layout.noteX : layout.noteX2,
      accidentals: v === 0 ? layout.accidentals : layout.accidentals2,
      verses: v === 0 ? layout.verses : layout.verses2,
    };
  });
  const anyPlaying = per.some((p) => p.dPlaying !== null);
  // The cursor sits in the voice being edited: after the selection, or after its last note.
  const act = per[voice] ?? per[0];
  const caretTarget = range ? range[1] : act.written.notes.length - 1;
  const caretK = caretTarget < 0 ? null : act.map ? act.map.indexOf(caretTarget) : caretTarget;
  const caret =
    editing && !anyPlaying && lyricEdit === null && (caretK !== -1 || !act.written.notes.length)
      ? caretAt(act.vs, systems.map((sys) => staffOf(sys, act.v)), act.noteX, caretK === -1 ? null : caretK)
      : null;

  // Keep the selected or sounding note in view; during playback line by line.
  const lastLine = useRef<Element | null>(null);
  useEffect(() => {
    const box = root.current;
    const el = box?.querySelector(".note.playing, .note.cur");
    if (!box || !el) return;
    const line = anyPlaying ? el.closest(".system") : null;
    follow(box, el, line, line !== lastLine.current);
    lastLine.current = line;
  }, [sel, playing1, playing2, layout, zoom]);

  /** Song index and section a click into staff `ss` of voice `v` inserts at. */
  const insertAt = (ss: SystemLayout, x: number, p: (typeof per)[number]): [number, string | undefined] => {
    const sec = song.sections?.length ? ss.section.split("~")[0] : undefined;
    const k = insertIndex(ss, p.noteX, x);
    if (k < ss.end) return [p.src(k), sec];
    if (ss.end > ss.start) return [p.src(ss.end - 1) + 1, sec];
    return [sec ? sectionRange(p.written, sec)[1] : ss.start, sec];
  };
  const onMove = (e: RPointerEvent, ss: SystemLayout, v: VoiceIndex) => {
    if (drag.current) return;
    const p = svgPoint(e, e.currentTarget);
    setHover({ sys: ss, v, x: p.x, pitch: clampPitch(yPitch(ss, p.y, BOTTOM_LINE[per[v].vs.clef])) });
  };
  const onClick = (e: React.MouseEvent, ss: SystemLayout, v: VoiceIndex) => {
    const p = svgPoint(e, e.currentTarget);
    setVoice(v);
    const [index, sec] = insertAt(ss, p.x, per[v]);
    insertNote(index, clampPitch(yPitch(ss, p.y, BOTTOM_LINE[per[v].vs.clef])), undefined, sec);
  };

  const onNoteDown = (e: RPointerEvent, k: number, v: VoiceIndex) => {
    e.stopPropagation();
    const i = per[v].src(k);
    if (e.shiftKey && v === voice) return select(i, true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setVoice(v, i);
    auditionAt(i);
    const n = per[v].written.notes[i];
    if (!n.rest) drag.current = { i, y0: svgPoint(e, e.currentTarget).y, pitch0: n.pitch, recorded: false };
  };
  const onNoteMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const pitch = clampPitch(d.pitch0 + Math.round((d.y0 - svgPoint(e, e.currentTarget).y) / (S / 2)));
    if (pitch === cur().notes[d.i]?.pitch) return;
    if (!d.recorded) {
      recordUndo();
      d.recorded = true;
    }
    updateNote(d.i, { pitch, alter: undefined }, false);
    auditionAt(d.i);
  };
  const onNoteUp = () => (drag.current = null);

  // Swipe left across the music (edit mode, touch): delete the last input, like Backspace.
  const swipe = useRef<{ x: number; y: number; t: number; left: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipe.current = editing && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now(), left: root.current?.scrollLeft ?? 0 } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Quick, mostly horizontal, and not a sideways scroll of a zoomed-in sheet.
    if (dx < -70 && Math.abs(dy) < Math.abs(dx) / 2 && Date.now() - s.t < 600 && (root.current?.scrollLeft ?? 0) === s.left) deleteLast();
  };

  /** One staff of a system: highlight, staff, notes, lyrics, names, cursor and preview. */
  const staff = (sys: SystemLayout, p: (typeof per)[number]) => {
    const ss = staffOf(sys, p.v);
    const { vs, noteX, accidentals, dPlaying, inSel } = p;
    const bottom = BOTTOM_LINE[vs.clef];
    // Highlight: the sounding note, else the selected notes of this staff.
    let a = -1;
    let b = -1;
    for (let k = ss.start; k < ss.end; k++) {
      if (anyPlaying ? k === dPlaying : inSel(k)) {
        if (a < 0) a = k;
        b = k;
      }
    }
    const dim = editing && voices.length > 1 && !p.active;
    return (
      <g key={p.v} className={`voice${dim ? " dim" : ""}`}>
        {a >= 0 && (
          <rect
            className={`highlight edit-only${anyPlaying ? " playing" : ""}`}
            x={noteX[a] - 0.7 * S}
            y={ss.y - 2 * S}
            width={noteX[b] + HEAD_W(vs.notes[b].dur) + 1.4 * S - noteX[a]}
            height={8 * S}
            rx={0.5 * S}
          />
        )}
        <Staff sys={ss} song={vs} />
        {editing && (
          <rect
            className="hit-staff"
            x={ss.contentX}
            y={ss.y - 4 * S}
            width={ss.x1 - ss.contentX}
            height={12 * S}
            onPointerMove={(e) => onMove(e, ss, p.v)}
            onPointerLeave={() => setHover(null)}
            // On click, not pointerdown: a swipe or scroll that starts here must not add a note.
            onClick={(e) => onClick(e, ss, p.v)}
          />
        )}
        {vs.notes.slice(ss.start, ss.end).map((n, j) => {
          const k = ss.start + j;
          const x = noteX[k];
          const y = n.rest ? ss.y + 2 * S : pitchY(ss, n.pitch, bottom);
          return (
            <g key={n.id} className={`note${inSel(k) ? " sel" : ""}${p.active && p.src(k) === sel ? " cur" : ""}${k === dPlaying ? " playing" : ""}`}>
              <NoteGlyph n={n} x={x} y={y} sys={ss} bottom={bottom} clef={vs.clef} shown={accidentals[k].shown} />
              <rect
                className="hit-note"
                x={x - 0.5 * S}
                y={n.rest ? ss.y - S : y - 1.1 * S}
                width={HEAD_W(n.dur) + S}
                height={n.rest ? 6 * S : 2.2 * S}
                // View mode plays on click: iOS starts audio only from a completed tap.
                onPointerDown={editing ? (e) => onNoteDown(e, k, p.v) : undefined}
                onClick={
                  editing
                    ? undefined
                    : () => {
                        setVoice(p.v);
                        playFrom(p.src(k));
                      }
                }
                onPointerMove={onNoteMove}
                onPointerUp={onNoteUp}
                onPointerEnter={() => setHover(null)}
              >
                <title>{n.rest ? "Rest" : pitchName(n.pitch, accidentals[k].actual)}</title>
              </rect>
            </g>
          );
        })}
        <Lyrics
          sys={ss}
          song={vs}
          noteX={noteX}
          verses={p.verses}
          editing={!expanded && p.active && lyricEdit !== null ? { i: lyricEdit, v: lyricVerse } : null}
          onEdit={
            expanded || !editing
              ? undefined
              : (i, verse) => {
                  setVoice(p.v);
                  editLyric(i, verse);
                }
          }
        />
        {names && <NoteNames sys={ss} song={vs} noteX={noteX} accidentals={accidentals} style={names} />}
        {caret && p.active && caret.sys.y === ss.y && caret.sys.start === ss.start && (
          <g className="caret edit-only">
            <rect x={caret.x - 0.12 * S} y={ss.y - 1.5 * S} width={0.24 * S} height={7 * S} rx={0.12 * S} />
            <title>New notes go here</title>
          </g>
        )}
        {hover && hover.v === p.v && hover.sys.y === ss.y && hover.sys.start === ss.start && (
          <g className="ghost edit-only">
            <NoteGlyph
              n={{ id: "", dur: input.dur, dots: input.dots, rest: input.rest, pitch: hover.pitch }}
              x={hover.x - HEAD_W(input.dur) / 2}
              y={input.rest ? ss.y + 2 * S : pitchY(ss, hover.pitch, bottom)}
              sys={ss}
              bottom={bottom}
              clef={vs.clef}
              shown={null}
            />
          </g>
        )}
      </g>
    );
  };

  return (
    <div className={`score${editing ? "" : " viewing"}`} ref={root} onPointerLeave={() => setHover(null)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {layout.pages.map((systems, pi) => (
        <svg
          key={pi}
          className="page"
          viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
          width={PAGE_W * zoom}
          height={PAGE_H * zoom}
          onPointerDown={(e) => e.target === e.currentTarget && select(null)}
        >
          <rect className="paper" width={PAGE_W} height={PAGE_H} onPointerDown={() => select(null)} />
          {pi === 0 && <Heading song={song} form={formLine ? formText(song) : undefined} />}
          {systems.map((sys, si) => (
            <g key={si} className={`system${sys.measures.every((m) => m.extra) ? " edit-only" : ""}`}>
              {per.map((p) => staff(sys, p))}
              {sys.y2 !== null && <SystemBracket sys={sys} />}
            </g>
          ))}
          {pi === 0 && !song.notes.length && !song.second?.notes.length && (
            <text className="hint edit-only" x={PAGE_W / 2} y={systems[0].y + 9 * S} textAnchor="middle">
              Click on the staff or type the letters A–G to enter notes
            </text>
          )}
          {pi === 0 && expanded && !dsong.notes.length && song.notes.length > 0 && (
            <text className="hint edit-only" x={PAGE_W / 2} y={systems[0].y + 9 * S} textAnchor="middle">
              The form is empty – add sections to it in the bar above
            </text>
          )}
          <text className="page-number" x={PAGE_W / 2} y={PAGE_H - 40} textAnchor="middle">
            {layout.pages.length > 1 ? pi + 1 : ""}
          </text>
        </svg>
      ))}
    </div>
  );
}

/** The line and bracket at the left that join the two staves of a system. */
export function SystemBracket({ sys }: { sys: SystemLayout }) {
  const bottom = sys.y2! + 4 * S;
  const x = sys.x0 - 0.9 * S;
  return (
    <g className="system-bracket">
      <line className="bar" x1={sys.x0} x2={sys.x0} y1={sys.y} y2={bottom} strokeWidth={0.16 * S} />
      <rect className="bar-fill" x={x} y={sys.y - 0.2 * S} width={0.5 * S} height={bottom - sys.y + 0.4 * S} />
      <path className="bar" d={`M${x} ${sys.y - 0.2 * S} q ${0.9 * S} 0 ${1.3 * S} -${0.9 * S}`} fill="none" strokeWidth={0.18 * S} />
      <path className="bar" d={`M${x} ${bottom + 0.2 * S} q ${0.9 * S} 0 ${1.3 * S} ${0.9 * S}`} fill="none" strokeWidth={0.18 * S} />
    </g>
  );
}

/** "Verse – Chorus – Verse – Chorus" for the heading of the compact view. */
export function formText(song: Song) {
  const names = new Map(sectionsOf(song).map((s, i) => [s.id, s.name || `Section ${i + 1}`]));
  return formOf(song)
    .map((id) => names.get(id))
    .join(" – ");
}

/**
 * Where the next note from the keyboard or the piano goes: right after the selected note, or after
 * the last note when nothing is selected.
 */
function caretAt(song: Song, systems: SystemLayout[], noteX: number[], sel: number | null) {
  const len = song.notes.length;
  if (!len) return systems[0] ? { sys: systems[0], x: systems[0].contentX + 1.5 * S } : null;
  const at = sel ?? len - 1;
  const sys = systems.find((s) => at >= s.start && at < s.end);
  if (!sys) return null;
  const right = noteX[at] + HEAD_W(song.notes[at].dur);
  const next = at + 1 < sys.end ? noteX[at + 1] - S : null;
  return { sys, x: next !== null && next > right ? (right + next) / 2 + 0.2 * S : right + 1.2 * S };
}

export function Heading({ song, form }: { song: Song; form?: string }) {
  return (
    <g className="heading">
      <text className="song-title" x={PAGE_W / 2} y={100} textAnchor="middle">
        {song.title}
      </text>
      {song.composer && (
        <text className="song-composer" x={PAGE_W - 64} y={128} textAnchor="end">
          {song.composer}
        </text>
      )}
      <text className="tempo" x={64} y={128}>
        <tspan className="mus-small">{"\uECA5"}</tspan> = {song.tempo}
      </text>
      {form && (
        <text className="form-line" x={PAGE_W / 2} y={158} textAnchor="middle">
          Form: {form}
        </text>
      )}
    </g>
  );
}

export function Staff({ sys, song }: { sys: SystemLayout; song: Song }) {
  const bottom = BOTTOM_LINE[song.clef];
  const real = sys.measures.filter((m) => !m.extra);
  const realEnd = real.length ? real[real.length - 1].x + real[real.length - 1].width : sys.contentX;
  const lines = (from: number, to: number, cls?: string) => (
    <g className={cls}>
      {[0, 1, 2, 3, 4].map((l) => (
        <line key={l} className="staff-line" x1={from} x2={to} y1={sys.y + l * S} y2={sys.y + l * S} strokeWidth={LINE} />
      ))}
    </g>
  );
  const x = sys.x0 + 0.8 * S;
  const clefY = song.clef === "bass" ? sys.y + S : sys.y + 3 * S;
  const keyX = sys.x0 + 3.6 * S;
  return (
    <g>
      {lines(sys.x0, real.length ? realEnd : sys.contentX)}
      {real.length < sys.measures.length && lines(realEnd, sys.x1, "edit-only")}
      <line className="bar" x1={sys.x0} x2={sys.x0} y1={sys.y} y2={sys.y + 4 * S} strokeWidth={0.16 * S} />
      <text className="mus" x={x} y={clefY}>
        {song.clef === "bass" ? G.fClef : G.gClef}
      </text>
      {keySignaturePitches(song.fifths, song.clef).map((p, k) => (
        <text key={k} className="mus" x={keyX + k * 1.05 * S} y={pitchY(sys, p, bottom)}>
          {ACCIDENTAL[song.fifths > 0 ? 1 : -1]}
        </text>
      ))}
      {sys.first && (
        <g>
          <text className="mus" x={keyX + keyWidth(song.fifths) + 0.2 * S} y={sys.y + S}>
            {G.timeSig(song.beats)}
          </text>
          <text className="mus" x={keyX + keyWidth(song.fifths) + 0.2 * S} y={sys.y + 3 * S}>
            {G.timeSig(song.beatType)}
          </text>
        </g>
      )}
      {sys.label ? (
        <g className="section-label">
          <rect x={sys.x0} y={sys.y - 4.4 * S} width={sys.label.length * 7.6 + 1.4 * S} height={2.2 * S} rx={0.3 * S} />
          <text x={sys.x0 + 0.7 * S} y={sys.y - 2.75 * S}>
            {sys.label}
          </text>
        </g>
      ) : (
        !sys.first &&
        !sys.lower &&
        sys.measures[0] && (
          <text className="measure-number" x={sys.x0} y={sys.y - 1.6 * S}>
            {sys.measures[0].number}
          </text>
        )
      )}
      {sys.measures.map((m) => {
        const end = m.x + m.width;
        if (m.extra) return null;
        if (m.last)
          return (
            <g key={m.number}>
              <rect className="bar-fill" x={end - 0.9 * S} y={sys.y} width={0.16 * S} height={4 * S} />
              <rect className="bar-fill" x={end - 0.5 * S} y={sys.y} width={0.5 * S} height={4 * S} />
            </g>
          );
        // A section ends with a double bar line.
        if (sys.sectionEnd && m === real[real.length - 1])
          return (
            <g key={m.number}>
              <line className="bar" x1={end - 0.5 * S} x2={end - 0.5 * S} y1={sys.y} y2={sys.y + 4 * S} strokeWidth={0.16 * S} />
              <line className="bar" x1={end} x2={end} y1={sys.y} y2={sys.y + 4 * S} strokeWidth={0.16 * S} />
            </g>
          );
        return <line key={m.number} className="bar" x1={end} x2={end} y1={sys.y} y2={sys.y + 4 * S} strokeWidth={0.16 * S} />;
      })}
    </g>
  );
}

export function NoteGlyph({ n, x, y, sys, bottom, clef, shown }: { n: NoteEvent; x: number; y: number; sys: SystemLayout; bottom: number; clef: Song["clef"]; shown: Alter | null }) {
  if (n.rest) {
    const ry = n.dur === 1 ? sys.y + S : sys.y + 2 * S;
    return (
      <g>
        <text className="mus" x={x} y={ry}>
          {REST[n.dur]}
        </text>
        {n.dots ? <text className="mus" x={x + 1.6 * S} y={sys.y + 1.5 * S}>{G.dot}</text> : null}
      </g>
    );
  }
  const w = HEAD_W(n.dur);
  const head = n.dur === 1 ? G.noteheadWhole : n.dur === 2 ? G.noteheadHalf : G.noteheadBlack;
  const up = n.pitch < middleLine(clef);
  const midY = sys.y + 2 * S;
  const stemX = up ? x + 1.18 * S - 0.06 * S : x + 0.06 * S;
  const stemEnd = up ? Math.min(y - 3.5 * S, midY) : Math.max(y + 3.5 * S, midY);
  const flag = n.dur === 8 ? (up ? G.flag8thUp : G.flag8thDown) : n.dur === 16 ? (up ? G.flag16thUp : G.flag16thDown) : null;
  const ledgers: number[] = [];
  for (let p = bottom - 2; p >= n.pitch; p -= 2) ledgers.push(p);
  for (let p = bottom + 10; p <= n.pitch; p += 2) ledgers.push(p);
  const onLine = (n.pitch - bottom) % 2 === 0;
  return (
    <g>
      {ledgers.map((p) => (
        <line key={p} className="ledger" x1={x - 0.4 * S} x2={x + w + 0.4 * S} y1={pitchY(sys, p, bottom)} y2={pitchY(sys, p, bottom)} strokeWidth={0.16 * S} />
      ))}
      {shown !== null && (
        <text className="mus" x={x - 1.25 * S} y={y}>
          {ACCIDENTAL[shown]}
        </text>
      )}
      <text className="mus" x={x} y={y}>
        {head}
      </text>
      {n.dur > 1 && (
        <Fragment>
          <line className="stem" x1={stemX} x2={stemX} y1={up ? y - 0.17 * S : y + 0.17 * S} y2={stemEnd} strokeWidth={0.12 * S} />
          {flag && (
            <text className="mus" x={stemX - 0.06 * S} y={stemEnd}>
              {flag}
            </text>
          )}
        </Fragment>
      )}
      {n.dots ? (
        <text className="mus" x={x + w + 0.35 * S + (flag && up ? 0.8 * S : 0)} y={onLine ? y - S / 2 : y}>
          {G.dot}
        </text>
      ) : null}
    </g>
  );
}

/**
 * Note names in a row above the staff, each centered over its note. The row moves up when a high
 * note, its stem or accidental would reach into it.
 */
export function NoteNames({ sys, song, noteX, accidentals, style }: { sys: SystemLayout; song: Song; noteX: number[]; accidentals: Resolved[]; style: NameStyle }) {
  const bottom = BOTTOM_LINE[song.clef];
  const mid = middleLine(song.clef);
  let top = sys.y - 0.6 * S;
  for (let i = sys.start; i < sys.end; i++) {
    const n = song.notes[i];
    if (n.rest) continue;
    const y = pitchY(sys, n.pitch, bottom);
    const stemTop = n.dur > 1 && n.pitch < mid ? Math.min(y - 3.5 * S, sys.y + 2 * S) : y;
    top = Math.min(top, stemTop, y - (accidentals[i].shown !== null ? 1.6 * S : 0.6 * S));
  }
  const y = top - 0.9 * S;
  return (
    <g className="note-names">
      {song.notes.slice(sys.start, sys.end).map((n, k) => {
        const i = sys.start + k;
        if (n.rest) return null;
        return (
          <text key={n.id} x={noteX[i] + HEAD_W(n.dur) / 2} y={y} textAnchor="middle">
            {noteLabel(n.pitch, accidentals[i].actual, style)}
          </text>
        );
      })}
    </g>
  );
}

const LYRIC_DY = 7.8 * S;
const centerX = (n: NoteEvent, x: number) => x + HEAD_W(n.dur) / 2;

/** Next (dir 1) or previous (dir -1) note that is not a rest. */
function nextSung(notes: NoteEvent[], i: number, dir: 1 | -1) {
  for (let j = i + dir; j >= 0 && j < notes.length; j += dir) if (!notes[j].rest) return j;
  return null;
}

export function Lyrics({
  sys,
  song,
  noteX,
  verses = 1,
  editing = null,
  onEdit,
}: {
  sys: SystemLayout;
  song: Song;
  noteX: number[];
  verses?: number;
  editing?: { i: number; v: number } | null;
  onEdit?: (i: number, v: number) => void;
}) {
  const out = [];
  const lines = Math.max(verses, editing ? editing.v + 1 : 1);
  // Verse numbers only where this system has more than one line of text.
  let used = 0;
  for (let v = 0; v < lines; v++) if (song.notes.slice(sys.start, sys.end).some((n) => verseOf(n, v))) used++;
  for (let v = 0; v < lines; v++) {
    const y = sys.y + LYRIC_DY + v * VERSE_DY;
    let numbered = used < 2;
    for (let i = sys.start; i < sys.end; i++) {
      const n = song.notes[i];
      const cx = centerX(n, noteX[i]);
      if (editing && i === editing.i && v === editing.v) {
        out.push(<LyricInput key={`edit-${n.id}-${v}`} i={i} v={v} x={cx} y={y} />);
        continue;
      }
      const lyric = verseOf(n, v);
      if (!lyric) continue;
      // With several verses, each line starts with its number.
      if (!numbered) {
        numbered = true;
        out.push(
          <text key={`no-${v}`} className="lyric verse-no" x={sys.x0 + 0.8 * S} y={y}>
            {v + 1}.
          </text>,
        );
      }
      out.push(
        <text key={`${n.id}-${v}`} className="lyric" x={cx} y={y} textAnchor="middle" onPointerDown={onEdit && (() => onEdit(i, v))}>
          {lyric.replace(/-$/, "")}
        </text>,
      );
      // A hyphen centered between this syllable and the next one in the same system.
      const next = nextSung(song.notes, i, 1);
      if (lyric.endsWith("-") && next !== null && next < sys.end) {
        out.push(
          <text key={`${n.id}-${v}-h`} className="lyric" x={(cx + centerX(song.notes[next], noteX[next])) / 2} y={y} textAnchor="middle">
            -
          </text>,
        );
      }
    }
  }
  return <g className="lyrics">{out}</g>;
}

/**
 * Inline editor for one syllable: Space or Tab goes to the next note, "-" ends the syllable with a
 * hyphen, Shift+Tab or Backspace in an empty field goes back, ↓ / ↑ switch to the next or previous
 * verse, Enter or Esc stops.
 */
function LyricInput({ i, v, x, y }: { i: number; v: number; x: number; y: number }) {
  const n = useStore((s) => s.song.notes[i]);
  const initial = (n && verseOf(n, v)) ?? "";
  const [value, setValue] = useState(() => initial.replace(/-$/, ""));
  const hyphen = useRef(initial.endsWith("-"));
  const commit = (h = hyphen.current) => {
    hyphen.current = h;
    setLyric(i, value.trim() ? value.trim() + (h ? "-" : "") : "", v);
  };
  const go = (dir: 1 | -1 | 0) => {
    const notes = useStore.getState().song.notes;
    editLyric(dir ? nextSung(notes, i, dir) : null, v);
  };
  const onKey = (e: RKeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    if (key === " " || (key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      commit(false);
      go(1);
    } else if (key === "-") {
      e.preventDefault();
      commit(true);
      go(1);
    } else if (key === "Tab" || (key === "Backspace" && !value)) {
      e.preventDefault();
      commit();
      go(-1);
    } else if (key === "ArrowDown" || (key === "ArrowUp" && v > 0)) {
      e.preventDefault();
      commit();
      editLyric(i, v + (key === "ArrowDown" ? 1 : -1));
    } else if (key === "Enter" || key === "Escape") {
      e.preventDefault();
      commit();
      go(0);
    }
  };
  return (
    <foreignObject className="edit-only" x={x - 60} y={y - 15} width={120} height={22}>
      <input
        className="lyric-input"
        value={value}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={() => {
          commit();
          const st = useStore.getState();
          if (st.lyricEdit === i && st.lyricVerse === v) editLyric(null);
        }}
        aria-label={`Lyric syllable, verse ${v + 1}`}
      />
    </foreignObject>
  );
}
