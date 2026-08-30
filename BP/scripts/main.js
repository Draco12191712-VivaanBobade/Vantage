import { world, system, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
const NAMESPACE = "vantage:";
const ENABLED_OBJECTIVE = "vantage_enabled";
/** @type {Map<string, {enabled:boolean, offsetX:number, offsetY:number, offsetZ:number, opacity:number, sneakJumpToggle:boolean}>} */
const configCache = new Map();
const DEFAULT_CONFIG = Object.freeze({
    enabled: true,
    offsetX: 0.0,
    offsetY: 0.0,
    offsetZ: 0.32,
    opacity: 100,
    sneakJumpToggle: true,
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
function pushScoreboard(player, cfg) {
    try {
        player.runCommand(
            "scoreboard players set @s " + ENABLED_OBJECTIVE + " " + (cfg.enabled ? 1 : 0)
        );
    } catch (e) {
        console.warn("[Vantage] Scoreboard update failed for " + player.name + ": " + e);
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
        pushScoreboard(player, cfg);
        player.onScreenDisplay.setActionBar(
            cfg.enabled ? "\u00a7aVantage: On" : "\u00a77Vantage: Off"
        );
        toggleCooldown.set(player.id, 20);
    }
}
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        handleQuickToggle(player, getConfig(player));
    }
}, 1);
world.afterEvents.playerSpawn.subscribe((event) => {
    const { player, initialSpawn } = event;
    if (!initialSpawn) return;
    const cfg = loadConfig(player);
    system.run(() => pushScoreboard(player, cfg));
    player.sendMessage("\u00a75\u00a7l\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    player.sendMessage("\u00a75\u00a7lWelcome to Vantage, \u00a7d" + player.name + "\u00a75\u00a7l!");
    player.sendMessage("\u00a75\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    player.sendMessage("\u00a77Vantage — True first-person body visibility.");
    player.sendMessage("\u00a76\u00a7lSetup");
    player.sendMessage("\u00a77\u2022 Beta APIs must be enabled.");
    player.sendMessage("\u00a77\u2022 Minecraft 1.26.0 or newer required.");
    player.sendMessage("\u00a7aSetup is working!");
    player.sendMessage("\u00a7b\u00a7lConfiguration");
    player.sendMessage("\u00a77Open config menu:");
    player.sendMessage("\u00a7e/vantage:configmenu");
    player.sendMessage("\u00a77Sneak + Jump toggles on/off.");
    player.sendMessage("\u00a76\u00a7lFeatures");
    player.sendMessage("\u00a77\u2022 Configurable camera offset (X/Y/Z)");
    player.sendMessage("\u00a77\u2022 Adjustable body visibility / opacity");
    player.sendMessage("\u00a77\u2022 Quick-toggle (Sneak + Jump)");
    player.sendMessage("\u00a75\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    player.sendMessage("\u00a7d\u00a7lHave fun with Vantage!");
    player.sendMessage("\u00a75\u00a7l\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
});
world.afterEvents.playerLeave.subscribe((event) => {
    configCache.delete(event.playerId);
    toggleCooldown.delete(event.playerId);
});
function openConfigMenu(player) {
    const cfg = getConfig(player);
    const form = new ModalFormData()
        .title("Vantage Configuration")
        .toggle("Enable Vantage (first-person body)", { defaultValue: cfg.enabled })
        .slider("Camera Forward/Back (Z)", -0.5, 0.8, 0.05, cfg.offsetZ)
        .slider("Camera Left/Right (X)", -0.3, 0.3, 0.05, cfg.offsetX)
        .slider("Camera Up/Down (Y)", -0.3, 0.3, 0.05, cfg.offsetY)
        .slider("Body Visibility (%)", 0, 100, 10, cfg.opacity)
        .toggle("Quick-toggle (Sneak + Jump)", { defaultValue: cfg.sneakJumpToggle });
    form
        .show(player)
        .then((response) => {
            if (response.canceled || !response.formValues) return;
            const [enabled, offsetZ, offsetX, offsetY, opacity, sneakJumpToggle] = response.formValues;
            const newCfg = { enabled, offsetZ, offsetX, offsetY, opacity, sneakJumpToggle };
            saveConfig(player, newCfg);
            pushScoreboard(player, newCfg);
            player.sendMessage("\u00a7a[Vantage]\u00a7r Settings saved.");
        })
        .catch((e) => console.warn("[Vantage] Menu error: " + e));
}
try {
    system.beforeEvents.startup.subscribe((init) => {
        init.customCommandRegistry.registerCommand(
            {
                name: "vantage:configmenu",
                description: "Open Vantage configuration menu.",
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
    console.warn("[Vantage] Custom command unavailable: " + e);
}
try {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id !== "vantage:configmenu") return;
        const player = event.sourceEntity;
        if (player) openConfigMenu(player);
    });
} catch (e) {
    console.warn("[Vantage] Script event fallback unavailable: " + e);
}
console.warn("[Vantage] loaded — use /vantage:configmenu to configure.");
