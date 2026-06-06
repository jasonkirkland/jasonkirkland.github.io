/* =====================================================================
   DINOSAUR DATA
   ---------------------------------------------------------------------
   This is the file your daughter can edit to add or change creatures.
   Every creature is one object in the SPECIES array below.

   Fields:
     id        unique short name, no spaces
     name      shown to the player
     emoji     little icon for the menu card
     kind      "dinosaur" | "marine reptile" | "pterosaur"
               (We label these honestly — mosasaurs and pterosaurs are
                NOT dinosaurs, and that's a great thing to learn!)
     diet      "herbivore" | "carnivore" | "omnivore" | "insectivore" | "piscivore"
     period    when it lived
     biome     the world it spawns into: forest | swamp | desert | plains | river | ocean
     length_m  real length in metres (used to size the model)
     colors    { body, belly, accent } hex colors for the low-poly model
     build     "quadruped" | "biped" | "swimmer"
     features  optional flags: { armorPlates, sailBack, frill, crest, longNeck, finned }
     waterBreath  true only for creatures that can stay underwater
     unlockCost   scales needed to unlock (0 = free from the start)
     facts     short, accurate learning facts shown while you play
   ===================================================================== */

export const SPECIES = [
  {
    id: "triceratops",
    name: "Triceratops",
    emoji: "🦏",
    kind: "dinosaur",
    diet: "herbivore",
    period: "Late Cretaceous (~68–66 million years ago)",
    biome: "plains",
    length_m: 9,
    colors: { body: 0x7a6a52, belly: 0xb6a684, accent: 0x9c7b54 },
    build: "quadruped",
    features: { frill: true },
    waterBreath: false,
    unlockCost: 0,
    facts: [
      "Triceratops means \"three-horned face.\" Its frill and horns may have been used for display and defense.",
      "It was a herbivore that ate low-growing plants, using a sharp beak to snip tough vegetation.",
      "It had hundreds of teeth packed in 'batteries' that ground up plants like a living food processor.",
      "A full-grown Triceratops weighed as much as a large elephant — around 6,000–12,000 kg.",
    ],
  },
  {
    id: "velociraptor",
    name: "Velociraptor",
    emoji: "🦖",
    kind: "dinosaur",
    diet: "carnivore",
    period: "Late Cretaceous (~75–71 million years ago)",
    biome: "desert",
    length_m: 2,
    colors: { body: 0x8a6b3a, belly: 0xcbb277, accent: 0x4a3320 },
    build: "biped",
    features: {},
    waterBreath: false,
    unlockCost: 0,
    facts: [
      "Real Velociraptors were only about the size of a turkey — much smaller than in the movies!",
      "Fossils show they had feathers. Many small meat-eating dinosaurs were feathered.",
      "It had a large sickle-shaped claw on each foot, likely used to pin down prey.",
      "It lived in a dry, desert-like environment in what is now Mongolia.",
    ],
  },
  {
    id: "stegosaurus",
    name: "Stegosaurus",
    emoji: "🦕",
    kind: "dinosaur",
    diet: "herbivore",
    period: "Late Jurassic (~155–145 million years ago)",
    biome: "forest",
    length_m: 9,
    colors: { body: 0x5f7050, belly: 0x93a07e, accent: 0x394a2c },
    build: "quadruped",
    features: { armorPlates: true },
    waterBreath: false,
    unlockCost: 0,
    facts: [
      "Stegosaurus had two rows of tall bony plates along its back, probably for display and soaking up heat.",
      "Its tail had four sharp spikes nicknamed the 'thagomizer' — a powerful defense weapon.",
      "Despite being the size of a bus, its brain was only about the size of a hot dog.",
      "It ate low plants like ferns and cycads, since it couldn't reach high branches.",
    ],
  },
  {
    id: "parasaurolophus",
    name: "Parasaurolophus",
    emoji: "🦆",
    kind: "dinosaur",
    diet: "herbivore",
    period: "Late Cretaceous (~76–73 million years ago)",
    biome: "swamp",
    length_m: 10,
    colors: { body: 0x6a5b8a, belly: 0xb3a6cf, accent: 0x423459 },
    build: "quadruped",
    features: { crest: true },
    waterBreath: false,
    unlockCost: 8,
    facts: [
      "Its long, hollow head crest may have worked like a trumpet to make loud, low calls.",
      "It could walk on two legs or four, and likely lived in herds near water.",
      "It's a 'duck-billed' dinosaur with a wide beak for cropping plants.",
      "Different calls may have helped the herd warn each other and stay together.",
    ],
  },
  {
    id: "spinosaurus",
    name: "Spinosaurus",
    emoji: "🐊",
    kind: "dinosaur",
    diet: "piscivore",
    period: "Cretaceous (~99–93 million years ago)",
    biome: "river",
    length_m: 15,
    colors: { body: 0x4f5b6b, belly: 0x9fb0bf, accent: 0x2c3b4a },
    build: "biped",
    features: { sailBack: true, finned: true },
    waterBreath: false,
    unlockCost: 14,
    facts: [
      "Spinosaurus was one of the largest meat-eaters ever — even longer than T. rex.",
      "It spent lots of time in water, hunting fish with cone-shaped teeth and a paddle-like tail.",
      "The tall 'sail' on its back was made of long spines covered in skin.",
      "It still had to surface to breathe air — no dinosaur could breathe underwater.",
    ],
  },
  {
    id: "trex",
    name: "Tyrannosaurus rex",
    emoji: "🦖",
    kind: "dinosaur",
    diet: "carnivore",
    period: "Late Cretaceous (~68–66 million years ago)",
    biome: "forest",
    length_m: 12,
    colors: { body: 0x6b5240, belly: 0xa78b6e, accent: 0x3a2a1d },
    build: "biped",
    features: {},
    waterBreath: false,
    unlockCost: 20,
    facts: [
      "T. rex had one of the strongest bites of any land animal ever — able to crush bone.",
      "Its tiny arms were surprisingly strong, but its huge head and jaws did the real work.",
      "It could grow over 12 metres long and may have had patches of feathers as a youngster.",
      "Its sense of smell was excellent, helping it find prey and carcasses from far away.",
    ],
  },
  {
    id: "mosasaurus",
    name: "Mosasaurus",
    emoji: "🐋",
    kind: "marine reptile",
    diet: "carnivore",
    period: "Late Cretaceous (~82–66 million years ago)",
    biome: "ocean",
    length_m: 15,
    colors: { body: 0x2e5066, belly: 0x9ec3d6, accent: 0x16303f },
    build: "swimmer",
    features: { finned: true },
    waterBreath: true,
    unlockCost: 28,
    facts: [
      "Surprise: Mosasaurus was NOT a dinosaur! It was a giant marine reptile, related to today's lizards and snakes.",
      "It ruled the oceans, eating fish, turtles, and even other mosasaurs.",
      "It breathed air like a whale but spent its whole life in the sea.",
      "It swam using a powerful tail with a fish-like fin and four flippers.",
    ],
  },
];

/** Look up one species object by its id. */
export function getSpecies(id) {
  return SPECIES.find((s) => s.id === id) || null;
}
