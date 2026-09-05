/**
* Vantage - Quick Toggle Input (Sneak + Jump)
* ------------------------------------------------------------------
* WHY THIS EXISTS INSTEAD OF A CLICKABLE HUD BUTTON
*
* A resource-pack JSON UI control cannot invoke behavior-pack script.
* Data-driven UI is a display and navigation layer: its `button`
* controls bind only to a fixed set of engine-recognised actions, and
* there is no binding that dispatches a developer-defined callback.
* The HUD badge Vantage ships is therefore a status/hint glyph, not a
* click target - and a custom screen-space button would also be
* unreachable by gamepad focus, so it would have been worse than
* useless on controller anyway.
*
* `world.afterEvents.playerButtonInput` is the supported way to read a
* real input, and it reports Jump/Sneak identically on touch, gamepad,
* and keyboard & mouse - which is exactly the input parity target.
* PC players who want a dedicated key can additionally bind
* `/vantage:toggle` to a command macro in Settings > Keyboard & Mouse.
*
* Guard rails: the combo requires Sneak to already be held when Jump
* goes down, is rate-limited so a held jump cannot flicker the view,
* and can be switched off in the settings menu for players who
* sneak-jump often enough to trip it by accident.
*/

import { world, system, InputButton, ButtonState } from "@minecraft/server";
import { getPlayerConfig, isEnabledFor, setEnabledFor } from "./vantage_config.js";
import { forceDeactivate } from "./vantage_camera.js";

const COOLDOWN_TICKS = 10;

/** @type {Map<string, number>} */
const lastToggleTick = new Map();

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean} the new enabled state
 */
export function toggleVantage(player) {
  const next = !isEnabledFor(player);
  setEnabledFor(player, next);
  if (!next) forceDeactivate(player);
  announce(player, next);
  return next;
}

/** @param {import("@minecraft/server").Player} player */
export function announce(player, enabled) {
  const text = enabled ? "§aVantage: first-person body ON" : "§7Vantage: first-person body OFF";
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch (_err) {
    try {
      player.sendMessage(text);
    } catch (_err2) {
      /* non-fatal */
    }
  }
}

/**
 * @returns {boolean} false when the platform does not expose button
 * input, so the caller can report the degraded state instead of the
 * feature failing silently.
 */
export function registerQuickToggle() {
  const signal = world.afterEvents?.playerButtonInput;
  if (!signal?.subscribe) return false;

  signal.subscribe((event) => {
    try {
      if (event.button !== InputButton.Jump) return;
      if (event.newButtonState !== ButtonState.Pressed) return;

      const player = event.player;
      if (!player?.isValid) return;

      // Sneak must already be held. `inputInfo` is the authoritative
      // read; `isSneaking` is the fallback on builds that predate it.
      let sneaking = false;
      try {
        sneaking = player.inputInfo?.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
      } catch (_err) {
        sneaking = false;
      }
      if (!sneaking) sneaking = player.isSneaking === true;
      if (!sneaking) return;

      if (!getPlayerConfig(player).quickToggleEnabled) return;

      const now = system.currentTick;
      const last = lastToggleTick.get(player.id) ?? -Infinity;
      if (now - last < COOLDOWN_TICKS) return;
      lastToggleTick.set(player.id, now);

      system.run(() => {
        if (player.isValid) toggleVantage(player);
      });
    } catch (_err) {
      /* never let an input handler take the add-on down */
    }
  });

  return true;
}

/** @param {string} playerId */
export function forgetPlayer(playerId) {
  lastToggleTick.delete(playerId);
}
