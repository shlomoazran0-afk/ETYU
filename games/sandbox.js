import * as THREE from 'three';
import { Game, clamp, lerp } from '../engine/core.js';
import { setupWorld } from '../engine/world.js';
import { Assets } from '../engine/assets.js';

// 💥 מגרש ההרס — סנדבוקס פיזיקה: ירי כדורים, ניפוץ ארגזים ופיצוצי חביות

const BALL_COLORS = [0xd94f3d, 0x3d7bd9, 0x3dd97b, 0xd9c33d, 0xb03dd9, 0x3dd9d0];

export class SmashYard extends Game {
  needsLock = false;

  init() {
    const w = setupWorld(this.scene, { preset: 'night', size: 200 });
    this.root.add(w.group);

    this.balls = [];
    this.score = 0;
    this.shots = 0;
    this.targets = 0;
    this.shake = 0;

    this.camYaw = 0.5;
    this.camPitch = 0.34;
    this.camDist = 15;
    this.camTarget = new THREE.Vector3(0, 1.6, 0);

    // זיהוי פגיעות חזקות של כדורים במטרות
    this.physics.onImpact = (body, s, v) => {
      if (!s || s.dead) return;
      if (s.tag === 'crate' && v > 6.5) this.smashCrate(s);
      else if (s.tag === 'barrel' && v > 5.0) this.explodeBarrel(s);
    };

    this.buildYard();

    this.rayDir = new THREE.Vector3();
    this.hud.score(0);

    this.camera.position.set(10, 7, 12);
    this.camera.lookAt(this.camTarget);

    this.hud.showOverlay({
      title: '💥 מגרש ההרס',
      sub: 'פיזיקה חופשית: נפצו את כל 13 המטרות. חביות מתפוצצות בשרשור!',
      controls: [['קליק שמאלי', 'ירי כדור'], ['גרירה ימנית / חצים', 'סיבוב מצלמה'], ['גלגלת', 'זום'], ['1 / 2 / 3', 'ארגזים / חבית / כדור'], ['R', 'איפוס מגרש'], ['M', 'השתקה']],
      buttons: [{ label: '▶️ התחל להרוס', primary: true, cb: () => this.begin() }],
      locked: true,
    });
  }

  begin() {
    this.sfx.init();
    this.hud.hideOverlay();
    this.started = true;
  }

  addSolid(obj, tag) {
    this.root.add(obj);
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(obj);
    const half = new THREE.Vector3().subVectors(box.max, box.min).multiplyScalar(0.5);
    const c = new THREE.Vector3().addVectors(box.max, box.min).multiplyScalar(0.5);
    return this.physics.addStatic(obj, half, c, { tag });
  }

  buildYard() {
    // חומות המגרש
    for (const [w, d, x, z] of [[27, 0.8, 0, -13], [27, 0.8, 0, 13], [0.8, 27, -13, 0], [0.8, 27, 13, 0]]) {
      const m = Assets.wall(w, 1.7, d);
      m.position.set(x, 0.85, z);
      this.root.add(m);
      this.physics.addTree(m);
    }

    // מגדל ארגזים 3-2-1
    const s = 1.1;
    let n = 0;
    for (let lvl = 0; lvl < 3; lvl++) {
      const count = 3 - lvl;
      for (let i = 0; i < count; i++) {
        const c = Assets.crate(s);
        c.position.set((i - (count - 1) / 2) * (s + 0.08), s / 2 + lvl * s, 0);
        this.addSolid(c, 'crate');
        n++;
      }
    }

    // חביות מסביב
    for (const [x, z] of [[-5, -3], [5.5, -2], [-3.5, 4.5], [4, 5], [0, -5.5]]) {
      const b = Assets.barrel();
      b.position.set(x, 0.53, z);
      this.addSolid(b, 'barrel');
      n++;
    }

    // ארגזים פזורים
    for (const [x, z] of [[-8, 2], [8, 3.5], [-7, -7], [7.5, -7.5], [0, 6.5]]) {
      const c = Assets.crate(1.2);
      c.position.set(x, 0.6, z);
      this.addSolid(c, 'crate');
      n++;
    }

    // פנסים
    for (const [x, z] of [[-10, -10], [10, 10]]) {
      const l = Assets.lamp();
      l.position.set(x, 0, z);
      Assets.noCollide(l);
      this.root.add(l);
    }

    this.targets = n;
  }

  update(dt) {
    if (!this.started) return;
    if (this.over) { this.effects.update(dt); return; }
    this.elapsed += dt;
    const inp = this.input;

    // --- מצלמה מקיפה ---
    if (inp.buttons.has(2)) {
      this.camYaw -= inp.mouseDX * 0.005;
      this.camPitch = clamp(this.camPitch + inp.mouseDY * 0.005, -0.05, 1.25);
    }
    this.camYaw += (inp.axis('ArrowLeft', 'ArrowRight') * -1.8) * dt;
    this.camPitch = clamp(this.camPitch + inp.axis('ArrowDown', 'ArrowUp') * 1.2 * dt, -0.05, 1.25);
    this.camDist = clamp(this.camDist + inp.wheel * 0.012, 7, 30);
    const cp = Math.cos(this.camPitch);
    this.camera.position.set(
      this.camTarget.x + Math.sin(this.camYaw) * cp * this.camDist,
      this.camTarget.y + Math.sin(this.camPitch) * this.camDist,
      this.camTarget.z + Math.cos(this.camYaw) * cp * this.camDist
    );
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.5;
    }
    this.camera.lookAt(this.camTarget);

    // --- ירי ---
    if (inp.clicked(0)) this.shootBall();

    // --- יצירת מטרות/כדורים ---
    if (inp.pressed('Digit1')) this.spawnProps('crate');
    if (inp.pressed('Digit2')) this.spawnProps('barrel');
    if (inp.pressed('Digit3')) this.dropBall();
    if (inp.pressed('KeyR')) {
      this.hud.toast('🔄 המגרש אופס');
      this.engine.restart();
      return;
    }

    // --- פיזיקה ---
    this.physics.step(dt);
    this.physics.collideAllPairs();

    // --- כדורים: ניקוי ישנים ---
    while (this.balls.length > 28) {
      const old = this.balls.shift();
      this.physics.removeBody(old);
      this.root.remove(old.mesh);
    }

    this.effects.update(dt);
    this.hud.score(this.score);
    this.hud.info('🎯 נותרו ' + this.targets + ' · 🔵 ' + this.balls.length + ' כדורים · קליק = ירי');
  }

  shootBall() {
    if (this.over) return;
    this.camera.getWorldDirection(this.rayDir);
    const color = BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
    const m = Assets.ball(0.3, color);
    m.position.copy(this.camera.position).addScaledVector(this.rayDir, 1.2);
    this.root.add(m);
    const b = this.physics.addBody(m, {
      sphere: true,
      r: 0.3,
      half: new THREE.Vector3(0.3, 0.3, 0.3),
      restitution: 0.55,
      friction: 1.4,
      airFriction: 0.02,
    });
    b.vel.copy(this.rayDir).multiplyScalar(27);
    b.vel.y += 1.5;
    this.balls.push(b);
    this.shots++;
    this.sfx.play('shootBall');
  }

  dropBall() {
    const color = BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
    const m = Assets.ball(0.4, color);
    m.position.set(-6 + Math.random() * 12, 7, -6 + Math.random() * 12);
    this.root.add(m);
    const b = this.physics.addBody(m, {
      sphere: true,
      r: 0.4,
      half: new THREE.Vector3(0.4, 0.4, 0.4),
      restitution: 0.5,
      friction: 1.4,
      airFriction: 0.02,
    });
    this.balls.push(b);
    this.sfx.play('shootBall');
  }

  spawnProps(kind) {
    const x = -8 + Math.random() * 16;
    const z = -8 + Math.random() * 16;
    if (kind === 'crate') {
      const c = Assets.crate(1.2);
      c.position.set(x, 0.6, z);
      this.addSolid(c, 'crate');
      const c2 = Assets.crate(1.2);
      c2.position.set(x + 0.1, 1.8, z);
      this.addSolid(c2, 'crate');
      this.targets += 2;
      this.hud.toast('🧱 נוספו 2 ארגזים');
    } else {
      const b = Assets.barrel();
      b.position.set(x, 0.53, z);
      this.addSolid(b, 'barrel');
      this.targets++;
      this.hud.toast('🛢️ נוספה חבית');
    }
  }

  // התנגשות חזקה של כדור במטרה — מטופלת דרך physics.onImpact

  smashCrate(s) {
    if (s.dead) return;
    s.dead = true;
    this.physics.removeStatic(s);
    if (s.mesh) this.root.remove(s.mesh);
    this.effects.burst(s.pos, { color: 0xb98a4a, count: 14, speed: 6, life: 0.7, size: 0.15 });
    this.sfx.play('break');
    this.score += 20;
    this.targets--;
    this.checkWin();
  }

  explodeBarrel(s) {
    if (s.dead) return;
    s.dead = true;
    this.physics.removeStatic(s);
    if (s.mesh) this.root.remove(s.mesh);
    this.effects.burst(s.pos, { color: 0xff7733, count: 26, speed: 9, life: 0.8, size: 0.2 });
    this.effects.burst(s.pos, { color: 0x2b2f36, count: 10, speed: 4, life: 1, size: 0.24, up: 5 });
    this.sfx.play('explode');
    this.shake = 0.8;
    this.score += 50;

    // שרשור פיצוצים
    for (const st of [...this.physics.statics]) {
      if (st.dead || !st.tag) continue;
      const d = st.pos.distanceTo(s.pos);
      if (d < 3.5) {
        if (st.tag === 'barrel') this.explodeBarrel(st);
        else if (st.tag === 'crate') this.smashCrate(st);
      }
    }
    // דחיפת כדורים
    for (const b of this.physics.bodies) {
      if (!b.sphere) continue;
      const d = b.mesh.position.distanceTo(s.pos);
      if (d < 4.5 && d > 0.01) {
        const dir = new THREE.Vector3().subVectors(b.mesh.position, s.pos).divideScalar(d);
        b.vel.addScaledVector(dir, 14 * (1 - d / 4.5));
        b.vel.y += 5;
      }
    }
    this.checkWin();
  }

  checkWin() {
    if (this.targets <= 0 && !this.over && this.started) {
      this.endScreen(
        '🏆 ניקוי מוחלט!',
        'כל המטרות במגרש הושמדו. הרסני!',
        [['ניקוד', this.score], ['כדורים שנורו', this.shots], ['זמן', Math.round(this.elapsed) + ' שנ׳']],
        true
      );
    }
  }
}

export { SmashYard as Game };
