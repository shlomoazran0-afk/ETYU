import * as THREE from 'three';
import { TEX } from './assets.js';

// ETYU Engine — עולם: שמיים (כיפת גרדיאנט), תאורה עם צללים, קרקע וכוכבים

const PRESETS = {
  day: {
    top: 0x5aa8f0, bottom: 0xd8ecff, fog: 0xcfe4f8, fogNear: 70, fogFar: 300,
    sun: 0xfff4e0, sunI: 2.6, hemiS: 0xbfd9ff, hemiG: 0x7f8a66, hemiI: 0.9,
    ground: 'grass', stars: false, sunDisc: false,
  },
  sunset: {
    top: 0x35235e, bottom: 0xff9950, fog: 0xe8895a, fogNear: 60, fogFar: 260,
    sun: 0xffc9a0, sunI: 2.1, hemiS: 0x8a6bd4, hemiG: 0x5a4030, hemiI: 0.8,
    ground: 'sand', stars: false, sunDisc: true,
  },
  night: {
    top: 0x03050d, bottom: 0x101a33, fog: 0x0a1122, fogNear: 40, fogFar: 200,
    sun: 0x9fb4ff, sunI: 0.85, hemiS: 0x27324f, hemiG: 0x11151f, hemiI: 0.55,
    ground: 'grid', stars: true, sunDisc: false,
  },
};

function groundMat(type, size) {
  const rep = size / 7;
  if (type === 'grass') return new THREE.MeshStandardMaterial({ map: tiled(TEX.grass, rep, rep), roughness: 1 });
  if (type === 'sand') return new THREE.MeshStandardMaterial({ map: tiled(TEX.sand, rep, rep), roughness: 1 });
  return new THREE.MeshStandardMaterial({ map: tiled(TEX.grid, rep, rep), roughness: 0.6, metalness: 0.2 });
}

function tiled(base, rx, ry) {
  const t = base.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function makeStars() {
  const n = 700;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.42;
    const r = 400;
    pos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
    pos[i * 3 + 1] = Math.sin(ph) * r + 15;
    pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9,
  }));
}

export function setupWorld(scene, { preset = 'day', size = 320, groundY = 0, shadowArea = 70, sunPos = [28, 46, 20], sunTarget = [0, 0, 0] } = {}) {
  const P = PRESETS[preset];
  const group = new THREE.Group();
  scene.fog = new THREE.Fog(P.fog, P.fogNear, P.fogFar);

  // כיפת שמיים עם גרדיאנט
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(P.top) },
      bottom: { value: new THREE.Color(P.bottom) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
      void main(){
        float h = clamp(normalize(vP).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottom, top, pow(h, 0.65)), 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(430, 24, 12), skyMat);
  group.add(sky);

  // תאורה
  const hemi = new THREE.HemisphereLight(P.hemiS, P.hemiG, P.hemiI);
  const sun = new THREE.DirectionalLight(P.sun, P.sunI);
  sun.position.set(...sunPos);
  sun.target.position.set(...sunTarget);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -shadowArea; sc.right = shadowArea;
  sc.top = shadowArea; sc.bottom = -shadowArea;
  sc.near = 5; sc.far = 300;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  group.add(hemi, sun, sun.target);

  // קרקע
  const ground = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 48), groundMat(P.ground, size));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundY;
  ground.receiveShadow = true;
  group.add(ground);

  if (P.stars) group.add(makeStars());
  if (P.sunDisc) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(30, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false })
    );
    disc.position.set(0, 58, -330);
    disc.userData.collide = false;
    group.add(disc);
  }

  scene.add(group);
  return { group, sun, hemi, ground };
}
