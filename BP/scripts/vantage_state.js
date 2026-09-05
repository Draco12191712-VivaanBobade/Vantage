/**
* Vantage - Player Pose Classification & Safety Gating
* ------------------------------------------------------------------
* Vanilla already poses the skeleton correctly for every native state,
* because Vantage never overrides the player entity definition. This
* module answers two questions per tick: which pose is the player in
* (so the camera pivot can track it), and is it currently safe to hold
* the camera at all.
*
* There is no `isCrawling` flag in the Script API, so crawling is
* inferred from eye-to-feet height: a standing player's eye sits at
* ~1.62 blocks and a crawling player's collapses under 1.
*/

import { EquipmentSlot } from "@minecraft/server";

/** @typedef {"riding"|"crawling"|"swimming"|"gliding"|"sneaking"|"sprinting"|"default"} VantagePose */

const CRAWL_EYE_HEIGHT = 0.9;

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {VantagePose}
 */
export function classifyPose(player) {
  try {
    if (isRiding(player)) return "riding";
    if (player.isGliding) return "gliding";
    if (player.isSwimming) return "swimming";
    if (isCrawling(player)) return "crawling";
    if (player.isSneaking) return "sneaking";
    if (player.isSprinting) return "sprinting";
  } catch (_err) {
    /* fall through to default */
  }
  return "default";
}

/** @param {import("@minecraft/server").Player} player */
export function isRiding(player) {
  try {
    const riding = player.getComponent("minecraft:riding");
    return riding !== undefined && riding.entityRidingOn !== undefined;
  } catch (_err) {
    return false;
  }
}

/** @param {import("@minecraft/server").Player} player */
export function isCrawling(player) {
  try {
    if (player.isSwimming || player.isGliding) return false;
    const eyeHeight = player.getHeadLocation().y - player.location.y;
    return eyeHeight > 0 && eyeHeight < CRAWL_EYE_HEIGHT;
  } catch (_err) {
    return false;
  }
}

/** @param {import("@minecraft/server").Player} player */
function isHoldingSpyglass(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return false;
    const mainhand = equippable.getEquipment(EquipmentSlot.Mainhand);
    return mainhand?.typeId === "minecraft:spyglass";
  } catch (_err) {
    return false;
  }
}

/**
 * States where holding a close-orbit camera would actively hurt play:
 * spectating, dead, sleeping (the bed camera is its own cinematic),
 * gliding (a horizontal body sits between the lens and the horizon at
 * the exact moment precision matters most), and the spyglass (whose
 * zoom overlay is drawn for a true first-person frustum). The last two
 * are player-configurable because they are preference, not safety.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {import("./vantage_config.js").VantageConfig} config
 * @returns {boolean}
 */
export function shouldYieldToVanilla(player, config) {
  try {
    if (!player.isValid) return true;
    if (player.isSleeping) return true;
    if (config.fallbackWhileGliding && player.isGliding) return true;
    if (config.fallbackWhileSpyglass && isHoldingSpyglass(player)) return true;

    const gameMode = player.getGameMode?.();
    if (gameMode === "spectator" || gameMode === "Spectator") return true;

    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue <= 0) return true;
  } catch (_err) {
    return true;
  }
  return false;
}
