import Phaser from "phaser";
import { CAVE_END, FOREST_END, GAME_H, WORLD_H, WORLD_W } from "../const";
import { PLATFORMS, SPAWNS, TOTAL_CRYSTALS } from "../world/levelData";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { BreakablePot, CrystalCore } from "../entities/Pickups";
import { sfx } from "../audio";

export class GameScene extends Phaser.Scene {
  player!: Player;
  enemies!: Phaser.Physics.Arcade.Group;
  solids!: Phaser.Physics.Arcade.StaticGroup;
  oneways!: Phaser.Physics.Arcade.StaticGroup;
  ladders!: Phaser.Physics.Arcade.StaticGroup;
  waters!: Phaser.Physics.Arcade.StaticGroup;
  crystals!: Phaser.Physics.Arcade.Group;
  pots!: Phaser.Physics.Arcade.Group;
  boss: Boss | null = null;
  private sky!: Phaser.GameObjects.TileSprite;
  private ruins!: Phaser.GameObjects.TileSprite;
  private waterT = 0;
  private pausedLocal = false;

  constructor() {
    super("game");
  }

  create() {
    this.registry.set("totalCrystals", TOTAL_CRYSTALS);
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor("#070b14");

    this.sky = this.add
      .tileSprite(0, 0, WORLD_W, WORLD_H, "bg-sky")
      .setOrigin(0, 0)
      .setScrollFactor(0.06)
      .setDepth(-30);
    this.ruins = this.add
      .tileSprite(0, 40, FOREST_END, WORLD_H, "bg-ruins")
      .setOrigin(0, 0)
      .setScrollFactor(0.28)
      .setDepth(-20);

    const forest = this.add
      .image(0, 0, "level-overgrown")
      .setOrigin(0, 0)
      .setDepth(-8);
    forest.setDisplaySize(FOREST_END, WORLD_H);

    const caves = this.add
      .image(FOREST_END - 40, 0, "level-caverns")
      .setOrigin(0, 0)
      .setDepth(-7);
    caves.setDisplaySize(WORLD_W - FOREST_END + 80, WORLD_H);

    this.add
      .rectangle(FOREST_END, WORLD_H / 2, 80, WORLD_H, 0x04060c, 0.35)
      .setDepth(-6);

    this.solids = this.physics.add.staticGroup();
    this.oneways = this.physics.add.staticGroup();
    this.ladders = this.physics.add.staticGroup();
    this.waters = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.crystals = this.physics.add.group();
    this.pots = this.physics.add.group();

    const specials: { kind: string; x: number; y: number; w: number; h: number }[] =
      [];

    for (const p of PLATFORMS) {
      if (
        p.kind === "checkpoint" ||
        p.kind === "unlock-dash" ||
        p.kind === "unlock-double" ||
        p.kind === "boss-gate"
      ) {
        specials.push(p);
        continue;
      }
      const rect = this.add
        .rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0x000000, 0)
        .setVisible(false);
      this.physics.add.existing(rect, true);
      if (p.kind === "solid") this.solids.add(rect);
      else if (p.kind === "oneway") this.oneways.add(rect);
      else if (p.kind === "ladder") this.ladders.add(rect);
      else if (p.kind === "water" || p.kind === "hurt") this.waters.add(rect);
    }

    this.player = new Player(this, 180, 860);
    this.player.setSpawn(180, 860);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player,
      this.oneways,
      undefined,
      (pl, plat) => {
        const body = (pl as Player).body as Phaser.Physics.Arcade.Body;
        const pb = (plat as Phaser.GameObjects.Rectangle)
          .body as Phaser.Physics.Arcade.StaticBody;
        return body.velocity.y >= 0 && body.bottom <= pb.top + 12;
      },
    );

    this.physics.add.overlap(this.player, this.ladders, () => {
      this.player.onLadder = true;
    });

    this.physics.add.overlap(this.player, this.waters, () => {
      this.waterT += this.game.loop.delta;
      if (this.waterT > 380) {
        this.waterT = 0;
        this.player.takeHit(this.player.x, 1);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-320);
      }
    });

    for (const s of SPAWNS) {
      if (s.type === "crystal") {
        const c = new CrystalCore(this, s.x, s.y);
        this.crystals.add(c);
      } else if (s.type === "pot") {
        const pot = new BreakablePot(this, s.x, s.y);
        this.pots.add(pot);
      } else if (s.type === "boss") {
        this.boss = new Boss(this, s.x, s.y);
        this.boss.bindPlayer(this.player);
        this.physics.add.collider(this.boss, this.solids);
      } else {
        const e = new Enemy(this, s.x, s.y, s.type);
        e.bindPlayer(this.player);
        this.enemies.add(e);
      }
    }

    this.physics.add.collider(this.enemies, this.solids);
    this.physics.add.collider(this.enemies, this.oneways);
    this.physics.add.collider(this.pots, this.solids);

    this.physics.add.overlap(this.player, this.enemies, (pl, en) => {
      const player = pl as Player;
      const enemy = en as Enemy;
      if (player.fsm.is("dash") || enemy.dead) return;
      player.takeHit(enemy.x, enemy.damage);
    });

    if (this.boss) {
      this.physics.add.overlap(this.player, this.boss, (pl, b) => {
        const player = pl as Player;
        const boss = b as Boss;
        if (player.fsm.is("dash") || boss.dead) return;
        player.takeHit(boss.x, boss.damage);
      });
    }

    this.physics.add.overlap(this.player.attackHitbox, this.enemies, (_h, en) => {
      const enemy = en as Enemy;
      if (!this.player.hitboxActive || enemy.dead) return;
      if (enemy.getData("swing") === this.player.comboUntil) return;
      enemy.setData("swing", this.player.comboUntil);
      enemy.takeHit(
        this.player.x,
        this.player.lastAttackDamage,
        this.player.lastKnockback,
      );
    });

    if (this.boss) {
      this.physics.add.overlap(this.player.attackHitbox, this.boss, () => {
        if (!this.player.hitboxActive || !this.boss || this.boss.dead) return;
        if (this.boss.getData("swing") === this.player.comboUntil) return;
        this.boss.setData("swing", this.player.comboUntil);
        this.boss.takeHit(this.player.x, this.player.lastAttackDamage);
      });
    }

    this.physics.add.overlap(this.player, this.crystals, (_p, c) => {
      (c as CrystalCore).collect(this.player);
    });

    this.physics.add.overlap(this.player.attackHitbox, this.pots, (_h, pot) => {
      if (!this.player.hitboxActive) return;
      (pot as BreakablePot).smash((x, y) => {
        const c = new CrystalCore(this, x, y);
        this.crystals.add(c);
      });
    });

    for (const s of specials) {
      const zone = this.add.zone(s.x + s.w / 2, s.y + s.h / 2, s.w + 20, s.h + 20);
      this.physics.add.existing(zone, true);
      if (s.kind === "checkpoint") {
        const beacon = this.add.image(s.x, s.y, "items", "crystal").setScale(0.22).setDepth(9);
        beacon.setTint(0xf0d48a);
        this.tweens.add({
          targets: beacon,
          y: s.y - 8,
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
        this.physics.add.overlap(this.player, zone, () => {
          this.player.setSpawn(s.x, s.y - 40);
          beacon.setTint(0x7ed56a);
        });
      }
      if (s.kind === "unlock-double") {
        const shrine = this.add.image(s.x, s.y, "items", "crystal").setScale(0.3).setDepth(9);
        shrine.setTint(0x9be58a);
        this.physics.add.overlap(this.player, zone, () => {
          if (this.player.hasDoubleJump) return;
          this.player.hasDoubleJump = true;
          sfx.unlock();
          shrine.setAlpha(0.35);
          this.player.emitHud();
          this.toast("DOUBLE JUMP AWAKENED");
        });
      }
      if (s.kind === "unlock-dash") {
        const shrine = this.add.image(s.x, s.y, "items", "crystal").setScale(0.3).setDepth(9);
        shrine.setTint(0xc45cff);
        this.physics.add.overlap(this.player, zone, () => {
          if (this.player.hasDash) return;
          this.player.hasDash = true;
          sfx.unlock();
          shrine.setAlpha(0.35);
          this.player.emitHud();
          this.toast("PHANTOM DASH AWAKENED");
        });
      }
    }

    this.cameras.main.startFollow(this.player, true, 0.12, 0.14);
    this.cameras.main.setDeadzone(90, 50);
    this.cameras.main.setLerp(0.12, 0.14);

    this.input.keyboard?.on("keydown-ESC", () => {
      const fn = this.registry.get("onEvent") as ((t: string) => void) | undefined;
      fn?.("pause");
    });

    sfx.startMusic();
    this.player.emitHud();
    this.toast("THE OVERGROWTH STIRS");

    void GAME_H;
    void CAVE_END;
  }

  toast(text: string) {
    const cam = this.cameras.main;
    const t = this.add
      .text(cam.worldView.centerX, cam.worldView.centerY - 80, text, {
        fontFamily: "Press Start 2P",
        fontSize: "10px",
        color: "#8af7ff",
        stroke: "#070b14",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setScrollFactor(1);
    this.tweens.add({
      targets: t,
      y: t.y - 40,
      alpha: 0,
      duration: 1600,
      onComplete: () => t.destroy(),
    });
  }

  update() {
    this.player.onLadder = false;
    this.sky.tilePositionX = this.cameras.main.scrollX * 0.15;
    this.ruins.tilePositionX = this.cameras.main.scrollX * 0.08;
    if (this.registry.get("paused") && !this.pausedLocal) {
      this.physics.world.pause();
      this.pausedLocal = true;
    } else if (!this.registry.get("paused") && this.pausedLocal) {
      this.physics.world.resume();
      this.pausedLocal = false;
    }
  }
}
