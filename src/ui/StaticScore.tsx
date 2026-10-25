import { layoutScore, PAGE_H, PAGE_W, pitchY, S, staffOf } from "../model/layout";
import { BOTTOM_LINE, pitchName, type NameStyle } from "../model/music";
import type { Song } from "../model/types";
import { voiceSong, type VoiceIndex } from "../model/voices";
import { Heading, Lyrics, NoteGlyph, NoteNames, Staff, SystemBracket } from "./Score";

/**
 * The score as plain SVG pages for the HTML export: no editing parts, and every note carries its
 * voice and index (data-v, data-i) so the exported page can play it and follow along.
 */
export function StaticScore({ song, names = null }: { song: Song; names?: NameStyle | null }) {
  const layout = layoutScore(song);
  const voices: VoiceIndex[] = song.second ? [0, 1] : [0];
  return (
    <>
      {layout.pages.map((systems, pi) => (
        <svg key={pi} className="page" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} xmlns="http://www.w3.org/2000/svg">
          <rect className="paper" width={PAGE_W} height={PAGE_H} />
          {pi === 0 && <Heading song={song} />}
          {systems
            .filter((sys) => sys.measures.some((m) => !m.extra))
            .map((sys, si) => (
              <g key={si} className="system">
                {voices.map((v) => {
                  const ss = staffOf(sys, v);
                  const vs = voiceSong(song, v);
                  const bottom = BOTTOM_LINE[vs.clef];
                  const noteX = v === 0 ? layout.noteX : layout.noteX2;
                  const accidentals = v === 0 ? layout.accidentals : layout.accidentals2;
                  return (
                    <g key={v}>
                      <Staff sys={ss} song={vs} />
                      {vs.notes.slice(ss.start, ss.end).map((n, k) => {
                        const i = ss.start + k;
                        const y = n.rest ? ss.y + 2 * S : pitchY(ss, n.pitch, bottom);
                        return (
                          <g key={n.id} className="note" data-v={v} data-i={i}>
                            <NoteGlyph n={n} x={noteX[i]} y={y} sys={ss} bottom={bottom} clef={vs.clef} shown={accidentals[i].shown} />
                            <title>{n.rest ? "Rest" : pitchName(n.pitch, accidentals[i].actual)}</title>
                          </g>
                        );
                      })}
                      <Lyrics sys={ss} song={vs} noteX={noteX} verses={v === 0 ? layout.verses : layout.verses2} editing={null} />
                      {names && <NoteNames sys={ss} song={vs} noteX={noteX} accidentals={accidentals} style={names} />}
                    </g>
                  );
                })}
                {sys.y2 !== null && <SystemBracket sys={sys} />}
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
