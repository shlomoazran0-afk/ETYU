import * as THREE from 'three';
import { Game, clamp, lerp } from '../engine/core.js';
import { setupWorld } from '../engine/world.js';
import { Assets, TEX } from '../engine/assets.js';

// 🏎️ כביש הטורבו — מירוץ ארקייד אינסופי בשקיעה

const ROAD_W = 14;
const SEG_LEN = 30;
const SEG_COUNT = 13;
const WRAP = SEG_LEN * SEG_COUNT; // 390

export class TurboRoad extends Game {
  needsLock = false;

  init() {
    const w = setupWorld(this.scene, { preset: 'sunset', size: 260 });
    this.root.add(w.group);

    this.segs = [];
    this.scenery = [];
    this.obstacles = [];
    this.pickups = [];

    this.speed = 0;
    this.dist = 0;
    this.coins = 0;
    this.maxSpeed = 0;
    this.boostT = 0;
    this.dead = false;
    this.deadT = 0;
    this.sinceSpawn = 0;
    this.shake = 0;
    this.steerS = 0;
    this.fov = 68;

    this.buildRoad();
    this.buildScenery();

    // המכונית
    this.kart = Assets.kart(0xe23a2e);
    this.kart.position.set(0, 0, 8);
    this.root.add(this.kart);

    this.hud.score(null);
    this.hud.health(null);
    this.hud.info('0 קמ״ש');

    this.camera.position.set(0, 3.4, 15.5);
    this.camera.lookAt(0, 1.2, 0);

    this.hud.showOverlay({
      title: '🏎️ כביש הטורבו',
      sub: 'אינסוף כביש, מהירות עולה, מכשולים בכל נתיב. כמה רחוק תגיעו?',
      controls: [['A / D', 'סטייה (או חצים)'], ['W', 'גז'], ['S', 'בלימה'], ['משטח זוהר', '⚡ בוסט'], ['Esc', 'הפסקה']],
      buttons: [{ label: '▶️ צאו לכביש', primary: true, cb: () => this.begin() }],
      locked: true,
    });
  }

  begin() {
    this.sfx.init();
    this.hud.hideOverlay();
    this.started = true;
    this.hud.showMsg('יאללה, נוסעים!', 'היזהרו מהמכשולים ואספו מטבעות 🪙', 2000);
  }

  buildRoad() {
    const geo = new THREE.PlaneGeometry(ROAD_W, SEG_LEN);
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = new THREE.Group();
      const road = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ map: roadTex(), roughness: 0.85 })
      );
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      g.add(road);
      const edgeColor = i % 2 ? 0xff3ec8 : 0x35f0ff;
      const edgeMat = new THREE.MeshBasicMaterial({ color: edgeColor });
      for (const sx of [-ROAD_W / 2 - 0.2, ROAD_W / 2 + 0.2]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, SEG_LEN), edgeMat);
        strip.position.set(sx, 0.05, 0);
        g.add(strip);
      }
      g.position.set(0, 0.02, 12 - i * SEG_LEN);
      this.segs.push(g);
      this.root.add(g);
    }
  }

  buildScenery() {
    // פנסי רחוב
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const lamp = Assets.lamp();
      lamp.position.set(side * 8.4, 0, 15 - i * 15);
      lamp.rotation.y = side > 0 ? Math.PI : 0;
      this.scenery.push(lamp);
      this.root.add(lamp);
    }
    // דקלים
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const palm = Assets.palm();
      palm.position.set(side * (11.5 + Math.random() * 3), 0, 10 - i * 40 + Math.random() * 12);
      this.scenery.push(palm);
      this.root.add(palm);
    }
    // הרים רחוקים
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const h = 18 + Math.random() * 26;
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(h * 0.9, h, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a2a5e, roughness: 1, flatShading: true })
      );
      m.position.set(side * (26 + Math.random() * 20), h / 2 - 2, -30 - i * 45);
      this.scenery.push(m);
      this.root.add(m);
    }
  }

  spawnRow() {
    const r = Math.random();
    if (r < 0.55) this.spawnObstacle();
    else if (r < 0.82) this.spawnCoins();
    else this.spawnBoost();
  }

  spawnObstacle() {
    const lanes = [-4.5, -2.2, 0, 2.2, 4.5];
    const x = lanes[Math.floor(Math.random() * lanes.length)];
    const kind = Math.floor(Math.random() * 4);
    let mesh, half;
    if (kind === 0) {
      mesh = Assets.barrel();
      mesh.position.set(x, 0.53, -175);
      half = new THREE.Vector3(0.45, 0.53, 0.45);
    } else if (kind === 1) {
      mesh = Assets.crate(1.2);
      mesh.position.set(x, 0.6, -175);
      half = new THREE.Vector3(0.6, 0.6, 0.6);
    } else if (kind === 2) {
      mesh = Assets.cone();
      mesh.position.set(x, 0, -175);
      half = new THREE.Vector3(0.34, 0.45, 0.34);
    } else {
      mesh = Assets.wall(2.6, 0.9, 0.4);
      mesh.position.set(x, 0.45, -175);
      half = new THREE.Vector3(1.3, 0.45, 0.25);
    }
    this.root.add(mesh);
    this.obstacles.push({ mesh, half });
  }

  spawnCoins() {
    const lanes = [-4.5, -2.2, 0, 2.2, 4.5];
    const x = lanes[Math.floor(Math.random() * lanes.length)];
    for (let i = 0; i < 4; i++) {
      const c = Assets.coin();
      c.position.set(x, 0.95, -175 - i * 5);
      this.root.add(c);
      this.pickups.push({ mesh: c, type: 'coin' });
    }
  }

  spawnBoost() {
    const lanes = [-3, 0, 3];
    const x = lanes[Math.floor(Math.random() * lanes.length)];
    const pad = Assets.boostPad();
    pad.position.set(x, 0.035, -175);
    this.root.add(pad);
    this.pickups.push({ mesh: pad, type: 'boost' });
  }

  update(dt) {
    if (!this.started) return;
    if (this.over) { this.effects.update(dt); return; }
    this.elapsed += dt;
    const inp = this.input;

    // --- מהירות ---
    if (!this.dead) {
      let cruise = Math.min(17 + this.elapsed * 0.55, 42);
      if (inp.down('KeyW') || inp.down('ArrowUp')) cruise += 6;
      if (inp.down('KeyS') || inp.down('ArrowDown')) cruise = Math.min(cruise, 9);
      if (this.boostT > 0) {
        cruise += 16;
        this.boostT -= dt;
      }
      this.speed = lerp(this.speed, cruise, Math.min(1, 1.6 * dt));
      this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    } else {
      this.speed = Math.max(0, this.speed - dt * 22);
    }
    const dz = this.speed * dt;
    this.dist += dz;

    // --- היגוי ---
    const steer = this.dead ? 0 : inp.axis('KeyA', 'KeyD') + inp.axis('ArrowLeft', 'ArrowRight');
    this.steerS = lerp(this.steerS, steer, Math.min(1, 8 * dt));
    this.kart.position.x = clamp(
      this.kart.position.x + this.steerS * dt * (5.5 + this.speed * 0.24),
      -ROAD_W / 2 + 1.1, ROAD_W / 2 - 1.1
    );
    this.kart.rotation.z = -this.steerS * 0.16;
    this.kart.rotation.y = -this.steerS * 0.07;
    for (const wh of this.kart.userData.wheels) wh.rotation.x += (this.speed * dt) / 0.34;

    // --- גלילת העולם ---
    for (const seg of this.segs) {
      seg.position.z += dz;
      if (seg.position.z > 27) seg.position.z -= WRAP;
    }
    for (const s of this.scenery) {
      s.position.z += dz;
      if (s.position.z > 25) s.position.z -= WRAP;
    }

    // --- הנצה (spawn) ---
    if (!this.dead) {
      this.sinceSpawn += dz;
      const gap = Math.max(27 - this.dist / 260, 13);
      if (this.sinceSpawn >= gap) {
        this.sinceSpawn = 0;
        this.spawnRow();
      }
    }

    // --- מכשולים ---
    const kx = this.kart.position.x;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.mesh.position.z += dz;
      if (o.mesh.position.z > 18) {
        this.root.remove(o.mesh);
        this.obstacles.splice(i, 1);
        continue;
      }
      if (!this.dead &&
        Math.abs(o.mesh.position.z - 8) < o.half.z + 1.15 &&
        Math.abs(o.mesh.position.x - kx) < o.half.x + 0.75) {
        this.crash(o.mesh.position);
      }
    }

    // --- מטבעות ובוסט ---
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.mesh.position.z += dz;
      if (pk.type === 'coin') pk.mesh.rotation.y += dt * 4;
      if (pk.mesh.position.z > 18) {
        this.root.remove(pk.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      if (this.dead) continue;
      const range = pk.type === 'boost' ? 1.5 : 1.25;
      if (Math.abs(pk.mesh.position.z - 8) < 1.6 && Math.abs(pk.mesh.position.x - kx) < range) {
        if (pk.type === 'coin') {
          this.coins++;
          this.sfx.play('coin');
          this.effects.burst(pk.mesh.position, { color: 0xffd23e, count: 8, speed: 4, life: 0.4, size: 0.09, gravity: -3 });
        } else {
          this.boostT = 2.6;
          this.sfx.play('boost');
          this.hud.toast('⚡ בוסט!');
          this.effects.burst(pk.mesh.position, { color: 0x35f0ff, count: 14, speed: 6, life: 0.5, size: 0.12, gravity: -2 });
        }
        this.root.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }

    // --- מצלמה ---
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    const camX = kx * 0.55 + (Math.random() - 0.5) * this.shake * 0.8;
    const camY = 3.4 + (Math.random() - 0.5) * this.shake * 0.5;
    this.camera.position.set(camX, camY, 15.5);
    this.camera.lookAt(kx * 0.8, 1.2, 2);
    const wantFov = 68 + (this.speed / 46) * 12;
    if (Math.abs(wantFov - this.fov) > 0.1) {
      this.fov = lerp(this.fov, wantFov, Math.min(1, 4 * dt));
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // --- HUD ---
    this.hud.info(
      Math.round(this.speed * 3.8) + ' קמ״ש · 📏 ' + Math.round(this.dist) + ' מ׳ · 🪙 ' + this.coins
    );
    if (this.boostT > 0) this.effects.burst(
      new THREE.Vector3(kx + (Math.random() - 0.5), 0.4, 6.6),
      { color: 0x35f0ff, count: 1, speed: 1, life: 0.3, size: 0.14, gravity: 2, up: 1 }
    );

    // --- מוות ---
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 1.25 && !this.over) {
        this.endScreen(
          '💥 התנגשות!',
          'הנסיעה הסתיימה בקיר (או בחבית)...',
          [['מרחק', Math.round(this.dist) + ' מ׳'], ['מטבעות', this.coins], ['מהירות שיא', Math.round(this.maxSpeed * 3.8) + ' קמ״ש']]
        );
      }
    }

    this.effects.update(dt);
  }

  crash(pos) {
    this.dead = true;
    this.shake = 1.4;
    this.sfx.play('crash');
    this.hud.flash();
    this.effects.burst(pos, { color: 0xff7733, count: 26, speed: 9, life: 0.9, size: 0.18 });
    this.effects.burst(pos, { color: 0x2b2f36, count: 10, speed: 4, life: 1.1, size: 0.24, up: 5 });
  }
}

// טקסטורת כביש משותפת לכל המקטעים
function roadTex() {
  if (!roadTex._t) {
    roadTex._t = TEX.road.clone();
    roadTex._t.repeat.set(1, 2);
    roadTex._t.needsUpdate = true;
  }
  return roadTex._t;
}

export { TurboRoad as Game };
