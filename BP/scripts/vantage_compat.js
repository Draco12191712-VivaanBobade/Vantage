/**
* Vantage - Cross-Add-on Compatibility Layer
* ------------------------------------------------------------------
* FIXED IN v0.2.0 - this file contained the crash that took the whole
* add-on down in v0.1.x:
*
*   world.afterEvents.scriptEventReceive.subscribe(...)
*
* `scriptEventReceive` does not live on WorldAfterEvents. It lives on
* SystemAfterEvents (`system.afterEvents.scriptEventReceive`). Reading
* `.subscribe` off `undefined` threw a TypeError during module
* evaluation, which aborted main.js before the camera loop or the
* command registry were ever reached - which is why the body never
* appeared, the menu never opened, and the toggle never responded.
* Every subscription in this add-on is now both correct and guarded.
*
* Vantage never overrides `entity/player.entity.json`. That file is a
* singleton across the resource-pack stack: if two packs ship a copy,
* only the top one loads and the other is dropped whole. Driving
* everything from the Script API instead is what lets Vantage sit in a
* stack with skin packs, shaders, and other cosmetic packs safely.
*/

import { world, system } from "@minecraft/server";
import { ADDON_VERSION } from "./vantage_config.js";

const SUPPRESS_PROPERTY = "vantage:suppressed_by_other_addon";

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
  try {
    player.setDynamicProperty(SUPPRESS_PROPERTY, Boolean(suppressed));
  } catch (_err) {
    /* non-fatal */
  }
}

/**
 * Handshake so cooperating add-ons can detect Vantage and stand it
 * down per player, without either side needing a build-time
 * dependency on the other:
 *
 *   /scriptevent vantage:query              -> Vantage answers vantage:status
 *   /scriptevent vantage:suppress true      -> Vantage yields for the sender
 *   /scriptevent vantage:suppress false     -> Vantage resumes
 */
export function registerCompatHandshake() {
  const signal = system.afterEvents?.scriptEventReceive;
  if (!signal?.subscribe) return false;

  signal.subscribe((event) => {
    try {
      if (event.id === "vantage:query") {
        // Command execution is not permitted inside an event callback's
        // read-only window; system.run defers it to the next safe tick.
        system.run(() => {
          try {
            world
              .getDimension("overworld")
              .runCommand(`scriptevent vantage:status {"addon":"vantage","version":"${ADDON_VERSION}"}`);
          } catch (_err) {
            /* non-fatal */
          }
        });
        return;
      }

      if (event.id === "vantage:suppress") {
        const source = event.sourceEntity;
        if (source?.typeId === "minecraft:player") {
          const suppressed = String(event.message).trim().toLowerCase() === "true";
          system.run(() => setSuppressed(source, suppressed));
        }
      }
    } catch (_err) {
      /* a malformed message from another add-on must never break Vantage */
    }
  });

  return true;
}
