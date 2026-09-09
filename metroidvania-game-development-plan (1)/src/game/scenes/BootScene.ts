import Phaser from "phaser";
import {
  chromaKeyFromEdges,
  cleanupFrameEdges,
  cropFrame,
  featherFrameEdge,
  sliceGrid,
  sliceStrip,
} from "../chroma";
import { GAME_H, GAME_W } from "../const";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    const w = GAME_W;
    const h = GAME_H;
    this.add.rectangle(w / 2, h / 2, w, h, 0x070b14);
    this.load.image("title-art", "/images/title-art.png");
    this.load.image("bg-sky", "/images/bg-sky.png");
    this.load.image("bg-ruins", "/images/bg-ruins.png");
    this.load.image("level-overgrown", "/images/level-overgrown.png");
    this.load.image("level-caverns", "/images/level-caverns.png");
    this.load.image("player_raw", "/images/player.png");
    this.load.image("enemies_raw", "/images/enemies.png");
    this.load.image("boss_raw", "/images/boss.png");
    this.load.image("items_raw", "/images/items.png");

    this.add.rectangle(w / 2, h - 48, 320, 14, 0x1a2238);
    const bar = this.add
      .rectangle(w / 2 - 158, h - 48, 316, 8, 0x5cf0ff)
      .setOrigin(0, 0.5);
    bar.scaleX = 0.001;
    const label = this.add
      .text(w / 2, h - 72, "AWAKENING THE GROVE...", {
        fontFamily: "VT323",
        fontSize: "18px",
        color: "#8af7ff",
      })
      .setOrigin(0.5);

    this.load.on("progress", (p: number) => {
      bar.scaleX = Math.max(0.001, p);
      label.setText(`AWAKENING THE GROVE... ${Math.floor(p * 100)}%`);
    });
  }

  create() {
    const art = this.add.image(GAME_W / 2, GAME_H / 2, "title-art");
    art.setDisplaySize(GAME_W, GAME_H).setAlpha(0.35);

    // Kill the magenta backdrop on every character/item sheet.
    chromaKeyFromEdges(this, "player_raw", "player");
    chromaKeyFromEdges(this, "enemies_raw", "enemies");
    chromaKeyFromEdges(this, "boss_raw", "boss");
    chromaKeyFromEdges(this, "items_raw", "items");

    // Player sheet is a 4x2 pose grid (each cell 448x504).
    sliceGrid(this, "player", 4, 2, [
      ["idle", "run", "jump", "attack"],
      ["dash", "slash", "glide", "hurt"],
    ]);
    // Boss sheet is a single row of 4 poses (448x1008 each).
    sliceStrip(this, "boss", ["idle", "walk", "attack", "hurt"]);
    // Enemy sheet is a 4x3 grid (448x336 each): golem / wisp / crawler rows.
    sliceGrid(this, "enemies", 4, 3, [
      ["golem_idle", "golem_walk", "golem_attack", "golem_hurt"],
      ["wisp_idle", "wisp_walk", "wisp_attack", "wisp_hurt"],
      ["crawler_idle", "crawler_walk", "crawler_attack", "crawler_hurt"],
    ]);
    // Item crops use absolute pixel rects measured from the 4x4 item grid.
    cropFrame(this, "items", "crystal", 90, 20, 240, 285);
    cropFrame(this, "items", "pot", 470, 322, 270, 266);
    cropFrame(this, "items", "spark", 1268, 33, 266, 266);
    cropFrame(this, "items", "heart", 88, 638, 256, 228);

    // Shave neighbor-pose fragments left across frame borders.
    cleanupFrameEdges(this, "player");
    cleanupFrameEdges(this, "enemies");
    cleanupFrameEdges(this, "boss");
    cleanupFrameEdges(this, "items");
    // Dash streaks were painted across the cell border — fade, don't hard-cut.
    featherFrameEdge(this, "player", "dash", "right", 18);
    featherFrameEdge(this, "player", "dash", "left", 10);

    for (const key of ["player", "enemies", "boss", "items", "bg-sky", "bg-ruins", "level-overgrown", "level-caverns"]) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    this.time.delayedCall(240, () => this.scene.start("game"));
  }
}
