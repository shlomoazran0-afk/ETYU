import * as THREE from 'three';

// ETYU Engine — נכסים פרוצדורליים: טקסטורות קנבס, חומרים ומפעל מש-אובייקטים.
// כל הנכסים נוצרים בקוד — בלי קבצי תמונה או מודלים חיצוניים.

const rnd = (a, b) => a + Math.random() * (b - a);

function makeTex(size, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function tiled(base, rx, ry) {
  const t = base.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

// --- בסיס עץ (לקרשים ולארגזים) ---
function woodBase(g, s) {
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#8f6034' : '#a5713f';
    g.fillRect(i * s / 4, 0, s / 4, s);
  }
  g.strokeStyle = 'rgba(60,35,12,0.45)';
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * s;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 6, s * 0.3, x - 6, s * 0.6, x + 3, s);
    g.stroke();
  }
}

// --- טקסטורות ---
export const TEX = {
  wood: makeTex(128, (g, s) => woodBase(g, s), 1, 1),

  crate: makeTex(128, (g, s) => {
    woodBase(g, s);
    g.strokeStyle = '#5d3a17';
    g.lineWidth = 11;
    g.strokeRect(6, 6, s - 12, s - 12);
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(10, 10); g.lineTo(s - 10, s - 10);
    g.moveTo(s - 10, 10); g.lineTo(10, s - 10);
    g.stroke();
  }),

  metal: makeTex(128, (g, s) => {
    g.fillStyle = '#7a8288';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd(0.02, 0.08)})`;
      g.fillRect(0, Math.random() * s, s, 1);
    }
    g.fillStyle = '#5a6268';
    for (const [x, y] of [[14, 14], [s - 14, 14], [14, s - 14], [s - 14, s - 14]]) {
      g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
    }
  }),

  barrel: makeTex(128, (g, s) => {
    g.fillStyle = '#a34a2a';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(40,20,10,${rnd(0.03, 0.1)})`;
      g.fillRect(Math.random() * s, Math.random() * s, rnd(2, 10), rnd(2, 6));
    }
    g.fillStyle = '#6b3018';
    g.fillRect(0, s * 0.18, s, 9);
    g.fillRect(0, s * 0.74, s, 9);
    g.fillStyle = 'rgba(255,220,120,0.75)';
    g.font = 'bold 26px monospace';
    g.textAlign = 'center';
    g.fillText('⚠', s / 2, s / 2 + 9);
  }),

  brick: makeTex(128, (g, s) => {
    g.fillStyle = '#b8ab98';
    g.fillRect(0, 0, s, s);
    const bw = 30, bh = 15;
    for (let y = 0; y < s / bh; y++) {
      const off = (y % 2) * (bw / 2);
      for (let x = -1; x < s / bw + 1; x++) {
        const shade = rnd(-14, 14) | 0;
        g.fillStyle = `rgb(${164 + shade},${85 + shade},${63 + shade})`;
        g.fillRect(x * bw + off + 1.5, y * bh + 1.5, bw - 3, bh - 3);
      }
    }
  }),

  windows: makeTex(128, (g, s) => {
    g.fillStyle = '#2b3138';
    g.fillRect(0, 0, s, s);
    const n = 4, cell = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = Math.random() < 0.3 ? '#ffd77a' : '#46525f';
        g.fillRect(x * cell + 5, y * cell + 5, cell - 10, cell - 12);
      }
    }
  }),

  grass: makeTex(128, (g, s) => {
    g.fillStyle = '#5d9c46';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 320; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,30,0.35)' : 'rgba(150,210,110,0.3)';
      g.fillRect(Math.random() * s, Math.random() * s, rnd(1, 3), rnd(1, 3));
    }
  }),

  sand: makeTex(128, (g, s) => {
    g.fillStyle = '#d9c489';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(160,130,70,0.3)' : 'rgba(240,225,170,0.4)';
      g.fillRect(Math.random() * s, Math.random() * s, rnd(1, 3), rnd(1, 3));
    }
  }),

  grid: makeTex(128, (g, s) => {
    g.fillStyle = '#0d1420';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#1e4a78';
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(s, i * 32); g.stroke();
    }
    g.fillStyle = 'rgba(80,180,255,0.5)';
    g.fillRect(0, 0, s, 2);
    g.fillRect(0, 0, 2, s);
  }),

  road: makeTex(256, (g, s) => {
    g.fillStyle = '#33373e';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd(0.01, 0.05)})`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    // קווי נתיב מקווקווים
    g.fillStyle = '#e8e8e8';
    for (const x of [s / 3 - 2, (2 * s) / 3 - 2]) {
      for (let y = 0; y < s; y += 64) g.fillRect(x, y, 4, 30);
    }
    // קווי דשדש
    g.fillStyle = '#d9b13b';
    g.fillRect(6, 0, 5, s);
    g.fillRect(s - 11, 0, 5, s);
  }),

  chevron: makeTex(128, (g, s) => {
    g.fillStyle = '#041c26';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#35f0ff';
    g.lineWidth = 14;
    g.lineJoin = 'round';
    for (const y of [100, 68, 36]) {
      g.beginPath();
      g.moveTo(22, y + 22);
      g.lineTo(64, y - 12);
      g.lineTo(106, y + 22);
      g.stroke();
    }
  }),
};

// --- חומרים משותפים ---
export const MAT = {
  wood: new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.85 }),
  crate: new THREE.MeshStandardMaterial({ map: TEX.crate, roughness: 0.85 }),
  metal: new THREE.MeshStandardMaterial({ map: TEX.metal, metalness: 0.55, roughness: 0.4 }),
  barrel: new THREE.MeshStandardMaterial({ map: TEX.barrel, metalness: 0.3, roughness: 0.6 }),
  brick: new THREE.MeshStandardMaterial({ map: TEX.brick, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8a94a4, roughness: 0.9 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.95, flatShading: true }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.7, roughness: 0.35 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1c2733, metalness: 0.6, roughness: 0.2 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc84a, metalness: 0.8, roughness: 0.25, emissive: 0x664400, emissiveIntensity: 0.4 }),
  gem: new THREE.MeshStandardMaterial({ color: 0x19e6c0, emissive: 0x0f9c85, emissiveIntensity: 0.9, roughness: 0.2 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9, flatShading: true }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 }),
};

// --- עזרים ---
function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function noCollide(obj) {
  obj.traverse((o) => { o.userData.collide = false; });
  return obj;
}

// --- מפעל הנכסים ---
export const Assets = {
  noCollide,

  crate(s = 1.2) {
    return mesh(new THREE.BoxGeometry(s, s, s), MAT.crate);
  },

  barrel() {
    return mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 14), MAT.barrel);
  },

  cone() {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.6 });
    const body = mesh(new THREE.ConeGeometry(0.3, 0.68, 12), m);
    body.position.y = 0.4;
    const base = mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), m);
    base.position.y = 0.04;
    g.add(base, body);
    return g;
  },

  ball(r = 0.32, color = 0xd94f3d) {
    return mesh(
      new THREE.SphereGeometry(r, 18, 14),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 })
    );
  },

  rock(s = 1) {
    const geo = new THREE.IcosahedronGeometry(s, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(rnd(0.75, 1.25));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return mesh(geo, MAT.darkStone.clone());
  },

  tree() {
    const g = new THREE.Group();
    const trunk = mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 8), MAT.trunk);
    trunk.position.y = 0.75;
    const c1 = mesh(new THREE.ConeGeometry(1.05, 1.5, 8), MAT.leaf);
    c1.position.y = 2.0;
    const c2 = mesh(new THREE.ConeGeometry(0.78, 1.2, 8), MAT.leaf);
    c2.position.y = 2.9;
    g.add(trunk, c1, c2);
    g.rotation.y = Math.random() * Math.PI * 2;
    const k = rnd(0.8, 1.3);
    g.scale.setScalar(k);
    return noCollide(g);
  },

  palm() {
    const g = new THREE.Group();
    let x = 0;
    for (let i = 0; i < 4; i++) {
      const seg = mesh(new THREE.CylinderGeometry(0.13 - i * 0.015, 0.16 - i * 0.015, 0.9, 7), MAT.trunk);
      x += i * 0.09;
      seg.position.set(x, 0.45 + i * 0.85, 0);
      seg.rotation.z = -0.12;
      g.add(seg);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = mesh(new THREE.BoxGeometry(1.7, 0.05, 0.38), MAT.leaf);
      leaf.position.set(x + Math.cos(a) * 0.7, 3.7 - 0.12, Math.sin(a) * 0.7);
      leaf.rotation.y = -a;
      leaf.rotation.z = -0.45;
      g.add(leaf);
    }
    return noCollide(g);
  },

  building(w = 4, h = 6, d = 4) {
    const mat = new THREE.MeshStandardMaterial({
      map: tiled(TEX.windows, Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3))),
      roughness: 0.8,
    });
    return mesh(new THREE.BoxGeometry(w, h, d), mat);
  },

  wall(w = 4, h = 3, d = 0.8) {
    const mat = new THREE.MeshStandardMaterial({
      map: tiled(TEX.brick, Math.max(1, w / 2), Math.max(1, h / 2)),
      roughness: 0.9,
    });
    return mesh(new THREE.BoxGeometry(w, h, d), mat);
  },

  platform(w = 4, d = 4, h = 0.6, mat = MAT.stone) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat);
  },

  stairs(steps = 4, w = 2, stepH = 0.42, stepD = 0.5) {
    // מדרגות העולות לאורך -Z (כל מדרגה מלאה מהקרקע — מתאים לפיזיקת AABB)
    const g = new THREE.Group();
    for (let i = 0; i < steps; i++) {
      const h = (i + 1) * stepH;
      const st = mesh(new THREE.BoxGeometry(w, h, stepD), MAT.stone);
      st.position.set(0, h / 2, -(i * stepD) - stepD / 2);
      g.add(st);
    }
    return g;
  },

  gem() {
    const m = mesh(new THREE.OctahedronGeometry(0.34), MAT.gem);
    m.scale.y = 1.5;
    return noCollide(m);
  },

  coin() {
    const g = new THREE.Group();
    const c = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 18), MAT.gold);
    c.rotation.x = Math.PI / 2;
    g.add(c);
    return noCollide(g);
  },

  drone() {
    const g = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(0.42, 16, 12), MAT.darkMetal);
    const eye = mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    eye.position.set(0, 0.02, 0.38);
    const ring = mesh(new THREE.TorusGeometry(0.58, 0.05, 8, 20), MAT.darkMetal);
    ring.rotation.x = Math.PI / 2;
    g.add(body, eye, ring);
    const rotors = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08), MAT.darkMetal);
      arm.position.set(Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55);
      arm.rotation.y = -a;
      const rotor = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0x11151a, roughness: 0.6 }));
      rotor.position.set(Math.cos(a) * 0.8, 0.17, Math.sin(a) * 0.8);
      rotors.push(rotor);
      g.add(arm, rotor);
    }
    g.userData.rotors = rotors;
    return noCollide(g);
  },

  kart(color = 0xe23a2e) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
    const body = mesh(new THREE.BoxGeometry(1.4, 0.42, 2.3), mat);
    body.position.y = 0.45;
    const cabin = mesh(new THREE.BoxGeometry(0.9, 0.35, 1.0), MAT.glass);
    cabin.position.set(0, 0.8, -0.15);
    const spoiler = mesh(new THREE.BoxGeometry(1.5, 0.07, 0.35), mat);
    spoiler.position.set(0, 0.85, -1.1);
    g.add(body, cabin, spoiler);
    const wheels = [];
    for (const [wx, wz] of [[0.72, 0.78], [-0.72, 0.78], [0.72, -0.78], [-0.72, -0.78]]) {
      const wh = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14), new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.8 }));
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.34, wz);
      wheels.push(wh);
      g.add(wh);
    }
    const light = mesh(new THREE.BoxGeometry(0.9, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    light.position.set(0, 0.5, 1.16);
    g.add(light);
    g.userData.wheels = wheels;
    return noCollide(g);
  },

  lamp() {
    const g = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 8), MAT.metal);
    pole.position.y = 2.1;
    const head = mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
    head.position.set(0.3, 4.25, 0);
    g.add(pole, head);
    return noCollide(g);
  },

  flag(color = 0xffd23e) {
    const g = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), MAT.metal);
    pole.position.y = 1.1;
    const flag = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.04), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.5 }));
    flag.position.set(0.48, 1.85, 0);
    g.add(pole, flag);
    return noCollide(g);
  },

  portal() {
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(1.3, 0.13, 10, 32), new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x7a3cff, emissiveIntensity: 1.2, roughness: 0.3 }));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.17, 32), new THREE.MeshBasicMaterial({ color: 0xb28aff, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    g.add(ring, inner);
    return noCollide(g);
  },

  cloud() {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
    for (const [sx, sy, sz, x, z] of [[2.4, 0.9, 1.2, 0, 0], [1.6, 0.7, 1, 1.6, 0.3], [1.8, 0.8, 1.1, -1.5, -0.2]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), m);
      b.scale.set(sx, sy, sz);
      b.position.set(x, 0, z);
      g.add(b);
    }
    return noCollide(g);
  },

  boostPad() {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 3.4),
      new THREE.MeshBasicMaterial({ map: TEX.chevron, transparent: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    return noCollide(m);
  },
};
