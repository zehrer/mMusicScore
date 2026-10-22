import { emptySong, parseMelody } from "./music";
import type { Song } from "./types";

/** Folk songs and public-domain melodies offered on first start and in File → Add sample songs. */
export function sampleSongs(): Song[] {
  return [
    {
      ...emptySong("Twinkle, Twinkle, Little Star"),
      composer: "Traditional",
      tempo: 112,
      notes: parseMelody(
        "C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2 |" +
          "G4 G4 F4 F4 | E4 E4 D4/2 | G4 G4 F4 F4 | E4 E4 D4/2 |" +
          "C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2",
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
