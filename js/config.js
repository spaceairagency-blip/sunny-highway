// =========================================================
// SUNNY HIGHWAY — Global configuration & tunable constants
// =========================================================

export const CONFIG = {
  // --- Road ---
  LANE_COUNT: 3,
  LANE_WIDTH: 3.6,
  ROAD_SEGMENT_LENGTH: 20,      // length of one repeating road tile
  ROAD_SEGMENTS_VISIBLE: 14,    // how many tiles kept alive ahead/behind
  ROAD_TOTAL_WIDTH: 14,         // visual width of asphalt (extra shoulder)

  // --- Car physics (arcade, not sim) ---
  CAR_MAX_SPEED: 46,            // m/s ~ 165 km/h baseline top speed
  CAR_MAX_SPEED_NITRO: 64,      // m/s while boosting
  CAR_ACCEL: 16,                // m/s^2
  CAR_BRAKE_DECEL: 34,          // m/s^2
  CAR_FRICTION_DECEL: 8,        // natural coast-down deceleration
  CAR_REVERSE_MAX_SPEED: -10,
  CAR_STEER_SPEED: 3.4,         // lateral units/sec at full steer
  CAR_STEER_RETURN: 6,          // how fast steering visually settles
  CAR_DRIFT_LATERAL_MULT: 1.6,  // extra lateral slide while drifting
  CAR_TILT_MAX: 0.16,           // radians of body roll while steering
  CAR_MIN_X: -5.2,
  CAR_MAX_X: 5.2,

  // --- Nitro ---
  NITRO_MAX: 100,
  NITRO_DRAIN_PER_SEC: 34,
  NITRO_REGEN_PER_SEC: 6,
  NITRO_PICKUP_AMOUNT: 35,

  // --- Difficulty / spawn scaling ---
  // Stretched across the full 50-level journey (see LEVELS below) so
  // difficulty keeps creeping up smoothly the whole run instead of maxing
  // out after the first minute; it naturally caps once past level 50.
  DIFFICULTY_RAMP_DISTANCE: 1800, // overwritten below once LEVELS exists
  TRAFFIC_MIN_GAP: 42,
  TRAFFIC_MAX_GAP_START: 70,
  TRAFFIC_MAX_GAP_END: 40,
  TRAFFIC_SPEED_MIN: 10,
  TRAFFIC_SPEED_MAX: 22,
  PICKUP_CHANCE: 0.22,           // chance a spawn slot is a nitro pickup instead of traffic

  // --- Scoring ---
  SCORE_PER_METER: 1,
  SCORE_NEAR_MISS_BONUS: 15,
  SCORE_NITRO_PICKUP_BONUS: 25,
  SCORE_LEVEL_UP_BONUS: 200,

  // --- Camera ---
  CAM_BASE_OFFSET: { x: 0, y: 4.2, z: -8.5 },
  CAM_LOOKAHEAD: 14,
  CAM_FOV_BASE: 58,
  CAM_FOV_BOOST: 68,
  CAM_SHAKE_ON_CRASH: 0.3,

  // --- Rendering ---
  FOG_NEAR: 110,
  FOG_FAR: 260,
  DRAW_DISTANCE: 200,

  // --- Levels / themes ---
  LEVEL_COUNT: 50,
  LEVEL_BASE_GOAL: 50,     // first goal is exactly 50 meters
  LEVEL_GOAL_STEP: 17,     // each subsequent goal grows by this many meters
  THEME_TRANSITION_SECONDS: 1.6,

  // --- Storage keys ---
  STORAGE_BEST_DISTANCE: 'sunnyhighway_best_distance',
  STORAGE_BEST_SPEED: 'sunnyhighway_best_speed',
  STORAGE_BEST_LEVEL: 'sunnyhighway_best_level',
  STORAGE_SOUND: 'sunnyhighway_sound_on',
};

export const COLORS = {
  bg: 0xbfe6ff,
  fogColor: 0xcfe9ff,
  asphalt: 0x4a4d52,
  asphaltDark: 0x434649,
  laneLine: 0xffffff,
  shoulderLine: 0xffdd33,
  grass: 0x5fae3d,
  grassDark: 0x549638,
  cyan: 0x36c98f,
  magenta: 0xffd23f,
  amber: 0xffd23f,
  red: 0xff3d3d,
  green: 0x36c98f,
  skyTop: 0x4fa8ff,
  skyBottom: 0xdff3ff,
};

// =========================================================
// Theme palette — each fully re-skins the world: sky gradient,
// fog, lighting mood, road/grass colors, distant scenery, and
// whether the car's headlights should run bright (night themes).
// ThemeManager cross-fades between these whenever a level goal
// is reached.
// =========================================================
export const THEMES = [
  { id: 'golden-highway', label: 'Golden Highway', isNight: false,
    sky: ['#3f96f0', '#8fc9f5', '#dff3ff', '#eef9ff'], fog: '#cfe9ff', fogNear: 110, fogFar: 260,
    hemi: { sky: '#bfe0ff', ground: '#5a8f3e', intensity: 0.75 },
    sun: { color: '#fff6e0', intensity: 1.15 }, fill: { color: '#cfe8ff', intensity: 0.3 }, exposure: 1.05,
    asphalt: ['#4a4d52', '#434649'], grass: ['#5fae3d', '#549638'],
    lane: '#ffffff', shoulder: '#ffdd33', hill: '#3f8f3a', canopy: '#3f8f3a' },
  { id: 'sunset-boulevard', label: 'Sunset Boulevard', isNight: false,
    sky: ['#ff9a56', '#ffb37a', '#ffd9a0', '#fff0d9'], fog: '#ffcf9e', fogNear: 100, fogFar: 240,
    hemi: { sky: '#ffb37a', ground: '#6b4a2f', intensity: 0.7 },
    sun: { color: '#ffb066', intensity: 1.0 }, fill: { color: '#ff7a4d', intensity: 0.25 }, exposure: 1.05,
    asphalt: ['#4a464a', '#423e42'], grass: ['#8a6a3d', '#7a5c34'],
    lane: '#ffffff', shoulder: '#ffcc33', hill: '#8a5a3a', canopy: '#9c6a2e' },
  { id: 'dusk-drive', label: 'Dusk Drive', isNight: false,
    sky: ['#5b4b8a', '#7d6bab', '#b79fd0', '#e6d9f0'], fog: '#8f7ab8', fogNear: 95, fogFar: 230,
    hemi: { sky: '#9a86c9', ground: '#2f2a4a', intensity: 0.55 },
    sun: { color: '#d8b8ff', intensity: 0.6 }, fill: { color: '#6a5aa8', intensity: 0.3 }, exposure: 0.95,
    asphalt: ['#3a3844', '#322f3a'], grass: ['#3f5a4a', '#374f41'],
    lane: '#ffffff', shoulder: '#ffd23f', hill: '#4a3f6a', canopy: '#3f5a4a' },
  { id: 'midnight-run', label: 'Midnight Run', isNight: true,
    sky: ['#050914', '#0d1730', '#16264a', '#22345f'], fog: '#0d1730', fogNear: 80, fogFar: 200,
    hemi: { sky: '#22345f', ground: '#0a0f18', intensity: 0.35 },
    sun: { color: '#9db4ff', intensity: 0.35 }, fill: { color: '#1c2a4a', intensity: 0.2 }, exposure: 0.9,
    asphalt: ['#1c1d22', '#17181c'], grass: ['#0f2015', '#0c1a11'],
    lane: '#ffffff', shoulder: '#ffd23f', hill: '#0c1522', canopy: '#0c2015' },
  { id: 'neon-nights', label: 'Neon Nights', isNight: true,
    sky: ['#05041a', '#160c33', '#2a1550', '#3a1f66'], fog: '#1c1240', fogNear: 80, fogFar: 195,
    hemi: { sky: '#3a1f66', ground: '#0a0620', intensity: 0.4 },
    sun: { color: '#36e0ff', intensity: 0.4 }, fill: { color: '#ff2fd0', intensity: 0.25 }, exposure: 0.95,
    asphalt: ['#16121e', '#120e18'], grass: ['#0e0a1c', '#0b0716'],
    lane: '#36e0ff', shoulder: '#ff2fd0', hill: '#1a1030', canopy: '#1c1030' },
  { id: 'desert-heat', label: 'Desert Heat', isNight: false,
    sky: ['#4fb8ff', '#9fd9ff', '#ffe8c0', '#fff3da'], fog: '#ffe1ab', fogNear: 115, fogFar: 270,
    hemi: { sky: '#bfe0ff', ground: '#d2a35c', intensity: 0.8 },
    sun: { color: '#fff0c0', intensity: 1.25 }, fill: { color: '#ffdca0', intensity: 0.3 }, exposure: 1.1,
    asphalt: ['#5a544c', '#504a43'], grass: ['#d8b877', '#c9a663'],
    lane: '#ffffff', shoulder: '#ff3d3d', hill: '#c9a05a', canopy: '#8a9a3f' },
  { id: 'misty-morning', label: 'Misty Morning', isNight: false,
    sky: ['#9fb3c2', '#c3d3dd', '#e2ecf0', '#f2f7f8'], fog: '#d7e3e8', fogNear: 55, fogFar: 150,
    hemi: { sky: '#c3d3dd', ground: '#5a6b63', intensity: 0.6 },
    sun: { color: '#f0f4f5', intensity: 0.55 }, fill: { color: '#b8c8cf', intensity: 0.25 }, exposure: 0.9,
    asphalt: ['#53575c', '#4b4f54'], grass: ['#6f9a6a', '#628a5e'],
    lane: '#ffffff', shoulder: '#ffdd33', hill: '#8fa89a', canopy: '#6f9a6a' },
  { id: 'arctic-frost', label: 'Arctic Frost', isNight: false,
    sky: ['#8fc4e8', '#c9e6f5', '#eaf6fc', '#ffffff'], fog: '#dff0f7', fogNear: 100, fogFar: 250,
    hemi: { sky: '#cfe9ff', ground: '#dfeaf0', intensity: 0.85 },
    sun: { color: '#ffffff', intensity: 1.2 }, fill: { color: '#cfe0ff', intensity: 0.3 }, exposure: 1.1,
    asphalt: ['#4a4d52', '#434649'], grass: ['#f0f5f8', '#e4ecf0'],
    lane: '#333333', shoulder: '#ff8c33', hill: '#eef5f8', canopy: '#dfe8ec' },
  { id: 'storm-chaser', label: 'Storm Chaser', isNight: false,
    sky: ['#2c333d', '#454e59', '#6b7480', '#8f97a1'], fog: '#5a6470', fogNear: 65, fogFar: 165,
    hemi: { sky: '#6b7480', ground: '#2a2e33', intensity: 0.5 },
    sun: { color: '#9aa4ad', intensity: 0.5 }, fill: { color: '#4a5158', intensity: 0.2 }, exposure: 0.85,
    asphalt: ['#2e3034', '#27282c'], grass: ['#3a4a3f', '#334238'],
    lane: '#ffffff', shoulder: '#ffd23f', hill: '#3a4046', canopy: '#33423a' },
  { id: 'dawn-patrol', label: 'Dawn Patrol', isNight: false,
    sky: ['#3a5f9e', '#c586a0', '#ffc9a8', '#ffe9d2'], fog: '#e8a6a0', fogNear: 100, fogFar: 245,
    hemi: { sky: '#c586a0', ground: '#4a5c8a', intensity: 0.65 },
    sun: { color: '#ffb8a0', intensity: 0.9 }, fill: { color: '#6a7fc0', intensity: 0.3 }, exposure: 1.0,
    asphalt: ['#44424a', '#3c3a42'], grass: ['#4a6a4a', '#415c41'],
    lane: '#ffffff', shoulder: '#ffcc33', hill: '#5a5a8a', canopy: '#415c41' },
  { id: 'emerald-coast', label: 'Emerald Coast', isNight: false,
    sky: ['#1e9ee0', '#5fc4e8', '#bdeee0', '#eafff5'], fog: '#c9f2e5', fogNear: 115, fogFar: 270,
    hemi: { sky: '#a0e8d0', ground: '#2f8a5a', intensity: 0.8 },
    sun: { color: '#fff8e0', intensity: 1.2 }, fill: { color: '#7fe8c9', intensity: 0.3 }, exposure: 1.1,
    asphalt: ['#47494e', '#404247'], grass: ['#2fae6a', '#27965a'],
    lane: '#ffffff', shoulder: '#ffdd33', hill: '#1f8a5c', canopy: '#2fae6a' },
  { id: 'crimson-dusk', label: 'Crimson Dusk', isNight: false,
    sky: ['#4a0e1a', '#8f1f2e', '#d1443f', '#f0906a'], fog: '#a83b3a', fogNear: 90, fogFar: 220,
    hemi: { sky: '#d1443f', ground: '#3a0e12', intensity: 0.55 },
    sun: { color: '#ff6a4a', intensity: 0.9 }, fill: { color: '#8a1f2e', intensity: 0.25 }, exposure: 0.95,
    asphalt: ['#322022', '#2a1a1c'], grass: ['#4a2a28', '#3f2422'],
    lane: '#ffffff', shoulder: '#ffb300', hill: '#5a1f22', canopy: '#4a2422' },
  { id: 'cyber-twilight', label: 'Cyber Twilight', isNight: true,
    sky: ['#160821', '#3a1240', '#6b1f66', '#a83f8a'], fog: '#4a1a52', fogNear: 80, fogFar: 200,
    hemi: { sky: '#6b1f66', ground: '#160821', intensity: 0.45 },
    sun: { color: '#ff5fd0', intensity: 0.55 }, fill: { color: '#36e0ff', intensity: 0.3 }, exposure: 1.0,
    asphalt: ['#1e1424', '#18101c'], grass: ['#1a0e28', '#150b20'],
    lane: '#ff5fd0', shoulder: '#36e0ff', hill: '#2a1440', canopy: '#24123a' },
  { id: 'aurora-drive', label: 'Aurora Drive', isNight: true,
    sky: ['#02060f', '#04141c', '#0a3a2e', '#1f6b52'], fog: '#0a2a24', fogNear: 80, fogFar: 200,
    hemi: { sky: '#1f6b52', ground: '#02100c', intensity: 0.4 },
    sun: { color: '#5fffc9', intensity: 0.4 }, fill: { color: '#2fae8a', intensity: 0.25 }, exposure: 0.95,
    asphalt: ['#141a18', '#101614'], grass: ['#0a1c16', '#081611'],
    lane: '#ffffff', shoulder: '#5fffc9', hill: '#0e2820', canopy: '#0c2018' },
];

// A wide, hand-picked palette of car livery colors so the ride visibly
// changes paint job every time a new theme kicks in.
export const LIVERY_COLORS = [
  '#e5484d', '#3388ff', '#ffcc33', '#2fae60', '#a855f7', '#ff7a1a',
  '#f4f4f6', '#14181d', '#c9ccd1', '#14b8a6', '#ff4fa0', '#7ce02c',
  '#1c3faa', '#7a1f2e', '#d4af37', '#22d3ee', '#e042f4', '#8a5a2f',
  '#5a7a2f', '#ff8a5c', '#2fd6a0', '#3d3f9e', '#c81e3a', '#a8f0e0',
  '#6b6f76',
];

// --- HSL hue-rotation helper (kept dependency-free from three.js) ---
// Used to keep the theme cycle feeling fresh on second/third passes
// through the 14 base themes across all 50 levels, without hand-authoring
// 50 fully unique palettes.
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s; const l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb({ h, s, l }) {
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}
export function shiftHue(hex, degrees) {
  if (!degrees) return hex;
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.h = (hsl.h + degrees / 360 + 1) % 1;
  return rgbToHex(hslToRgb(hsl));
}

function themeVariant(theme, cycleIndex) {
  if (cycleIndex === 0) return theme;
  const deg = cycleIndex * 22;
  const suffix = ['', 'II', 'III', 'IV', 'V'][cycleIndex] || `x${cycleIndex + 1}`;
  return {
    ...theme,
    label: `${theme.label} ${suffix}`.trim(),
    sky: theme.sky.map((c) => shiftHue(c, deg)),
    fog: shiftHue(theme.fog, deg),
    hemi: { ...theme.hemi, sky: shiftHue(theme.hemi.sky, deg), ground: shiftHue(theme.hemi.ground, deg) },
    sun: { ...theme.sun, color: shiftHue(theme.sun.color, deg) },
    fill: { ...theme.fill, color: shiftHue(theme.fill.color, deg) },
    grass: theme.grass.map((c) => shiftHue(c, deg)),
    hill: shiftHue(theme.hill, deg),
    canopy: shiftHue(theme.canopy, deg),
  };
}

// --- Build the 50 milestone levels ---
// Level n's goal is how many additional meters must be driven (from the
// end of level n-1) to complete it. Goals grow linearly so early levels
// come fast (the very first is exactly 50m) and later ones are a real
// endurance test.
export const LEVELS = [];
let _cumulative = 0;
for (let n = 1; n <= CONFIG.LEVEL_COUNT; n++) {
  const goal = Math.round(CONFIG.LEVEL_BASE_GOAL + (n - 1) * CONFIG.LEVEL_GOAL_STEP);
  const start = _cumulative;
  _cumulative += goal;
  const baseTheme = THEMES[(n - 1) % THEMES.length];
  const cycleIndex = Math.floor((n - 1) / THEMES.length);
  const theme = themeVariant(baseTheme, cycleIndex);
  const livery = LIVERY_COLORS[(n - 1) % LIVERY_COLORS.length];
  LEVELS.push({
    number: n,
    goal,
    rangeStart: start,
    rangeEnd: _cumulative,
    theme,
    livery,
  });
}
export const LEVELS_TOTAL_DISTANCE = _cumulative;

// Stretch the difficulty ramp across the whole 50-level journey.
CONFIG.DIFFICULTY_RAMP_DISTANCE = LEVELS_TOTAL_DISTANCE;
