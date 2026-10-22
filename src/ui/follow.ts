/**
 * Scrolls `box` so that `el` stays visible. Uses only bounding rectangles, which every browser
 * reports for SVG elements (Safari does not scroll SVG elements with scrollIntoView).
 *
 * `playing`: keep the sounding note in a band in the upper part of the view and, once it leaves
 * the band, bring its line to about a third of the height, so the lines below can be read ahead.
 * Otherwise (selection) scroll only as far as needed to keep the note on screen.
 */
export function follow(box: HTMLElement, el: Element, playing: boolean) {
  const v = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const y = r.top - v.top;
  const x = r.left - v.left;
  let dy = 0;
  let dx = 0;
  if (playing) {
    if (y < v.height * 0.12 || y + r.height > v.height * 0.62) dy = y - v.height * 0.3;
    if (x < v.width * 0.08 || x + r.width > v.width * 0.8) dx = x - v.width * 0.3;
  } else {
    const m = Math.min(60, v.height / 4);
    if (y < m) dy = y - m;
    else if (y + r.height > v.height - m) dy = y + r.height - (v.height - m);
    const mx = Math.min(40, v.width / 4);
    if (x < mx) dx = x - mx;
    else if (x + r.width > v.width - mx) dx = x + r.width - (v.width - mx);
  }
  if (Math.abs(dy) < 1 && Math.abs(dx) < 1) return;
  box.scrollTo({ top: box.scrollTop + dy, left: box.scrollLeft + dx, behavior: playing ? "smooth" : "auto" });
}
