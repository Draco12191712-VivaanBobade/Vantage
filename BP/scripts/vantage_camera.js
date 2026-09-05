import { system, EasingType } from "@minecraft/server";
import { classifyPoseState, isCameraOverrideUnsafe } from "./vantage_state.js";
import { isSuppressedByAnotherAddon } from "./vantage_compat.js";
import { clamp } from "./vantage_config.js";
export const VANTAGE_CAMERA_PRESET = "vantage:pov";
export const VANILLA_FIRST_PERSON_PRESET = "minecraft:first_person";
const HEAD_HIDE_ANIMATION = "animation.vantage.hide_head";
const IDLE_SWAY_ANIMATION = "animation.vantage.idle_sway";
const OFFSET_EASE_MS = 180;
const lastPoseByPlayerId = new Map();
const activeByPlayerId = new Set();
function addOffsets(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function easeOptionsFor(ms) {
  return { easeTime: ms / 1000, easeType: EasingType.InOutSine };
}
/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("./vantage_config.js").VantageConfig} config
 * @param {boolean} enabled
 */
export function applyVantageForPlayer(player, config, enabled) {
  const shouldBeActive =
    enabled &&
    config.bodyVisible &&
    !isCameraOverrideUnsafe(player) &&
    !isSuppressedByAnotherAddon(player);
  const wasActive = activeByPlayerId.has(player.id);
  if (!shouldBeActive) {
    if (wasActive) exitVantageCamera(player);
    return;
  }
  const pose = classifyPoseState(player);
  const poseChanged = lastPoseByPlayerId.get(player.id) !== pose;
  if (!wasActive) {
    enterVantageCamera(player, config);
  } else if (poseChanged) {
    applyOffsetForPose(player, config, pose, true);
  } else {
    applyOffsetForPose(player, config, pose, false);
  }
  lastPoseByPlayerId.set(player.id, pose);
  if (config.headHideEnabled) {
    player.playAnimation(HEAD_HIDE_ANIMATION, { players: [player], blendOutTime: 0 });
  }
  player.playAnimation(IDLE_SWAY_ANIMATION, { players: [player], blendOutTime: 0.2 });
  applyFov(player, config);
}
function enterVantageCamera(player, config) {
  applyOffsetForPose(player, config, classifyPoseState(player), false);
  activeByPlayerId.add(player.id);
}
function exitVantageCamera(player) {
  try {
    if (player.isValid) {
      player.camera.setCameraWithEase(VANILLA_FIRST_PERSON_PRESET, easeOptionsFor(OFFSET_EASE_MS));
      player.camera.setFov();
      player.playAnimation(HEAD_HIDE_ANIMATION, { players: [player], blendOutTime: 0.2 });
    }
  } catch (_err) {
  }
  activeByPlayerId.delete(player.id);
  lastPoseByPlayerId.delete(player.id);
}
function applyOffsetForPose(player, config, pose, _poseJustChanged) {
  const delta = config.stateOffsetDeltas[pose] ?? { x: 0, y: 0, z: 0 };
  const entityOffset = addOffsets(config.baseOffset, delta);
  try {
    player.camera.setCamera(VANTAGE_CAMERA_PRESET, {
      entityOffset,
      viewOffset: config.viewOffset,
    });
  } catch (_err) {
  }
}
function applyFov(player, config) {
  try {
    if (config.fovOverrideEnabled) {
      const fov = clamp(config.fovDegrees, 30, 110);
      player.camera.setFov({ fov });
    } else {
      player.camera.setFov();
    }
  } catch (_err) {
  }
}
export function startCameraLoop(getPlayersToUpdate) {
  system.runInterval(() => {
    for (const { player, config, enabled } of getPlayersToUpdate()) {
      applyVantageForPlayer(player, config, enabled);
    }
  }, 1);
}
export function forgetPlayer(playerId) {
  activeByPlayerId.delete(playerId);
  lastPoseByPlayerId.delete(playerId);
}