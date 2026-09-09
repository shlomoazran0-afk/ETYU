export const GAME_W = 960;
export const GAME_H = 540;
export const WORLD_W = 5600;
export const WORLD_H = 1080;

export const FOREST_END = 2700;
export const CAVE_END = 4300;

export const GRAVITY = 780;

export const PLAYER = {
  speed: 220,
  airSpeed: 205,
  jump: -520,
  doubleJump: -490,
  coyoteMs: 110,
  bufferMs: 130,
  dashSpeed: 520,
  dashMs: 170,
  dashCooldownMs: 520,
  iframeMs: 720,
  maxHp: 10,
  maxMana: 100,
  manaRegen: 14,
  dashMana: 18,
};

export const COMBO = {
  startup: [70, 60, 110],
  active: [110, 120, 160],
  recover: [90, 100, 200],
  damage: [1, 1, 2],
  knockback: [140, 180, 320],
  hitW: [46, 54, 72],
  hitH: [30, 34, 42],
  windowMs: 420,
};

export const COLORS = {
  cyan: 0x5cf0ff,
  purple: 0xc45cff,
  moss: 0x7ed56a,
  gold: 0xf0d48a,
  blood: 0xe23d4a,
};
