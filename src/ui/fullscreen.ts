import { useStore } from "../model/store";

// iPad Safari before 16.4 only knows the webkit-prefixed names.
type Doc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type El = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
const doc = document as Doc;

const nativeElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

/**
 * Full screen hides everything but the score and the play bar. Where the browser allows it (also
 * iPad Safari) the page fills the screen too; on iPhone only the app's own bars go away.
 */
export async function enterFullscreen() {
  useStore.setState({ fullscreen: true, mode: "view", lyricEdit: null, anchor: null });
  const el = document.documentElement as El;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else await el.webkitRequestFullscreen?.();
  } catch {
    /* not allowed here: the app's own full screen remains */
  }
}

export async function exitFullscreen() {
  useStore.setState({ fullscreen: false });
  try {
    if (!nativeElement()) return;
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    /* already left */
  }
}

export const toggleFullscreen = () => (useStore.getState().fullscreen ? exitFullscreen() : enterFullscreen());

/** Leaving the browser's full screen (Esc, swipe) also leaves the app's. */
export function listenFullscreen() {
  let was = false;
  const update = () => {
    const now = !!nativeElement();
    if (was && !now) useStore.setState({ fullscreen: false });
    was = now;
  };
  document.addEventListener("fullscreenchange", update);
  document.addEventListener("webkitfullscreenchange", update);
  return () => {
    document.removeEventListener("fullscreenchange", update);
    document.removeEventListener("webkitfullscreenchange", update);
  };
}
