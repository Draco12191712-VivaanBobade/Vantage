/**
* Vantage - Menus
* ------------------------------------------------------------------
* `@minecraft/server-ui` forms are the Bedrock UI system's supported
* surface for click-driven, script-backed interaction, and
* `ActionFormData.button(text, iconPath)` is what puts the supplied
* toggle artwork on a control that can actually carry a click back
* into script. The engine renders and input-maps these per platform,
* so touch, gamepad, and keyboard & mouse all work with no
* platform-specific code.
*
* Every `show()` is awaited inside a caller that runs under
* `system.run`, because forms cannot be opened from a read-only event
* context.
*/

import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import {
  getPlayerConfig,
  setPlayerConfig,
  createDefaultConfig,
  isEnabledFor,
  clamp,
  BODY_DISTANCE_LABELS,
  ADDON_VERSION,
} from "./vantage_config.js";
import { toggleVantage } from "./vantage_input.js";

const ICON_ON = "textures/ui/vantage_toggle_on";
const ICON_OFF = "textures/ui/vantage_toggle_off";

/** @param {import("@minecraft/server").Player} player */
export async function showMainMenu(player) {
  const enabled = isEnabledFor(player);

  const form = new ActionFormData()
    .title("Vantage")
    .body(
      `First-person body: ${enabled ? "§aON§r" : "§cOFF§r"}\n` +
      "§7Quick toggle: Sneak + Jump§r\n" +
      `§8v${ADDON_VERSION}§r`
    )
    .button(enabled ? "Turn Off" : "Turn On", enabled ? ICON_OFF : ICON_ON)
    .button("Camera & Body Settings")
    .button("Reset to Defaults");

  const response = await form.show(player);
  if (response.canceled || response.selection === undefined) return;

  if (response.selection === 0) {
    toggleVantage(player);
    return;
  }
  if (response.selection === 1) {
    await showSettingsMenu(player);
    return;
  }
  await confirmReset(player);
}

/** @param {import("@minecraft/server").Player} player */
export async function showSettingsMenu(player) {
  const cfg = getPlayerConfig(player);

  // NOTE: no divider()/header()/label() calls here on purpose. Those are
  // non-interactive elements and the stable docs do not state whether they
  // occupy a slot in `formValues`. If they do, every index below shifts and
  // the wrong value lands in the wrong setting. Interactive controls only
  // keeps the response mapping unambiguous on every runtime version.
  // `dropdown` takes `defaultValueIndex`, NOT `defaultValue`.
  const form = new ModalFormData()
    .title("Vantage - Camera & Body")
    .toggle("Show first-person body", { defaultValue: cfg.bodyVisible })
    .toggle("Hide my own head", {
      defaultValue: cfg.headHideEnabled,
      tooltip: "Keeps your head from filling the lens. Only you see this.",
    })
    .dropdown("Body distance", BODY_DISTANCE_LABELS, {
      defaultValueIndex: clamp(cfg.bodyDistance, 0, 2) | 0,
      tooltip: "How far your torso and legs sit from the camera.",
    })
    .toggle("Quick toggle: Sneak + Jump", { defaultValue: cfg.quickToggleEnabled })
    .slider("Camera offset - forward/back", -30, 30, {
      defaultValue: Math.round(cfg.baseOffset.z * 100),
      valueStep: 1,
      tooltip: "Hundredths of a block.",
    })
    .slider("Camera offset - up/down", -30, 30, {
      defaultValue: Math.round(cfg.baseOffset.y * 100),
      valueStep: 1,
    })
    .slider("Camera offset - left/right", -30, 30, {
      defaultValue: Math.round(cfg.baseOffset.x * 100),
      valueStep: 1,
    })
    .toggle("Override field of view", { defaultValue: cfg.fovOverrideEnabled })
    .slider("Field of view (degrees)", 30, 110, {
      defaultValue: clamp(cfg.fovDegrees, 30, 110),
      valueStep: 1,
    })
    .toggle("Vanilla view while gliding", { defaultValue: cfg.fallbackWhileGliding })
    .toggle("Vanilla view while holding a spyglass", { defaultValue: cfg.fallbackWhileSpyglass });

  const response = await form.show(player);
  if (response.canceled || !response.formValues) return;

  const v = response.formValues;
  let i = 0;
  cfg.bodyVisible = Boolean(v[i++]);
  cfg.headHideEnabled = Boolean(v[i++]);
  cfg.bodyDistance = clamp(Number(v[i++]), 0, 2) | 0;
  cfg.quickToggleEnabled = Boolean(v[i++]);
  cfg.baseOffset = {
    z: clamp(Number(v[i++]) / 100, -0.3, 0.3),
    y: clamp(Number(v[i++]) / 100, -0.3, 0.3),
    x: clamp(Number(v[i++]) / 100, -0.3, 0.3),
  };
  cfg.fovOverrideEnabled = Boolean(v[i++]);
  cfg.fovDegrees = clamp(Number(v[i++]), 30, 110);
  cfg.fallbackWhileGliding = Boolean(v[i++]);
  cfg.fallbackWhileSpyglass = Boolean(v[i++]);

  const saved = setPlayerConfig(player, cfg);
  player.sendMessage(saved ? "§7[Vantage] Settings saved." : "§c[Vantage] Could not save settings.");
}

/** @param {import("@minecraft/server").Player} player */
async function confirmReset(player) {
  const form = new ActionFormData()
    .title("Vantage - Reset")
    .body("Reset all Vantage settings for you to their defaults?")
    .button("Cancel")
    .button("Reset");

  const response = await form.show(player);
  if (response.canceled || response.selection !== 1) return;

  setPlayerConfig(player, createDefaultConfig());
  player.sendMessage("§7[Vantage] Settings reset to defaults.");
}
