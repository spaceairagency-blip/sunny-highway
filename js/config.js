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
  DIFFICULTY_RAMP_DISTANCE: 1800, // meters over which difficulty maxes out
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

  // --- Storage keys ---
  STORAGE_BEST_DISTANCE: 'sunnyhighway_best_distance',
  STORAGE_BEST_SPEED: 'sunnyhighway_best_speed',
  STORAGE_SOUND: 'sunnyhighway_sound_on',
};

export const COLORS = {
  bg: 0xbfe6ff,
  fogColor: 0xcfe9ff,
  asphalt: 0x4a4d52,
  asphaltDark: 0x434649,
  laneLine: 0xffffff,      // white dashed centre lines
  shoulderLine: 0xffdd33,  // yellow edge lines
  grass: 0x5fae3d,
  grassDark: 0x549638,
  cyan: 0x36c98f,          // repurposed "accent A" -> green
  magenta: 0xffd23f,       // repurposed "accent B" -> yellow
  amber: 0xffd23f,
  red: 0xff3d3d,
  green: 0x36c98f,
  skyTop: 0x4fa8ff,
  skyBottom: 0xdff3ff,
};
