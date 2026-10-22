import { Fragment, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { insertIndex, keyWidth, layoutScore, PAGE_H, PAGE_W, pitchY, S, yPitch, type SystemLayout } from "../model/layout";
import { BOTTOM_LINE, clampPitch, keySignaturePitches, middleLine, pitchName } from "../model/music";
import { auditionAt, insertNote, recordUndo, select, updateNote, useStore } from "../model/store";
import type { Alter, Duration, NoteEvent, Song } from "../model/types";
import { ACCIDENTAL, G, REST } from "./glyphs";

const HEAD_W = (dur: Duration) => (dur === 1 ? 1.69 * S : 1.18 * S);
const LINE = 0.13 * S;

type Hover = { sys: SystemLayout; x: number; pitch: number } | null;
type Drag = { i: number; y0: number; pitch0: number; recorded: boolean } | null;

/** Converts a pointer position into page coordinates of its SVG, whatever the zoom. */
function svgPoint(e: { clientX: number; clientY: number }, el: Element) {
  const svg = el instanceof SVGSVGElement ? el : (el as SVGElement).ownerSVGElement!;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  return { x: p.x, y: p.y };
}

export function Score() {
  const song = useStore((s) => s.song);
  const sel = useStore((s) => s.sel);
  const playing = useStore((s) => s.playing);
  const zoom = useStore((s) => s.zoom);
  const input = useStore((s) => s.input);
  const layout = useMemo(() => layoutScore(song), [song]);
  const [hover, setHover] = useState<Hover>(null);
  const drag = useRef<Drag>(null);
  const bottom = BOTTOM_LINE[song.clef];

  const onMove = (e: RPointerEvent, sys: SystemLayout) => {
    if (drag.current) return;
    const p = svgPoint(e, e.currentTarget);
    setHover({ sys, x: p.x, pitch: clampPitch(yPitch(sys, p.y, bottom)) });
  };
  const onClick = (e: RPointerEvent, sys: SystemLayout) => {
    const p = svgPoint(e, e.currentTarget);
    insertNote(insertIndex(sys, layout.noteX, p.x), clampPitch(yPitch(sys, p.y, bottom)));
  };

  const onNoteDown = (e: RPointerEvent, i: number) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    select(i);
    auditionAt(i);
    const n = song.notes[i];
    if (!n.rest) drag.current = { i, y0: svgPoint(e, e.currentTarget).y, pitch0: n.pitch, recorded: false };
  };
  const onNoteMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const pitch = clampPitch(d.pitch0 + Math.round((d.y0 - svgPoint(e, e.currentTarget).y) / (S / 2)));
    if (pitch === useStore.getState().song.notes[d.i]?.pitch) return;
    if (!d.recorded) {
      recordUndo();
      d.recorded = true;
    }
    updateNote(d.i, { pitch, alter: undefined }, false);
    auditionAt(d.i);
  };
  const onNoteUp = () => (drag.current = null);

  return (
    <div className="score" onPointerLeave={() => setHover(null)}>
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
          {pi === 0 && <Heading song={song} />}
          {systems.map((sys, si) => (
            <g key={si} className={sys.measures.every((m) => m.extra) ? "edit-only" : undefined}>
              <Staff sys={sys} song={song} final={sys.measures.some((m) => m.end === song.notes.length && !m.extra) && song.notes.length > 0} />
              <rect
                className="hit-staff"
                x={sys.contentX}
                y={sys.y - 5 * S}
                width={sys.x1 - sys.contentX}
                height={14 * S}
                onPointerMove={(e) => onMove(e, sys)}
                onPointerLeave={() => setHover(null)}
                onPointerDown={(e) => onClick(e, sys)}
              />
              {song.notes.slice(sys.start, sys.end).map((n, k) => {
                const i = sys.start + k;
                const x = layout.noteX[i];
                const y = n.rest ? sys.y + 2 * S : pitchY(sys, n.pitch, bottom);
                return (
                  <g key={n.id} className={`note${i === sel ? " sel" : ""}${i === playing ? " playing" : ""}`}>
                    <NoteGlyph n={n} x={x} y={y} sys={sys} bottom={bottom} clef={song.clef} shown={layout.accidentals[i].shown} />
                    <rect
                      className="hit-note"
                      x={x - 0.5 * S}
                      y={n.rest ? sys.y - S : y - 1.1 * S}
                      width={HEAD_W(n.dur) + S}
                      height={n.rest ? 6 * S : 2.2 * S}
                      onPointerDown={(e) => onNoteDown(e, i)}
                      onPointerMove={onNoteMove}
                      onPointerUp={onNoteUp}
                      onPointerEnter={() => setHover(null)}
                    >
                      <title>{n.rest ? "Rest" : pitchName(n.pitch, layout.accidentals[i].actual)}</title>
                    </rect>
                  </g>
                );
              })}
              {hover?.sys === sys && (
                <g className="ghost edit-only">
                  <NoteGlyph
                    n={{ id: "", dur: input.dur, dots: input.dots, rest: input.rest, pitch: hover.pitch }}
                    x={hover.x - HEAD_W(input.dur) / 2}
                    y={input.rest ? sys.y + 2 * S : pitchY(sys, hover.pitch, bottom)}
                    sys={sys}
                    bottom={bottom}
                    clef={song.clef}
                    shown={null}
                  />
                </g>
              )}
            </g>
          ))}
          {pi === 0 && !song.notes.length && (
            <text className="hint edit-only" x={PAGE_W / 2} y={systems[0].y + 9 * S} textAnchor="middle">
              Click on the staff or type the letters A–G to enter notes
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

function Heading({ song }: { song: Song }) {
  return (
    <g className="heading">
      <text className="song-title" x={PAGE_W / 2} y={100} textAnchor="middle">
        {song.title}
      </text>
      {song.composer && (
        <text className="song-composer" x={PAGE_W - 64} y={140} textAnchor="end">
          {song.composer}
        </text>
      )}
      <text className="tempo" x={64} y={150}>
        <tspan className="mus-small">{""}</tspan> = {song.tempo}
      </text>
    </g>
  );
}

function Staff({ sys, song, final }: { sys: SystemLayout; song: Song; final: boolean }) {
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
      {!sys.first && sys.measures[0] && (
        <text className="measure-number" x={sys.x0} y={sys.y - 1.6 * S}>
          {sys.measures[0].number}
        </text>
      )}
      {sys.measures.map((m) => {
        const end = m.x + m.width;
        if (m.extra) return null;
        if (final && m.end === song.notes.length)
          return (
            <g key={m.number}>
              <rect x={end - 0.9 * S} y={sys.y} width={0.16 * S} height={4 * S} />
              <rect x={end - 0.5 * S} y={sys.y} width={0.5 * S} height={4 * S} />
            </g>
          );
        return <line key={m.number} className="bar" x1={end} x2={end} y1={sys.y} y2={sys.y + 4 * S} strokeWidth={0.16 * S} />;
      })}
    </g>
  );
}

function NoteGlyph({ n, x, y, sys, bottom, clef, shown }: { n: NoteEvent; x: number; y: number; sys: SystemLayout; bottom: number; clef: Song["clef"]; shown: Alter | null }) {
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
