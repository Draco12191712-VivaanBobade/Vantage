import {
    system,
    world
} from "@minecraft/server";

import "./camera/camera.js";
import "./camera/first_person.js";
import "./camera/third_person.js";
import "./camera/transitions.js";
import "./compatibility/animations.js";
import "./compatibility/multiplayer.js";
import "./compatibility/packs.js";
import "./config/config.js";
import "./config/defaults.js";
import "./config/packs.js";
import "./player/pose.js";
import "./player/state.js";
import "./player/visibility.js";
import "./utilities/interpolation.js";
import "./utilities/math.js";
import "./utilities/performance.js";

const TICK_INTERVAL = 1;
const INITIALIZATION_DELAY = 1;
const MAX_ERRORS_PER_TICK = 3;

const runtime = {
    started: false,
    intervalId: undefined,
    initializationId: undefined,
    tick: 0,
    errors: 0,
    lastSuccessfulTick: -1
};

const playerRuntime = new WeakMap();

function isValidPlayer(player) {
    if (!player) {
        return false;
    }

    try {
        if (typeof player.isValid === "function") {
            return player.isValid();
        }

        return true;
    } catch {
        return false;
    }
}

function getPlayerRuntime(player) {
    let data = playerRuntime.get(player);

    if (!data) {
        data = {
            initialized: false,
            lastTick: -1,
            errorCount: 0
        };

        playerRuntime.set(player, data);
    }

    return data;
}

function safeExecute(callback) {
    try {
        callback();
        return true;
    } catch {
        runtime.errors++;
        return false;
    }
}

function initializePlayer(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const data = getPlayerRuntime(player);

    if (data.initialized) {
        return true;
    }

    const stateResult = safeExecute(() => {
        updatePlayerState(
            player,
            runtime.tick
        );
    });

    const visibilityResult = safeExecute(() => {
        updateVisibility(
            player,
            "first_person"
        );
    });

    data.initialized =
        stateResult ||
        visibilityResult;

    data.lastTick = runtime.tick;

    return data.initialized;
}

function updatePlayer(player, tick) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const data = getPlayerRuntime(player);

    if (
        data.lastTick === tick &&
        data.initialized
    ) {
        return true;
    }

    let successful = false;

    if (
        safeExecute(() => {
            updatePlayerState(
                player,
                tick
            );
        })
    ) {
        successful = true;
    }

    if (
        safeExecute(() => {
            updateVisibility(
                player,
                detectCameraMode(player)
            );
        })
    ) {
        successful = true;
    }

    data.initialized =
        data.initialized ||
        successful;

    data.lastTick = tick;

    return successful;
}

function detectCameraMode(player) {
    if (!isValidPlayer(player)) {
        return "first_person";
    }

    try {
        const inputInfo =
            player.inputInfo;

        if (inputInfo) {
            if (
                typeof inputInfo.getMovementVector ===
                "function"
            ) {
                inputInfo.getMovementVector();
            }
        }
    } catch {
    }

    return "first_person";
}

function updateAllPlayers() {
    runtime.tick =
        Number.isFinite(system.currentTick)
            ? system.currentTick
            : runtime.tick + 1;

    runtime.errors = 0;

    let players;

    try {
        players = world.getPlayers();
    } catch {
        return;
    }

    if (!players || players.length === 0) {
        runtime.lastSuccessfulTick =
            runtime.tick;

        return;
    }

    let processed = 0;

    for (const player of players) {
        if (
            processed >=
            players.length
        ) {
            break;
        }

        if (!isValidPlayer(player)) {
            continue;
        }

        if (
            runtime.errors >=
            MAX_ERRORS_PER_TICK
        ) {
            break;
        }

        if (
            updatePlayer(
                player,
                runtime.tick
            )
        ) {
            processed++;
        }
    }

    runtime.lastSuccessfulTick =
        runtime.tick;
}

function handlePlayerSpawn(event) {
    const player =
        event?.player;

    if (!isValidPlayer(player)) {
        return;
    }

    const initialize = () => {
        if (!isValidPlayer(player)) {
            return;
        }

        initializePlayer(player);
    };

    try {
        system.runTimeout(
            initialize,
            INITIALIZATION_DELAY
        );
    } catch {
        initialize();
    }
}

function handlePlayerLeave(event) {
    const playerId =
        event?.playerId;

    if (
        typeof playerId !== "string" &&
        typeof playerId !== "number"
    ) {
        return;
    }

    const players = (() => {
        try {
            return world.getPlayers();
        } catch {
            return [];
        }
    })();

    for (const player of players) {
        try {
            if (player.id !== playerId) {
                continue;
            }

            resetPlayer(player);
        } catch {
        }
    }
}

function resetPlayer(player) {
    if (!player) {
        return false;
    }

    let result = false;

    try {
        result =
            resetPlayerState(player) ||
            result;
    } catch {
    }

    try {
        result =
            resetVisibility(player) ||
            result;
    } catch {
    }

    try {
        playerRuntime.delete(player);
    } catch {
    }

    return result;
}

function subscribeToEvents() {
    try {
        world.afterEvents.playerSpawn.subscribe(
            handlePlayerSpawn
        );
    } catch {
    }

    try {
        world.afterEvents.playerLeave.subscribe(
            handlePlayerLeave
        );
    } catch {
    }
}

function startUpdateLoop() {
    if (runtime.intervalId !== undefined) {
        return;
    }

    runtime.intervalId =
        system.runInterval(
            updateAllPlayers,
            TICK_INTERVAL
        );
}

function initializeExistingPlayers() {
    try {
        const players =
            world.getPlayers();

        for (const player of players) {
            initializePlayer(player);
        }
    } catch {
    }
}

function start() {
    if (runtime.started) {
        return;
    }

    runtime.started = true;

    subscribeToEvents();

    try {
        runtime.initializationId =
            system.runTimeout(() => {
                initializeExistingPlayers();
            }, INITIALIZATION_DELAY);
    } catch {
        initializeExistingPlayers();
    }

    startUpdateLoop();
}

function stop() {
    if (!runtime.started) {
        return;
    }

    runtime.started = false;

    if (
        runtime.intervalId !== undefined
    ) {
        try {
            system.clearRun(
                runtime.intervalId
            );
        } catch {
        }

        runtime.intervalId =
            undefined;
    }

    if (
        runtime.initializationId !==
        undefined
    ) {
        try {
            system.clearRun(
                runtime.initializationId
            );
        } catch {
        }

        runtime.initializationId =
            undefined;
    }
}

export function getRuntimeStatus() {
    return {
        started: runtime.started,
        tick: runtime.tick,
        lastSuccessfulTick:
            runtime.lastSuccessfulTick,
        errors: runtime.errors,
        running:
            runtime.intervalId !== undefined
    };
}

export function isRunning() {
    return runtime.started;
}

export function getCurrentTick() {
    return runtime.tick;
}

export function restart() {
    stop();
    start();
}

export function initialize() {
    start();
}

start();