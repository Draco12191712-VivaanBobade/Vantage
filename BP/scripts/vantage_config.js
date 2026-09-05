/**
* Vantage - Configuration & Persistence
* ------------------------------------------------------------------
* All durable per-player state funnels through this module so the
* serialization format stays in one place. Every read is total: a
* missing, corrupt, or out-of-date dynamic property degrades to
* defaults instead of throwing, because a config read happens on the
* hot path and an exception there would take the camera loop with it.
*
* v0.2.0: `enabled` now defaults to TRUE. In v0.1.x it defaulted to
* false, which meant a fresh install did nothing at all until the
* player found the toggle - and since the toggle was unreachable
* (see main.js changelog), the add-on appeared completely inert.
*/

export const ADDON_VERSION = "0.2.0";

const CONFIG_SCHEMA_VERSION = 2;

const KEY_ENABLED = "vantage:enabled";
const KEY_CONFIG = "vantage:config";
const KEY_SEEN_WELCOME = "vantage:seen_welcome";

/** Body push-back presets; must match the animation ids shipped in the RP. */
export const BODY_DISTANCE = Object.freeze({
  0: "animation.vantage.first_person.close",
  1: "animation.vantage.first_person.normal",
  2: "animation.vantage.first_person.far",
});

export const BODY_DISTANCE_LABELS = Object.freeze(["Close", "Normal", "Far"]);

/**
 * @typedef {{x:number,y:number,z:number}} Vec3
 * @typedef {Object} VantageConfig
 * @property {number} schemaVersion
 * @property {boolean} bodyVisible        Show the first-person body (false = plain vanilla first person).
 * @property {boolean} headHideEnabled    Hide the local player's own head so it cannot clip the lens.
 * @property {number}  bodyDistance       Index into BODY_DISTANCE.
 * @property {boolean} quickToggleEnabled Sneak + Jump toggles Vantage.
 * @property {Vec3}    baseOffset         Camera pivot offset in blocks (forward = +z).
 * @property {Record<string, Vec3>} stateOffsetDeltas Additive per-pose pivot nudges.
 * @property {{x:number,y:number}} viewOffset
 * @property {boolean} fovOverrideEnabled
 * @property {number}  fovDegrees
 * @property {boolean} fallbackWhileGliding  Use vanilla view while flying with an elytra.
 * @property {boolean} fallbackWhileSpyglass Use vanilla view while holding a spyglass.
 */

/** @returns {VantageConfig} */
export function createDefaultConfig() {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    bodyVisible: true,
    headHideEnabled: true,
    bodyDistance: 1,
    quickToggleEnabled: true,
    baseOffset: { x: 0.0, y: 0.0, z: 0.0 },
    stateOffsetDeltas: {
      sneaking: { x: 0.0, y: 0.0, z: 0.0 },
      sprinting: { x: 0.0, y: 0.0, z: 0.02 },
      swimming: { x: 0.0, y: 0.05, z: 0.0 },
      crawling: { x: 0.0, y: 0.1, z: 0.05 },
      riding: { x: 0.0, y: 0.0, z: 0.0 },
      gliding: { x: 0.0, y: 0.0, z: 0.0 },
      default: { x: 0.0, y: 0.0, z: 0.0 },
    },
    viewOffset: { x: 0.0, y: 0.0 },
    fovOverrideEnabled: false,
    fovDegrees: 70,
    fallbackWhileGliding: true,
    fallbackWhileSpyglass: true,
  };
}

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function mergeWithDefaults(parsed) {
  const defaults = createDefaultConfig();
  if (!parsed || typeof parsed !== "object") return defaults;

  const merged = defaults;
  merged.bodyVisible = parsed.bodyVisible ?? defaults.bodyVisible;
  merged.headHideEnabled = parsed.headHideEnabled ?? defaults.headHideEnabled;
  merged.bodyDistance = clamp(parsed.bodyDistance ?? defaults.bodyDistance, 0, 2) | 0;
  merged.quickToggleEnabled = parsed.quickToggleEnabled ?? defaults.quickToggleEnabled;
  merged.baseOffset = { ...defaults.baseOffset, ...(parsed.baseOffset ?? {}) };
  if (parsed.stateOffsetDeltas) {
    for (const key of Object.keys(defaults.stateOffsetDeltas)) {
      merged.stateOffsetDeltas[key] = {
        ...defaults.stateOffsetDeltas[key],
        ...(parsed.stateOffsetDeltas[key] ?? {}),
      };
    }
  }
  merged.viewOffset = { ...defaults.viewOffset, ...(parsed.viewOffset ?? {}) };
  merged.fovOverrideEnabled = parsed.fovOverrideEnabled ?? defaults.fovOverrideEnabled;
  merged.fovDegrees = clamp(parsed.fovDegrees ?? defaults.fovDegrees, 30, 110);
  merged.fallbackWhileGliding = parsed.fallbackWhileGliding ?? defaults.fallbackWhileGliding;
  merged.fallbackWhileSpyglass = parsed.fallbackWhileSpyglass ?? defaults.fallbackWhileSpyglass;
  merged.schemaVersion = CONFIG_SCHEMA_VERSION;
  return merged;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {VantageConfig}
 */
export function getPlayerConfig(player) {
  try {
    const raw = player.getDynamicProperty(KEY_CONFIG);
    if (typeof raw !== "string") return createDefaultConfig();
    return mergeWithDefaults(JSON.parse(raw));
  } catch (_err) {
    return createDefaultConfig();
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {VantageConfig} config
 */
export function setPlayerConfig(player, config) {
  try {
    player.setDynamicProperty(KEY_CONFIG, JSON.stringify(mergeWithDefaults(config)));
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Defaults to enabled so a fresh install works with zero setup.
 * @param {import("@minecraft/server").Player} player
 */
export function isEnabledFor(player) {
  try {
    const value = player.getDynamicProperty(KEY_ENABLED);
    return value === undefined ? true : Boolean(value);
  } catch (_err) {
    return false;
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {boolean} enabled
 */
export function setEnabledFor(player, enabled) {
  try {
    player.setDynamicProperty(KEY_ENABLED, Boolean(enabled));
  } catch (_err) {
    /* non-fatal */
  }
}

/** @param {import("@minecraft/server").Player} player */
export function hasSeenWelcome(player) {
  try {
    return Boolean(player.getDynamicProperty(KEY_SEEN_WELCOME));
  } catch (_err) {
    return true;
  }
}

/** @param {import("@minecraft/server").Player} player */
export function markWelcomeSeen(player) {
  try {
    player.setDynamicProperty(KEY_SEEN_WELCOME, true);
  } catch (_err) {
    /* non-fatal */
  }
}
