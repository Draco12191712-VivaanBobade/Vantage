import { world, system, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
const CAMERA_ID = "vantage:free_cam";
const NAMESPACE = "vantage:";
/** @type {Map<string, {enabled:boolean, backOffset:number, heightOffset:number, sneakJumpToggle:boolean}>} */
const configCache = new Map();
const DEFAULT_CONFIG = Object.freeze({
    enabled: true,
    backOffset: 0.0,
    heightOffset: 0.0,
    sneakJumpToggle: false,
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
        console.warn("[Vantage] Failed to load config for " + player.name + ": " + e);
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
        console.warn("[Vantage] Failed to save config for " + player.name + ": " + e);
    }
}
function yawPitchToForward(rotation) {
    const yawRad = (rotation.y * Math.PI) / 180;
    const pitchRad = (rotation.x * Math.PI) / 180;
    return {
        x: -Math.sin(yawRad) * Math.cos(pitchRad),
        y: -Math.sin(pitchRad),
        z: Math.cos(yawRad) * Math.cos(pitchRad),
    };
}
function applyVantageCamera(player) {
    const cfg = getConfig(player);
    try {
        const eye = typeof player.getHeadLocation === "function" ? player.getHeadLocation() : player.location;
        const rot = player.getRotation();
        const fwd = yawPitchToForward(rot);
        const camPos = {
            x: eye.x - fwd.x * cfg.backOffset,
            y: eye.y + cfg.heightOffset,
            z: eye.z - fwd.z * cfg.backOffset,
        };
        player.camera.setCamera(CAMERA_ID, {
            location: camPos,
            rotation: { x: rot.x, y: rot.y },
            easeOptions: { easeTime: 0 },
        });
    } catch (e) {
        console.warn("[Vantage] setCamera failed for " + player.name + ": " + e);
    }
}
function clearVantageCamera(player) {
    try {
        player.camera.clear();
    } catch (e) {
        console.warn("[Vantage] camera.clear failed for " + player.name + ": " + e);
    }
}
const toggleCooldown = new Map();
function handleQuickToggle(player, cfg) {
    if (!cfg.sneakJumpToggle) return;
    const cooldown = toggleCooldown.get(player.id) ?? 0;
    if (cooldown > 0) {
        toggleCooldown.set(player.id, cooldown - 1);
        return;
    }
    if (player.isSneaking && player.isJumping) {
        cfg.enabled = !cfg.enabled;
        saveConfig(player, cfg);
        if (cfg.enabled) applyVantageCamera(player);
        else clearVantageCamera(player);
        player.onScreenDisplay.setActionBar(
            cfg.enabled ? "\u00a7aVantage: On" : "\u00a77Vantage: Off"
        );
        toggleCooldown.set(player.id, 20);
    }
}
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const cfg = getConfig(player);
        handleQuickToggle(player, cfg);
        if (cfg.enabled) applyVantageCamera(player);
    }
}, 1);
world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    const cfg = loadConfig(event.player);
    if (cfg.enabled) system.run(() => applyVantageCamera(event.player));
});
world.afterEvents.playerLeave.subscribe((event) => {
    configCache.delete(event.playerId);
    toggleCooldown.delete(event.playerId);
});
function openConfigMenu(player) {
    const cfg = getConfig(player);
    const form = new ModalFormData()
        .title("Vantage Configuration")
        .toggle("Enable Vantage (first-person body)", cfg.enabled)
        .slider("Camera back/forward offset", -0.4, 0.2, 0.05, cfg.backOffset)
        .slider("Camera height offset", -0.3, 0.3, 0.05, cfg.heightOffset)
        .toggle("Quick-toggle with Sneak + Jump", cfg.sneakJumpToggle);
    form
        .show(player)
        .then((response) => {
            if (response.canceled || !response.formValues) return;
            const [enabled, backOffset, heightOffset, sneakJumpToggle] = response.formValues;
            const newCfg = { enabled, backOffset, heightOffset, sneakJumpToggle };
            saveConfig(player, newCfg);
            if (enabled) applyVantageCamera(player);
            else clearVantageCamera(player);
            player.sendMessage("\u00a7a[Vantage]\u00a7r Settings updated.");
        })
        .catch((e) => console.warn("[Vantage] Menu error: " + e));
}
try {
    system.beforeEvents.startup.subscribe((init) => {
        init.customCommandRegistry.registerCommand(
            {
                name: "vantage:configmenu",
                description: "Open the Vantage first-person configuration menu.",
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
    console.warn("[Vantage] Custom command registration unavailable, using fallbacks only: " + e);
}
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "vantage:configmenu") return;
    const player = event.sourceEntity;
    if (player) openConfigMenu(player);
});
world.beforeEvents.chatSend.subscribe((event) => {
    if (event.message.trim().toLowerCase() !== "!vantage") return;
    event.cancel = true;
    const player = event.sender;
    system.run(() => openConfigMenu(player));
});
console.warn("[Vantage] loaded — use /vantage:configmenu or type !vantage in chat.");