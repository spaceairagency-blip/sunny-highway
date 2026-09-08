# Sunny Highway — Arcade Racer

A lightweight 3D highway racer built with plain HTML, CSS, and Three.js (vanilla JS
modules, no build step). Dodge traffic, grab NOS pickups, climb through **50
levels**, and watch the world — sky, road, scenery, and your car's paint job —
transform every time you hit a level's distance goal.

## What's new: the level system

- **50 levels**, each with its own meters-to-clear goal. Level 1 is a quick
  50m; goals grow by 17m every level after that (level 50 needs 883m), for
  ~23.3km of total hand-tuned progression — after that the run goes endless
  and keeps re-cycling the same 50 themes so it never just freezes.
- **Every level-up re-skins the world**: sky gradient, fog, sun/ambient
  lighting, road & grass colors, distant hills, tree canopies, lane-line
  color, and your **car's paint job** all cross-fade smoothly (~1.6s) into
  the next theme. 14 hand-authored moods (Golden Highway, Sunset Boulevard,
  Dusk Drive, Midnight Run, Neon Nights, Desert Heat, Misty Morning, Arctic
  Frost, Storm Chaser, Dawn Patrol, Emerald Coast, Crimson Dusk, Cyber
  Twilight, Aurora Drive) cycle across all 50 levels, each repeat pass given
  a hue-shifted variant so it still feels fresh the 2nd/3rd time around.
- **Day ↔ night matters gameplay-wise, not just visually**: night themes
  automatically brighten the car's headlights.
- A top-center **level HUD** shows your current level, theme name, and a
  progress bar toward the next goal; a **level-up toast** celebrates each
  milestone with a chime and a score bonus.
- **Near-miss bonus scoring** — squeezing closely past a traffic car without
  hitting it now scores bonus points, on top of the existing distance/NOS
  scoring.
- Best distance, best top speed, *and* best level reached are all saved
  locally and shown on the menu and game-over screens.

All of this lives in `js/config.js` (`THEMES`, `LIVERY_COLORS`, `LEVELS`),
`js/world/ThemeManager.js` (the cross-fade engine), and
`js/world/LevelManager.js` (goal tracking) — see "Customizing" below.

## Running it

This is a fully static site — no server-side code, no build tools, no npm install
required to play. Because it uses ES module imports, it must be served over
HTTP(S), not opened directly as a `file://` URL (browsers block module imports
from the filesystem).

Locally:
```
cd game
python3 -m http.server 8000
# open http://localhost:8000
```

Or use any static file server (`npx serve`, VS Code "Live Server", nginx, etc).
To publish, upload the entire `game/` folder as-is — it's self-contained.

## File structure

```
game/
├── index.html              All UI screens (menu, HUD, modals) — no separate templates
├── css/
│   └── style.css           All styling: theme, responsive layout, animations
├── js/
│   ├── main.js              Entry point
│   ├── config.js            Tunable constants + THEMES / LIVERY_COLORS / LEVELS
│   ├── Game.js               Core game loop & state machine
│   ├── input/InputManager.js Keyboard + touch input handling
│   ├── ui/UIManager.js        DOM overlay management (HUD, level toast, menus)
│   ├── audio/AudioManager.js  Procedural sound (Web Audio API, no audio files)
│   ├── utils/                Storage (localStorage) and EventBus helpers
│   ├── world/
│   │   ├── SceneSetup.js     Renderer, lighting, sky gradient
│   │   ├── Road.js            Procedural infinite road + grass + trees (re-tintable)
│   │   ├── PlayerCar.js       Loads car.glb, arcade physics, livery + headlights
│   │   ├── TrafficManager.js  Traffic cars, NOS pickups, near-miss detection
│   │   ├── CameraRig.js       Chase camera, FOV punch, crash shake
│   │   ├── ThemeManager.js    Cross-fades sky/fog/lighting/road/car between themes
│   │   └── LevelManager.js    Tracks the 50 level goals + progress
│   └── vendor/                Local copy of Three.js + GLTFLoader (no CDN dependency)
├── fonts/                    Poppins + Rajdhani (OFL licensed, bundled locally)
├── favicon.svg               Self-contained SVG tab icon (no external request)
└── assets/car/car.glb        Your uploaded car model
```

Everything runs offline once loaded — no CDN calls, no external requests — which
is important for game portals that sandbox or firewall outbound network access.

## About the assets

- **Car model** — your uploaded `cartoon_car.glb` is used as the player vehicle.
  I measured its real bounding box and rescaled it (~0.335x) so it sits correctly
  on the road at a realistic ~4.2m length, with wheels touching the ground plane.
- **Road model** — your uploaded `road.zip` (a Sketchfab CC-BY model, ~58MB, a
  single static non-tileable stretch of highway) was **not used** in the final
  build. At that size and with no seamless loop points, it wasn't a good fit for
  an endlessly-scrolling racer and would have made the initial load far too heavy
  for a browser game portal. Instead I built a procedural road system (flat
  geometry, dashed lane lines, grass shoulders, trees, and low hills) that loops
  seamlessly and costs almost nothing to render. If you'd still like the original
  road model included as *background scenery* (not the driving surface), let me
  know and I can integrate it as a one-time static backdrop.
- **Traffic cars** — simple procedural low-poly boxes (not GLB models), kept
  intentionally simple/stylized so they render fast and read clearly at speed.
- **Fonts** — Poppins and Rajdhani, both SIL Open Font License, bundled locally
  as `.ttf` files (no Google Fonts CDN call).
- **Audio** — fully synthesized in-browser with the Web Audio API (engine hum,
  wind noise, crash, pickup chime, UI clicks). No audio files at all, which keeps
  the package small and avoids any licensing questions around sound effects.

Total package size is ~13MB, well within typical size expectations for browser
game portals.

## Controls

**Keyboard**
- `←` `→` or `A` `D` — Steer
- `↑` or `W` — Accelerate
- `↓` or `S` — Brake / Reverse
- `Space` — Handbrake / Drift
- `N` — Nitro boost
- `P` or `Esc` — Pause

**Touch**
- Left/right circular pads — Steer
- GAS / BRAKE / DRIFT / NOS buttons — bottom right

The in-game HUD shows a "Press ___ TO ___" legend in the top-left (fades to low
opacity after a few seconds so it doesn't block the view), and touch controls
appear automatically on touch-capable devices.

Layout adapts fluidly to portrait, landscape, narrow phones, and wide desktop
screens — nothing is orientation-locked.

## Customizing

Almost every gameplay number (max speed, spawn rates, difficulty ramp, nitro
drain, scoring) lives in `js/config.js` — tweak values there rather than hunting
through the game logic.

- **Level goals**: change `LEVEL_BASE_GOAL` / `LEVEL_GOAL_STEP` / `LEVEL_COUNT`
  to make levels shorter/longer or add more of them — everything (goal
  distances, difficulty ramp length, endless-mode wraparound) recalculates
  automatically.
- **Themes**: add, remove, or edit entries in the `THEMES` array — each one
  is a full palette (sky/fog/lighting/road/grass/car). They're distributed
  across the 50 levels automatically, repeating with a hue-shift once you've
  gone through all of them.
- **Car colors**: edit `LIVERY_COLORS` to change the paint palette cycled
  through per level.

Colors live in the same file under `COLORS`, and are mirrored in `css/style.css`
via CSS custom properties at the top of the file (`:root { --yellow: ...; }`) —
change both if you adjust the base UI palette so the chrome stays in sync
with the 3D scene's *default* (level 1) look.

## Before submitting to CrazyGames (or any portal)

This build was already written with portal constraints in mind — no CDN
calls, safe localStorage fallback, sound only starts after a user gesture,
fully responsive with working touch controls, no `alert`/`confirm`/
`window.open`. Still worth confirming yourself:

1. **Licensing** — the car model came from your own upload; confirm you have
   the rights to redistribute it if it originated from a marketplace or
   Sketchfab-style source with its own license terms. CrazyGames requires
   you to own or be licensed for all assets (art, audio, code).
2. **CrazyGames SDK** — for real submission you'll want to add the
   CrazyGames Games SDK (`sdk.crazygames.com`) and call its lifecycle
   hooks: `SDK.game.loadingStart()` / `loadingStop()` around your boot
   sequence, `SDK.game.gameplayStart()` when `_startGame()` runs, and
   `SDK.game.gameplayStop()` on `_endGame()`/pause. This is required for ads
   and leaderboards to work on their platform, and is a one-file addition
   once you have a developer account — I didn't hardcode it here since the
   SDK script only resolves from their CDN when actually hosted on
   CrazyGames, and this project intentionally has zero external network
   calls so it can be tested fully offline.
3. **Thumbnail & metadata** — CrazyGames wants a 1200×630 (or similar)
   thumbnail and a short description at upload time (separate from this
   repo); `index.html`'s `<meta>` tags are filled in as a sensible default
   if you reuse them elsewhere.
4. **Aspect ratio / orientation** — already responsive for both portrait and
   landscape, with a one-time rotate hint on narrow portrait phones; test on
   a couple of real devices before submitting.
5. **Performance** — asset payload is ~13MB total, well under typical portal
   limits; road/traffic/pickups are all pooled (no runtime GC pressure from
   spawning), and the level system only mutates existing material colors
   rather than rebuilding geometry, so level-ups don't cause frame drops.
6. **Playtesting the curve** — traffic density/speed and the 50 level goals
   were tuned by feel; play a handful of runs yourself and adjust
   `DIFFICULTY_RAMP_DISTANCE`-affecting constants (`LEVEL_GOAL_STEP`,
   `TRAFFIC_*`) if it feels too easy/hard by level 10–15.
