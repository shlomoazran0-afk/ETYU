import Phaser from "phaser";
import {
  chromaKeyFromEdges,
  cropFrame,
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
    this.load.image("hud_raw", "/images/hud.png");

    this.add.rectangle(w / 2, h - 48, 320, 14, 0x1a2238);
    const bar = this.add.rectangle(w / 2 - 158, h - 48, 4, 8, 0x5cf0ff).setOrigin(0, 0.5);
    const label = this.add
      .text(w / 2, h - 72, "AWAKENING THE GROVE...", {
        fontFamily: "VT323",
        fontSize: "18px",
        color: "#8af7ff",
      })
      .setOrigin(0.5);

    this.load.on("progress", (p: number) => {
      bar.width = 316 * p;
      label.setText(`AWAKENING THE GROVE... ${Math.floor(p * 100)}%`);
    });
  }

  create() {
    const art = this.add.image(GAME_W / 2, GAME_H / 2, "title-art");
    art.setDisplaySize(GAME_W, GAME_H).setAlpha(0.35);

    chromaKeyFromEdges(this, "player_raw", "player");
    chromaKeyFromEdges(this, "enemies_raw", "enemies");
    chromaKeyFromEdges(this, "boss_raw", "boss");
    chromaKeyFromEdges(this, "items_raw", "items");
    chromaKeyFromEdges(this, "hud_raw", "hud");

    sliceStrip(this, "player", ["idle", "run", "jump", "attack", "dash", "hurt"]);
    sliceStrip(this, "boss", ["idle", "walk", "attack", "hurt"]);
    sliceGrid(this, "enemies", 4, 3, [
      ["golem_idle", "golem_walk", "golem_attack", "golem_hurt"],
      ["wisp_idle", "wisp_walk", "wisp_attack", "wisp_hurt"],
      ["crawler_idle", "crawler_walk", "crawler_attack", "crawler_hurt"],
    ]);
    cropFrame(this, "items", "crystal", 0.02, 0.1, 0.16, 0.34);
    cropFrame(this, "items", "pot", 0.4, 0.06, 0.18, 0.4);
    cropFrame(this, "items", "spark", 0.02, 0.12, 0.08, 0.16);
    cropFrame(this, "items", "heart", 0.56, 0.06, 0.14, 0.24);
    cropFrame(this, "hud", "hpframe", 0.05, 0.08, 0.4, 0.18);

    for (const key of ["player", "enemies", "boss", "items", "bg-sky", "bg-ruins", "level-overgrown", "level-caverns"]) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    this.time.delayedCall(240, () => this.scene.start("game"));
  }
}
