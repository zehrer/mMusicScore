/**
 * HTML export: one self-contained file that shows a song as sheet music in any browser and can
 * play it. The song is embedded as JSON, so the file opens in mMusicScore again (button
 * "Open in mMusicScore", or File → Import).
 */
import { songToJSON } from "./io";
import { midi, resolveAccidentals, ticks } from "./music";
import type { Song } from "./types";

export const DATA_ID = "mmusicscore-data";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
/** "</" inside an embedded script would end the script element early. */
const scriptSafe = (s: string) => s.replace(/<\//g, "<\\/");

/** Per note: MIDI number (null for rests) and length in seconds. */
export function playbackEvents(song: Song): [number | null, number][] {
  const resolved = resolveAccidentals(song);
  const tick = 60 / song.tempo / 16;
  return song.notes.map((n, i) => [n.rest ? null : midi(n.pitch, resolved[i].actual), +(ticks(n) * tick).toFixed(4)]);
}

/** The song's embedded JSON from an exported file, or null if `html` is not one. */
export function extractSongJSON(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.getElementById(DATA_ID)?.textContent ?? null;
}

/** `pages` is the rendered SVG markup, `font` the Bravura woff2 as base64. */
export function toHTML(song: Song, pages: string, font: string, appUrl: string): string {
  const title = song.title || "Untitled";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="mMusicScore">
<title>${esc(title)}</title>
<style>
  @font-face { font-family: Bravura; src: url(data:font/woff2;base64,${font}) format("woff2"); font-display: block; }
  :root { color-scheme: light; font: 14px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1f1f1f; background: #e8eaed; }
  body { margin: 0; padding: 0 16px 48px; }
  .topbar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 794px; margin: 0 auto; padding: 12px 0; background: #e8eaed; }
  .topbar h1 { flex: 1; min-width: 160px; margin: 0; font-size: 18px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .topbar button { border: 0; border-radius: 18px; padding: 7px 16px; font: inherit; font-weight: 500; cursor: pointer; background: #fff; color: #0b57d0; }
  .topbar button.primary { background: #0b57d0; color: #fff; }
  .topbar button.on { background: #d93025; color: #fff; }
  .open { max-width: 794px; margin: 0 auto 16px; padding: 10px 14px; border-radius: 12px; background: #fff; color: #444746; font-size: 13px; }
  .open a { color: #0b57d0; }
  .page { display: block; width: 100%; max-width: 794px; height: auto; margin: 0 auto 24px; background: #fff; color: #111; box-shadow: 0 1px 3px rgb(60 64 67 / 30%), 0 4px 12px rgb(60 64 67 / 12%); }
  .paper { fill: #fff; }
  .mus { font-family: Bravura; font-size: 40px; fill: currentColor; }
  .staff-line, .bar, .ledger, .stem { stroke: currentColor; }
  .bar-fill { fill: currentColor; }
  .edit-only { display: none; }
  .song-title { font: 28px Georgia, "Times New Roman", serif; fill: #111; }
  .song-composer { font: italic 15px Georgia, "Times New Roman", serif; fill: #111; }
  .tempo { font: bold 14px Georgia, serif; fill: #111; }
  .mus-small { font-family: Bravura; font-size: 22px; }
  .measure-number { font: italic 11px Georgia, serif; fill: #5f6368; }
  .page-number { font: 12px Georgia, serif; fill: #5f6368; }
  .note-names text { font: 600 11px -apple-system, "Segoe UI", Roboto, Arial, sans-serif; fill: #444746; }
  .lyric { font: 14px Georgia, "Times New Roman", serif; fill: #111; }
  .note { cursor: pointer; }
  .note:hover { color: #0b57d0; }
  .note.playing { color: #d93025; }
  @media print {
    @page { size: A4; margin: 0; }
    body { padding: 0; background: #fff; }
    .topbar, .open { display: none; }
    .page { width: 210mm; max-width: none; height: 297mm; margin: 0; box-shadow: none; break-after: page; }
    .page:last-of-type { break-after: auto; }
    .note.playing { color: #111; }
  }
</style>
</head>
<body>
<div class="topbar">
  <h1>${esc(title)}</h1>
  <button id="play" class="primary" type="button" title="Play / stop (Space); click a note to start there">▶ Play</button>
  <button id="print" type="button">Print</button>
  <button id="open-in-app" type="button">Open in mMusicScore</button>
</div>
<p class="open">A read-only copy made with <a href="${esc(appUrl)}">mMusicScore</a>, a free music notation app that runs in your browser and keeps songs only there. “Open in mMusicScore” adds this song to your library; if the button does not work, open the app and use <b>File → Import</b> with this file.</p>
${pages}
<script type="application/json" id="${DATA_ID}">${scriptSafe(songToJSON(song))}</script>
<script>
  var EVENTS = ${JSON.stringify(playbackEvents(song))};
  var APP = ${scriptSafe(JSON.stringify(appUrl))};
  var ctx = null, stopAt = null, raf = 0;
  var btn = document.getElementById("play");

  function notes(i) { return document.querySelectorAll('.note[data-i="' + i + '"]'); }
  function mark(i, on) { notes(i).forEach(function (el) { el.classList.toggle("playing", on); }); }

  function tone(m, at, len, out) {
    var f = 440 * Math.pow(2, (m - 69) / 12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.32, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.14, at + Math.min(0.25, len * 0.6));
    g.gain.setValueAtTime(0.14, at + Math.max(0.02, len - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.08);
    g.connect(out);
    [["triangle", f, 1], ["sine", f * 2, 0.18]].forEach(function (o) {
      var osc = ctx.createOscillator(), og = ctx.createGain();
      osc.type = o[0]; osc.frequency.value = o[1]; og.gain.value = o[2];
      osc.connect(og).connect(g); osc.start(at); osc.stop(at + len + 0.1);
    });
  }

  // Keeps the sounding note's line in the upper part of the window, below the sticky bar. Only
  // rectangles are used: Safari does not scroll SVG elements with scrollIntoView.
  function follow(el) {
    var r = el.getBoundingClientRect(), h = window.innerHeight;
    var top = document.querySelector(".topbar").offsetHeight;
    if (r.top < top + h * 0.08 || r.bottom > h * 0.62) window.scrollTo({ top: window.scrollY + r.top - top - h * 0.25, behavior: "smooth" });
  }

  function stop() {
    if (!stopAt) return;
    stopAt();
  }

  function play(from) {
    stop();
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    var master = ctx.createGain();
    master.connect(ctx.destination);
    var start = ctx.currentTime + 0.08, t = start, times = [];
    for (var i = from; i < EVENTS.length; i++) {
      times.push(t);
      if (EVENTS[i][0] !== null) tone(EVENTS[i][0], t, EVENTS[i][1] * 0.92, master);
      t += EVENTS[i][1];
    }
    var end = t, cur = -1;
    btn.textContent = "■ Stop"; btn.classList.add("on");
    function tick() {
      var now = ctx.currentTime;
      if (now >= end) return stopAt();
      var k = times.length - 1;
      while (k > 0 && times[k] > now) k--;
      var i = now < start ? -1 : from + k;
      if (i !== cur) {
        if (cur >= 0) mark(cur, false);
        cur = i;
        if (i >= 0) {
          mark(i, true);
          var el = notes(i)[0];
          if (el) follow(el);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    stopAt = function () {
      cancelAnimationFrame(raf);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(function () { master.disconnect(); }, 150);
      if (cur >= 0) mark(cur, false);
      stopAt = null;
      btn.textContent = "▶ Play"; btn.classList.remove("on");
    };
    raf = requestAnimationFrame(tick);
  }

  btn.onclick = function () { stopAt ? stop() : play(0); };
  document.getElementById("print").onclick = function () { stop(); print(); };
  document.querySelectorAll(".note").forEach(function (el) {
    el.addEventListener("click", function () { play(Number(el.getAttribute("data-i"))); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === " " && !e.metaKey && !e.ctrlKey) { e.preventDefault(); stopAt ? stop() : play(0); }
  });

  // Opens mMusicScore and hands over the embedded song once the app reports that it is ready.
  document.getElementById("open-in-app").onclick = function () {
    var win = window.open(APP + "#import", "_blank");
    if (!win) { alert("Please allow pop-ups, or open mMusicScore and use File \\u2192 Import with this file."); return; }
    var data = { type: "mmusicscore-data", name: ${scriptSafe(JSON.stringify(title))}, json: document.getElementById("${DATA_ID}").textContent };
    window.addEventListener("message", function ready(e) {
      if (e.source !== win || !e.data || e.data.type !== "mmusicscore-ready") return;
      win.postMessage(data, new URL(APP).origin);
      window.removeEventListener("message", ready);
    });
  };
</script>
</body>
</html>
`;
}
