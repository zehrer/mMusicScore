import { emptySong, parseMelody } from "./music";
import type { Song } from "./types";

/** Folk songs and public-domain melodies offered on first start and in File → Add sample songs. */
export function sampleSongs(): Song[] {
  const twinkle = parseMelody(
    "C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2 |" +
      "G4 G4 F4 F4 | E4 E4 D4/2 | G4 G4 F4 F4 | E4 E4 D4/2 |" +
      "C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2",
  );
  const words =
    "Twin- kle, twin- kle, lit- tle star, how I won- der what you are! " +
    "Up a- bove the world so high, like a dia- mond in the sky. " +
    "Twin- kle, twin- kle, lit- tle star, how I won- der what you are!";
  words.split(" ").forEach((w, i) => (twinkle[i].lyric = w));
  return [
    {
      ...emptySong("Twinkle, Twinkle, Little Star"),
      composer: "Traditional",
      tempo: 112,
      notes: twinkle,
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
