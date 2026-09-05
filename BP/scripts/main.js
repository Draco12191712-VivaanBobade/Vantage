import { world, system } from "@minecraft/server";
import { getPlayerConfig, isEnabledFor } from "./vantage_config.js";
import { startCameraLoop, forgetPlayer } from "./vantage_camera.js";
import { registerCommands } from "./vantage_commands.js";
import { registerCompatHandshake } from "./vantage_compat.js";
registerCommands();
registerCompatHandshake();
world.afterEvents.playerLeave.subscribe((event) => {
    forgetPlayer(event.playerId);
});
system.run(() => {
    startCameraLoop(function* collectPlayerUpdates() {
        for (const player of world.getAllPlayers()) {
            if (!player.isValid) continue;
            yield {
                player,
                config: getPlayerConfig(player),
                enabled: isEnabledFor(player),
            };
        }
    });
});