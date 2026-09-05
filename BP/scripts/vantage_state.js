/** @typedef {"riding"|"crawling"|"swimming"|"gliding"|"sneaking"|"sprinting"|"default"} VantagePoseState */
const CRAWL_EYE_HEIGHT_THRESHOLD = 0.9;
/**
 * @param {import("@minecraft/server").Player} player
 * @returns {VantagePoseState}
 */
export function classifyPoseState(player) {
  if (isRiding(player)) return "riding";
  if (player.isGliding) return "gliding";
  if (player.isSwimming || player.isClimbing) return "swimming";
  if (isCrawling(player)) return "crawling";
  if (player.isSneaking) return "sneaking";
  if (player.isSprinting) return "sprinting";
  return "default";
}
/**
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean}
 */
export function isRiding(player) {
  try {
    const riding = player.getComponent("minecraft:riding");
    return riding !== undefined && riding.entityRidingOn !== undefined;
  } catch (_err) {
    return false;
  }
}
/**
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean}
 */
export function isCrawling(player) {
  if (player.isSwimming || player.isGliding) return false;
  try {
    const eyeHeight = player.getHeadLocation().y - player.location.y;
    return eyeHeight > 0 && eyeHeight < CRAWL_EYE_HEIGHT_THRESHOLD;
  } catch (_err) {
    return false;
  }
}
/**
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean}
 */
export function isCameraOverrideUnsafe(player) {
  try {
    if (!player.isValid) return true;
    if (player.getGameMode?.() === "spectator") return true;
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue <= 0) return true;
  } catch (_err) {
    return true;
  }
  return false;
}
