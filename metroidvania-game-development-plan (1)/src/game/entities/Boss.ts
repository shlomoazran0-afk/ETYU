import Phaser from "phaser";
import { StateMachine } from "../fsm";
import { sfx } from "../audio";
import type { Player } from "./Player";

export class Boss extends Phaser.Physics.Arcade.Sprite {
  fsm = new StateMachine();
  hp = 28;
  maxHp = 28;
  dead = false;
  engaged = false;
  damage = 2;
  private dir = -1;
  private cdUntil = 0;
  private player!: Player;
  private phase = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "boss", "idle");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(17);
    this.setDisplaySize(168, 188);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setImmovable(true);
    const tw = this.frame.width;
    const th = this.frame.height;
    body.setSize(tw * 0.4, th * 0.62);
    body.setOffset(tw * 0.3, th * 0.3);
    this.buildFsm();
    this.fsm.set("idle");
  }

  bindPlayer(player: Player) {
    this.player = player;
  }

  private buildFsm() {
    this.fsm
      .add("idle", { enter: () => this.use("idle") })
      .add("patrol", { enter: () => this.use("walk") })
      .add("detect", { enter: () => this.use("idle") })
      .add("chase", { enter: () => this.use("walk") })
      .add("attack", { enter: () => this.use("attack") })
      .add("cooldown", { enter: () => this.use("idle") })
      .add("hurt", { enter: () => this.use("hurt") })
      .add("death", {
        enter: () => {
          this.dead = true;
          this.use("hurt");
          sfx.bossHit();
          this.scene.cameras.main.shake(500, 0.02);
          this.scene.tweens.add({
            targets: this,
            alpha: 0,
            y: this.y + 40,
            duration: 1400,
            onComplete: () => {
              const fn = this.scene.registry.get("onEvent") as
                | ((t: string) => void)
                | undefined;
              fn?.("victory");
              this.destroy();
            },
          });
        },
      });
  }

  private use(name: "idle" | "walk" | "attack" | "hurt") {
    if (this.texture.has(name)) this.setFrame(name);
  }

  takeHit(fromX: number, dmg: number) {
    if (this.dead) return;
    this.hp -= dmg;
    this.setTint(0xff88ff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    this.scene.cameras.main.shake(100, 0.008);
    sfx.bossHit();
    this.phase = this.hp < 10 ? 3 : this.hp < 18 ? 2 : 1;
    const fn = this.scene.registry.get("onEvent") as
      | ((t: string, d: unknown) => void)
      | undefined;
    fn?.("boss-hp", { hp: this.hp, max: this.maxHp, name: "Grove Colossus" });
    if (this.hp <= 0) {
      this.fsm.unlock();
      this.fsm.set("death");
      return;
    }
    this.fsm.unlock();
    this.fsm.set("hurt");
    this.fsm.lock(180);
    this.scene.time.delayedCall(180, () => {
      if (!this.dead && this.fsm.is("hurt")) {
        this.fsm.unlock();
        this.fsm.set("chase");
      }
    });
    void fromX;
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (this.dead || !this.player || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);

    if (!this.engaged && dist < 420) {
      this.engaged = true;
      const fn = this.scene.registry.get("onEvent") as
        | ((t: string, d: unknown) => void)
        | undefined;
      fn?.("boss-hp", { hp: this.hp, max: this.maxHp, name: "Grove Colossus" });
      this.fsm.set("detect");
    }
    if (!this.engaged) return;
    if (this.fsm.is("hurt", "death")) return;

    if (this.fsm.is("attack")) return;
    if (this.fsm.is("cooldown")) {
      body.setVelocityX(0);
      if (time > this.cdUntil) this.fsm.set("chase");
      return;
    }

    if (this.fsm.is("detect")) this.fsm.set("chase");

    if (this.fsm.is("chase") || this.fsm.is("patrol") || this.fsm.is("idle")) {
      this.fsm.set("chase");
      this.dir = Math.sign(this.player.x - this.x) || this.dir;
      this.setFlipX(this.dir > 0);
      const spd = 40 + this.phase * 18;
      body.setVelocityX(this.dir * spd);
      if (dist < 90) this.slam(time);
      else if (this.phase >= 2 && dist > 160 && time > this.cdUntil + 400) {
        this.crystalVolley();
        this.cdUntil = time + 1600 - this.phase * 200;
      }
    }
    void delta;
  }

  private slam(time: number) {
    this.fsm.set("attack");
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    this.scene.time.delayedCall(220, () => {
      if (this.dead) return;
      this.scene.cameras.main.shake(220, 0.014);
      sfx.bossHit();
      if (!this.player) return;
      if (Math.abs(this.player.x - this.x) < 120 && Math.abs(this.player.y - this.y) < 90) {
        this.player.takeHit(this.x, this.damage);
      }
    });
    this.scene.time.delayedCall(520, () => {
      if (this.dead) return;
      this.fsm.set("cooldown");
      this.cdUntil = time + 900 - this.phase * 120;
    });
  }

  private crystalVolley() {
    this.fsm.set("attack");
    if (!this.scene.textures.exists("items")) {
      this.fsm.set("cooldown");
      return;
    }
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 140, () => {
        if (this.dead || !this.player) return;
        const frame = this.scene.textures.get("items").has("crystal")
          ? "crystal"
          : undefined;
        const shard = this.scene.physics.add.image(this.x, this.y - 40, "items", frame);
        shard.setScale(0.22).setTint(0xc45cff).setDepth(18);
        const b = shard.body as Phaser.Physics.Arcade.Body;
        b.allowGravity = false;
        const ang = Math.atan2(this.player.y - shard.y, this.player.x - shard.x);
        b.setVelocity(Math.cos(ang) * 260, Math.sin(ang) * 260);
        this.scene.physics.add.overlap(this.player, shard, () => {
          this.player.takeHit(this.x, 1);
          shard.destroy();
        });
        this.scene.time.delayedCall(1800, () => shard.destroy());
      });
    }
    this.scene.time.delayedCall(700, () => {
      if (!this.dead) this.fsm.set("cooldown");
    });
  }
}
