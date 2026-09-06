/**
* Vantage - Dynamic First-Person Body
* ==================================================================
* v1.1.0 - camera handover fixes (focus-group report)
*
* 1. Turning Vantage off left a camera PRESET active. v1.0.0 fell back to
*    `setCamera("minecraft:first_person")`, and that is still a preset: the
*    perspective key stays locked and the client stays on the preset render
*    path, which draws the local player model. With the head-hide clip
*    already released, the result was staring at the inside of your own head
*    and hat layer with F5 dead. Worse, the single `camera.clear()` on the
*    off-transition was fire-and-forget: the state latched to "off" even if
*    the call threw, so one dropped call stranded the player permanently.
*    Now every non-body state calls `camera.clear()` and re-asserts it for a
*    bounded window. See `handBackToVanilla`.
*
* 2. A held map rendered as a flat item texture instead of opening the map
*    view. The first-person map render is a dedicated engine path that does
*    not exist under a camera preset. Vantage now hands the camera back
*    entirely while a map is held in either hand. See `VANILLA_ITEMS`.
*
* v1.0.0 - full rewrite.
*
* WHY THE PRE-1.0 BUILDS SHOWED NOTHING
* --------------------------------------
* Every bone expression in the old resource-pack animation was gated
* behind `q.is_local_player`:
*
*     "scale":    "(q.is_in_ui || !q.is_local_player) ? 1.0 : 0.0"
*     "position": "(q.is_in_ui || !q.is_local_player) || q.is_swimming ? 0 : 5.5"
*
* `query.is_local_player` is NOT a Bedrock Molang query. An unknown
* query resolves to 0, so `!q.is_local_player` was permanently 1, so
* every expression permanently took its no-op branch: head scale
* always 1.0, waist/leg push-back always 0. The animation played
* correctly and did nothing, on every client, in every build. That is
* the whole reason the body never appeared and why the body-distance
* setting appeared to do nothing - all three variants were equally
* inert.
*
* Per-player scoping never needed a Molang query in the first place:
* `playAnimation(id, { players: [player] })` sends the request to that
* one client only. That is how the reference add-on does it, and this
* build now does the same.
*
* STRUCTURE
* ---------
* Deliberately ONE file. The two prior failures were both module-graph
* failures - a bad signal reference, then a missing module - and each
* one aborted the entire script at import time. A single file cannot
* fail that way.
*
* HOW THE BODY IS RENDERED
* ------------------------
* `vantage:pov` inherits `minecraft:follow_orbit` at radius 0.1, i.e.
* a third-person camera sitting on the head. The engine therefore
* draws the player's real, fully-animated model - torso, limbs, armor,
* held items, skin, cape - with no custom geometry and no override of
* `player.entity.json`. The looping RP animation then scales the head
* to 0 and pushes waist + legs away from the lens so the torso isn't
* flush against the near plane.
*
* Because nothing here replaces the player entity definition, skin
* packs, texture packs, shader/Vibrant Visuals packs and custom
* player-animation packs all continue to work.
*/

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

const VERSION = "1.1.0";

const PRESET = "vantage:pov";

/**
 * v1.1.0 - THERE IS NO "VANILLA PRESET" ANY MORE, AND THAT IS THE FIX.
 *
 * v1.0.0 fell back to `setCamera("minecraft:first_person")`. That is still a
 * camera preset, and while ANY preset is active Bedrock (a) locks the
 * perspective key and (b) keeps the client on the preset render path, which
 * draws the local player model. Combined with the head-hide animation having
 * been released, that is exactly the reported "perspective switching is dead
 * and I'm looking at the inside of my own head/hat layer".
 *
 * The only way to genuinely hand the camera back is `camera.clear()`. Every
 * non-body state now clears instead of presetting.
 */

/** Held indefinitely; re-requesting the same id with 0 releases it. */
const HOLD = 999999;

const ANIMS = ["animation.vantage.body.close", "animation.vantage.body.normal", "animation.vantage.body.far"];
const RELEASE_ANIM = "animation.vantage.release";
const DISTANCE_LABELS = ["Close", "Normal", "Far"];

const KEY_CFG = "vantage:cfg";
const KEY_SEEN = "vantage:seen";

const QUICK_TOGGLE_COOLDOWN = 10;

/**
 * How long to keep re-asserting `camera.clear()` after leaving the body state.
 * A single clear() that throws or lands mid-teleport used to strand the player
 * inside `vantage:pov` forever, because the state latched to "off" regardless
 * of whether the call succeeded. Bounded so it can never fight another
 * add-on's camera for more than a second.
 */
const CLEAR_ASSERT_TICKS = 20;

/** Mounts whose own camera framing makes a head-mounted orbit unusable. */
const VANILLA_MOUNTS = ["minecraft:happy_ghast"];

/**
 * Items whose first-person render is a dedicated engine path that simply does
 * not exist under a camera preset. A held map draws as a flat item texture on
 * the player model instead of opening the map view, so Vantage gets out of the
 * way entirely while one is held - in either hand.
 */
const VANILLA_ITEMS = ["minecraft:filled_map", "minecraft:map"];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** `isValid` has been both a property and a method across API versions. */
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

/* ------------------------------------------------------------------ */
/* config                                                              */
/* ------------------------------------------------------------------ */

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

/** playerId -> config, so the per-tick loop never touches storage. */
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

/* ------------------------------------------------------------------ */
/* state classification                                                */
/* ------------------------------------------------------------------ */

function isCrawling(player) {
    try {
        if (player.isSwimming || player.isGliding) return false;
        // No isCrawling flag exists; a prone player's eye collapses to <1 block.
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

/** True when the engine's own camera should take over completely. */
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
        // Not configurable on purpose: with a map in hand there is no working
        // first-person body mode to offer, so there is nothing to opt into.
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

/* ------------------------------------------------------------------ */
/* per-player application                                              */
/* ------------------------------------------------------------------ */

/** playerId -> { mode, anim, fov, clearTicks } */
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
        /* non-fatal */
    }
}

/** Releases the held clip and neutralises the bones it was driving. */
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
        /* cosmetic only */
    }
}

/**
 * Full handover to the engine: drop the body clip, drop any FOV override, and
 * clear the camera. Used for BOTH "Vantage is off" and every vanilla-fallback
 * state, so there is never a preset left holding the perspective key hostage.
 *
 * `mode` is the state being entered, so re-entering it doesn't re-run the
 * one-shot teardown; the clear itself is re-asserted for a bounded window
 * because the call can fail silently mid-teleport or dimension change.
 */
function handBackToVanilla(player, state, mode) {
    if (state.mode !== mode) {
        releaseBody(player, state);
        if (state.fov !== null) {
            state.fov = null;
            try {
                player.camera.setFov();
            } catch (_e) {
                /* non-fatal */
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
            // Retried next tick - the bounded counter is what makes that safe.
        }
    }
}

function tickPlayer(player) {
    const state = stateOf(player.id);
    const cfg = getCfg(player);

    /* ---- off: Vantage owns nothing, the engine owns everything ---- */
    if (!cfg.enabled) {
        handBackToVanilla(player, state, "off");
        return;
    }

    /* ---- vanilla fallback: same full handover, temporarily ---- */
    if (wantsVanilla(player, cfg)) {
        handBackToVanilla(player, state, "vanilla");
        return;
    }

    /* ---- body visible ---- */
    const wanted = ANIMS[clamp(cfg.distance, 0, 2) | 0] ?? ANIMS[1];

    if (state.anim && state.anim !== wanted) {
        playAnim(player, state.anim, 0);
        state.anim = null;
    }

    // Re-requested every tick on purpose: it costs one native call, it is
    // exactly what the reference add-on does, and it self-heals after a
    // respawn, dimension change, emote or death without any state tracking.
    playAnim(player, wanted, HOLD);
    state.anim = wanted;
    state.mode = "body";
    // Re-arm the clear burst so the *next* handover gets its full retry window.
    state.clearTicks = 0;

    try {
        player.camera.setCamera(PRESET, {
            entityOffset: { x: cfg.offsetX, y: cfg.offsetY, z: cfg.offsetZ },
        });
    } catch (_e) {
        /* camera calls can fail for a tick mid-teleport; retried next tick */
    }

    applyFov(player, state, cfg);
}

/* ------------------------------------------------------------------ */
/* toggle                                                              */
/* ------------------------------------------------------------------ */

function announce(player, enabled) {
    const text = enabled ? "§aVantage: body ON" : "§7Vantage: body OFF";
    try {
        player.onScreenDisplay.setActionBar(text);
    } catch (_e) {
        try {
            player.sendMessage(text);
        } catch (_e2) {
            /* non-fatal */
        }
    }
}

function toggle(player) {
    const cfg = getCfg(player);
    cfg.enabled = !cfg.enabled;
    saveCfg(player, cfg);
    // Apply on the same tick the player asked for it.
    try {
        tickPlayer(player);
    } catch (_e) {
        /* the loop will catch up */
    }
    announce(player, cfg.enabled);
    return cfg.enabled;
}

/* ------------------------------------------------------------------ */
/* menus                                                               */
/* ------------------------------------------------------------------ */

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
        /* non-fatal */
    }
}

async function showSettings(player) {
    const cfg = getCfg(player);

    // Interactive controls only, in a fixed order - formValues is a positional
    // array, so a non-interactive element or a reorder silently shifts values
    // into the wrong fields.
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
    // NOTE: the runtime state is deliberately NOT cleared here. saveCfg has
    // already updated the cache the loop reads, so the next tick picks the
    // change up immediately - and keeping the state means it still remembers
    // which clip is currently held, so a changed body distance releases the
    // old clip before holding the new one. Wiping it would strand the old
    // clip on the client, leaving two animations driving the same bones.
    try {
        player.sendMessage(ok ? "§7[Vantage] Settings saved." : "§c[Vantage] Could not save settings.");
    } catch (_e) {
        /* non-fatal */
    }
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

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
            // Command callbacks run in a read-only context.
            system.run(() => {
                try {
                    if (alive(player)) action(player);
                } catch (_e) {
                    /* non-fatal */
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

    /** playerId -> tick */
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
            /* an input handler must never take the add-on down */
        }
    });

    return true;
});

boot("compat", () => {
    const signal = system.afterEvents?.scriptEventReceive;
    if (!signal?.subscribe) return false;

    // Lets a cooperating first-person add-on stand Vantage down per player:
    //   /scriptevent vantage:suppress true | false
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
                    /* non-fatal */
                }
            });
        } catch (_e) {
            /* non-fatal */
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
        // Config is re-read on demand; drop any cache from a previous session.
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
                /* non-fatal */
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
                // One bad player must never stall the loop for everyone else.
            }
        }
    }, 1);
    return true;
});

console.warn(`[Vantage v${VERSION}] startup - ${report.join(" | ")}`);
