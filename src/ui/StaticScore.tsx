import { layoutScore, PAGE_H, PAGE_W, pitchY, S } from "../model/layout";
import { BOTTOM_LINE, pitchName } from "../model/music";
import type { Song } from "../model/types";
import { Heading, Lyrics, NoteGlyph, Staff } from "./Score";

/**
 * The score as plain SVG pages for the HTML export: no editing parts, and every note carries its
 * index (data-i) so the exported page can play it and follow along.
 */
export function StaticScore({ song }: { song: Song }) {
  const layout = layoutScore(song);
  const bottom = BOTTOM_LINE[song.clef];
  const len = song.notes.length;
  return (
    <>
      {layout.pages.map((systems, pi) => (
        <svg key={pi} className="page" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} xmlns="http://www.w3.org/2000/svg">
          <rect className="paper" width={PAGE_W} height={PAGE_H} />
          {pi === 0 && <Heading song={song} />}
          {systems
            .filter((sys) => sys.measures.some((m) => !m.extra))
            .map((sys, si) => (
              <g key={si}>
                <Staff sys={sys} song={song} final={len > 0 && sys.measures.some((m) => m.end === len && !m.extra)} />
                {song.notes.slice(sys.start, sys.end).map((n, k) => {
                  const i = sys.start + k;
                  const y = n.rest ? sys.y + 2 * S : pitchY(sys, n.pitch, bottom);
                  return (
                    <g key={n.id} className="note" data-i={i}>
                      <NoteGlyph n={n} x={layout.noteX[i]} y={y} sys={sys} bottom={bottom} clef={song.clef} shown={layout.accidentals[i].shown} />
                      <title>{n.rest ? "Rest" : pitchName(n.pitch, layout.accidentals[i].actual)}</title>
                    </g>
                  );
                })}
                <Lyrics sys={sys} song={song} noteX={layout.noteX} editing={null} />
              </g>
            ))}
          {layout.pages.length > 1 && (
            <text className="page-number" x={PAGE_W / 2} y={PAGE_H - 40} textAnchor="middle">
              {pi + 1}
            </text>
          )}
        </svg>
      ))}
    </>
  );
}
