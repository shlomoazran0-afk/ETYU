import * as THREE from 'three';

// ETYU Engine — פיזיקה: גופים דינמיים (קופסה / כדור) מול סטטיקה (AABB),
// כבידה, חיכוך, קפיצה, העלאת מדרגות (auto-step), פלטפורמות נעות והתנגשויות כדור-כדור.
export class PhysicsWorld {
  constructor() {
    this.gravity = -24;
    this.groundY = 0;      // רצפה גלובלית (null = אין — נפילה חופשית)
    this.statics = [];
    this.bodies = [];
    this.onImpact = null;  // (body, stat, impactSpeed) => void
  }

  // --- סטטיקה ---
  addStatic(mesh, half, pos, extra = {}) {
    const s = {
      mesh: mesh || null,
      half,
      pos: pos.clone(),
      delta: new THREE.Vector3(),
      follow: !!extra.follow,
      tag: extra.tag || null,
      dead: false,
    };
    this.statics.push(s);
    return s;
  }

  // מוסיף כל Mesh (שלא מסומן collide:false) כסטטי, לפי תיבת החפיפה העולמית שלו
  addTree(root) {
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    root.traverse((o) => {
      if (!o.isMesh || o.userData.collide === false || !o.visible) return;
      box.setFromObject(o);
      const half = new THREE.Vector3().subVectors(box.max, box.min).multiplyScalar(0.5);
      if (half.x <= 0.001 || half.y <= 0.001 || half.z <= 0.001) return;
      const c = new THREE.Vector3().addVectors(box.max, box.min).multiplyScalar(0.5);
      this.addStatic(o, half, c);
    });
  }

  removeStatic(s) {
    if (s) s.dead = true;
    const i = this.statics.indexOf(s);
    if (i >= 0) this.statics.splice(i, 1);
  }

  // --- גופים דינמיים ---
  addBody(mesh, opts = {}) {
    const b = {
      mesh,
      half: opts.half || new THREE.Vector3(0.4, 0.4, 0.4),
      r: opts.r || 0.3,
      sphere: !!opts.sphere,
      vel: new THREE.Vector3(),
      restitution: opts.restitution ?? 0,
      friction: opts.friction ?? 8,
      airFriction: opts.airFriction ?? 0.4,
      gravityScale: opts.gravityScale ?? 1,
      canStep: opts.canStep || 0,
      onGround: false,
      ground: null,
    };
    this.bodies.push(b);
    return b;
  }

  removeBody(b) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  step(dt) {
    // סטטיקה שרודפת מש (פלטפורמות נעות) — delta מחושב אוטומטית מתנועת המש
    for (const s of this.statics) {
      if (s.mesh && s.follow) {
        s.delta.copy(s.mesh.position).sub(s.pos);
        s.pos.copy(s.mesh.position);
      }
    }
    for (const b of this.bodies) this._integrate(b, dt);
    // גוף שעומד על פלטפורמה נעה נסחב איתה
    for (const b of this.bodies) {
      if (b.onGround && b.ground && b.ground.delta) b.mesh.position.add(b.ground.delta);
    }
  }

  _integrate(b, dt) {
    const p = b.mesh.position;
    b.vel.y += this.gravity * b.gravityScale * dt;
    p.addScaledVector(b.vel, dt);
    b.onGround = false;
    b.ground = null;

    if (this.groundY !== null && p.y - b.half.y < this.groundY) {
      p.y = this.groundY + b.half.y;
      if (b.vel.y < 0) {
        if (this.onImpact && -b.vel.y > 5) this.onImpact(b, null, -b.vel.y);
        b.vel.y = -b.vel.y * b.restitution;
        if (b.vel.y < 1.2) b.vel.y = 0;
      }
      b.onGround = true;
      b.ground = null;
    }

    for (const s of this.statics) {
      if (b.sphere) this._collideSphere(b, s);
      else this._collideBox(b, s);
    }

    const fr = (b.onGround ? b.friction : b.airFriction) * dt;
    const k = Math.max(0, 1 - fr);
    b.vel.x *= k;
    b.vel.z *= k;
  }

  _collideBox(b, s) {
    const p = b.mesh.position;
    const dx = p.x - s.pos.x, dy = p.y - s.pos.y, dz = p.z - s.pos.z;
    const ox = b.half.x + s.half.x - Math.abs(dx);
    if (ox <= 0) return;
    const oy = b.half.y + s.half.y - Math.abs(dy);
    if (oy <= 0) return;
    const oz = b.half.z + s.half.z - Math.abs(dz);
    if (oz <= 0) return;

    let axis = 0, overlap = ox;
    if (oy < overlap) { axis = 1; overlap = oy; }
    if (oz < overlap) { axis = 2; overlap = oz; }

    // Auto-step — חסימה אופקית עם מדרגה נמוכה: לעלות במקום להיחסם
    if (axis !== 1 && b.canStep > 0 && b.vel.y <= 0.01) {
      const top = s.pos.y + s.half.y;
      const rise = top - (p.y - b.half.y);
      if (rise > 0 && rise <= b.canStep && this._fitsAt(b, p.x, top + b.half.y + 0.02, p.z)) {
        p.y = top + b.half.y + 0.001;
        if (b.vel.y < 0) b.vel.y = 0;
        b.onGround = true;
        b.ground = s;
        return;
      }
    }

    const sign = (axis === 0 ? dx : axis === 1 ? dy : dz) < 0 ? -1 : 1;
    if (axis === 0) {
      p.x += sign * overlap;
      if ((sign > 0 && b.vel.x < 0) || (sign < 0 && b.vel.x > 0)) {
        const impact = Math.abs(b.vel.x);
        if (this.onImpact && impact > 5) this.onImpact(b, s, impact);
        b.vel.x = -b.vel.x * b.restitution;
        if (Math.abs(b.vel.x) < 0.8) b.vel.x = 0;
      }
    } else if (axis === 1) {
      p.y += sign * overlap;
      if (sign > 0) {
        // נחיתה על הסטטי (הגוף מעליו)
        if (b.vel.y < 0) {
          if (this.onImpact && -b.vel.y > 5) this.onImpact(b, s, -b.vel.y);
          b.vel.y = -b.vel.y * b.restitution;
          if (b.vel.y < 1.0) b.vel.y = 0;
        }
        b.onGround = true;
        b.ground = s;
      } else if (b.vel.y > 0) {
        b.vel.y = 0; // פגיעה בתקרה מלמטה
      }
    } else {
      p.z += sign * overlap;
      if ((sign > 0 && b.vel.z < 0) || (sign < 0 && b.vel.z > 0)) {
        const impact = Math.abs(b.vel.z);
        if (this.onImpact && impact > 5) this.onImpact(b, s, impact);
        b.vel.z = -b.vel.z * b.restitution;
        if (Math.abs(b.vel.z) < 0.8) b.vel.z = 0;
      }
    }
  }

  _collideSphere(b, s) {
    const p = b.mesh.position;
    const r = b.r;
    const cx = Math.max(s.pos.x - s.half.x, Math.min(p.x, s.pos.x + s.half.x));
    const cy = Math.max(s.pos.y - s.half.y, Math.min(p.y, s.pos.y + s.half.y));
    const cz = Math.max(s.pos.z - s.half.z, Math.min(p.z, s.pos.z + s.half.z));
    const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r * r) return;

    let nx = 0, ny = 0, nz = 0;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      nx = dx / d; ny = dy / d; nz = dz / d;
      const push = r - d;
      p.x += nx * push; p.y += ny * push; p.z += nz * push;
    } else {
      // המרכז בתוך התיבה — לדחוף כלפי מעלה
      p.y = s.pos.y + s.half.y + r;
      ny = 1;
    }

    const vn = b.vel.x * nx + b.vel.y * ny + b.vel.z * nz;
    if (vn < 0) {
      if (this.onImpact && -vn > 5) this.onImpact(b, s, -vn);
      const j = -(1 + b.restitution) * vn;
      b.vel.x += j * nx;
      b.vel.y += j * ny;
      b.vel.z += j * nz;
      // מנוחה — בליטות קטנות נגררות לאפס
      const vn2 = b.vel.x * nx + b.vel.y * ny + b.vel.z * nz;
      if (Math.abs(vn2) < 0.9) {
        b.vel.x -= vn2 * nx;
        b.vel.y -= vn2 * ny;
        b.vel.z -= vn2 * nz;
      }
    }
    if (ny > 0.5) { b.onGround = true; b.ground = s; }
  }

  _fitsAt(b, x, y, z) {
    // האם תיבת הגוף חופשית במיקום מוצע (לצורך auto-step)
    const hx = b.half.x - 0.02, hy = b.half.y, hz = b.half.z - 0.02;
    for (const s of this.statics) {
      const dx = x - s.pos.x, dy = y - s.pos.y, dz = z - s.pos.z;
      if (Math.abs(dx) < hx + s.half.x &&
          Math.abs(dy) < hy + s.half.y - 0.01 &&
          Math.abs(dz) < hz + s.half.z) return false;
    }
    return true;
  }

  // התנגשות כדור-כדור (מסות שוות)
  collidePair(a, b) {
    if (!a.sphere || !b.sphere) return;
    const pa = a.mesh.position, pb = b.mesh.position;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-8) return;
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d, nz = dz / d;
    const push = (rr - d) / 2;
    pa.x -= nx * push; pa.y -= ny * push; pa.z -= nz * push;
    pb.x += nx * push; pb.y += ny * push; pb.z += nz * push;
    const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y, rvz = b.vel.z - a.vel.z;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn < 0) {
      const rest = Math.min(a.restitution, b.restitution);
      const j = -(1 + rest) * vn / 2;
      a.vel.x -= j * nx; a.vel.y -= j * ny; a.vel.z -= j * nz;
      b.vel.x += j * nx; b.vel.y += j * ny; b.vel.z += j * nz;
    }
  }

  collideAllPairs() {
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this.collidePair(this.bodies[i], this.bodies[j]);
      }
    }
  }
}
