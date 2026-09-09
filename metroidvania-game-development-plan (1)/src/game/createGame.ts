import Phaser from "phaser";
import { GAME_H, GAME_W, GRAVITY } from "./const";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

export function createEchoesGame(
  parent: HTMLElement,
  onEvent: (type: string, data?: unknown) => void,
) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#070b14",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    physics: {
      arcade: {
        gravity: { x: 0, y: GRAVITY },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameScene],
  });
  game.registry.set("onEvent", onEvent);
  return game;
}
