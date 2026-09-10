// ETYU Engine — HUD: ניקוד, בריאות, מסרים, טוסטים ושכבות־על (תפריט/הפסקה/סיום)
export class HUD {
  constructor(host) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-pill hud-score hidden"></div>
        <div class="hud-health hidden"><div class="hud-health-fill"></div></div>
        <div class="hud-pill hud-info hidden"></div>
        <div class="hud-pill hud-fps hidden"></div>
      </div>
      <div class="hud-crosshair hidden"><span></span><span></span><span></span><span></span><i></i></div>
      <div class="hud-msg hidden"><h2></h2><p></p></div>
      <div class="hud-flash"></div>
      <div class="hud-toast hidden"></div>
      <div class="hud-overlay hidden"><div class="hud-panel">
        <h2></h2>
        <p class="ov-sub"></p>
        <div class="ov-stats"></div>
        <div class="ov-controls"></div>
        <div class="ov-buttons"></div>
      </div></div>`;
    host.appendChild(this.root);

    this.el = {
      score: this.root.querySelector('.hud-score'),
      health: this.root.querySelector('.hud-health'),
      healthFill: this.root.querySelector('.hud-health-fill'),
      info: this.root.querySelector('.hud-info'),
      fps: this.root.querySelector('.hud-fps'),
      cross: this.root.querySelector('.hud-crosshair'),
      msg: this.root.querySelector('.hud-msg'),
      msgTitle: this.root.querySelector('.hud-msg h2'),
      msgSub: this.root.querySelector('.hud-msg p'),
      flash: this.root.querySelector('.hud-flash'),
      toast: this.root.querySelector('.hud-toast'),
      overlay: this.root.querySelector('.hud-overlay'),
      ovTitle: this.root.querySelector('.hud-panel h2'),
      ovSub: this.root.querySelector('.ov-sub'),
      ovStats: this.root.querySelector('.ov-stats'),
      ovControls: this.root.querySelector('.ov-controls'),
      ovButtons: this.root.querySelector('.ov-buttons'),
    };
    this._msgTimer = 0;
    this._toastTimer = 0;
    this._overlayLocked = false;
  }

  score(v) {
    if (v == null) { this.el.score.classList.add('hidden'); return; }
    this.el.score.classList.remove('hidden');
    this.el.score.textContent = 'ניקוד: ' + Math.round(v);
  }

  health(cur, max = 100) {
    if (cur == null) { this.el.health.classList.add('hidden'); return; }
    this.el.health.classList.remove('hidden');
    const p = Math.max(0, Math.min(1, cur / max));
    this.el.healthFill.style.width = (p * 100).toFixed(1) + '%';
    this.el.healthFill.classList.toggle('low', p < 0.32);
  }

  info(text) {
    if (text == null) { this.el.info.classList.add('hidden'); return; }
    this.el.info.classList.remove('hidden');
    this.el.info.textContent = text;
  }

  fps(v) {
    if (v == null) { this.el.fps.classList.add('hidden'); return; }
    this.el.fps.classList.remove('hidden');
    this.el.fps.textContent = v + ' FPS';
  }

  cross(show) { this.el.cross.classList.toggle('hidden', !show); }

  showMsg(title, sub = '', ms = 1600) {
    this.el.msgTitle.textContent = title;
    this.el.msgSub.textContent = sub;
    this.el.msg.classList.remove('hidden');
    clearTimeout(this._msgTimer);
    if (ms > 0) this._msgTimer = setTimeout(() => this.el.msg.classList.add('hidden'), ms);
  }
  hideMsg() { this.el.msg.classList.add('hidden'); }

  toast(text, ms = 2200) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), ms);
  }

  flash() {
    this.el.flash.classList.remove('go');
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add('go');
  }

  showOverlay({ title, sub = '', stats = null, controls = null, buttons = [], locked = false }) {
    this.el.ovTitle.textContent = title;
    this.el.ovSub.textContent = sub;
    this.el.ovSub.classList.toggle('hidden', !sub);
    this.el.ovStats.innerHTML = (stats || [])
      .map(([k, v]) => `<div class="ov-stat"><span>${k}</span><b>${v}</b></div>`)
      .join('');
    this.el.ovStats.classList.toggle('hidden', !stats || !stats.length);
    this.el.ovControls.innerHTML = (controls || [])
      .map(([k, d]) => `<div class="ov-ctl"><kbd>${k}</kbd><span>${d}</span></div>`)
      .join('');
    this.el.ovControls.classList.toggle('hidden', !controls || !controls.length);
    this.el.ovButtons.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'ov-btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', b.cb);
      this.el.ovButtons.appendChild(btn);
    }
    this.el.overlay.classList.remove('hidden');
    this._overlayLocked = locked;
  }

  get overlayOpen() { return !this.el.overlay.classList.contains('hidden'); }
  get overlayLocked() { return this._overlayLocked; }

  hideOverlay() {
    this.el.overlay.classList.add('hidden');
    this._overlayLocked = false;
  }

  reset() {
    this.score(null);
    this.health(null);
    this.info(null);
    this.fps(null);
    this.cross(false);
    this.hideMsg();
    this.hideOverlay();
    this.el.toast.classList.add('hidden');
  }

  dispose() {
    clearTimeout(this._msgTimer);
    clearTimeout(this._toastTimer);
    this.root.remove();
  }
}
