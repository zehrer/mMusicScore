/**
 * Keeps the selected or sounding note visible by scrolling `box`. Uses only bounding rectangles,
 * which every browser reports for SVG elements (Safari does not scroll SVG elements with
 * scrollIntoView).
 *
 * `line` (playback): the note's line. When playback reaches a new line that is not comfortably
 * in view, that line moves to near the top in one smooth scroll, so the lines below can be read
 * ahead; within a line nothing moves vertically. Sideways (zoomed in) the view only moves when
 * the note would leave it.
 * Without `line` (selection) the view scrolls just as far as needed.
 */
export function follow(box: HTMLElement, el: Element, line: Element | null, newLine = true) {
  const v = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  let dy = 0;
  let dx = 0;
  if (line) {
    const l = line.getBoundingClientRect();
    const top = l.top - v.top;
    if (newLine && (top < v.height * 0.05 || top + l.height > v.height * 0.9)) dy = top - v.height * 0.15;
    const x = r.left - v.left;
    if (x < v.width * 0.05 || x + r.width > v.width * 0.92) dx = x - v.width * 0.3;
  } else {
    const y = r.top - v.top;
    const x = r.left - v.left;
    const m = Math.min(60, v.height / 4);
    if (y < m) dy = y - m;
    else if (y + r.height > v.height - m) dy = y + r.height - (v.height - m);
    const mx = Math.min(40, v.width / 4);
    if (x < mx) dx = x - mx;
    else if (x + r.width > v.width - mx) dx = x + r.width - (v.width - mx);
  }
  // Only scroll by what is possible: a request that cannot move would interrupt a smooth scroll
  // that is still running and make the view stutter.
  const top = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, box.scrollTop + dy));
  const left = Math.max(0, Math.min(box.scrollWidth - box.clientWidth, box.scrollLeft + dx));
  if (Math.abs(top - box.scrollTop) < 1 && Math.abs(left - box.scrollLeft) < 1) return;
  box.scrollTo({ top, left, behavior: line ? "smooth" : "auto" });
}
