import { world, system, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
const NAMESPACE = "vantage:";
/** @type {Map<string, {enabled:boolean}>} */
const configCache = new Map();
const DEFAULT_CONFIG = Object.freeze({
    enabled: true,
});
function loadConfig(player) {
    try {
        const raw = player.getDynamicProperty(NAMESPACE + "cfg");
        if (typeof raw === "string") {
            const parsed = JSON.parse(raw);
            const cfg = { ...DEFAULT_CONFIG, ...parsed };
            configCache.set(player.id, cfg);
            return cfg;
        }
    } catch (e) {
    }
    const cfg = { ...DEFAULT_CONFIG };
    configCache.set(player.id, cfg);
    return cfg;
}
function getConfig(player) {
    return configCache.get(player.id) ?? loadConfig(player);
}
function saveConfig(player, cfg) {
    configCache.set(player.id, cfg);
    try {
        player.setDynamicProperty(NAMESPACE + "cfg", JSON.stringify(cfg));
    } catch (e) {
    }
}
function applyVantageCamera(player, cfg) {
    if (!cfg.enabled) {
        try {
            player.camera.clear();
        } catch (e) {
        }
        return;
    }
    try {
        const eyeLoc = typeof player.getHeadLocation === "function" ? player.getHeadLocation() : player.location;
        const rot = player.getRotation();
        player.runCommand(
            `camera @s set minecraft:free pos ${eyeLoc.x} ${eyeLoc.y} ${eyeLoc.z} rot ${rot.x} ${rot.y}`
        );
    } catch (e) {
    }
}
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const cfg = getConfig(player);
        applyVantageCamera(player, cfg);
    }
}, 1);
const toggleCooldown = new Map();
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const cfg = getConfig(player);
        const cooldown = toggleCooldown.get(player.id) ?? 0;
        if (cooldown > 0) {
            toggleCooldown.set(player.id, cooldown - 1);
            continue;
        }
        if (player.isSneaking && player.isJumping) {
            cfg.enabled = !cfg.enabled;
            saveConfig(player, cfg);
            applyVantageCamera(player, cfg);
            player.onScreenDisplay.setActionBar(
                cfg.enabled ? "\u00a7aVantage: ON" : "\u00a77Vantage: OFF"
            );
            toggleCooldown.set(player.id, 20);
        }
    }
}, 1);
world.afterEvents.playerSpawn.subscribe((event) => {
    const { player, initialSpawn } = event;
    if (!initialSpawn) return;
    const cfg = loadConfig(player);
    system.run(() => applyVantageCamera(player, cfg));
    player.sendMessage("\u00a75\u00a7l\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    player.sendMessage("\u00a75\u00a7lWelcome to Vantage , \u00a7d" + player.name + "\u00a75\u00a7l!");
    player.sendMessage("\u00a75\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    player.sendMessage("\u00a77Your head is invisible in first-person.");
    player.sendMessage("\u00a77Others always see your real head.");
    player.sendMessage("\u00a7b\u00a7lControls");
    player.sendMessage("\u00a77\u00a7lSneak + Jump\u00a77: Toggle Vantage on/off");
    player.sendMessage("\u00a76\u00a7lRequirements");
    player.sendMessage("\u00a77\u2022 Beta APIs: ON");
    player.sendMessage("\u00a77\u2022 Creator Camera Features: ON");
    player.sendMessage("\u00a75\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
});
world.afterEvents.playerLeave.subscribe((event) => {
    configCache.delete(event.playerId);
    toggleCooldown.delete(event.playerId);
});
function openConfigMenu(player) {
    const cfg = getConfig(player);
    const form = new ActionFormData()
        .title("Vantage Settings")
        .body(
            "Vantage: " + (cfg.enabled ? "\u00a7aON" : "\u00a7cOFF") + "\n" +
            "\u00a77Toggle with: Sneak + Jump\n" +
            "\u00a77Or use the button below:"
        )
        .button(cfg.enabled ? "\u00a7cTurn OFF" : "\u00a7aTurn ON");
    form
        .show(player)
        .then((response) => {
            if (response.canceled) return;
            cfg.enabled = !cfg.enabled;
            saveConfig(player, cfg);
            applyVantageCamera(player, cfg);
            player.sendMessage(
                cfg.enabled
                    ? "\u00a7a[Vantage] Enabled"
                    : "\u00a77[Vantage] Disabled"
            );
        })
        .catch((e) => console.warn("[Vantage] Menu error: " + e));
}
try {
    system.beforeEvents.startup.subscribe((init) => {
        init.customCommandRegistry.registerCommand(
            {
                name: "vantage:menu",
                description: "Open Vantage settings menu.",
                permissionLevel: CommandPermissionLevel.Any,
                cheatsRequired: false,
            },
            (origin) => {
                const player = origin.sourceEntity;
                if (player) system.run(() => openConfigMenu(player));
                return { status: CustomCommandStatus.Success };
            }
        );
    });
} catch (e) {
    console.warn("[Vantage] Custom command unavailable");
}
try {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id !== "vantage:menu") return;
        const player = event.sourceEntity;
        if (player) openConfigMenu(player);
    });
} catch (e) {
}
console.warn("[Vantage] loaded — use /vantage:menu or Sneak+Jump to toggle.");
