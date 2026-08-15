import {
    CAMERA_MODES,
    setMode,
    getMode,
    isFirstPerson,
    isThirdPerson
} from "./camera.js";

const DEFAULTS = Object.freeze({
    duration: 0.15,
    easeType: "in_out_cubic",
    minimumDuration: 0,
    maximumDuration: 2
});

const states = new WeakMap();

function isValidPlayer(player) {
    if (!player) {
        return false;
    }

    try {
        return (
            typeof player.isValid === "function" &&
            player.isValid()
        );
    } catch {
        return false;
    }
}

function getState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    let state = states.get(player);

    if (!state) {
        state = {
            active: false,
            from: getMode(player),
            to: getMode(player),
            elapsed: 0,
            duration: DEFAULTS.duration,
            progress: 1,
            started: false,
            completed: false,
            interrupted: false,
            easeType: DEFAULTS.easeType
        };

        states.set(player, state);
    }

    return state;
}

function sanitizeNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function normalizeDuration(value) {
    return Math.min(
        DEFAULTS.maximumDuration,
        Math.max(
            DEFAULTS.minimumDuration,
            sanitizeNumber(
                value,
                DEFAULTS.duration
            )
        )
    );
}

function normalizeEaseType(value) {
    if (typeof value !== "string") {
        return DEFAULTS.easeType;
    }

    const normalized = value.trim();

    return normalized.length > 0
        ? normalized
        : DEFAULTS.easeType;
}

function normalizeMode(mode) {
    if (
        mode === CAMERA_MODES.FIRST_PERSON ||
        mode === CAMERA_MODES.THIRD_PERSON
    ) {
        return mode;
    }

    return null;
}

function resetRuntimeState(state) {
    state.active = false;
    state.elapsed = 0;
    state.progress = 1;
    state.started = false;
}

function finishState(state, completed) {
    state.active = false;
    state.elapsed = state.duration;
    state.progress = 1;
    state.started = false;
    state.completed = completed;
}

export function begin(
    player,
    targetMode,
    options = {}
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const normalizedTarget =
        normalizeMode(targetMode);

    if (!normalizedTarget) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    const currentMode = getMode(player);

    const duration =
        normalizeDuration(
            options.duration
        );

    const easeType =
        normalizeEaseType(
            options.easeType
        );

    if (
        currentMode === normalizedTarget &&
        !state.active
    ) {
        state.from = currentMode;
        state.to = normalizedTarget;
        state.duration = duration;
        state.elapsed = duration;
        state.progress = 1;
        state.started = false;
        state.completed = true;
        state.interrupted = false;
        state.easeType = easeType;

        return true;
    }

    state.from = currentMode;
    state.to = normalizedTarget;
    state.duration = duration;
    state.elapsed = 0;
    state.progress = 0;
    state.started = true;
    state.completed = false;
    state.interrupted = false;
    state.easeType = easeType;
    state.active = true;

    const cameraOptions = {
        easeOptions: {
            easeTime: duration,
            easeType
        }
    };

    const success = setMode(
        player,
        normalizedTarget,
        cameraOptions
    );

    if (!success) {
        state.active = false;
        state.started = false;
        state.interrupted = true;
        state.completed = false;

        return false;
    }

    if (duration <= 0) {
        finishState(state, true);
        return true;
    }

    return true;
}

export function update(
    player,
    deltaTime = 1 / 20
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state || !state.active) {
        return false;
    }

    const dt = Math.min(
        0.25,
        Math.max(
            0,
            sanitizeNumber(
                deltaTime,
                1 / 20
            )
        )
    );

    if (dt <= 0) {
        return true;
    }

    state.elapsed = Math.min(
        state.duration,
        state.elapsed + dt
    );

    state.progress =
        state.duration <= 0
            ? 1
            : Math.min(
                1,
                state.elapsed /
                state.duration
            );

    const currentMode =
        getMode(player);

    if (
        currentMode !== state.from &&
        currentMode !== state.to
    ) {
        state.interrupted = true;
        state.active = false;
        state.started = false;
        state.completed = false;

        return false;
    }

    if (
        state.progress >= 1
    ) {
        finishState(
            state,
            currentMode === state.to
        );

        return currentMode === state.to;
    }

    return true;
}

export function cancel(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state || !state.active) {
        return false;
    }

    state.active = false;
    state.started = false;
    state.interrupted = true;
    state.completed = false;

    state.progress = Math.min(
        1,
        Math.max(
            0,
            state.progress
        )
    );

    return true;
}

export function completeTransition(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state || !state.active) {
        return false;
    }

    const success = setMode(
        player,
        state.to
    );

    finishState(
        state,
        success
    );

    if (!success) {
        state.interrupted = true;
    }

    return success;
}

export function transitionToFirstPerson(
    player,
    options = {}
) {
    return begin(
        player,
        CAMERA_MODES.FIRST_PERSON,
        options
    );
}

export function transitionToThirdPerson(
    player,
    options = {}
) {
    return begin(
        player,
        CAMERA_MODES.THIRD_PERSON,
        options
    );
}

export function isActive(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return Boolean(
        getState(player)?.active
    );
}

export function getProgress(player) {
    if (!isValidPlayer(player)) {
        return 1;
    }

    return getState(player)?.progress ?? 1;
}

export function getElapsed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getState(player)?.elapsed ?? 0;
}

export function getDuration(player) {
    if (!isValidPlayer(player)) {
        return DEFAULTS.duration;
    }

    return getState(player)?.duration ??
        DEFAULTS.duration;
}

export function getTransitionState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    if (!state) {
        return null;
    }

    return {
        active: state.active,
        from: state.from,
        to: state.to,
        elapsed: state.elapsed,
        duration: state.duration,
        progress: state.progress,
        started: state.started,
        completed: state.completed,
        interrupted: state.interrupted,
        easeType: state.easeType
    };
}

export function getTransitionMode(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    if (!state) {
        return null;
    }

    return state.active
        ? state.to
        : getMode(player);
}

export function isTransitioningToFirstPerson(
    player
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    return Boolean(
        state &&
        state.active &&
        state.to === CAMERA_MODES.FIRST_PERSON
    );
}

export function isTransitioningToThirdPerson(
    player
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    return Boolean(
        state &&
        state.active &&
        state.to === CAMERA_MODES.THIRD_PERSON
    );
}

export function isCurrentlyFirstPerson(
    player
) {
    return (
        isValidPlayer(player) &&
        isFirstPerson(player)
    );
}

export function isCurrentlyThirdPerson(
    player
) {
    return (
        isValidPlayer(player) &&
        isThirdPerson(player)
    );
}

export function hasCompleted(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return Boolean(
        getState(player)?.completed
    );
}

export function wasInterrupted(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return Boolean(
        getState(player)?.interrupted
    );
}

export function setTransitionDuration(
    player,
    duration
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.duration =
        normalizeDuration(duration);

    if (
        state.active &&
        state.elapsed > state.duration
    ) {
        state.elapsed = state.duration;
    }

    return true;
}

export function getTransitionEaseType(player) {
    if (!isValidPlayer(player)) {
        return DEFAULTS.easeType;
    }

    return getState(player)?.easeType ??
        DEFAULTS.easeType;
}

export function setTransitionEaseType(
    player,
    easeType
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.easeType =
        normalizeEaseType(easeType);

    return true;
}

export function reset(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return states.delete(player);
}

export function resetAll(players) {
    if (!players) {
        return 0;
    }

    let count = 0;

    for (const player of players) {
        if (reset(player)) {
            count++;
        }
    }

    return count;
}

export function getDefaults() {
    return {
        duration: DEFAULTS.duration,
        easeType: DEFAULTS.easeType,
        minimumDuration:
            DEFAULTS.minimumDuration,
        maximumDuration:
            DEFAULTS.maximumDuration
    };
} // YAEY!! IM DONE!! =D