export const NAMESPACE = "vantage";
const CONFIG_SCHEMA_VERSION = 1;
const DYNAMIC_PROPERTY_KEYS = Object.freeze({
  enabled: "vantage:enabled",
  config: "vantage:config",
});
/**
 * @typedef {Object} VantageOffset
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
/**
 * @typedef {Object} VantageConfig
 * @property {number} schemaVersion
 * @property {boolean} bodyVisible
 * @property {boolean} headHideEnabled
 * @property {VantageOffset} baseOffset
 * @property {Record<string, VantageOffset>} stateOffsetDeltas
 * @property {{x:number,y:number}} viewOffset
 * @property {boolean} fovOverrideEnabled
 * @property {number} fovDegrees
 * @property {boolean} cameraShakeEnabled
 */
/** @returns {VantageConfig} */
export function createDefaultConfig() {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    bodyVisible: true,
    headHideEnabled: true,
    baseOffset: { x: 0.0, y: 0.0, z: 0.06 },
    stateOffsetDeltas: {
      sneaking: { x: 0.0, y: -0.15, z: -0.02 },
      sprinting: { x: 0.0, y: -0.02, z: 0.03 },
      swimming: { x: 0.0, y: 0.05, z: 0.0 },
      crawling: { x: 0.0, y: 0.22, z: 0.04 },
      riding: { x: 0.0, y: -0.05, z: 0.0 },
      gliding: { x: 0.0, y: 0.04, z: 0.0 },
    },
    viewOffset: { x: 0.0, y: 0.0 },
    fovOverrideEnabled: false,
    fovDegrees: 70,
    cameraShakeEnabled: false,
  };
}
function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}
function mergeWithDefaults(parsed) {
  const defaults = createDefaultConfig();
  if (!parsed || typeof parsed !== "object") return defaults;
  const merged = cloneConfig(defaults);
  merged.bodyVisible = parsed.bodyVisible ?? defaults.bodyVisible;
  merged.headHideEnabled = parsed.headHideEnabled ?? defaults.headHideEnabled;
  merged.baseOffset = { ...defaults.baseOffset, ...(parsed.baseOffset ?? {}) };
  merged.stateOffsetDeltas = { ...defaults.stateOffsetDeltas };
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
  merged.cameraShakeEnabled = parsed.cameraShakeEnabled ?? defaults.cameraShakeEnabled;
  merged.schemaVersion = CONFIG_SCHEMA_VERSION;
  return merged;
}
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
/**
 * @param {import("@minecraft/server").Player} player
 * @returns {VantageConfig}
 */
export function getPlayerConfig(player) {
  try {
    const raw = player.getDynamicProperty(DYNAMIC_PROPERTY_KEYS.config);
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
  const payload = JSON.stringify(mergeWithDefaults(config));
  if (payload.length > 1500) {
    throw new Error("vantage: serialized config exceeds safe dynamic property size");
  }
  player.setDynamicProperty(DYNAMIC_PROPERTY_KEYS.config, payload);
}
/**
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean}
 */
export function isEnabledFor(player) {
  try {
    const value = player.getDynamicProperty(DYNAMIC_PROPERTY_KEYS.enabled);
    return value === undefined ? false : Boolean(value);
  } catch (_err) {
    return false;
  }
}
/**
 * @param {import("@minecraft/server").Player} player
 * @param {boolean} enabled
 */
export function setEnabledFor(player, enabled) {
  player.setDynamicProperty(DYNAMIC_PROPERTY_KEYS.enabled, Boolean(enabled));
}