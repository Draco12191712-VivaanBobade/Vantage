/**
* Vantage - Dynamic First-Person Body Add-on
* Entry point.
*
* ------------------------------------------------------------------
* v0.2.0 CHANGELOG - why v0.1.x did nothing at all
*
* The single fatal defect: vantage_compat.js subscribed to
* `world.afterEvents.scriptEventReceive`, but that signal lives on
* `system.afterEvents`. Reading `.subscribe` off `undefined` threw
* during module evaluation, and because that happened at import time
* in main.js, execution stopped there - the camera loop never
* started and the command registry was never populated. All three
* reported symptoms (no body, no menu, no toggle) were that one line.
*
* Hardening so it cannot happen again: every subsystem registers
* behind its own try/catch, so a failure in any one of them degrades
* that feature only and the rest of the add-on still runs. Startup
* reports what came up and what did not, in the content log.
* ------------------------------------------------------------------
*/

import { world, system } from "@minecraft/server";
import { getPlayerConfig, isEnabledFor, hasSeenWelcome, markWelcomeSeen, ADDON_VERSION } from "./vantage_config.js";
import { startLoop, forgetPlayer as forgetCamera } from "./vantage_camera.js";
import { registerCommands } from "./vantage_commands.js";
import { registerCompatHandshake } from "./vantage_compat.js";
import { registerQuickToggle, forgetPlayer as forgetInput } from "./vantage_input.js";

const report = [];

function boot(label, fn) {
    try {
        const ok = fn();
        report.push(`${label}: ${ok === false ? "unavailable on this runtime" : "ok"}`);
    } catch (err) {
        report.push(`${label}: FAILED (${err})`);
        console.warn(`[Vantage] ${label} failed to initialize: ${err}`);
    }
}

boot("commands", registerCommands);
boot("quick-toggle", registerQuickToggle);
boot("compat-handshake", registerCompatHandshake);

boot("player-events", () => {
    world.afterEvents.playerLeave.subscribe((event) => {
        forgetCamera(event.playerId);
        forgetInput(event.playerId);
    });

    world.afterEvents.playerSpawn.subscribe((event) => {
        if (!event.initialSpawn) return;
        const player = event.player;
        system.runTimeout(() => {
            try {
                if (!player.isValid || hasSeenWelcome(player)) return;
                markWelcomeSeen(player);
                player.sendMessage(
                    `§7[§9§lVantage§r§7 v${ADDON_VERSION}]§r First-person body is §aon§r.\n` +
                    "§7Quick toggle: §fSneak + Jump§7. Settings: §f/vantage§7."
                );
            } catch (_err) {
                /* non-fatal */
            }
        }, 60);
    });
    return true;
});

boot("camera-loop", () => {
    startLoop(function* collect() {
        for (const player of world.getAllPlayers()) {
            try {
                if (!player.isValid) continue;
                yield { player, config: getPlayerConfig(player), enabled: isEnabledFor(player) };
            } catch (_err) {
                /* skip this player this tick */
            }
        }
    });
    return true;
});

console.warn(`[Vantage v${ADDON_VERSION}] startup - ${report.join(" | ")}`);
