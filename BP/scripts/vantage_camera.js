/**
* Vantage - Camera & Body Application Layer
* ------------------------------------------------------------------
* HOW THE FIRST-PERSON BODY ACTUALLY WORKS
*
* 1. `vantage:pov` inherits `minecraft:follow_orbit` at `radius: 0.1`
*    (the documented minimum; 0 is not legal). Mechanically this is a
*    third-person camera sitting on top of the player's head, so the
*    engine draws the full, already-correctly-animated body - torso,
*    limbs, armor, held items - with no custom geometry anywhere.
*
* 2. The player's own head is scaled to 0 for that player's client
*    only, otherwise it fills the lens. The RP animation guards this
*    with `q.is_in_ui` (so the inventory paper doll keeps its head)
*    and `!q.is_local_player` (so no other client ever renders a
*    headless body), and the script additionally scopes the request
*    with `players: [self]`.
*
* 3. CRITICAL, AND MISSING FROM v0.1.x: hiding the head is not enough.
*    With the lens on the head, the torso and legs sit directly
*    against the near plane and read as a wall of texture. The same
*    animation therefore pushes `waist`, `leftleg` and `rightleg`
*    away from the camera along +z, which is what turns "a texture in
*    my face" into "my body, seen from my own eyes". Three push-back
*    distances ship as separate animation ids and are selected from
*    config, since molang variables cannot be driven from script.
*
* ANIMATION LIFECYCLE
* `playAnimation` requests are timed: a large `blendOutTime` makes a
* looping clip persist, and re-requesting the same id with
* `blendOutTime: 0` releases it. Vantage asserts on transitions and
* re-asserts on a slow heartbeat rather than every tick, so a
* respawn, dimension change or emote cannot leave the body stuck.
*
* RAYCAST NOTE
* Interaction raycasts always originate at the true eye location -
* camera presets are render-only. At the 0.1-block minimum radius the
* visual/hit-test divergence is sub-voxel and imperceptible, but it is
* not mathematically zero, and no supported API reduces it further.
*/

import { system, EasingType } from "@minecraft/server";
import { classifyPose, shouldYieldToVanilla } from "./vantage_state.js";
import { isSuppressedByAnotherAddon } from "./vantage_compat.js";
import { clamp, BODY_DISTANCE } from "./vantage_config.js";

export const VANTAGE_PRESET = "vantage:pov";
export const VANILLA_PRESET = "minecraft:first_person";

const ANIMATION_REASSERT_TICKS = 20;
const EXIT_EASE_SECONDS = 0.18;
const EXIT_CLEAR_DELAY_TICKS = 6;

/** @type {Map<string, {active:boolean, pose:string, animId:string|undefined, tick:number, generation:number}>} */
const runtime = new Map();

function stateFor(playerId) {
  let entry = runtime.get(playerId);
  if (!entry) {
    entry = { active: false, pose: "", animId: undefined, tick: 0, generation: 0 };
    runtime.set(playerId, entry);
  }
  return entry;
}

function addOffset(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("./vantage_config.js").VantageConfig} config
 * @param {boolean} enabled
 */
export function applyForPlayer(player, config, enabled) {
  const entry = stateFor(player.id);
  entry.tick++;

  const wantActive =
    enabled &&
    config.bodyVisible &&
    !shouldYieldToVanilla(player, config) &&
    !isSuppressedByAnotherAddon(player);

  if (!wantActive) {
    if (entry.active) deactivate(player, entry);
    return;
  }

  const pose = classifyPose(player);
  const desiredAnim = BODY_DISTANCE[config.bodyDistance] ?? BODY_DISTANCE[1];

  // Camera pivot is re-asserted every tick: it is a single cheap native
  // call, and it is what makes the view snap straight back if the
  // player hits the native perspective key (which clears custom camera
  // state and which the Script API exposes no event for).
  applyPivot(player, config, pose);

  const animChanged = entry.animId !== desiredAnim;
  const wantAnim = config.headHideEnabled;

  if (!wantAnim) {
    if (entry.animId) releaseAnimation(player, entry);
  } else if (animChanged) {
    if (entry.animId) releaseAnimation(player, entry);
    assertAnimation(player, entry, desiredAnim);
  } else if (entry.tick % ANIMATION_REASSERT_TICKS === 0 || entry.pose !== pose) {
    assertAnimation(player, entry, desiredAnim);
  }

  if (!entry.active) {
    // Invalidates any deactivation clean-up still queued from a toggle
    // the player has already reversed.
    entry.generation++;
    entry.active = true;
  }
  entry.pose = pose;

  applyFov(player, config);
}

function applyPivot(player, config, pose) {
  const delta = config.stateOffsetDeltas[pose] ?? { x: 0, y: 0, z: 0 };
  const entityOffset = addOffset(config.baseOffset, delta);
  try {
    player.camera.setCamera(VANTAGE_PRESET, {
      entityOffset,
      viewOffset: config.viewOffset,
    });
  } catch (_err) {
    // Camera calls can fail for a tick during teleports/dimension
    // changes; the next tick retries.
  }
}

function assertAnimation(player, entry, animId) {
  try {
    player.playAnimation(animId, { players: [player], blendOutTime: 999999 });
    entry.animId = animId;
  } catch (_err) {
    /* non-fatal */
  }
}

function releaseAnimation(player, entry) {
  if (!entry.animId) return;
  try {
    // Re-requesting the same clip with a zero blend-out releases its
    // hold on the bones; the Script API exposes no explicit stop.
    player.playAnimation(entry.animId, { players: [player], blendOutTime: 0 });
  } catch (_err) {
    /* non-fatal */
  }
  entry.animId = undefined;
}

function deactivate(player, entry) {
  entry.active = false;
  entry.pose = "";
  const generation = ++entry.generation;

  try {
    if (!player.isValid) return;

    releaseAnimation(player, entry);

    // Ease out to the vanilla first-person preset so leaving Vantage
    // reads as a transition rather than a hard cut...
    player.camera.setCameraWithEase(VANILLA_PRESET, {
      easeTime: EXIT_EASE_SECONDS,
      easeType: EasingType.InOutSine,
    });
    player.camera.setFov();

    // ...and then hand the camera back to the engine once the ease has
    // played out. This second step matters: while ANY preset is set -
    // including `minecraft:first_person` - the player's own perspective
    // key is locked out. Without the clear, turning Vantage off would
    // leave them unable to switch to third person at all, which is a
    // worse bug than the one the ease is smoothing over. The generation
    // check makes a toggle-off-then-on inside the ease window safe.
    system.runTimeout(() => {
      try {
        if (player.isValid && !entry.active && entry.generation === generation) {
          player.camera.clear();
        }
      } catch (_err) {
        /* non-fatal */
      }
    }, EXIT_CLEAR_DELAY_TICKS);
  } catch (_err) {
    /* player may have left */
  }
}

function applyFov(player, config) {
  try {
    if (config.fovOverrideEnabled) {
      player.camera.setFov({ fov: clamp(config.fovDegrees, 30, 110) });
    }
  } catch (_err) {
    /* cosmetic only */
  }
}

/**
 * Immediately tears down Vantage for one player - used by the toggle
 * so the view changes on the same tick the player asks for it rather
 * than waiting for the loop to notice.
 * @param {import("@minecraft/server").Player} player
 */
export function forceDeactivate(player) {
  const entry = stateFor(player.id);
  if (entry.active || entry.animId) deactivate(player, entry);
}

/** Starts the per-tick loop. `supplier` yields {player, config, enabled}. */
export function startLoop(supplier) {
  return system.runInterval(() => {
    for (const item of supplier()) {
      try {
        applyForPlayer(item.player, item.config, item.enabled);
      } catch (_err) {
        // One bad player must never stall the loop for everyone else.
      }
    }
  }, 1);
}

/** @param {string} playerId */
export function forgetPlayer(playerId) {
  runtime.delete(playerId);
}
