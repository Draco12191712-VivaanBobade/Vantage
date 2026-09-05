import { world } from "@minecraft/server";
const SUPPRESS_PROPERTY = "vantage:suppressed_by_other_addon";
const HANDSHAKE_QUERY_EVENT = "vantage:query";
const HANDSHAKE_STATUS_EVENT = "vantage:status";
/** @param {import("@minecraft/server").Player} player */
export function isSuppressedByAnotherAddon(player) {
  try {
    return Boolean(player.getDynamicProperty(SUPPRESS_PROPERTY));
  } catch (_err) {
    return false;
  }
}
/**
 * @param {import("@minecraft/server").Player} player
 * @param {boolean} suppressed
 */
export function setSuppressed(player, suppressed) {
  player.setDynamicProperty(SUPPRESS_PROPERTY, Boolean(suppressed));
}
export function registerCompatHandshake() {
  world.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === HANDSHAKE_QUERY_EVENT) {
      world.getDimension("overworld").runCommand(
        `scriptevent ${HANDSHAKE_STATUS_EVENT} {"addon":"vantage","version":"1.0.0"}`
      );
      return;
    }
    if (event.id === "vantage:suppress") {
      const target = event.sourceEntity;
      if (target && "typeId" in target && target.typeId === "minecraft:player") {
        setSuppressed(/** @type {import("@minecraft/server").Player} */(target), event.message === "true");
      }
    }
  });
}