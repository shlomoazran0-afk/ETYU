import Phaser from "phaser";
import { StateMachine } from "../fsm";
import { sfx } from "../audio";
import type { Player } from "./Player";

export type EnemyKind = "golem" | "wisp" | "crawler";

const STATS: Record<
  EnemyKind,
  {
    hp: number;
    speed: number;
    detect: number;
    attackRange: number;
    damage: number;
    cooldown: number;
    scale: number;
    flying: boolean;
    frames: { idle: string; walk: string; attack: string; hurt: string };
  }
> = {
  golem: {
    hp: 5,
    speed: 55,
    detect: 220,
    attackRange: 52,
    damage: 1,
    cooldown: 900,
    scale: 0.42,
    flying: false,
    frames: {
      idle: "golem_idle",
      walk: "golem_walk",
      attack: "golem_attack",
      hurt: "golem_hurt",
    },
  },
  wisp: {
    hp: 3,
    speed: 90,
    detect: 260,
    attackRange: 46,
    damage: 1,
    cooldown: 1100,
    scale: 0.38,
    flying: true,
    frames: {
      idle: "wisp_idle",
      walk: "wisp_walk",
      attack: "wisp_attack",
      hurt: "wisp_hurt",
    },
  },
  crawler: {
    hp: 4,
    speed: 70,
    detect: 180,
    attackRange: 48,
    damage: 1,
    cooldown: 800,
    scale: 0.4,
    flying: false,
    frames: {
      idle: "crawler_idle",
      walk: "crawler_walk",
      attack: "crawler_attack",
      hurt: "crawler_hurt",
    },
  },
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  kind: EnemyKind;
  fsm = new StateMachine();
  hp: number;
  maxHp: number;
  damage: number;
  dead = false;
  private stats = STATS.golem;
  private dir = -1;
  private homeX: number;
  private patrol = 90;
  private cdUntil = 0;
  private attackUntil = 0;
  private player!: Player;
  private hoverY: number;
  hitThisSwing = false;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
    const st = STATS[kind];
    super(scene, x, y, "enemies", st.frames.idle);
    this.kind = kind;
    this.stats = st;
    this.hp = st.hp;
    this.maxHp = st.hp;
    this.damage = st.damage;
    this.homeX = x;
    this.hoverY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(16);
    if (kind === "wisp") this.setDisplaySize(58, 52);
    else if (kind === "golem") this.setDisplaySize(78, 86);
    else this.setDisplaySize(70, 64);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    const tw = this.frame.width;
    const th = this.frame.height;
    body.setSize(tw * 0.4, th * 0.55);
    body.setOffset(tw * 0.3, th * 0.35);
    if (st.flying) {
      body.allowGravity = false;
    }
    this.buildFsm();
    this.fsm.set("patrol");
  }

  bindPlayer(player: Player) {
    this.player = player;
  }

  private buildFsm() {
    this.fsm
      .add("patrol", { enter: () => this.use("walk") })
      .add("detect", { enter: () => this.use("idle") })
      .add("chase", { enter: () => this.use("walk") })
      .add("attack", { enter: () => this.use("attack") })
      .add("cooldown", { enter: () => this.use("idle") })
      .add("hurt", { enter: () => this.use("hurt") })
      .add("death", {
        enter: () => {
          this.use("hurt");
          this.dead = true;
          const body = this.body as Phaser.Physics.Arcade.Body;
          body.setVelocity(0, this.stats.flying ? -40 : -160);
          sfx.hit();
          this.scene.tweens.add({
            targets: this,
            alpha: 0,
            angle: 50,
            duration: 480,
            onComplete: () => this.destroy(),
          });
        },
      });
  }

  private use(which: "idle" | "walk" | "attack" | "hurt") {
    const f = this.stats.frames[which];
    if (this.texture.has(f)) this.setFrame(f);
  }

  takeHit(fromX: number, dmg: number, knock: number) {
    if (this.dead) return;
    this.hp -= dmg;
    this.setTint(0xffffff);
    this.scene.time.delayedCall(70, () => this.clearTint());
    const body = this.body as Phaser.Physics.Arcade.Body;
    const kdir = Math.sign(this.x - fromX) || -1;
    body.setVelocityX(kdir * knock);
    if (!this.stats.flying) body.setVelocityY(-140);
    this.scene.cameras.main.shake(60, 0.004);
    sfx.hit();
    if (this.hp <= 0) {
      this.fsm.unlock();
      this.fsm.set("death");
      return;
    }
    this.fsm.unlock();
    this.fsm.set("hurt");
    this.fsm.lock(220);
    this.scene.time.delayedCall(220, () => {
      if (!this.dead && this.fsm.is("hurt")) {
        this.fsm.unlock();
        this.fsm.set("chase");
      }
    });
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (this.dead || !this.player || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const p = this.player;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
    const dx = p.x - this.x;

    if (this.fsm.is("hurt", "death")) return;

    // Flying enemies hover through velocity, never by writing to `y`
    // (Arcade Physics overwrites position from the body every step, and
    // gravity is off — so without a spring they drift after attacking).
    if (this.stats.flying && !this.fsm.is("chase", "attack")) {
      const targetY = this.hoverY + Math.sin(time / 300 + this.homeX) * 16;
      body.setVelocityY(Phaser.Math.Clamp((targetY - this.y) * 2.5, -70, 70));
    }

    if (this.fsm.is("attack")) {
      if (time > this.attackUntil) {
        this.fsm.set("cooldown");
        this.cdUntil = time + this.stats.cooldown;
      }
      return;
    }

    if (this.fsm.is("cooldown")) {
      body.setVelocityX(0);
      if (time > this.cdUntil) this.fsm.set(dist < this.stats.detect ? "chase" : "patrol");
      return;
    }

    if (dist < this.stats.detect && this.fsm.is("patrol")) this.fsm.set("detect");
    if (this.fsm.is("detect")) {
      this.fsm.set("chase");
    }

    if (this.fsm.is("chase")) {
      this.dir = Math.sign(dx) || this.dir;
      this.setFlipX(this.dir > 0);
      if (this.stats.flying) {
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        body.setVelocity(
          Math.cos(ang) * this.stats.speed,
          Math.sin(ang) * this.stats.speed * 0.6,
        );
      } else {
        body.setVelocityX(this.dir * this.stats.speed * 1.35);
      }
      if (dist < this.stats.attackRange) this.beginAttack(time);
      if (dist > this.stats.detect * 1.4) this.fsm.set("patrol");
      return;
    }

    // patrol
    if (this.x < this.homeX - this.patrol) this.dir = 1;
    if (this.x > this.homeX + this.patrol) this.dir = -1;
    this.setFlipX(this.dir > 0);
    if (this.stats.flying) {
      body.setVelocityX(this.dir * this.stats.speed * 0.6);
      body.setVelocityY(Math.sin(time / 200) * 20);
    } else {
      body.setVelocityX(this.dir * this.stats.speed);
    }
  }

  private beginAttack(time: number) {
    this.fsm.set("attack");
    this.attackUntil = time + 420;
    this.hitThisSwing = false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    this.scene.time.delayedCall(180, () => {
      if (this.dead || !this.player) return;
      const dist = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.player.x,
        this.player.y,
      );
      if (dist < this.stats.attackRange + 18) {
        this.player.takeHit(this.x, this.damage);
      }
    });
  }
}
