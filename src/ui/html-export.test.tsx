import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { extractSongJSON, playbackEvents, toHTML } from "../model/html-export";
import { fromJSON } from "../model/io";
import { sampleSongs } from "../model/samples";
import { StaticScore } from "./StaticScore";

describe("HTML export", () => {
  const song = sampleSongs()[0];
  const pages = renderToStaticMarkup(createElement(StaticScore, { song }));
  const html = toHTML(song, pages, "AAAA", "https://example.test/mMusicScore/");

  it("renders every note once with its index and no editing parts", () => {
    expect(pages.match(/data-i="/g)).toHaveLength(song.notes.length);
    expect(pages).not.toContain("hit-");
    expect(pages).toContain("Köpf");
  });

  it("embeds the song so it can be imported again", () => {
    const json = extractSongJSON(html);
    expect(json).not.toBeNull();
    const [back] = fromJSON(json!);
    expect(back.title).toBe(song.title);
    expect(back.notes.map((n) => [n.pitch, n.dur, n.lyric])).toEqual(song.notes.map((n) => [n.pitch, n.dur, n.lyric]));
  });

  it("keeps a title with markup from breaking the page", () => {
    const evil = { ...song, title: '</script><b>"x"</b>' };
    const out = toHTML(evil, "", "", "https://example.test/");
    expect(out).not.toContain("</script><b>");
    expect(fromJSON(extractSongJSON(out)!)[0].title).toBe(evil.title);
  });

  it("times notes from the tempo", () => {
    const ev = playbackEvents(song);
    expect(ev[0]).toEqual([60, +(60 / song.tempo).toFixed(4)]);
    expect(ev).toHaveLength(song.notes.length);
  });
});
