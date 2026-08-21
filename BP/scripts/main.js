import {
    Player,
    system,
    world,
} from "@minecraft/server";

const VANTAGE = {
    version: "1.0.0",

    animations: {
        firstPerson: "animation.vantage.first_person",
        removeHead: "animation.vantage.remove_head",
        restoreHead: "animation.vantage.restore_head",
    },

    tags: {
        enabled: "vantage:enabled",
        initialized: "vantage:initialized",
    },

    dynamicProperties: {
        enabled: "vantage:enabled",
    },

    timing: {
        updateInterval: 1,
        initializationDelay: 2,
        animationBlend: 0.08,
    },

    compatibility: {
        ignoreSpectator: true,
        ignoreInvalidPlayers: true,
    },
} as const;

type VantageState = {
    enabled: boolean;
    initialized: boolean;
    lastAnimationState: string;
    lastSneaking: boolean;
    lastSwimming: boolean;
    lastGliding: boolean;
    lastSprinting: boolean;
    lastDimension: string;
};

const playerStates = new Map<string, VantageState>();

function createState(): VantageState {
    return {
        enabled: true,
        initialized: false,
        lastAnimationState: "",
        lastSneaking: false,
        lastSwimming: false,
        lastGliding: false,
        lastSprinting: false,
        lastDimension: "",
    };
}

function getState(player: Player): VantageState {
    let state = playerStates.get(player.id);

    if (!state) {
        state = createState();
        playerStates.set(player.id, state);
    }

    return state;
}

function isUsablePlayer(player: Player): boolean {
    if (!player.isValid) {
        return false;
    }

    if (
        VANTAGE.compatibility.ignoreSpectator &&
        player.getGameMode() === "Spectator"
    ) {
        return false;
    }

    return true;
}

function safePlayAnimation(
    player: Player,
    animation: string,
    blendOutTime = VANTAGE.timing.animationBlend,
): boolean {
    try {
        player.playAnimation(animation, {
            players: [player],
            blendOutTime,
        });

        return true;
    } catch {
        return false;
    }
}

function safeAddTag(player: Player, tag: string): void {
    try {
        if (!player.hasTag(tag)) {
            player.addTag(tag);
        }
    } catch { }
}

function safeRemoveTag(player: Player, tag: string): void {
    try {
        if (player.hasTag(tag)) {
            player.removeTag(tag);
        }
    } catch { }
}

function readEnabledState(player: Player): boolean {
    try {
        const value = player.getDynamicProperty(
            VANTAGE.dynamicProperties.enabled,
        );

        if (typeof value === "boolean") {
            return value;
        }
    } catch { }

    return true;
}

function writeEnabledState(
    player: Player,
    enabled: boolean,
): void {
    try {
        player.setDynamicProperty(
            VANTAGE.dynamicProperties.enabled,
            enabled,
        );
    } catch { }
}

function enableFirstPersonBody(player: Player): void {
    if (!isUsablePlayer(player)) {
        return;
    }

    const state = getState(player);

    state.enabled = true;

    writeEnabledState(player, true);

    safeAddTag(player, VANTAGE.tags.enabled);

    safePlayAnimation(
        player,
        VANTAGE.animations.removeHead,
        0,
    );

    safePlayAnimation(
        player,
        VANTAGE.animations.firstPerson,
        VANTAGE.timing.animationBlend,
    );

    state.initialized = true;
}

function disableFirstPersonBody(player: Player): void {
    if (!player.isValid) {
        return;
    }

    const state = getState(player);

    state.enabled = false;

    writeEnabledState(player, false);

    safeRemoveTag(player, VANTAGE.tags.enabled);

    safePlayAnimation(
        player,
        VANTAGE.animations.restoreHead,
        VANTAGE.timing.animationBlend,
    );

    state.initialized = false;
}

function toggleVantage(player: Player): boolean {
    const state = getState(player);

    if (state.enabled) {
        disableFirstPersonBody(player);
        return false;
    }

    enableFirstPersonBody(player);
    return true;
}

function initializePlayer(player: Player): void {
    if (!isUsablePlayer(player)) {
        return;
    }

    const state = getState(player);

    state.enabled = readEnabledState(player);
    state.lastAnimationState = "";
    state.lastSneaking = player.isSneaking;
    state.lastSwimming = player.isSwimming;
    state.lastGliding = player.isGliding;
    state.lastSprinting = player.isSprinting;

    try {
        state.lastDimension = player.dimension.id;
    } catch {
        state.lastDimension = "";
    }

    if (state.enabled) {
        enableFirstPersonBody(player);
    } else {
        disableFirstPersonBody(player);
    }
}

function getMovementState(player: Player): string {
    if (player.isSwimming) {
        return "swimming";
    }

    if (player.isGliding) {
        return "gliding";
    }

    if (player.isSneaking) {
        return "sneaking";
    }

    if (player.isSprinting) {
        return "sprinting";
    }

    return "default";
}

function updateMovementState(player: Player): void {
    if (!isUsablePlayer(player)) {
        return;
    }

    const state = getState(player);

    if (!state.enabled) {
        return;
    }

    const movementState = getMovementState(player);

    const changed =
        movementState !== state.lastAnimationState ||
        player.isSneaking !== state.lastSneaking ||
        player.isSwimming !== state.lastSwimming ||
        player.isGliding !== state.lastGliding ||
        player.isSprinting !== state.lastSprinting;

    if (!changed) {
        return;
    }

    state.lastAnimationState = movementState;
    state.lastSneaking = player.isSneaking;
    state.lastSwimming = player.isSwimming;
    state.lastGliding = player.isGliding;
    state.lastSprinting = player.isSprinting;

    safePlayAnimation(
        player,
        VANTAGE.animations.firstPerson,
        VANTAGE.timing.animationBlend,
    );
}

function checkDimension(player: Player): void {
    if (!player.isValid) {
        return;
    }

    const state = getState(player);

    let dimensionId: string;

    try {
        dimensionId = player.dimension.id;
    } catch {
        return;
    }

    if (!state.lastDimension) {
        state.lastDimension = dimensionId;
        return;
    }

    if (state.lastDimension === dimensionId) {
        return;
    }

    state.lastDimension = dimensionId;

    if (state.enabled) {
        system.runTimeout(() => {
            if (!player.isValid) {
                return;
            }

            enableFirstPersonBody(player);
        }, VANTAGE.timing.initializationDelay);
    }
}

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;

    system.runTimeout(() => {
        if (!player.isValid) {
            return;
        }

        initializePlayer(player);
    }, VANTAGE.timing.initializationDelay);
});

world.afterEvents.playerLeave.subscribe((event) => {
    playerStates.delete(event.playerId);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) {
            continue;
        }

        const state = getState(player);

        if (!state.initialized) {
            if (state.enabled) {
                enableFirstPersonBody(player);
            }

            continue;
        }

        updateMovementState(player);
        checkDimension(player);
    }
}, VANTAGE.timing.updateInterval);

world.afterEvents.scriptEventReceive.subscribe((event) => {
    if (!event.id.startsWith("vantage:")) {
        return;
    }

    const player = event.sourceEntity;

    if (!(player instanceof Player)) {
        return;
    }

    switch (event.id) {
        case "vantage:toggle":
            toggleVantage(player);
            break;

        case "vantage:enable":
            enableFirstPersonBody(player);
            break;

        case "vantage:disable":
            disableFirstPersonBody(player);
            break;

        case "vantage:reload":
            initializePlayer(player);
            break;
    }
});

world.beforeEvents.chatSend.subscribe((event) => {
    if (event.message.toLowerCase() !== "!vantage") {
        return;
    }

    event.cancel = true;

    toggleVantage(event.sender);
});

system.run(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) {
            continue;
        }

        system.runTimeout(() => {
            if (!player.isValid) {
                return;
            }

            initializePlayer(player);
        }, VANTAGE.timing.initializationDelay);
    }
});