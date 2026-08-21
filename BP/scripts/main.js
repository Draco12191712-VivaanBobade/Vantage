import { world } from "@minecraft/server";

world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (!player) return;

    player.sendMessage("§6[Vantage] §fFull-body first person enabled.");
});