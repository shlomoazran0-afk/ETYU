import Phaser from "phaser";
import { sfx } from "../audio";
import type { Player } from "./Player";

export class CrystalCore extends Phaser.Physics.Arcade.Sprite {
  collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const tex = scene.textures.exists("items") ? "items" : "player";
    const frame = scene.textures.get(tex).has("crystal") ? "crystal" : undefined;
    super(scene, x, y, tex, frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(12);
    this.setDisplaySize(30, 38);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setSize(this.frame.width * 0.5, this.frame.height * 0.5);
    scene.tweens.add({
      targets: this,
      y: y - 10,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.setTint(0x8af7ff);
  }

  collect(player: Player) {
    player.crystals += 1;
    sfx.collect();
    player.emitHud();
    this.scene.tweens.add({
      targets: this,
      y: this.y - 30,
      alpha: 0,
      scale: this.scale * 1.4,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }
}

export class BreakablePot extends Phaser.Physics.Arcade.Sprite {
  broken = false;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    const tex = scene.textures.exists("items") ? "items" : "player";
    const frame = scene.textures.get(tex).has("pot") ? "pot" : undefined;
    super(scene, x, y, tex, frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(11);
    this.setDisplaySize(34, 40);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.allowGravity = false;
    body.setSize(this.frame.width * 0.5, this.frame.height * 0.6);
  }

  smash(spawnCrystal: (x: number, y: number) => void) {
    if (this.broken) return;
    this.broken = true;
    sfx.breakPot();
    spawnCrystal(this.x, this.y - 12);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleY: 0.2,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }
}
