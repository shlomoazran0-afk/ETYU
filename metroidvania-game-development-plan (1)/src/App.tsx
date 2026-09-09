import { useCallback, useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createEchoesGame } from "./game/createGame";
import { sfx } from "./game/audio";

type Screen =
  | "title"
  | "how"
  | "codex"
  | "playing"
  | "paused"
  | "gameover"
  | "victory";

type Hud = {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  crystals: number;
  totalCrystals: number;
  hasDoubleJump: boolean;
  hasDash: boolean;
  combo: number;
  dead: boolean;
};

type BossHud = { hp: number; max: number; name: string } | null;

const DEFAULT_HUD: Hud = {
  hp: 10,
  maxHp: 10,
  mana: 100,
  maxMana: 100,
  crystals: 0,
  totalCrystals: 24,
  hasDoubleJump: false,
  hasDash: false,
  combo: 0,
  dead: false,
};

const ASSETS = [
  {
    use: "Player Warden (idle / run / jump / attack / dash / hurt / death)",
    pack: "Fantasy Knight — Free Pixelart Animated Character",
    creator: "aamatniekss",
    frames: "120 × 80",
    url: "https://aamatniekss.itch.io/fantasy-knight-free-pixelart-animated-character",
  },
  {
    use: "Stone Golem, Night Wisp, Vine Crawler",
    pack: "Monsters Creatures Fantasy",
    creator: "LuizMelo",
    frames: "150 × 150",
    url: "https://luizmelo.itch.io/monsters-creatures-fantasy",
  },
  {
    use: "Grove Colossus boss",
    pack: "Boss: Undead Executioner [FREE] (body language) + Monsters Creatures Fantasy (golem titan)",
    creator: "Kronovi- / LuizMelo",
    frames: "288 × 160",
    url: "https://kronovi.itch.io/undead-executioner",
  },
  {
    use: "Overgrown forest ruins biome (unique tiles + tree + waterfall)",
    pack: "Oak Woods — Environment Asset / Sunny Land Woods",
    creator: "Brullov / ansimuz",
    frames: "32 × 32 tiles, 480px parallax layers",
    url: "https://brullov.itch.io/oak-woods",
  },
  {
    use: "Distant ruined colonnades parallax",
    pack: "Gothicvania Town + Church Pack",
    creator: "ansimuz",
    frames: "380 × 180 layers",
    url: "https://ansimuz.itch.io/gothicvania-town",
  },
  {
    use: "Night sky, moon, stars",
    pack: "Free 2D Metroidvania Pixel-Art Assets",
    creator: "ansimuz",
    frames: "384 × 240",
    url: "https://ansimuz.itch.io/free-2d-metroidvania-pixel-art-assets",
  },
  {
    use: "Crystal caverns biome (unique basalt + crystals — not reused forest tiles)",
    pack: "Cavernas + Parallax Backgrounds: Caves",
    creator: "Adam Saltsman / Admurin",
    frames: "16 × 16 tiles, 320px cave layers",
    url: "https://adamatomic.itch.io/cavernas",
  },
  {
    use: "Crystal Cores, pots, shrine gems",
    pack: "Pixel Adventure items / Free Swamp pickups",
    creator: "Pixel Frog / Free Game Assets",
    frames: "16 × 16 and 32 × 32",
    url: "https://pixelfrog-assets.itch.io/pixel-adventure-1",
  },
  {
    use: "Slash dust, dash afterimage, impact smoke",
    pack: "Smoke N Dust 01",
    creator: "pimen",
    frames: "64 × 64",
    url: "https://pimen.itch.io/smoke-n-dust-01",
  },
  {
    use: "HUD hearts, bars, ability slots",
    pack: "Free Fantasy GUI / Pixel UI",
    creator: "Free Game Assets (GUI, Sprite, Tilesets)",
    frames: "16 × 16 icons, 8px bar slices",
    url: "https://free-game-assets.itch.io",
  },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [hud, setHud] = useState<Hud>(DEFAULT_HUD);
  const [boss, setBoss] = useState<BossHud>(null);
  const [muted, setMuted] = useState(false);

  const onEvent = useCallback((type: string, data?: unknown) => {
    if (type === "hud") setHud(data as Hud);
    if (type === "boss-hp") setBoss(data as BossHud);
    if (type === "pause") setScreen((s) => (s === "playing" ? "paused" : s));
    if (type === "gameover") setScreen("gameover");
    if (type === "victory") setScreen("victory");
  }, []);

  useEffect(() => {
    sfx.muted = muted;
  }, [muted]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070b14] text-[#e8f0ff]">
      {screen !== "title" && screen !== "how" && screen !== "codex" && (
        <GameCanvas
          onEvent={onEvent}
          paused={screen === "paused"}
        />
      )}

      {(screen === "playing" || screen === "paused") && (
        <HudOverlay hud={hud} boss={boss} />
      )}

      {screen === "title" && (
        <TitleScreen
          onPlay={() => {
            setHud(DEFAULT_HUD);
            setBoss(null);
            setScreen("playing");
          }}
          onHow={() => setScreen("how")}
          onCodex={() => setScreen("codex")}
          muted={muted}
          onMute={() => setMuted((m) => !m)}
        />
      )}

      {screen === "how" && <HowScreen onBack={() => setScreen("title")} />}
      {screen === "codex" && <CodexScreen onBack={() => setScreen("title")} />}

      {screen === "paused" && (
        <Modal>
          <h2 className="font-[Cinzel_Decorative] text-3xl text-[#f0d48a]">Paused</h2>
          <p className="mt-2 text-xl text-[#9bb0d0]">The grove holds its breath.</p>
          <div className="mt-6 flex flex-col gap-2">
            <MenuBtn onClick={() => setScreen("playing")}>Resume</MenuBtn>
            <MenuBtn
              onClick={() => {
                sfx.stopMusic();
                setScreen("title");
              }}
            >
              Abandon Grove
            </MenuBtn>
          </div>
        </Modal>
      )}

      {screen === "gameover" && (
        <Modal>
          <h2 className="font-[Cinzel_Decorative] text-3xl text-[#e23d4a]">Fallen</h2>
          <p className="mt-2 text-xl text-[#9bb0d0]">
            Crystal Cores recovered: {hud.crystals}/{hud.totalCrystals}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <MenuBtn
              onClick={() => {
                setHud(DEFAULT_HUD);
                setBoss(null);
                setScreen("title");
                setTimeout(() => setScreen("playing"), 40);
              }}
            >
              Rise Again
            </MenuBtn>
            <MenuBtn
              onClick={() => {
                sfx.stopMusic();
                setScreen("title");
              }}
            >
              Title
            </MenuBtn>
          </div>
        </Modal>
      )}

      {screen === "victory" && (
        <Modal>
          <h2 className="font-[Cinzel_Decorative] text-3xl text-[#5cf0ff]">
            The Grove Remembers
          </h2>
          <p className="mt-3 max-w-md text-center text-xl leading-6 text-[#c5d4ee]">
            The Colossus kneels. Crystal-light floods the drowned colonnades.
            You recovered {hud.crystals} of {hud.totalCrystals} Cores.
          </p>
          <div className="mt-6">
            <MenuBtn
              onClick={() => {
                sfx.stopMusic();
                setScreen("title");
              }}
            >
              Return
            </MenuBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GameCanvas({
  onEvent,
  paused,
}: {
  onEvent: (type: string, data?: unknown) => void;
  paused: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const game = createEchoesGame(ref.current, onEvent);
    gameRef.current = game;
    return () => {
      sfx.stopMusic();
      game.destroy(true);
      gameRef.current = null;
    };
  }, [onEvent]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.registry.set("paused", paused);
    const sc = game.scene.getScene("game");
    if (!sc) return;
    if (paused) sc.scene.pause();
    else sc.scene.resume();
  }, [paused]);

  return <div ref={ref} id="game-root" className="absolute inset-0 bg-[#070b14]" />;
}

function HudOverlay({ hud, boss }: { hud: Hud; boss: BossHud }) {
  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100);
  const mpPct = Math.max(0, (hud.mana / hud.maxMana) * 100);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 p-4">
      <div className="flex max-w-sm flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">❤</span>
          <div className="h-3 w-44 overflow-hidden rounded-sm border border-[#3a2410] bg-[#14080c]">
            <div
              className="h-full bg-gradient-to-r from-[#7a1020] to-[#e23d4a]"
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="font-['Press_Start_2P'] text-[10px] text-[#f0d48a]">
            {hud.hp}/{hud.maxHp}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none text-[#5cf0ff]">💧</span>
          <div className="h-3 w-44 overflow-hidden rounded-sm border border-[#143048] bg-[#081018]">
            <div
              className="h-full bg-gradient-to-r from-[#1a6a9a] to-[#5cf0ff]"
              style={{ width: `${mpPct}%` }}
            />
          </div>
        </div>
        <AbilityRow
          icon="🪶"
          label="Double Jump"
          on={hud.hasDoubleJump}
          hint="Tree shrine"
        />
        <AbilityRow
          icon="🌑"
          label="Dash"
          on={hud.hasDash}
          hint="Cavern amethyst"
        />
        <div className="mt-1 flex items-center gap-2">
          <span className="crystal-glow text-xl">💎</span>
          <div>
            <div className="font-['Press_Start_2P'] text-[9px] tracking-wide text-[#c9e8ff]">
              Crystal Cores
            </div>
            <div className="font-['Press_Start_2P'] text-[11px] text-[#5cf0ff]">
              {hud.crystals}/{hud.totalCrystals}
            </div>
          </div>
        </div>
      </div>

      {hud.combo > 0 && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 font-['Press_Start_2P'] text-xs text-[#5cf0ff]">
          COMBO {hud.combo}/3
        </div>
      )}

      {boss && (
        <div className="absolute left-1/2 top-4 w-[420px] -translate-x-1/2">
          <div className="mb-1 text-center font-['Press_Start_2P'] text-[9px] text-[#f0d48a]">
            {boss.name}
          </div>
          <div className="h-3 overflow-hidden border border-[#5a2048] bg-[#140814]">
            <div
              className="h-full bg-gradient-to-r from-[#5a1070] to-[#c45cff]"
              style={{ width: `${(boss.hp / boss.max) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-4 font-['Press_Start_2P'] text-[8px] leading-4 text-[#6c7c9a]">
        A/D move · SPACE jump · J attack · SHIFT dash · ESC pause
      </div>
    </div>
  );
}

function AbilityRow({
  icon,
  label,
  on,
  hint,
}: {
  icon: string;
  label: string;
  on: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center border-2 text-sm ${
          on
            ? "border-[#c9a35b] bg-[#162034] shadow-[0_0_8px_#5cf0ff66]"
            : "border-[#2a3348] bg-[#0b1018] opacity-50"
        }`}
      >
        {on ? icon : ""}
      </div>
      <div>
        <div className="font-['Press_Start_2P'] text-[9px] text-[#dce7ff]">
          {label}
        </div>
        {!on && <div className="text-sm text-[#6c7c9a]">{hint}</div>}
      </div>
    </div>
  );
}

function TitleScreen({
  onPlay,
  onHow,
  onCodex,
  muted,
  onMute,
}: {
  onPlay: () => void;
  onHow: () => void;
  onCodex: () => void;
  muted: boolean;
  onMute: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30">
      <img
        src="/images/title-art.png"
        alt="Echoes of the Overgrown"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#070b14]/90 via-[#070b14]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/40" />

      <div className="relative flex h-full max-w-xl flex-col justify-center px-10">
        <p className="font-['Press_Start_2P'] text-[10px] tracking-[0.3em] text-[#5cf0ff]">
          A METROIDVANIA OF DROWNED TEMPLES
        </p>
        <h1 className="mt-4 font-[Cinzel_Decorative] text-5xl leading-tight text-[#f0d48a] drop-shadow-[0_4px_0_#1a1204] md:text-6xl">
          Echoes of the Overgrown
        </h1>
        <p className="mt-5 max-w-md text-2xl leading-7 text-[#c5d4ee]">
          The Grove Heart has gone silent. Climb living stone, harvest Crystal
          Cores, and wake the Warden&apos;s forgotten arts before the Colossus
          swallows the moon.
        </p>
        <div className="mt-8 flex w-72 flex-col gap-3">
          <MenuBtn onClick={onPlay}>Enter the Grove</MenuBtn>
          <MenuBtn onClick={onHow}>How to Play</MenuBtn>
          <MenuBtn onClick={onCodex}>Codex &amp; Assets</MenuBtn>
          <MenuBtn onClick={onMute}>{muted ? "Sound: Off" : "Sound: On"}</MenuBtn>
        </div>
      </div>
    </div>
  );
}

function HowScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-30 overflow-auto bg-[#070b14]">
      <img
        src="/images/level-overgrown.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="relative mx-auto max-w-3xl px-8 py-10">
        <h2 className="font-[Cinzel_Decorative] text-4xl text-[#f0d48a]">
          Warden&apos;s Primer
        </h2>
        <div className="mt-6 grid gap-4 text-xl leading-7 text-[#c5d4ee] md:grid-cols-2">
          <Card title="Movement">
            <b>A / D</b> or arrows to run. <b>Space / W / K</b> to jump. Coyote
            time and jump buffering keep leaps honest. Wake <b>Double Jump</b> at
            the root shrine in the great tree.
          </Card>
          <Card title="Phantom Dash">
            Unlock the cavern amethyst, then <b>Shift / L</b>. Costs mana,
            grants i-frames, and ghosts through enemy bodies. Cannot dash during
            a swing.
          </Card>
          <Card title="Three-Hit Chain">
            <b>J / X</b> starts a crisp melee combo. Hitboxes fire on the blade
            frame. Third hit knocks farther and shakes the stone. No attacking
            while dashing.
          </Card>
          <Card title="The Hunt">
            Enemies patrol, detect, chase, attack, then cool down. Golems slam,
            Wisps swoop, Crawlers lunge. The Grove Colossus slams and volleys
            crystal fire.
          </Card>
        </div>
        <p className="mt-6 text-lg text-[#9bb0d0]">
          Climb ladders with W/S. Break pots for extra Cores. Touch golden
          beacons to checkpoint. Falling into luminous water hurts — jump out.
          ESC pauses.
        </p>
        <div className="mt-8">
          <MenuBtn onClick={onBack}>Return</MenuBtn>
        </div>
      </div>
    </div>
  );
}

function CodexScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-30 overflow-auto bg-[#070b14]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="font-[Cinzel_Decorative] text-4xl text-[#f0d48a]">
          Codex &amp; Asset Ledger
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-[#c5d4ee]">
          Every plate in this build is high-detail 16-bit pixel art directed at
          the overgrown-ruins look of the reference. The ledger below names the
          exact free itch.io packs, creators, and slice sizes this project is
          built to ingest. Bundled plates live in <code>public/images/</code>.
        </p>

        <div className="mt-6 overflow-x-auto pixel-border">
          <table className="w-full min-w-[720px] text-left text-sm text-[#dce7ff]">
            <thead className="bg-[#12182a] font-['Press_Start_2P'] text-[8px] text-[#5cf0ff]">
              <tr>
                <th className="p-3">Use in game</th>
                <th className="p-3">Itch.io pack</th>
                <th className="p-3">Creator</th>
                <th className="p-3">Frame W/H</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a) => (
                <tr key={a.use} className="border-t border-[#243044] bg-[#0c1220]/90">
                  <td className="p-3 align-top text-base">{a.use}</td>
                  <td className="p-3 align-top">
                    <a
                      className="text-[#8af7ff] underline"
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.pack}
                    </a>
                  </td>
                  <td className="p-3 align-top text-[#f0d48a]">{a.creator}</td>
                  <td className="p-3 align-top font-mono text-[#9be58a]">{a.frames}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-10 font-[Cinzel_Decorative] text-2xl text-[#f0d48a]">
          Loading official itch.io sheets
        </h3>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-lg text-[#c5d4ee]">
          <li>Download each free pack from the itch.io links above (no payment wall on the listed Free files).</li>
          <li>
            Unzip into <code className="text-[#5cf0ff]">public/itch/&#123;pack-name&#125;/</code> keeping original PNG names.
          </li>
          <li>
            Open <code className="text-[#5cf0ff]">src/game/scenes/BootScene.ts</code>. Point{" "}
            <code>this.load.spritesheet</code> at the new files, using the Frame W/H column
            (example: Fantasy Knight idle is typically 120×80; LuizMelo monsters 150×150; Oak Woods tiles 32×32).
          </li>
          <li>
            In <code>sliceStrip</code> / <code>sliceGrid</code>, replace generated frame names with the pack&apos;s animation rows:
            Idle, Run, Jump, Fall, Attack1–3, Dash, Hurt, Death.
          </li>
          <li>
            Drop biome tilemaps exported from Tiled as JSON next to the sheets and swap{" "}
            <code>level-overgrown.png</code> / <code>level-caverns.png</code> for unique tilesets — never share forest grass
            tiles with the cavern basalt.
          </li>
        </ol>

        <h3 className="mt-8 font-[Cinzel_Decorative] text-2xl text-[#f0d48a]">
          Bundled plates (this web build)
        </h3>
        <ul className="mt-3 columns-2 text-lg text-[#9bb0d0]">
          <li>public/images/player.png — Warden strip</li>
          <li>public/images/enemies.png — 3 enemy rows</li>
          <li>public/images/boss.png — Colossus strip</li>
          <li>public/images/level-overgrown.png — Forest ruins</li>
          <li>public/images/level-caverns.png — Crystal caves</li>
          <li>public/images/bg-sky.png / bg-ruins.png — Parallax</li>
          <li>public/images/items.png — Cores &amp; pots</li>
          <li>public/images/title-art.png — Key art</li>
        </ul>

        <div className="mt-8">
          <MenuBtn onClick={onBack}>Return</MenuBtn>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hud-panel p-4">
      <h3 className="font-['Press_Start_2P'] text-[10px] text-[#5cf0ff]">{title}</h3>
      <p className="mt-2 text-lg leading-6">{children}</p>
    </div>
  );
}

function MenuBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => {
        sfx.ui();
        onClick();
      }}
      className="pixel-border bg-[#12182a] px-4 py-3 text-left font-['Press_Start_2P'] text-[10px] leading-5 text-[#f0d48a] transition hover:bg-[#1c2744] hover:text-[#5cf0ff]"
    >
      {children}
    </button>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#070b14]/70 backdrop-blur-[2px]">
      <div className="pixel-border max-w-lg bg-[#0c1220] px-10 py-8 text-center">
        {children}
      </div>
    </div>
  );
}
