import { setPlayVoices, useStore, type PlayVoices } from "../model/store";

/** Which voices Play plays; shown only when the song has a second voice. */
export function PlayVoicesSelect() {
  const two = useStore((s) => !!s.song.second);
  const value = useStore((s) => s.playVoices);
  if (!two) return null;
  return (
    <select className="play-voices" value={value} title="Voices to play" aria-label="Voices to play" onChange={(e) => setPlayVoices(e.target.value as PlayVoices)}>
      <option value="both">Both voices</option>
      <option value="1">Voice 1 only</option>
      <option value="2">Voice 2 only</option>
    </select>
  );
}
