import Phaser from "phaser";
import { COMBO, PLAYER } from "../const";
import { StateMachine } from "../fsm";
import { sfx } from "../audio";

export class Player extends Phaser.Physics.Arcade.Sprite {
  fsm = new StateMachine();
  hp = PLAYER.maxHp;
  maxHp = PLAYER.maxHp;
  mana = PLAYER.maxMana;
  maxMana = PLAYER.maxMana;
  crystals = 0;
  hasDoubleJump = false;
  hasDash = false;
  facing = 1;
  invulnUntil = 0;
  attackHitbox: Phaser.Physics.Arcade.Image;
  hitboxActive = false;
  comboStep = 0;
  comboUntil = 0;
  lastAttackDamage = 1;
  lastKnockback = 140;
  onLadder = false;
  spawnX = 160;
  spawnY = 860;

  private coyote = 0;
  private buffer = 0;
  private jumps = 0;
  private dashUntil = 0;
  private dashCd = 0;
  private wasGrounded = true;
  private trailT = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyJump!: Phaser.Input.Keyboard.Key;
  private keyJump2!: Phaser.Input.Keyboard.Key;
  private keyDash!: Phaser.Input.Keyboard.Key;
  private keyDash2!: Phaser.Input.Keyboard.Key;
  private keyAtk!: Phaser.Input.Keyboard.Key;
  private keyAtk2!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private lastHud = "";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player", "idle");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(380, 820);
    body.setDragX(1400);
    this.resizeBody();

    this.attackHitbox = scene.physics.add.image(x, y, "player", "attack");
    this.attackHitbox.setVisible(false);
    const hb = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    hb.allowGravity = false;
    hb.setImmovable(true);
    this.attackHitbox.disableBody(true, true);

    this.buildFsm();
    this.bindKeys();
  }

  private resizeBody() {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const tw = this.frame.width;
    const th = this.frame.height;
    this.setDisplaySize(64, 84);
    const bw = Math.max(24, tw * 0.22);
    const bh = Math.max(40, th * 0.48);
    body.setSize(bw, bh);
    body.setOffset((tw - bw) / 2, th * 0.42);
  }

  private bindKeys() {
    const kb = this.scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyJump = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyJump2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyDash = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyDash2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyAtk = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyAtk2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  }

  private buildFsm() {
    const canAct = (next: string) => {
      if (this.fsm.current === "dead") return false;
      if (this.fsm.current === "hurt" && next !== "dead") return false;
      if (this.fsm.current === "dash" && next !== "hurt" && next !== "dead")
        return false;
      if (
        this.fsm.current.startsWith("attack") &&
        next !== "hurt" &&
        next !== "dead" &&
        !next.startsWith("attack")
      )
        return false;
      return true;
    };

    for (const name of [
      "idle",
      "run",
      "jump",
      "fall",
      "dash",
      "attack1",
      "attack2",
      "attack3",
      "hurt",
      "dead",
      "climb",
    ]) {
      this.fsm.add(name, {
        can: canAct,
        enter: () => this.onEnter(name),
      });
    }
  }

  private onEnter(name: string) {
    const frame: Record<string, string> = {
      idle: "idle",
      run: "run",
      jump: "jump",
      fall: "jump",
      dash: "dash",
      attack1: "attack",
      attack2: "attack",
      attack3: "attack",
      hurt: "hurt",
      dead: "hurt",
      climb: "idle",
    };
    if (this.texture.has(frame[name])) this.setFrame(frame[name]);
    this.setAlpha(name === "dash" ? 0.7 : 1);
  }

  emitHud() {
    const payload = {
      hp: this.hp,
      maxHp: this.maxHp,
      mana: Math.floor(this.mana),
      maxMana: this.maxMana,
      crystals: this.crystals,
      totalCrystals: this.scene.registry.get("totalCrystals") ?? 24,
      hasDoubleJump: this.hasDoubleJump,
      hasDash: this.hasDash,
      combo: this.fsm.current.startsWith("attack") ? this.comboStep : 0,
      dead: this.fsm.current === "dead",
    };
    const key = JSON.stringify(payload);
    if (key === this.lastHud) return;
    this.lastHud = key;
    const fn = this.scene.registry.get("onEvent") as
      | ((t: string, d: unknown) => void)
      | undefined;
    fn?.("hud", payload);
  }

  setSpawn(x: number, y: number) {
    this.spawnX = x;
    this.spawnY = y;
  }

  respawn() {
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.clearTint();
    this.setAlpha(1);
    this.setAngle(0);
    this.fsm.unlock();
    this.fsm.current = "idle";
    this.setPosition(this.spawnX, this.spawnY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
    this.invulnUntil = this.scene.time.now + 800;
    this.emitHud();
  }

  takeHit(fromX: number, dmg: number) {
    const now = this.scene.time.now;
    if (now < this.invulnUntil) return;
    if (this.fsm.is("dead", "dash")) return;
    this.hp -= dmg;
    this.invulnUntil = now + PLAYER.iframeMs;
    sfx.hurt();
    this.scene.cameras.main.shake(140, 0.01);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.sign(this.x - fromX || this.facing) * 220, -240);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    } else {
      this.fsm.unlock();
      this.fsm.set("hurt");
      this.fsm.lock(280);
      this.scene.time.delayedCall(280, () => {
        if (this.fsm.is("hurt")) {
          this.fsm.unlock();
          this.fsm.set("fall");
        }
      });
    }
    this.emitHud();
  }

  private die() {
    this.fsm.unlock();
    this.fsm.set("dead");
    this.fsm.lock(99999);
    sfx.death();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, -180);
    this.scene.tweens.add({
      targets: this,
      angle: this.facing * 70,
      alpha: 0.2,
      duration: 700,
    });
    this.scene.time.delayedCall(1100, () => {
      const fn = this.scene.registry.get("onEvent") as
        | ((t: string) => void)
        | undefined;
      fn?.("gameover");
    });
    this.emitHud();
  }

  private startDash() {
    if (!this.hasDash) return;
    const now = this.scene.time.now;
    if (now < this.dashCd) return;
    if (this.mana < PLAYER.dashMana) return;
    if (this.fsm.is("dead", "hurt", "dash")) return;
    if (this.fsm.current.startsWith("attack")) return;
    this.mana -= PLAYER.dashMana;
    this.fsm.unlock();
    this.fsm.set("dash");
    this.dashUntil = now + PLAYER.dashMs;
    this.dashCd = now + PLAYER.dashCooldownMs;
    this.invulnUntil = Math.max(this.invulnUntil, now + PLAYER.dashMs + 80);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(this.facing * PLAYER.dashSpeed, 0);
    body.allowGravity = false;
    sfx.dash();
    this.fsm.lock(PLAYER.dashMs);
  }

  private startAttack() {
    if (this.fsm.is("dead", "hurt", "dash", "climb")) return;
    const now = this.scene.time.now;
    let step = 1;
    if (this.fsm.current.startsWith("attack") && now < this.comboUntil) {
      step = Math.min(3, this.comboStep + 1);
    } else if (this.fsm.current.startsWith("attack")) {
      return;
    }
    this.comboStep = step;
    const name = `attack${step}`;
    this.fsm.unlock();
    this.fsm.set(name);
    const start = COMBO.startup[step - 1];
    const active = COMBO.active[step - 1];
    const rec = COMBO.recover[step - 1];
    this.comboUntil = now + start + active + rec + COMBO.windowMs;
    this.lastAttackDamage = COMBO.damage[step - 1];
    this.lastKnockback = COMBO.knockback[step - 1];
    this.fsm.lock(start + active + rec);
    sfx.swing(step);
    this.scene.time.delayedCall(start, () => this.enableHitbox(step));
    this.scene.time.delayedCall(start + active, () => this.disableHitbox());
    this.scene.time.delayedCall(start + active + rec, () => {
      this.fsm.unlock();
      if (this.fsm.current === name) {
        const grounded = (this.body as Phaser.Physics.Arcade.Body).blocked.down;
        this.fsm.set(grounded ? "idle" : "fall");
      }
    });
  }

  private enableHitbox(step: number) {
    if (this.fsm.current !== `attack${step}`) return;
    this.hitboxActive = true;
    const w = COMBO.hitW[step - 1];
    const h = COMBO.hitH[step - 1];
    this.attackHitbox.enableBody(
      true,
      this.x + this.facing * 38,
      this.y - 6,
      true,
      false,
    );
    const b = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    b.setSize(w, h);
    this.slashFx(step);
    this.scene.cameras.main.shake(
      step === 3 ? 90 : 40,
      step === 3 ? 0.006 : 0.002,
    );
  }

  private disableHitbox() {
    this.hitboxActive = false;
    this.attackHitbox.disableBody(true, true);
  }

  private slashFx(step: number) {
    const arc = this.scene.add.image(
      this.x + this.facing * 36,
      this.y - 8,
      "player",
      "attack",
    );
    arc.setScale(this.scale * (0.7 + step * 0.12));
    arc.setAlpha(0.55);
    arc.setTint(step === 3 ? 0xc45cff : 0x5cf0ff);
    arc.setFlipX(this.facing < 0);
    arc.setBlendMode(Phaser.BlendModes.ADD);
    arc.setDepth(21);
    this.scene.tweens.add({
      targets: arc,
      alpha: 0,
      x: arc.x + this.facing * 28,
      angle: this.facing * (step === 3 ? 50 : 25),
      duration: 160,
      onComplete: () => arc.destroy(),
    });
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (!this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;

    const left = this.keyA.isDown || this.cursors.left.isDown;
    const right = this.keyD.isDown || this.cursors.right.isDown;
    const up = this.keyW.isDown || this.cursors.up.isDown;
    const down = this.keyS.isDown || this.cursors.down.isDown;
    const jumpDown =
      Phaser.Input.Keyboard.JustDown(this.keyJump) ||
      Phaser.Input.Keyboard.JustDown(this.keyJump2) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);
    const dashDown =
      Phaser.Input.Keyboard.JustDown(this.keyDash) ||
      Phaser.Input.Keyboard.JustDown(this.keyDash2);
    const atkDown =
      Phaser.Input.Keyboard.JustDown(this.keyAtk) ||
      Phaser.Input.Keyboard.JustDown(this.keyAtk2);

    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.coyote = PLAYER.coyoteMs;
      this.jumps = 0;
      if (!this.wasGrounded && !this.fsm.is("dead")) sfx.land();
    } else {
      this.coyote -= delta;
    }
    this.wasGrounded = grounded;

    if (jumpDown) this.buffer = PLAYER.bufferMs;
    else this.buffer -= delta;

    this.mana = Math.min(
      this.maxMana,
      this.mana + (PLAYER.manaRegen * delta) / 1000,
    );

    if (this.fsm.is("dead")) return;

    if (time < this.invulnUntil && !this.fsm.is("dash", "dead")) {
      this.setAlpha(0.45 + Math.sin(time / 40) * 0.35);
    } else if (!this.fsm.is("dash")) {
      this.setAlpha(1);
    }

    if (atkDown) this.startAttack();
    if (dashDown) this.startDash();

    if (this.fsm.is("dash")) {
      body.setVelocityX(this.facing * PLAYER.dashSpeed);
      body.setVelocityY(0);
      this.trailT += delta;
      if (this.trailT > 28) {
        this.trailT = 0;
        const g = this.scene.add.image(this.x, this.y, "player", "dash");
        g.setFlipX(this.flipX).setAlpha(0.4).setScale(this.scale).setDepth(19);
        g.setTint(0x5cf0ff);
        this.scene.tweens.add({
          targets: g,
          alpha: 0,
          duration: 180,
          onComplete: () => g.destroy(),
        });
      }
      if (time >= this.dashUntil) {
        body.allowGravity = true;
        this.fsm.unlock();
        this.fsm.set(grounded ? "idle" : "fall");
      }
      this.emitHud();
      return;
    }

    if (this.fsm.current.startsWith("attack")) {
      body.setVelocityX(this.facing * (this.comboStep === 3 ? 40 : 20));
      this.attackHitbox.setPosition(this.x + this.facing * 40, this.y - 4);
      this.emitHud();
      return;
    }

    if (this.fsm.is("hurt")) {
      this.emitHud();
      return;
    }

    if (this.onLadder && (up || down)) {
      this.fsm.unlock();
      this.fsm.set("climb");
    }

    if (this.fsm.is("climb")) {
      body.allowGravity = false;
      if (!this.onLadder) {
        body.allowGravity = true;
        this.fsm.set("fall");
      } else {
        body.setVelocityY(up ? -140 : down ? 160 : 0);
        body.setVelocityX((Number(right) - Number(left)) * 80);
        if (this.buffer > 0) {
          body.allowGravity = true;
          body.setVelocityY(PLAYER.jump);
          this.buffer = 0;
          this.fsm.set("jump");
          sfx.jump();
        }
      }
      this.emitHud();
      return;
    }

    body.allowGravity = true;

    const jumpHeld = this.keyJump.isDown || this.keyJump2.isDown || this.cursors.up.isDown;
    if (!jumpHeld && body.velocity.y < -120 && this.fsm.is("jump")) {
      body.setVelocityY(body.velocity.y * 0.55);
    }

    const dir = Number(right) - Number(left);
    if (dir !== 0) {
      this.facing = dir;
      this.setFlipX(dir < 0);
      const spd = grounded ? PLAYER.speed : PLAYER.airSpeed;
      body.setVelocityX(dir * spd);
    }

    const canCoyote = this.coyote > 0;
    if (this.buffer > 0 && canCoyote) {
      body.setVelocityY(PLAYER.jump);
      this.buffer = 0;
      this.coyote = 0;
      this.jumps = 1;
      this.fsm.set("jump");
      sfx.jump();
    } else if (
      this.buffer > 0 &&
      this.hasDoubleJump &&
      this.jumps < 2 &&
      !grounded
    ) {
      body.setVelocityY(PLAYER.doubleJump);
      this.buffer = 0;
      this.jumps = 2;
      this.fsm.set("jump");
      sfx.doubleJump();
      this.puff();
    }

    if (!this.fsm.current.startsWith("attack") && !this.fsm.is("dash", "hurt")) {
      if (!grounded) this.fsm.set(body.velocity.y < 0 ? "jump" : "fall");
      else this.fsm.set(dir !== 0 ? "run" : "idle");
    }

    this.emitHud();
  }

  private puff() {
    if (!this.scene.textures.exists("items")) return;
    for (let i = 0; i < 5; i++) {
      const frame = this.scene.textures.get("items").has("spark")
        ? "spark"
        : undefined;
      const p = this.scene.add.image(this.x, this.y + 24, "items", frame);
      p.setScale(0.12).setAlpha(0.8).setTint(0x5cf0ff).setDepth(18);
      this.scene.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-30, 30),
        y: p.y + Phaser.Math.Between(4, 18),
        alpha: 0,
        duration: 280,
        onComplete: () => p.destroy(),
      });
    }
  }
}
