import {
    world,
    system,
    EquipmentSlot,
    CommandPermissionLevel,
    CustomCommandStatus,
    Player,
    InputButton,
    ButtonState,
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
const VERSION = "1.0.0";
const PRESET = "vantage:pov";
const HOLD = 999999;
const ANIMS = ["animation.vantage.body.close", "animation.vantage.body.normal", "animation.vantage.body.far"];
const RELEASE_ANIM = "animation.vantage.release";
const DISTANCE_LABELS = ["Close", "Normal", "Far"];
const KEY_CFG = "vantage:cfg";
const KEY_SEEN = "vantage:seen";
const QUICK_TOGGLE_COOLDOWN = 10;
const CLEAR_ASSERT_TICKS = 20;
const VANILLA_MOUNTS = ["minecraft:happy_ghast"];
const VANILLA_ITEMS = ["minecraft:filled_map", "minecraft:map"];
function alive(player) {
    try {
        if (!player) return false;
        return typeof player.isValid === "function" ? player.isValid() : player.isValid !== false;
    } catch (_e) {
        return false;
    }
}
function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}
function defaults() {
    return {
        enabled: true,
        distance: 1,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        fovEnabled: false,
        fov: 70,
        quickToggle: true,
        vanillaGliding: true,
        vanillaCrawling: true,
        vanillaSpyglass: true,
        vanillaRiding: false,
    };
}
const cfgCache = new Map();
function getCfg(player) {
    const cached = cfgCache.get(player.id);
    if (cached) return cached;
    let cfg = defaults();
    try {
        const raw = player.getDynamicProperty(KEY_CFG);
        if (typeof raw === "string") {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                const d = defaults();
                cfg = {
                    enabled: parsed.enabled ?? d.enabled,
                    distance: clamp(parsed.distance ?? d.distance, 0, 2) | 0,
                    offsetX: clamp(parsed.offsetX ?? d.offsetX, -0.5, 0.5),
                    offsetY: clamp(parsed.offsetY ?? d.offsetY, -0.5, 0.5),
                    offsetZ: clamp(parsed.offsetZ ?? d.offsetZ, -0.5, 0.5),
                    fovEnabled: parsed.fovEnabled ?? d.fovEnabled,
                    fov: clamp(parsed.fov ?? d.fov, 30, 110),
                    quickToggle: parsed.quickToggle ?? d.quickToggle,
                    vanillaGliding: parsed.vanillaGliding ?? d.vanillaGliding,
                    vanillaCrawling: parsed.vanillaCrawling ?? d.vanillaCrawling,
                    vanillaSpyglass: parsed.vanillaSpyglass ?? d.vanillaSpyglass,
                    vanillaRiding: parsed.vanillaRiding ?? d.vanillaRiding,
                };
            }
        }
    } catch (_e) {
        cfg = defaults();
    }
    cfgCache.set(player.id, cfg);
    return cfg;
}
function saveCfg(player, cfg) {
    cfgCache.set(player.id, cfg);
    try {
        player.setDynamicProperty(KEY_CFG, JSON.stringify(cfg));
        return true;
    } catch (_e) {
        return false;
    }
}
function isCrawling(player) {
    try {
        if (player.isSwimming || player.isGliding) return false;
        return player.getHeadLocation().y < player.location.y + 1;
    } catch (_e) {
        return false;
    }
}
function mountTypeId(player) {
    try {
        return player.getComponent("minecraft:riding")?.entityRidingOn?.typeId;
    } catch (_e) {
        return undefined;
    }
}
function heldTypeIds(player) {
    try {
        const eq = player.getComponent("minecraft:equippable");
        if (!eq) return [];
        return [
            eq.getEquipment(EquipmentSlot.Mainhand)?.typeId,
            eq.getEquipment(EquipmentSlot.Offhand)?.typeId,
        ].filter(Boolean);
    } catch (_e) {
        return [];
    }
}
function wantsVanilla(player, cfg) {
    try {
        if (player.isSleeping) return true;

        const mount = mountTypeId(player);
        if (mount) {
            if (VANILLA_MOUNTS.includes(mount)) return true;
            if (cfg.vanillaRiding) return true;
        }
        if (cfg.vanillaGliding && player.isGliding) return true;
        if (cfg.vanillaCrawling && isCrawling(player)) return true;
        const held = heldTypeIds(player);
        if (held.some((id) => VANILLA_ITEMS.includes(id))) return true;
        if (cfg.vanillaSpyglass && held.includes("minecraft:spyglass")) return true;
        const mode = player.getGameMode?.();
        if (mode === "spectator" || mode === "Spectator") return true;
        const health = player.getComponent("minecraft:health");
        if (health && health.currentValue <= 0) return true;
        if (player.getDynamicProperty("vantage:suppressed")) return true;
    } catch (_e) {
        return true;
    }
    return false;
}
const runtime = new Map();
function stateOf(playerId) {
    let s = runtime.get(playerId);
    if (!s) {
        s = { mode: "none", anim: null, fov: null, clearTicks: 0 };
        runtime.set(playerId, s);
    }
    return s;
}
function playAnim(player, id, blendOutTime) {
    try {
        player.playAnimation(id, { players: [player], blendOutTime });
    } catch (_e) {
    }
}
function releaseBody(player, state) {
    if (state.anim) {
        playAnim(player, state.anim, 0);
        state.anim = null;
    }
    playAnim(player, RELEASE_ANIM, 0);
}
function applyFov(player, state, cfg) {
    const target = cfg.fovEnabled ? clamp(cfg.fov, 30, 110) : null;
    if (state.fov === target) return;
    state.fov = target;
    try {
        if (target === null) player.camera.setFov();
        else player.camera.setFov({ fov: target });
    } catch (_e) {
    }
}
function handBackToVanilla(player, state, mode) {
    if (state.mode !== mode) {
        releaseBody(player, state);
        if (state.fov !== null) {
            state.fov = null;
            try {
                player.camera.setFov();
            } catch (_e) {
            }
        }
        state.clearTicks = 0;
        state.mode = mode;
    }
    if (state.clearTicks < CLEAR_ASSERT_TICKS) {
        state.clearTicks++;
        try {
            player.camera.clear();
        } catch (_e) {
        }
    }
}
function tickPlayer(player) {
    const state = stateOf(player.id);
    const cfg = getCfg(player);
    if (!cfg.enabled) {
        handBackToVanilla(player, state, "off");
        return;
    }
    if (wantsVanilla(player, cfg)) {
        handBackToVanilla(player, state, "vanilla");
        return;
    }
    const wanted = ANIMS[clamp(cfg.distance, 0, 2) | 0] ?? ANIMS[1];

    if (state.anim && state.anim !== wanted) {
        playAnim(player, state.anim, 0);
        state.anim = null;
    }
    playAnim(player, wanted, HOLD);
    state.anim = wanted;
    state.mode = "body";
    state.clearTicks = 0;
    try {
        player.camera.setCamera(PRESET, {
            entityOffset: { x: cfg.offsetX, y: cfg.offsetY, z: cfg.offsetZ },
        });
    } catch (_e) {
    }

    applyFov(player, state, cfg);
}
function announce(player, enabled) {
    const text = enabled ? "§aVantage: body ON" : "§7Vantage: body OFF";
    try {
        player.onScreenDisplay.setActionBar(text);
    } catch (_e) {
        try {
            player.sendMessage(text);
        } catch (_e2) {
        }
    }
}
function toggle(player) {
    const cfg = getCfg(player);
    cfg.enabled = !cfg.enabled;
    saveCfg(player, cfg);
    try {
        tickPlayer(player);
    } catch (_e) {
    }
    announce(player, cfg.enabled);
    return cfg.enabled;
}
async function showMenu(player) {
    const cfg = getCfg(player);
    const form = new ActionFormData()
        .title("Vantage")
        .body(
            `First-person body: ${cfg.enabled ? "§aON§r" : "§cOFF§r"}\n` +
            `Distance: §f${DISTANCE_LABELS[cfg.distance] ?? "Normal"}§r\n` +
            `§7Quick toggle: Sneak + Jump§r\n§8v${VERSION}§r`
        )
        .button(cfg.enabled ? "Turn Off" : "Turn On")
        .button("Settings")
        .button("Reset to Defaults");
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined) return;
    if (res.selection === 0) return void toggle(player);
    if (res.selection === 1) return void (await showSettings(player));
    saveCfg(player, defaults());
    try {
        player.sendMessage("§7[Vantage] Settings reset.");
    } catch (_e) {
    }
}
async function showSettings(player) {
    const cfg = getCfg(player);
    const form = new ModalFormData()
        .title("Vantage - Settings")
        .toggle("First-person body", { defaultValue: cfg.enabled })
        .dropdown("Body distance", DISTANCE_LABELS, { defaultValueIndex: clamp(cfg.distance, 0, 2) | 0 })
        .slider("Camera left / right", -50, 50, { defaultValue: Math.round(cfg.offsetX * 100), valueStep: 1 })
        .slider("Camera up / down", -50, 50, { defaultValue: Math.round(cfg.offsetY * 100), valueStep: 1 })
        .slider("Camera forward / back", -50, 50, { defaultValue: Math.round(cfg.offsetZ * 100), valueStep: 1 })
        .toggle("Override field of view", { defaultValue: cfg.fovEnabled })
        .slider("Field of view", 30, 110, { defaultValue: clamp(cfg.fov, 30, 110), valueStep: 1 })
        .toggle("Quick toggle (Sneak + Jump)", { defaultValue: cfg.quickToggle })
        .toggle("Vanilla view while gliding", { defaultValue: cfg.vanillaGliding })
        .toggle("Vanilla view while crawling", { defaultValue: cfg.vanillaCrawling })
        .toggle("Vanilla view with spyglass", { defaultValue: cfg.vanillaSpyglass })
        .toggle("Vanilla view while riding", { defaultValue: cfg.vanillaRiding });
    const res = await form.show(player);
    if (res.canceled || !res.formValues) return;
    const v = res.formValues;
    let i = 0;
    const next = {
        enabled: Boolean(v[i++]),
        distance: clamp(Number(v[i++]), 0, 2) | 0,
        offsetX: clamp(Number(v[i++]) / 100, -0.5, 0.5),
        offsetY: clamp(Number(v[i++]) / 100, -0.5, 0.5),
        offsetZ: clamp(Number(v[i++]) / 100, -0.5, 0.5),
        fovEnabled: Boolean(v[i++]),
        fov: clamp(Number(v[i++]), 30, 110),
        quickToggle: Boolean(v[i++]),
        vanillaGliding: Boolean(v[i++]),
        vanillaCrawling: Boolean(v[i++]),
        vanillaSpyglass: Boolean(v[i++]),
        vanillaRiding: Boolean(v[i++]),
    };
    const ok = saveCfg(player, next);
    try {
        player.sendMessage(ok ? "§7[Vantage] Settings saved." : "§c[Vantage] Could not save settings.");
    } catch (_e) {
    }
}
const report = [];
function boot(label, fn) {
    try {
        const ok = fn();
        report.push(`${label}: ${ok === false ? "unavailable" : "ok"}`);
    } catch (err) {
        report.push(`${label}: FAILED (${err})`);
        console.warn(`[Vantage] ${label} failed: ${err}`);
    }
}
boot("commands", () => {
    const startup = system.beforeEvents?.startup;
    if (!startup?.subscribe) return false;
    startup.subscribe((init) => {
        const registry = init.customCommandRegistry;
        if (!registry?.registerCommand) return;
        const meta = (name, description) => ({
            name,
            description,
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
        });
        const run = (origin, action) => {
            const player = origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;
            if (!player) return { status: CustomCommandStatus.Failure, message: "Players only." };
            system.run(() => {
                try {
                    if (alive(player)) action(player);
                } catch (_e) {
                }
            });
            return { status: CustomCommandStatus.Success };
        };
        registry.registerCommand(meta("vantage:vantage", "Open the Vantage menu."), (o) => run(o, showMenu));
        registry.registerCommand(meta("vantage:toggle", "Toggle the first-person body."), (o) => run(o, toggle));
        registry.registerCommand(meta("vantage:config", "Open Vantage settings."), (o) => run(o, showSettings));
    });
    return true;
});
boot("quick-toggle", () => {
    const signal = world.afterEvents?.playerButtonInput;
    if (!signal?.subscribe) return false;
    const lastToggle = new Map();
    signal.subscribe((event) => {
        try {
            if (event.button !== InputButton.Jump) return;
            if (event.newButtonState !== ButtonState.Pressed) return;
            const player = event.player;
            if (!alive(player)) return;
            if (!getCfg(player).quickToggle) return;
            let sneaking = false;
            try {
                sneaking = player.inputInfo?.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
            } catch (_e) {
                sneaking = false;
            }
            if (!sneaking) sneaking = player.isSneaking === true;
            if (!sneaking) return;
            const now = system.currentTick;
            if (now - (lastToggle.get(player.id) ?? -Infinity) < QUICK_TOGGLE_COOLDOWN) return;
            lastToggle.set(player.id, now);
            system.run(() => {
                if (alive(player)) toggle(player);
            });
        } catch (_e) {
        }
    });

    return true;
});
boot("compat", () => {
    const signal = system.afterEvents?.scriptEventReceive;
    if (!signal?.subscribe) return false;
    signal.subscribe((event) => {
        try {
            if (event.id !== "vantage:suppress") return;
            const source = event.sourceEntity;
            if (source?.typeId !== "minecraft:player") return;
            const on = String(event.message).trim().toLowerCase() === "true";
            system.run(() => {
                try {
                    source.setDynamicProperty("vantage:suppressed", on);
                } catch (_e) {
                }
            });
        } catch (_e) {
        }
    });

    return true;
});
boot("player-events", () => {
    world.afterEvents.playerLeave.subscribe((event) => {
        runtime.delete(event.playerId);
        cfgCache.delete(event.playerId);
    });
    world.afterEvents.playerSpawn.subscribe((event) => {
        if (!event.initialSpawn) return;
        const player = event.player;
        cfgCache.delete(player.id);
        runtime.delete(player.id);
        system.runTimeout(() => {
            try {
                if (!alive(player) || player.getDynamicProperty(KEY_SEEN)) return;
                player.setDynamicProperty(KEY_SEEN, true);
                player.sendMessage(
                    `§7[§9§lVantage§r§7 v${VERSION}]§r First-person body is §aon§r.\n` +
                    "§7Toggle: §fSneak + Jump§7 or §f/vantage§7."
                );
            } catch (_e) {
            }
        }, 60);
    });
    return true;
});
boot("loop", () => {
    system.runInterval(() => {
        for (const player of world.getAllPlayers()) {
            try {
                if (alive(player)) tickPlayer(player);
            } catch (_e) {
            }
        }
    }, 1);
    return true;
});
console.warn(`[Vantage v${VERSION}] startup - ${report.join(" | ")}`);