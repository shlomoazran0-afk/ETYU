import * as THREE from 'three';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { SFX } from './sfx.js';
import { PhysicsWorld } from './physics.js';
import { Effects } from './effects.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// בסיס לכל משחק הבנוי על המנוע
export class Game {
  needsLock = false;
  over = false;
  started = false;

  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.input = engine.input;
    this.hud = engine.hud;
    this.sfx = engine.sfx;
    this.physics = new PhysicsWorld();
    this.effects = new Effects(engine.scene);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.elapsed = 0;
  }

  init() {}
  update() {}

  // הופעה בפני מסך סיום / ניצחון
  endScreen(title, sub, stats, win = false) {
    if (this.over) return;
    this.over = true;
    if (win) this.sfx.play('win');
    this.input.unlock();
    this.hud.showOverlay({
      title, sub, stats,
      buttons: [
        { label: '🔄 שחק שוב', primary: true, cb: () => this.engine.restart() },
        { label: '🏠 תפריט ראשי', cb: () => this.engine.exitToMenu() },
      ],
      locked: true,
    });
  }

  dispose() {
    this.effects.clear();
    this.scene.remove(this.root);
  }
}

// ליבת המנוע: רינדור, לולאה, קלט, HUD, סאונד, הפסקה וניהול משחקים
export class Engine {
  constructor({ host }) {
    this.host = host;
    this.onExit = null;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70,
      (host.clientWidth || window.innerWidth) / (host.clientHeight || window.innerHeight),
      0.1, 900
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera); // כדי שאובייקטים מחוברים למצלמה (נשק) ייצורו

    this.input = new Input(this.renderer.domElement);
    this.hud = new HUD(host);
    this.sfx = new SFX();
    this.game = null;
    this.GameClass = null;
    this.paused = false;

    this._clock = new THREE.Clock();
    this._raf = 0;
    this._fpsT = 0;
    this._fpsN = 0;

    this._onResize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);

    // יציאה מנעילת סמן (Esc) במשחקים עם עכבר → הפסקה
    this.input.onLockLost = () => {
      if (this.game && this.game.needsLock && !this.paused && !this.game.over) this.pause();
    };

    this._onKey = (e) => {
      if (!this.game) return;
      if (e.code === 'KeyM' && !e.repeat) {
        this.sfx.muted = !this.sfx.muted;
        this.hud.toast(this.sfx.muted ? '🔇 הקול כבוי' : '🔊 הקול דלוק');
      }
      if (e.code === 'Escape' && !this.game.needsLock && !this.game.over) {
        if (this.paused) this.resume();
        else if (!this.hud.overlayOpen) this.pause();
      }
    };
    window.addEventListener('keydown', this._onKey);

    this._loop = () => {
      this._raf = requestAnimationFrame(this._loop);
      const dt = Math.min(this._clock.getDelta(), 0.05);
      this._fpsN++;
      this._fpsT += dt;
      if (this._fpsT >= 0.5) {
        if (this.game) this.hud.fps(Math.round(this._fpsN / this._fpsT));
        this._fpsN = 0;
        this._fpsT = 0;
      }
      if (this.game) {
        if (!this.paused) this.game.update(dt);
        this.input.endFrame();
        this.renderer.render(this.scene, this.camera);
      }
    };
    this._loop();
  }

  startGame(GameClass) {
    this.stopGame();
    this.GameClass = GameClass;
    this.scene.clear();
    this.scene.add(this.camera); // scene.clear() מסיר גם את המצלמה
    this.camera.fov = 70;
    this.camera.rotation.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.scene.fog = null;
    this.scene.background = null;
    this.hud.reset();
    this.paused = false;
    this._clock.getDelta();
    this.game = new GameClass(this);
    this.game.init();
  }

  stopGame() {
    if (!this.game) return;
    this.game.dispose();
    this.game = null;
    this.input.unlock();
  }

  restart() {
    if (!this.GameClass) return;
    this.sfx.play('ui');
    this.startGame(this.GameClass);
  }

  exitToMenu() {
    this.sfx.play('ui');
    this.stopGame();
    this.hud.reset();
    this.onExit?.();
  }

  pause() {
    if (!this.game || this.paused || this.game.over || !this.game.started) return;
    this.paused = true;
    this.input.unlock();
    this.hud.showOverlay({
      title: '⏸ הפסקה',
      sub: 'המשחק מושהה',
      buttons: [
        { label: '▶️ המשך', primary: true, cb: () => this.resume() },
        { label: '🔄 התחל מחדש', cb: () => this.restart() },
        { label: '🏠 יציאה לתפריט', cb: () => this.exitToMenu() },
      ],
    });
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.hud.hideOverlay();
    this._clock.getDelta();
    if (this.game?.needsLock) this.input.lock();
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKey);
    this.input.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
