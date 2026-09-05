import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import {
  getPlayerConfig,
  setPlayerConfig,
  isEnabledFor,
  setEnabledFor,
  clamp,
  createDefaultConfig,
} from "./vantage_config.js";
const ICON_ON = "textures/ui/vantage_toggle_on";
const ICON_OFF = "textures/ui/vantage_toggle_off";
/**
 * @param {import("@minecraft/server").Player} player
 */
export async function showMainMenu(player) {
  const enabled = isEnabledFor(player);
  const form = new ActionFormData()
    .title("Vantage")
    .body(
      `Dynamic first-person body: ${enabled ? "§aON§r" : "§cOFF§r"}\n` +
      "Choose an option below."
    )
    .button(enabled ? "Turn Off" : "Turn On", enabled ? ICON_OFF : ICON_ON)
    .button("Camera & Body Settings")
    .button("Reset to Defaults");
  const response = await form.show(player);
  if (response.canceled || response.selection === undefined) return;
  switch (response.selection) {
    case 0:
      setEnabledFor(player, !enabled);
      player.sendMessage(`§7[Vantage] §rDynamic first-person body ${!enabled ? "§aenabled" : "§cdisabled"}§r.`);
      break;
    case 1:
      await showSettingsMenu(player);
      break;
    case 2:
      await confirmAndReset(player);
      break;
  }
}
/**
 * @param {import("@minecraft/server").Player} player
 */
export async function showSettingsMenu(player) {
  const cfg = getPlayerConfig(player);
  const form = new ModalFormData()
    .title("Vantage — Camera & Body Settings")
    .toggle("Show first-person body (close-orbit POV)", { defaultValue: cfg.bodyVisible })
    .toggle("Hide own head model (recommended)", { defaultValue: cfg.headHideEnabled })
    .slider("Camera offset — forward/back", -30, 30, { defaultValue: Math.round(cfg.baseOffset.z * 100), valueStep: 1 })
    .slider("Camera offset — up/down", -30, 30, { defaultValue: Math.round(cfg.baseOffset.y * 100), valueStep: 1 })
    .slider("Camera offset — left/right", -30, 30, { defaultValue: Math.round(cfg.baseOffset.x * 100), valueStep: 1 })
    .toggle("Override field of view", { defaultValue: cfg.fovOverrideEnabled })
    .slider("Field of view (degrees)", 30, 110, { defaultValue: cfg.fovDegrees, valueStep: 1 })
    .toggle("Camera shake on landing/sprint (cosmetic)", { defaultValue: cfg.cameraShakeEnabled });
  const response = await form.show(player);
  if (response.canceled || !response.formValues) return;
  const [
    bodyVisible,
    headHideEnabled,
    offsetZCenti,
    offsetYCenti,
    offsetXCenti,
    fovOverrideEnabled,
    fovDegrees,
    cameraShakeEnabled,
  ] = response.formValues;
  cfg.bodyVisible = Boolean(bodyVisible);
  cfg.headHideEnabled = Boolean(headHideEnabled);
  cfg.baseOffset = {
    x: clamp(Number(offsetXCenti) / 100, -0.3, 0.3),
    y: clamp(Number(offsetYCenti) / 100, -0.3, 0.3),
    z: clamp(Number(offsetZCenti) / 100, -0.3, 0.3),
  };
  cfg.fovOverrideEnabled = Boolean(fovOverrideEnabled);
  cfg.fovDegrees = clamp(Number(fovDegrees), 30, 110);
  cfg.cameraShakeEnabled = Boolean(cameraShakeEnabled);
  setPlayerConfig(player, cfg);
  player.sendMessage("§7[Vantage] §rSettings saved.");
}
/** @param {import("@minecraft/server").Player} player */
async function confirmAndReset(player) {
  const form = new ActionFormData()
    .title("Vantage — Reset")
    .body("Reset all Vantage settings for this player to their defaults?")
    .button("Cancel")
    .button("Reset");
  const response = await form.show(player);
  if (response.canceled || response.selection !== 1) return;
  setPlayerConfig(player, createDefaultConfig());
  player.sendMessage("§7[Vantage] §rSettings reset to defaults.");
}
