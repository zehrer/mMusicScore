import { afterEach, describe, expect, it, vi } from "vitest";
import { songToJSON } from "./io";
import { receiveFromExport } from "./persist";
import { sampleSongs } from "./samples";
import { useStore } from "./store";

// IndexedDB is not available in jsdom; a map stands in for it.
vi.mock("idb-keyval", () => {
  const db = new Map<string, unknown>();
  return {
    get: async (k: string) => db.get(k),
    set: async (k: string, v: unknown) => void db.set(k, v),
    del: async (k: string) => void db.delete(k),
  };
});

describe("Open in mMusicScore", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports ready to the export page and adds the song it sends after confirming", async () => {
    const opener = { postMessage: vi.fn() };
    vi.stubGlobal("opener", opener);
    vi.stubGlobal("confirm", () => true);
    history.replaceState(null, "", "/#import");

    receiveFromExport();
    expect(opener.postMessage).toHaveBeenCalledWith({ type: "mmusicscore-ready" }, "*");
    expect(location.hash).toBe("");

    const song = sampleSongs()[1];
    // A message from anywhere else is ignored.
    dispatchEvent(new MessageEvent("message", { data: { type: "mmusicscore-data", name: "x", json: songToJSON(sampleSongs()[0]) } }));
    dispatchEvent(new MessageEvent("message", { source: opener as unknown as Window, data: { type: "mmusicscore-data", name: song.title, json: songToJSON(song) } }));
    await vi.waitFor(() => expect(useStore.getState().song.title).toBe(song.title));
    expect(useStore.getState().song.id).not.toBe(song.id);
  });
});
