import * as THREE from 'three';
import { Game, clamp, lerp } from '../engine/core.js';
import { setupWorld } from '../engine/world.js';
import { Assets } from '../engine/assets.js';

// 💎 מסע בין האיים — פלטפורמר תלת־ממדי עם מצלמת גורם שלישי

const TOTAL_GEMS = 12;
const KILL_Y = -9;

const ISLANDS = [
  { x: 0, z: 0, y: 0, w: 9, d: 9, cp: true },
  { x: 0, z: -8, y: 0.5, w: 4.5, d: 4.5, gem: true },
  { x: 4, z: -14, y: 1.2, w: 3.6, d: 3.6, gem: true },
  { x: -1, z: -21, y: 2.0, w: 5, d: 5, gem: true, cp: true },
  { x: -7.5, z: -27, y: 2.8, w: 3.2, d: 3.2, gem: true, move: 'x', amp: 2.6, sp: 1.1 },
  { x: -2, z: -34, y: 3.6, w: 4, d: 4, gem: true },
  { x: 4, z: -40, y: 4.4, w: 3.4, d: 3.4, gem: true },
  { x: 10, z: -45, y: 5.2, w: 4.2, d: 4.2, gem: true, cp: true },
  { x: 10, z: -53, y: 6.0, w: 3.2, d: 3.2, gem: true, move: 'z', amp: 3.4, sp: 1.3 },
  { x: 4, z: -59, y: 6.8, w: 3.4, d: 3.4 },
  { x: -2, z: -64, y: 7.6, w: 4, d: 4, gem: true },
  { x: -8, z: -70, y: 8.4, w: 3.2, d: 3.2, gem: true, move: 'x', amp: 2.4, sp: 1.5 },
  { x: -8, z: -78, y: 9.2, w: 6, d: 6, gem: true, cp: true },
  { x: -2, z: -86, y: 10, w: 4, d: 4, gem: true },
  { x: 5, z: -93, y: 10.5, w: 8, d: 8 },
];

export class IslandHopper extends Game {
  needsLock = true;

  init() {
    const w = setupWorld(this.scene, {
      preset: 'day', size: 300, shadowArea: 105,
      sunPos: [40, 70, -25], sunTarget: [0, 0, -45],
    });
    this.root.add(w.group);

    this.got = 0;
    this.deaths = 0;
    this.gems = [];
    this.checkpoints = [];
    this.movers = [];
    this.clouds = [];

    this.buildLevel();

    // דמות השחקן
    this.char = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 6, 12), bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x14202b, roughness: 0.2, metalness: 0.5 })
    );
    visor.position.set(0, 0.84, 0.29);
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.5, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x35506b, roughness: 0.6 })
    );
    pack.position.set(0, 0.68, -0.33);
    body.castShadow = pack.castShadow = true;
    this.char.add(body, visor, pack);
    this.root.add(this.char);

    this.player = this.physics.addBody(this.char, {
      half: new THREE.Vector3(0.36, 0.55, 0.36),
      canStep: 0.5,
      friction: 0.3,
    });
    this.player.mesh.position.set(0, 1.2, 2);
    this.respawnAt = new THREE.Vector3(0, 1.2, 2);
    this.physics.groundY = null; // אין רצפה גלובלית — רק האיים

    this.camYaw = 0;
    this.camPitch = 0.34;
    this.camDist = 7.5;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.charRot = Math.PI;

    // פורטל (מופיע בסוף)
    this.portal = Assets.portal();
    this.portal.position.set(5, ISLANDS[ISLANDS.length - 1].y + 1.5, -93);
    this.portal.visible = false;
    this.portal.scale.setScalar(0.01);
    this.portalOpen = false;
    this.root.add(this.portal);

    this.hud.score(null);
    this.hud.health(null);
    this.hud.info('💎 0/' + TOTAL_GEMS);

    this.camera.position.set(0, 4, 10);
    this.camera.lookAt(0, 1, -3);

    this.hud.showOverlay({
      title: '💎 מסע בין האיים',
      sub: 'קפצו בין האיים המרחפים, אספו את כל ' + TOTAL_GEMS + ' אבני החן והגיעו לפורטל',
      controls: [['W A S D', 'תנועה'], ['עכבר', 'סיבוב מצלמה'], ['רווח', 'קפיצה'], ['גלגלת', 'זום'], ['Esc', 'הפסקה']],
      buttons: [{ label: '▶️ התחל', primary: true, cb: () => this.begin() }],
      locked: true,
    });
  }

  begin() {
    this.sfx.init();
    this.hud.hideOverlay();
    this.started = true;
    this.input.lock();
    this.hud.showMsg('צאו לדרך!', 'אספו אבני חן ואל תיפלו למים 🌊', 2200);
  }

  buildLevel() {
    // איים סטטיים
    ISLANDS.forEach((isl, idx) => {
      if (isl.move) return;
      const m = Assets.platform(isl.w, isl.d, 0.7);
      m.position.set(isl.x, isl.y - 0.35, isl.z);
      this.root.add(m);
      this.decorate(isl, idx);
    });
    this.physics.addTree(this.root);

    // איים נעים (סטטיקה שרודפת את המש)
    ISLANDS.forEach((isl, idx) => {
      if (!isl.move) return;
      const m = Assets.platform(isl.w, isl.d, 0.7);
      m.position.set(isl.x, isl.y - 0.35, isl.z);
      this.root.add(m);
      this.decorate(isl, idx);
      const s = this.physics.addStatic(
        m,
        new THREE.Vector3(isl.w / 2, 0.35, isl.d / 2),
        m.position,
        { follow: true }
      );
      this.movers.push({ s, isl, phase: Math.random() * Math.PI * 2 });
    });

    // מים למטה
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(160, 40),
      new THREE.MeshStandardMaterial({
        color: 0x2e7cc4, transparent: true, opacity: 0.93,
        roughness: 0.15, metalness: 0.3,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -6;
    Assets.noCollide(water);
    this.water = water;
    this.root.add(water);

    // עננים
    for (let i = 0; i < 7; i++) {
      const c = Assets.cloud();
      c.position.set(-50 + Math.random() * 100, 14 + Math.random() * 9, 15 - Math.random() * 115);
      c.scale.setScalar(0.8 + Math.random() * 1.6);
      this.clouds.push(c);
      this.root.add(c);
    }
  }

  decorate(isl, idx) {
    // אבן חן
    if (isl.gem) {
      const g = Assets.gem();
      g.position.set(isl.x, isl.y + 1.1, isl.z);
      g.userData.phase = Math.random() * Math.PI * 2;
      g.userData.baseY = isl.y + 1.1;
      this.gems.push(g);
      this.root.add(g);
    }
    // דגל נקודת ביקורת
    if (isl.cp && idx > 0) {
      const f = Assets.flag(0xffd23e);
      f.position.set(isl.x + isl.w / 2 - 0.8, isl.y, isl.z + isl.d / 2 - 0.8);
      this.root.add(f);
      this.checkpoints.push(f);
    }
    // נוי על איים גדולים
    if (isl.w >= 6) {
      for (let i = 0; i < 2; i++) {
        const t = Assets.tree();
        t.position.set(isl.x - isl.w / 2 + 1 + Math.random() * (isl.w - 2), isl.y, isl.z - isl.d / 2 + 1 + Math.random() * (isl.d - 2));
        this.root.add(t);
      }
    }
  }

  update(dt) {
    if (!this.started) return;
    if (this.over) { this.effects.update(dt); return; }
    this.elapsed += dt;
    const inp = this.input;
    const p = this.player.mesh.position;

    // קליק על המסך כשאין נעילה (אחרי resume שנכשל) → נעילה מחדש
    if (!inp.locked && inp.clicked(0) && !this.engine.paused && !this.over) inp.lock();

    // --- איים נעים (הפיזיקה גוררת אחריהם באופן אוטומטי) ---
    for (const mv of this.movers) {
      const { s, isl } = mv;
      const t = this.elapsed * isl.sp + mv.phase;
      const nx = isl.move === 'x' ? isl.x + Math.sin(t) * isl.amp : isl.x;
      const nz = isl.move === 'z' ? isl.z + Math.sin(t) * isl.amp : isl.z;
      s.mesh.position.set(nx, isl.y - 0.35, nz);
    }

    // --- מצלמה ---
    if (inp.locked) {
      this.camYaw -= inp.mouseDX * 0.0023;
      this.camPitch = clamp(this.camPitch + inp.mouseDY * 0.0023, -1.05, 1.25);
    }
    this.camDist = clamp(this.camDist + inp.wheel * 0.01, 3.5, 13);
    const pivot = new THREE.Vector3(p.x, p.y + 1.35, p.z);
    const cp = Math.cos(this.camPitch);
    const camPos = new THREE.Vector3(
      pivot.x + Math.sin(this.camYaw) * cp * this.camDist,
      pivot.y + Math.sin(this.camPitch) * this.camDist,
      pivot.z + Math.cos(this.camYaw) * cp * this.camDist
    );
    if (camPos.y < -3) camPos.y = -3;
    this.camera.position.lerp(camPos, Math.min(1, 11 * dt));
    this.camera.lookAt(pivot);

    // --- תנועה ---
    const f = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const mx = inp.axis('KeyA', 'KeyD') + inp.axis('ArrowLeft', 'ArrowRight');
    const mz = inp.axis('KeyS', 'KeyW') + inp.axis('ArrowDown', 'ArrowUp');
    const run = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const spd = run ? 8.6 : 6.5;
    const target = new THREE.Vector3().addScaledVector(f, mz).addScaledVector(right, mx);
    if (target.lengthSq() > 0) target.normalize().multiplyScalar(spd);
    const accel = this.player.onGround ? 12 : 5;
    const k = Math.min(1, accel * dt);
    this.player.vel.x += (target.x - this.player.vel.x) * k;
    this.player.vel.z += (target.z - this.player.vel.z) * k;

    // קפיצה עם coyote-time ו-buffer
    this.coyote = this.player.onGround ? 0.13 : Math.max(0, this.coyote - dt);
    if (inp.pressed('Space')) this.jumpBuf = 0.13;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.player.vel.y = 9.4;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.sfx.play('jump');
    }

    const vyBefore = this.player.vel.y;
    this.physics.step(dt);
    if (vyBefore < -7 && this.player.onGround) {
      this.sfx.play('land');
      this.char.scale.y = 0.75;
    }
    this.char.scale.y = lerp(this.char.scale.y, 1, Math.min(1, 10 * dt));

    // פניית הדמות לכיוון התנועה
    const hv = new THREE.Vector2(this.player.vel.x, this.player.vel.z);
    if (hv.length() > 0.7) {
      const want = Math.atan2(this.player.vel.x, this.player.vel.z);
      let d = want - this.charRot;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.charRot += d * Math.min(1, 12 * dt);
      this.char.rotation.y = this.charRot;
    }

    // --- נפילה למים ---
    if (p.y < KILL_Y) {
      this.deaths++;
      p.copy(this.respawnAt);
      this.player.vel.set(0, 0, 0);
      this.hud.flash();
      this.hud.showMsg('🌊 אופס!', 'חזרתם לנקודת הביקורת האחרונה', 1400);
      this.sfx.play('hurt');
    }

    // --- אבני חן ---
    const head = new THREE.Vector3(p.x, p.y + 0.6, p.z);
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.rotation.y += dt * 2.2;
      g.position.y = g.userData.baseY + Math.sin(this.elapsed * 2 + g.userData.phase) * 0.16;
      if (this.portalOpen && g.scale.x < 1) g.scale.setScalar(Math.min(1, g.scale.x + dt * 3)); // לא רלוונטי, ליתר ביטחון
      if (head.distanceTo(g.position) < 1.25) {
        this.root.remove(g);
        this.gems.splice(i, 1);
        this.got++;
        this.hud.info('💎 ' + this.got + '/' + TOTAL_GEMS + ' · ⏱ ' + Math.round(this.elapsed) + ' שנ׳ · 💀 ' + this.deaths);
        this.effects.burst(g.position, { color: 0x35ffd9, count: 14, speed: 5, life: 0.6, size: 0.11, gravity: -4 });
        this.sfx.play('gem');
        if (this.got >= TOTAL_GEMS && !this.portalOpen) {
          this.portalOpen = true;
          this.hud.toast('🌀 הפורטל נפתח! אל סוף המסלול');
          this.sfx.play('win');
        }
      }
    }

    // --- נקודות ביקורת ---
    for (const f of this.checkpoints) {
      if (Math.abs(p.x - f.position.x) < 2.5 && Math.abs(p.z - f.position.z) < 2.5 && Math.abs(p.y - f.position.y) < 3) {
        const np = new THREE.Vector3(f.position.x, f.position.y + 1.3, f.position.z);
        if (!this.respawnAt.equals(np)) {
          this.respawnAt = np;
          this.hud.toast('🚩 נקודת ביקורת נשמרה');
          this.sfx.play('coin');
        }
      }
    }

    // --- פורטל ---
    if (this.portalOpen) {
      const s = Math.min(1, this.portal.scale.x + dt * 2.5);
      this.portal.scale.setScalar(s);
      this.portal.rotation.y += dt;
      if (head.distanceTo(this.portal.position) < 1.8) {
        this.endScreen(
          '🏆 חציתם את הפורטל!',
          'אספתם את כל אבני החן וסיימתם את המסע!',
          [['זמן', Math.round(this.elapsed) + ' שנ׳'], ['אבני חן', this.got + '/' + TOTAL_GEMS], ['נפילות', this.deaths]],
          true
        );
      }
    }

    // --- נוי חי ---
    this.water.position.y = -6 + Math.sin(this.elapsed * 0.5) * 0.18;
    for (const c of this.clouds) {
      c.position.x += dt * 0.55;
      if (c.position.x > 60) c.position.x = -60;
    }

    this.effects.update(dt);
    if (!this.portalOpen) {
      this.hud.info('💎 ' + this.got + '/' + TOTAL_GEMS + ' · ⏱ ' + Math.round(this.elapsed) + ' שנ׳ · 💀 ' + this.deaths);
    }
  }
}

export { IslandHopper as Game };
