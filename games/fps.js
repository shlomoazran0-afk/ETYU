import * as THREE from 'three';
import { Game, clamp } from '../engine/core.js';
import { setupWorld } from '../engine/world.js';
import { Assets } from '../engine/assets.js';

// 🚁 צייד המל״טים — FPS גלים בזירה תלת־ממדית
export class DroneHunt extends Game {
  needsLock = true;

  init() {
    const w = setupWorld(this.scene, { preset: 'day', shadowArea: 45 });
    this.root.add(w.group);
    this.buildArena();

    // שחקן (גוף פיזי בלתי נראה)
    this.player = this.physics.addBody(new THREE.Object3D(), {
      half: new THREE.Vector3(0.42, 0.85, 0.42),
      canStep: 0.55,
      friction: 0.3,
    });
    this.player.mesh.position.set(0, 0.9, 11);
    this.yaw = 0;
    this.pitch = -0.04;

    this.hp = 100;
    this.score = 0;
    this.wave = 0;
    this.speed = 2.5;
    this.drones = [];
    this.fireCd = 0;
    this.flashT = 0;
    this.recoil = 0;
    this.regenT = 0;
    this.walkT = 0;
    this.waveClearT = -1;

    // אקדח (viewmodel מחובר למצלמה)
    this.gun = new THREE.Group();
    const gm = new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.4, metalness: 0.6 });
    const gp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42), gm);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), gm);
    barrel.position.set(0, 0.035, -0.33);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), gm);
    grip.position.set(0, -0.12, 0.1);
    grip.rotation.x = 0.3;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.06), gm);
    sight.position.set(0, 0.085, -0.1);
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd873, transparent: true, opacity: 0.95 })
    );
    this.flash.position.set(0, 0.035, -0.5);
    this.flash.visible = false;
    this.gun.add(gp, barrel, grip, sight, this.flash);
    this.gun.position.set(0.3, -0.26, -0.5);
    this.camera.add(this.gun);

    this.muzzle = new THREE.PointLight(0xffc36b, 0, 7);
    this.muzzle.position.set(0.3, -0.2, -1);
    this.camera.add(this.muzzle);

    this.ray = new THREE.Raycaster();
    this.ray.far = 120;

    // מצלמת פתיחה
    this.camera.position.set(0, 2.3, 12.5);
    this.camera.rotation.set(-0.02, 0, 0);

    this.hud.cross(true);
    this.hud.health(this.hp);
    this.hud.score(0);
    this.hud.info('המל״טים מתקרבים...');

    this.hud.showOverlay({
      title: '🚁 צייד המל״טים',
      sub: 'זירה סגורה, גלים של מל״טים עוינים — כמה רחוק תגיעו?',
      controls: [['W A S D', 'תנועה'], ['עכבר', 'כיוון'], ['קליק שמאלי', 'ירי'], ['רווח', 'קפיצה'], ['Shift', 'ריצה'], ['Esc', 'הפסקה']],
      buttons: [{ label: '▶️ התחל', primary: true, cb: () => this.begin() }],
      locked: true,
    });
  }

  begin() {
    this.sfx.init();
    this.hud.hideOverlay();
    this.started = true;
    this.input.lock();
    this.nextWave();
  }

  buildArena() {
    // חומות
    for (const [w, d, x, z] of [[29, 0.8, 0, -14], [29, 0.8, 0, 14], [0.8, 29, -14, 0], [0.8, 29, 14, 0]]) {
      const m = Assets.wall(w, 3.2, d);
      m.position.set(x, 1.6, z);
      this.root.add(m);
    }
    // מגדלי פינה
    for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
      const b = Assets.building(3.5, 7, 3.5);
      b.position.set(x, 3.5, z);
      this.root.add(b);
    }
    // ערימות כיסוי
    for (const [x, z] of [[-6, -4], [7, -6], [3, 6], [-8, 7], [0, -9], [9, 4]]) {
      let y = 0;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const c = Assets.crate(1.3);
        c.position.set(x + (Math.random() - 0.5) * 0.25, y + 0.65, z + (Math.random() - 0.5) * 0.25);
        y += 1.3;
        this.root.add(c);
      }
      const b = Assets.barrel();
      b.position.set(x + 1.7, 0.53, z + 0.9);
      this.root.add(b);
    }
    // עמדת צלף: פלטפורמה + מדרגות
    const plat = Assets.platform(4, 4, 0.6);
    plat.position.set(-9, 0.96, -8);
    this.root.add(plat);
    const stairs = Assets.stairs(3, 2.2);
    stairs.position.set(-9, 0, -4.9);
    this.root.add(stairs);
    // נוי
    for (let i = 0; i < 6; i++) {
      const t = Assets.tree();
      if (i % 2 === 0) t.position.set(-12 + Math.random() * 24, 0, i < 3 ? 13.2 : -13.2);
      else t.position.set(i < 3 ? 13.2 : -13.2, 0, -12 + Math.random() * 24);
      this.root.add(t);
    }
    for (let i = 0; i < 4; i++) {
      const r = Assets.rock(0.5 + Math.random() * 0.5);
      r.position.set(-10 + Math.random() * 20, 0.3, -10 + Math.random() * 20);
      this.root.add(r);
    }
    this.physics.addTree(this.root);
  }

  nextWave() {
    this.wave++;
    const n = Math.min(3 + this.wave * 2, 16);
    this.speed = Math.min(2.5 + this.wave * 0.38, 6.5);
    const hp = Math.min(2 + Math.floor(this.wave / 2), 5);
    for (let i = 0; i < n; i++) this.spawnDrone(hp);
    this.hud.showMsg('גל ' + this.wave, n + ' מל״טים בדרך אליכם...', 1900);
    this.hud.info('גל ' + this.wave);
    this.sfx.play('wave');
  }

  spawnDrone(hp) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 3.5;
    const m = Assets.drone();
    m.position.set(Math.cos(a) * r, 2.6 + Math.random() * 2.6, Math.sin(a) * r);
    this.root.add(m);
    const d = { m, hp, t: Math.random() * 10, cd: 1 + Math.random() };
    m.userData.droneRef = d;
    this.drones.push(d);
  }

  update(dt) {
    if (!this.started) return;
    if (this.over) { this.effects.update(dt); return; }
    this.elapsed += dt;
    const inp = this.input;
    const p = this.player.mesh.position;

    // קליק על המסך כשאין נעילה (אחרי resume שנכשל) → נעילה מחדש
    if (!inp.locked && inp.clicked(0) && !this.engine.paused && !this.over) inp.lock();

    // --- מצלמה ---
    if (inp.locked) {
      this.yaw -= inp.mouseDX * 0.0022;
      this.pitch = clamp(this.pitch - inp.mouseDY * 0.0022, -1.35, 1.45);
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.position.set(p.x, p.y + 0.72, p.z);

    // --- תנועה ---
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const mx = inp.axis('KeyA', 'KeyD') + inp.axis('ArrowLeft', 'ArrowRight');
    const mz = inp.axis('KeyS', 'KeyW') + inp.axis('ArrowDown', 'ArrowUp');
    const spd = inp.down('ShiftLeft') || inp.down('ShiftRight') ? 8.4 : 5.6;
    const target = new THREE.Vector3().addScaledVector(f, mz).addScaledVector(right, mx);
    if (target.lengthSq() > 0) target.normalize().multiplyScalar(spd);
    const k = Math.min(1, 12 * dt);
    this.player.vel.x += (target.x - this.player.vel.x) * k;
    this.player.vel.z += (target.z - this.player.vel.z) * k;
    if (inp.pressed('Space') && this.player.onGround) {
      this.player.vel.y = 8.4;
      this.sfx.play('jump');
    }
    const wasGround = this.player.onGround;
    this.physics.step(dt);
    if (!wasGround && this.player.onGround) this.sfx.play('land');
    if (this.player.onGround && (mx || mz)) this.walkT += dt * spd * 1.7;

    // --- מל״טים ---
    let alive = 0;
    for (const d of this.drones) {
      d.t += dt;
      d.cd -= dt;
      const dp = new THREE.Vector3(p.x - d.m.position.x, 0, p.z - d.m.position.z);
      const dist = dp.length();
      if (dist > 0.001) dp.divideScalar(dist);
      const desiredY = p.y + 1.15 + Math.sin(d.t * 2.1) * 0.55;
      d.m.position.x += dp.x * this.speed * dt;
      d.m.position.z += dp.z * this.speed * dt;
      d.m.position.y += (desiredY - d.m.position.y) * Math.min(1, 3 * dt);
      d.m.lookAt(p.x, d.m.position.y, p.z);
      for (const rt of d.m.userData.rotors) rt.rotation.y += dt * 30;
      d.m.scale.setScalar(d.hitT > 0 ? 1.18 : 1);
      if (d.hitT > 0) d.hitT -= dt;
      if (d.hp > 0) {
        alive++;
        if (dist < 1.3 && Math.abs(d.m.position.y - p.y) < 1.7 && d.cd <= 0) {
          d.cd = 1.0;
          this.damage(12);
          this.player.vel.addScaledVector(dp, 5);
          this.player.vel.y += 3;
        }
      }
    }

    // --- ירי ---
    this.fireCd -= dt;
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.muzzle.intensity = this.flashT > 0 ? 9 : 0;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    if (inp.locked && inp.buttons.has(0) && this.fireCd <= 0) this.shoot();

    // --- התחדשות ---
    this.regenT += dt;
    if (this.regenT > 4 && this.hp > 0 && this.hp < 100) {
      this.hp = Math.min(100, this.hp + 4.5 * dt);
      this.hud.health(this.hp);
    }

    // --- גל הושלם ---
    if (alive === 0 && this.waveClearT < 0) this.waveClearT = 2.2;
    if (this.waveClearT > 0) {
      this.waveClearT -= dt;
      if (this.waveClearT <= 0) {
        this.waveClearT = -1;
        this.score += 150 + this.wave * 25;
        this.hud.score(this.score);
        this.hud.toast('✅ גל ' + this.wave + ' טופל! בונוס +' + (150 + this.wave * 25));
        this.nextWave();
      }
    }

    // --- אפקטים ונשק ---
    this.effects.update(dt);
    this.gun.position.y = -0.26 + Math.sin(this.walkT) * 0.013;
    this.gun.rotation.x = this.recoil * 0.22;

    if (this.hp <= 0) this.die();
  }

  shoot() {
    this.fireCd = 0.14;
    this.recoil = 1;
    this.flashT = 0.05;
    this.sfx.play('shoot');
    const center = new THREE.Vector2(0, 0);
    this.ray.setFromCamera(center, this.camera);
    const hits = this.ray.intersectObject(this.root, true);
    const end = this.ray.ray.at(80, new THREE.Vector3());
    for (const h of hits) {
      let o = h.object;
      let drone = null;
      while (o) {
        if (o.userData.droneRef) { drone = o.userData.droneRef; break; }
        o = o.parent;
      }
      if (drone) {
        if (drone.hp <= 0) continue;
        drone.hp--;
        drone.hitT = 0.12;
        this.effects.burst(h.point, { color: 0xffcc55, count: 6, speed: 4, life: 0.35, size: 0.09 });
        if (drone.hp <= 0) this.killDrone(drone);
        else this.sfx.play('hit');
        break;
      }
      if (h.object.userData.collide !== false) {
        this.effects.burst(h.point, { color: 0xcccccc, count: 4, speed: 2.5, life: 0.3, size: 0.07 });
        break;
      }
    }
    const muzzlePos = new THREE.Vector3();
    this.flash.getWorldPosition(muzzlePos);
    this.effects.tracer(muzzlePos, end);
  }

  killDrone(d) {
    const i = this.drones.indexOf(d);
    if (i >= 0) this.drones.splice(i, 1);
    this.effects.burst(d.m.position, { color: 0xff8833, count: 20, speed: 7, life: 0.7, size: 0.16 });
    this.effects.burst(d.m.position, { color: 0x333844, count: 8, speed: 3, life: 0.9, size: 0.2, up: 3 });
    this.root.remove(d.m);
    this.sfx.play('explode');
    this.score += 100 + this.wave * 20;
    this.hud.score(this.score);
  }

  damage(n) {
    if (this.hp <= 0) return;
    this.hp -= n;
    this.regenT = 0;
    this.hud.health(this.hp);
    this.hud.flash();
    this.sfx.play('hurt');
  }

  die() {
    this.effects.burst(this.player.mesh.position, { color: 0xff5533, count: 26, speed: 8, life: 1, size: 0.2 });
    this.sfx.play('explode');
    this.hud.cross(false);
    this.endScreen(
      '💥 הופלת!',
      'המל״טים השתלטו על הזירה... אבל אפשר לנסות שוב!',
      [['ניקוד', Math.round(this.score)], ['גלים ששרדתם', this.wave], ['זמן', Math.round(this.elapsed) + ' שנ׳']]
    );
  }

  dispose() {
    this.camera.remove(this.gun);
    this.camera.remove(this.muzzle);
    super.dispose();
  }
}

export { DroneHunt as Game };
