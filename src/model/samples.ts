import { emptySong, parseMelody } from "./music";
import type { NoteEvent, Song } from "./types";

/** Puts space-separated syllables on the notes; "Twin-" joins to the next syllable. */
function withLyrics(notes: NoteEvent[], words: string) {
  words.split(" ").forEach((w, i) => (notes[i].lyric = w));
  return notes;
}

/** Folk songs and public-domain melodies offered on first start and in File → Add sample songs. */
export function sampleSongs(): Song[] {
  return [
    {
      ...emptySong("Alle meine Entchen"),
      composer: "Volkslied",
      tempo: 112,
      notes: withLyrics(
        parseMelody("C4 D4 E4 F4 | G4/2 G4/2 | A4 A4 A4 A4 | G4/1 | A4 A4 A4 A4 | G4/1 | F4 F4 F4 F4 | E4/2 E4/2 | D4 D4 D4 D4 | C4/1"),
        "Al- le mei- ne Ent- chen schwim- men auf dem See, schwim- men auf dem See, " +
          "Köpf- chen in das Was- ser, Schwänz- chen in die Höh'.",
      ),
    },
    {
      ...emptySong("Twinkle, Twinkle, Little Star"),
      composer: "Traditional",
      tempo: 112,
      notes: withLyrics(
        parseMelody(
          "C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2 |" +
            "G4 G4 F4 F4 | E4 E4 D4/2 | G4 G4 F4 F4 | E4 E4 D4/2 |" +
            "C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2",
        ),
        "Twin- kle, twin- kle, lit- tle star, how I won- der what you are! " +
          "Up a- bove the world so high, like a dia- mond in the sky. " +
          "Twin- kle, twin- kle, lit- tle star, how I won- der what you are!",
      ),
    },
    {
      ...emptySong("Ode to Joy"),
      composer: "Ludwig van Beethoven",
      tempo: 120,
      fifths: 2,
      notes: parseMelody(
        "F4 F4 G4 A4 | A4 G4 F4 E4 | D4 D4 E4 F4 | F4/4. E4/8 E4/2 |" +
          "F4 F4 G4 A4 | A4 G4 F4 E4 | D4 D4 E4 F4 | E4/4. D4/8 D4/2 |" +
          "E4 E4 F4 D4 | E4 F4/8 G4/8 F4 D4 | E4 F4/8 G4/8 F4 E4 | D4 E4 A3/2 |" +
          "F4 F4 G4 A4 | A4 G4 F4 E4 | D4 D4 E4 F4 | E4/4. D4/8 D4/2",
      ),
    },
  ];
}
