import * as THREE from 'three';

// ETYU Engine — אפקטים: מערכת חלקיקים ופסי ירי (מיחזור משאבים)
const MAX_PARTICLES = 360;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.free = [];
    this.active = [];
    this.tracers = [];
    this._geo = new THREE.TetrahedronGeometry(0.5);
    this._mats = new Map();
    this._tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
  }

  _mat(color) {
    if (!this._mats.has(color)) {
      this._mats.set(color, new THREE.MeshBasicMaterial({ color }));
    }
    return this._mats.get(color);
  }

  _spawn() {
    let m = this.free.pop();
    if (!m) {
      if (this.group.children.length >= MAX_PARTICLES) return null;
      m = new THREE.Mesh(this._geo, this._mat(0xffffff));
      this.group.add(m);
    }
    m.visible = true;
    return m;
  }

  burst(pos, { color = 0xffaa33, count = 12, speed = 6, size = 0.14, life = 0.7, gravity = -14, up = 2 } = {}) {
    for (let i = 0; i < count; i++) {
      const m = this._spawn();
      if (!m) break;
      m.material = this._mat(color);
      m.position.copy(pos);
      const s = size * (0.6 + Math.random() * 0.8);
      m.scale.setScalar(s);
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const sp = speed * (0.5 + Math.random() * 0.7);
      this.active.push({
        m,
        size: s,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        gravity,
        vel: new THREE.Vector3(
          Math.cos(a) * Math.cos(b) * sp,
          Math.sin(b) * sp + up,
          Math.sin(a) * Math.cos(b) * sp
        ),
        spin: (Math.random() - 0.5) * 12,
      });
    }
  }

  tracer(from, to, life = 0.07) {
    const m = new THREE.Mesh(
      this._tracerGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffe9a3, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      })
    );
    const dist = from.distanceTo(to);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    m.scale.z = Math.max(dist, 0.01);
    this.group.add(m);
    this.tracers.push({ m, life, maxLife: life });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.m.visible = false;
        this.free.push(p.m);
        this.active.splice(i, 1);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.m.position.addScaledVector(p.vel, dt);
      p.m.rotation.x += p.spin * dt;
      p.m.rotation.y += p.spin * dt;
      p.m.scale.setScalar(p.size * Math.max(0.01, p.life / p.maxLife));
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.group.remove(t.m);
        t.m.material.dispose();
        this.tracers.splice(i, 1);
        continue;
      }
      t.m.material.opacity = 0.9 * (t.life / t.maxLife);
    }
  }

  clear() {
    for (const p of this.active) { p.m.visible = false; this.free.push(p.m); }
    this.active.length = 0;
    for (const t of this.tracers) { this.group.remove(t.m); t.m.material.dispose(); }
    this.tracers.length = 0;
  }
}
