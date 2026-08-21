import { world } from "@minecraft/server";

/*
 * Vantage
 *
 * Core feature set:
 *   - Full local-player body in first person
 *   - Normal first/third-person switching
 *
 * Rendering is handled by the Resource Pack's player entity,
 * animation, and animation-controller pipeline.
 *
 * This script intentionally does not force a camera every tick.
 * Minecraft's native perspective system remains authoritative.
 */

const VANTAGE_VERSION = "0.1.0";

world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (!player) return;

    // Vantage does not need to modify the player's camera state here.
    // The vanilla perspective system remains responsible for switching
    // between first and third person.
});