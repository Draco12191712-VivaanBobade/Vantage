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

let running = false;
let intervalId = undefined;

function isValidPlayer(player) {
    if (!player) {
        return false;
    }

    try {
        return typeof player.isValid === "function"
            ? player.isValid()
            : true;
    } catch {
        return false;
    }
}

function update() {
    let players;

    try {
        players = world.getPlayers();
    } catch {
        return;
    }

    for (const player of players) {
        if (!isValidPlayer(player)) {
            continue;
        }
    }
}

export function start() {
    if (running) {
        return;
    }

    running = true;

    intervalId = system.runInterval(
        update,
        TICK_INTERVAL
    );
}

export function stop() {
    if (!running) {
        return;
    }

    running = false;

    if (intervalId !== undefined) {
        try {
            system.clearRun(intervalId);
        } catch {
        }

        intervalId = undefined;
    }
}

export function restart() {
    stop();
    start();
}

export function isRunning() {
    return running;
}

start();