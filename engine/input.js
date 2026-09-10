// ETYU Engine — קלט: מקלדת, עכבר ונעילת סמן (Pointer Lock)
const GAME_KEYS = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR',
  'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3',
]);

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.justPressed = new Set();
    this.buttons = new Set();
    this.justClicked = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.enabled = true;
    this.locked = false;
    this.onLockLost = null;

    this._kd = (e) => {
      if (this.enabled && GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add(e.code);
    };
    this._ku = (e) => this.keys.delete(e.code);
    this._mm = (e) => {
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._md = (e) => {
      this.buttons.add(e.button);
      this.justClicked.add(e.button);
    };
    this._mu = (e) => this.buttons.delete(e.button);
    this._blur = () => { this.keys.clear(); this.buttons.clear(); };
    this._wheel = (e) => {
      if (this.enabled) { e.preventDefault(); this.wheel += e.deltaY; }
    };
    this._ctx = (e) => { if (this.enabled) e.preventDefault(); };
    this._plc = () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.dom;
      if (was && !this.locked && this.onLockLost) this.onLockLost();
    };

    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('mousemove', this._mm);
    window.addEventListener('mousedown', this._md);
    window.addEventListener('mouseup', this._mu);
    window.addEventListener('blur', this._blur);
    document.addEventListener('pointerlockchange', this._plc);
    dom.addEventListener('wheel', this._wheel, { passive: false });
    dom.addEventListener('contextmenu', this._ctx);
  }

  down(code) { return this.enabled && this.keys.has(code); }
  pressed(code) { return this.enabled && this.justPressed.has(code); }
  clicked(btn) { return this.enabled && this.justClicked.has(btn); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }

  lock() {
    try {
      const p = this.dom.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* מותר להיכשל */ }
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  endFrame() {
    this.justPressed.clear();
    this.justClicked.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('mousemove', this._mm);
    window.removeEventListener('mousedown', this._md);
    window.removeEventListener('mouseup', this._mu);
    window.removeEventListener('blur', this._blur);
    document.removeEventListener('pointerlockchange', this._plc);
    this.dom.removeEventListener('wheel', this._wheel);
    this.dom.removeEventListener('contextmenu', this._ctx);
  }
}
