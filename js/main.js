import { Engine } from '../engine/core.js';

// נקודת כניסה: תפריט ← טעינת משחק דינמית ← ניהול מנוע אחד משותף
const menu = document.getElementById('menu');
const host = document.getElementById('game-root');

let engine = null;

const LOADERS = {
  fps: () => import('../games/fps.js'),
  platformer: () => import('../games/platformer.js'),
  racer: () => import('../games/racer.js'),
  sandbox: () => import('../games/sandbox.js'),
};

async function play(id) {
  menu.classList.add('hidden');
  host.classList.remove('hidden');
  try {
    if (!engine) {
      engine = new Engine({ host });
      engine.onExit = () => {
        host.classList.add('hidden');
        menu.classList.remove('hidden');
      };
    }
    const mod = await LOADERS[id]();
    engine.startGame(mod.Game);
  } catch (err) {
    console.error(err);
    host.classList.add('hidden');
    menu.classList.remove('hidden');
    alert('טעינת המשחק נכשלה: ' + (err?.message || err));
  }
}

for (const card of document.querySelectorAll('.card[data-game]')) {
  card.addEventListener('click', () => play(card.dataset.game));
}
