# Sunny Highway — Arcade Racer

A lightweight 3D highway racer built with plain HTML, CSS, and Three.js (vanilla JS
modules, no build step). Dodge traffic, grab NOS pickups, and chase your best
distance and top speed on an endless daytime highway.

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
│   ├── config.js            All tunable constants (physics, spawn rates, colors)
│   ├── Game.js               Core game loop & state machine
│   ├── input/InputManager.js Keyboard + touch input handling
│   ├── ui/UIManager.js        DOM overlay management
│   ├── audio/AudioManager.js  Procedural sound (Web Audio API, no audio files)
│   ├── utils/                Storage (localStorage) and EventBus helpers
│   ├── world/
│   │   ├── SceneSetup.js     Renderer, lighting, sky
│   │   ├── Road.js            Procedural infinite road + grass + trees
│   │   ├── PlayerCar.js       Loads car.glb, arcade physics
│   │   ├── TrafficManager.js  Traffic cars & NOS pickups, spawning/pooling
│   │   └── CameraRig.js       Chase camera, FOV punch, crash shake
│   └── vendor/                Local copy of Three.js + GLTFLoader (no CDN dependency)
├── fonts/                    Poppins + Rajdhani (OFL licensed, bundled locally)
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

Colors live in the same file under `COLORS`, and are mirrored in `css/style.css`
via CSS custom properties at the top of the file (`:root { --yellow: ...; }`) —
change both if you adjust the palette so the 3D scene and UI stay in sync.

## Before submitting to a game portal

A few things worth double-checking on your end before submission:

1. **Licensing** — the car model came from your own upload; confirm you have
   the rights to redistribute it if it originated from a marketplace or
   Sketchfab-style source with its own license terms.
2. **Aspect ratio / thumbnail** — portals usually want a specific thumbnail
   image and sometimes a fixed aspect ratio preview capture; grab a screenshot
   of actual gameplay once you've playtested.
3. **Playtesting difficulty curve** — I tuned traffic density and speed ramps
   by feel; you may want to adjust `DIFFICULTY_RAMP_DISTANCE` and the
   `TRAFFIC_*` constants in `config.js` after playing a few runs yourself.
