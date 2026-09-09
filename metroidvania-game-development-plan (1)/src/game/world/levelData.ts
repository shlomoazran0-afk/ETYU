export type RectKind =
  | "solid"
  | "oneway"
  | "ladder"
  | "water"
  | "hurt"
  | "checkpoint"
  | "unlock-dash"
  | "unlock-double"
  | "boss-gate";

export type PlatformDef = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: RectKind;
};

export type SpawnDef = {
  type: "golem" | "wisp" | "crawler" | "boss" | "crystal" | "pot";
  x: number;
  y: number;
};

export const PLATFORMS: PlatformDef[] = [
  // Forest floor
  { x: 0, y: 980, w: 820, h: 120, kind: "solid" },
  { x: 1220, y: 980, w: 1480, h: 120, kind: "solid" },
  { x: 820, y: 1040, w: 400, h: 50, kind: "water" },

  // Tree & mid platforms
  { x: 70, y: 820, w: 230, h: 26, kind: "oneway" },
  { x: 250, y: 680, w: 190, h: 24, kind: "oneway" },
  { x: 40, y: 540, w: 160, h: 24, kind: "oneway" },
  { x: 780, y: 760, w: 460, h: 30, kind: "solid" },
  { x: 980, y: 620, w: 180, h: 22, kind: "oneway" },
  { x: 1280, y: 840, w: 220, h: 24, kind: "oneway" },
  { x: 1520, y: 720, w: 260, h: 26, kind: "oneway" },
  { x: 1780, y: 600, w: 210, h: 24, kind: "oneway" },
  { x: 2040, y: 760, w: 280, h: 28, kind: "solid" },
  { x: 2320, y: 640, w: 200, h: 24, kind: "oneway" },
  { x: 2480, y: 500, w: 180, h: 24, kind: "oneway" },
  { x: 2360, y: 500, w: 28, h: 480, kind: "ladder" },
  { x: 2580, y: 880, w: 160, h: 24, kind: "oneway" },

  // Transition ledge into caverns
  { x: 2680, y: 980, w: 220, h: 120, kind: "solid" },
  { x: 2860, y: 860, w: 180, h: 26, kind: "oneway" },

  // Crystal caverns — distinct basalt ledges
  { x: 3000, y: 980, w: 1300, h: 120, kind: "solid" },
  { x: 3080, y: 820, w: 200, h: 24, kind: "oneway" },
  { x: 3320, y: 700, w: 240, h: 24, kind: "oneway" },
  { x: 3580, y: 560, w: 200, h: 24, kind: "oneway" },
  { x: 3780, y: 700, w: 180, h: 24, kind: "oneway" },
  { x: 3960, y: 820, w: 220, h: 24, kind: "oneway" },
  { x: 3480, y: 880, w: 160, h: 22, kind: "oneway" },
  { x: 3200, y: 480, w: 150, h: 22, kind: "oneway" },
  { x: 3720, y: 430, w: 170, h: 22, kind: "oneway" },
  { x: 4140, y: 640, w: 160, h: 24, kind: "oneway" },
  { x: 4040, y: 430, w: 28, h: 400, kind: "ladder" },
  { x: 3380, y: 1040, w: 260, h: 40, kind: "water" },

  // Boss gate & arena
  { x: 4300, y: 980, w: 1300, h: 120, kind: "solid" },
  { x: 4380, y: 840, w: 140, h: 24, kind: "oneway" },
  { x: 4520, y: 720, w: 120, h: 24, kind: "oneway" },
  { x: 5200, y: 820, w: 180, h: 24, kind: "oneway" },
  { x: 5400, y: 700, w: 160, h: 24, kind: "oneway" },

  { x: 380, y: 740, w: 80, h: 80, kind: "checkpoint" },
  { x: 2020, y: 700, w: 80, h: 80, kind: "checkpoint" },
  { x: 3120, y: 740, w: 100, h: 90, kind: "unlock-dash" },
  { x: 210, y: 600, w: 100, h: 90, kind: "unlock-double" },
  { x: 4280, y: 900, w: 40, h: 80, kind: "boss-gate" },
];

export const SPAWNS: SpawnDef[] = [
  { type: "golem", x: 980, y: 700 },
  { type: "golem", x: 1680, y: 940 },
  { type: "golem", x: 2140, y: 700 },
  { type: "crawler", x: 520, y: 940 },
  { type: "crawler", x: 1460, y: 940 },
  { type: "crawler", x: 2580, y: 840 },
  { type: "wisp", x: 1100, y: 520 },
  { type: "wisp", x: 1900, y: 480 },
  { type: "wisp", x: 2480, y: 380 },
  { type: "golem", x: 3400, y: 940 },
  { type: "crawler", x: 3660, y: 940 },
  { type: "wisp", x: 3360, y: 620 },
  { type: "wisp", x: 3760, y: 380 },
  { type: "golem", x: 4020, y: 940 },
  { type: "crawler", x: 3920, y: 780 },
  { type: "boss", x: 5000, y: 860 },

  { type: "crystal", x: 140, y: 780 },
  { type: "crystal", x: 300, y: 640 },
  { type: "crystal", x: 80, y: 500 },
  { type: "crystal", x: 900, y: 720 },
  { type: "crystal", x: 1120, y: 580 },
  { type: "crystal", x: 1360, y: 800 },
  { type: "crystal", x: 1600, y: 680 },
  { type: "crystal", x: 1860, y: 560 },
  { type: "crystal", x: 2100, y: 720 },
  { type: "crystal", x: 2380, y: 600 },
  { type: "crystal", x: 2560, y: 460 },
  { type: "crystal", x: 2640, y: 840 },
  { type: "crystal", x: 3120, y: 780 },
  { type: "crystal", x: 3380, y: 660 },
  { type: "crystal", x: 3620, y: 520 },
  { type: "crystal", x: 3840, y: 660 },
  { type: "crystal", x: 3260, y: 440 },
  { type: "crystal", x: 3780, y: 390 },
  { type: "crystal", x: 4180, y: 600 },
  { type: "crystal", x: 4480, y: 800 },
  { type: "crystal", x: 5280, y: 780 },
  { type: "crystal", x: 5460, y: 660 },
  { type: "crystal", x: 1020, y: 940 },
  { type: "crystal", x: 700, y: 940 },

  { type: "pot", x: 180, y: 950 },
  { type: "pot", x: 640, y: 950 },
  { type: "pot", x: 1320, y: 950 },
  { type: "pot", x: 1720, y: 950 },
  { type: "pot", x: 2080, y: 730 },
  { type: "pot", x: 2520, y: 950 },
  { type: "pot", x: 3140, y: 950 },
  { type: "pot", x: 3540, y: 950 },
  { type: "pot", x: 4100, y: 950 },
  { type: "pot", x: 4440, y: 950 },
];

export const TOTAL_CRYSTALS =
  SPAWNS.filter((s) => s.type === "crystal").length +
  SPAWNS.filter((s) => s.type === "pot").length;
