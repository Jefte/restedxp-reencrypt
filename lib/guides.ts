export interface GuideConfig {
  id: string;
  title: string;
  expansion: string;
  description: string;
  levels: string;
  image: string;
  guideUrl: string;
  sourceTag: string;
}

export const GUIDES: GuideConfig[] = [
  {
    id: "classic",
    title: "Classic Era Speedrun Guide — Both Factions",
    expansion: "Classic Era",
    description:
      "Classic Era speedrun routes for both factions; starter routes are included with the base addon.",
    levels: "1-60",
    image: "/bg-leather.jpg",
    guideUrl: "/guide_classic_player_1234.txt",
    sourceTag: "player#1234",
  },
  {
    id: "classic-hardcore",
    title: "Classic Hardcore Survival Guide — Both Factions",
    expansion: "Classic Hardcore",
    description:
      "Hardcore-safe Classic leveling routes for Alliance and Horde.",
    levels: "1-60",
    image: "/bg-leather.jpg",
    guideUrl: "/guide_classic_hardcore_player_1234.txt",
    sourceTag: "player#1234",
  },
  {
    id: "forever",
    title: "Forever Leveling Guide — Both Factions",
    expansion: "WoW Forever",
    description:
      "Complete WoW Forever leveling and dungeon guide collection for Alliance and Horde.",
    levels: "1-60",
    image: "/bg-leather.jpg",
    guideUrl: "/guide_forever_player_1234.txt",
    sourceTag: "player#1234",
  },
  {
    id: "midnight",
    title: "Midnight Leveling Guide",
    expansion: "Midnight",
    description: "Latest expansion leveling guide for both factions.",
    levels: "80-90",
    image: "/bg-midnight-art.jpg",
    guideUrl: "/guide_player_1234.txt",
    sourceTag: "player#1234",
  },
  {
    id: "mop",
    title: "Mists of Pandaria Guide — Both Factions",
    expansion: "Mists of Pandaria",
    description:
      "Complete MoP leveling, preparation, reputation, and Pandaria routes for both factions.",
    levels: "1-90",
    image: "/bg-leather.jpg",
    guideUrl: "/guide_mop_player_1234.txt",
    sourceTag: "player#1234",
  },
  {
    id: "tbc",
    title: "TBC Speedrun Guide",
    expansion: "The Burning Crusade",
    description: "Classic TBC speedrun guide for both Horde and Alliance.",
    levels: "1-70",
    image: "/bg-tbc.jpg",
    guideUrl: "/guide_tbc_player_1234.txt",
    sourceTag: "player#1234",
  },
  {
    id: "tbc-hardcore",
    title: "TBC Hardcore Survival Guide — Both Factions",
    expansion: "The Burning Crusade Hardcore",
    description:
      "Hardcore-safe TBC leveling routes and attunement guides for Alliance and Horde.",
    levels: "1-70",
    image: "/bg-tbc.jpg",
    guideUrl: "/guide_tbc_hardcore_player_1234.txt",
    sourceTag: "player#1234",
  },
  {
    id: "wotlk",
    title: "WotLK Leveling Guide",
    expansion: "Wrath of the Lich King",
    description: "Full 1-80 leveling guide for both factions.",
    levels: "1-80",
    image: "/bg-wotlk.jpg",
    guideUrl: "/guide_wotlk_player_1234.txt",
    sourceTag: "player#1234",
  },
];
