import {
    CAMERA_MODES,
    setMode,
    getMode,
    isFirstPerson,
    isThirdPerson
} from "./camera.js";

import {
    clamp,
    clamp01,
    lerp,
    lerpAngle,
    normalizeAngle,
    sanitizeNumber,
    sanitizeVector3
} from "../utilities/math.js";

import {
    exponentialSmoothing,
    exponentialSmoothingAngle,
    exponentialSmoothingVector3
} from "../utilities/interpolation.js";

const DEFAULTS = Object.freeze({
    duration: 0.2,
    positionSmoothing: 16,
    rotationSmoothing: 18,
    minimumDuration: 0,
    maximumDuration: 10,
    minimumSmoothing: 0,
    maximumSmoothing: 120
});

const states = new WeakMap();

function isValidPlayer(player) {
    return Boolean(
        player &&
        typeof player.isValid === "function" &&
        player.isValid()
    );
}

function createState() {
    return {
        active: false,
        from: CAMERA_MODES.FIRST_PERSON,
        to: CAMERA_MODES.FIRST_PERSON,
        elapsed: 0,
        duration: DEFAULTS.duration,
        progress: 0,
        positionSmoothing: DEFAULTS.positionSmoothing,
        rotationSmoothing: DEFAULTS.rotationSmoothing,
        startOffset: {
            x: 0,
            y: 0,
            z: 0
        },
        targetOffset: {
            x: 0,
            y: 0,
            z: 0
        },
        currentOffset: {
            x: 0,
            y: 0,
            z: 0
        },
        startRotation: {
            x: 0,
            y: 0
        },
        targetRotation: {
            x: 0,
            y: 0
        },
        currentRotation: {
            x: 0,
            y: 0
        },
        started: false,
        completed: false,
        interrupted: false
    };
}

function getState(player) {
    let state = states.get(player);

    if (!state) {
        state = createState();
        states.set(player, state);
    }

    return state;
}

function getPlayerRotation(player) {
    try {
        const rotation = player.getRotation();

        return {
            x: clamp(
                sanitizeNumber(rotation?.x, 0),
                -90,
                90
            ),
            y: normalizeAngle(
                sanitizeNumber(rotation?.y, 0)
            )
        };
    } catch {
        return {
            x: 0,
            y: 0
        };
    }
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

function normalizeDuration(duration) {
    return clamp(
        sanitizeNumber(duration, DEFAULTS.duration),
        DEFAULTS.minimumDuration,
        DEFAULTS.maximumDuration
    );
}

function normalizeSmoothing(value, fallback) {
    return clamp(
        Math.max(
            DEFAULTS.minimumSmoothing,
            sanitizeNumber(value, fallback)
        ),
        DEFAULTS.minimumSmoothing,
        DEFAULTS.maximumSmoothing
    );
}

function normalizeRotation(rotation) {
    return {
        x: clamp(
            sanitizeNumber(rotation?.x, 0),
            -90,
            90
        ),
        y: normalizeAngle(
            sanitizeNumber(rotation?.y, 0)
        )
    };
}

function copyVector(vector) {
    return {
        x: vector.x,
        y: vector.y,
        z: vector.z
    };
}

function copyRotation(rotation) {
    return {
        x: rotation.x,
        y: rotation.y
    };
}

function easeInOut(progress) {
    const t = clamp01(progress);
    return t * t * (3 - 2 * t);
}

function resetRuntimeState(state) {
    state.active = false;
    state.elapsed = 0;
    state.progress = 0;
    state.started = false;
    state.completed = false;
    state.interrupted = false;
}

function complete(player, state) {
    state.elapsed = state.duration;
    state.progress = 1;

    state.currentOffset = copyVector(state.targetOffset);
    state.currentRotation = copyRotation(state.targetRotation);

    const success = setMode(player, state.to);

    state.active = false;
    state.completed = success;
    state.started = false;

    return success;
}

function abort(state) {
    state.active = false;
    state.started = false;
    state.interrupted = true;
    state.completed = false;
}

export function begin(player, targetMode, options = {}) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const normalizedTarget = normalizeMode(targetMode);

    if (!normalizedTarget) {
        return false;
    }

    const currentMode = getMode(player);
    const state = getState(player);

    if (
        currentMode === normalizedTarget &&
        !state.active
    ) {
        state.from = currentMode;
        state.to = normalizedTarget;
        state.progress = 1;
        state.elapsed = 0;
        state.completed = true;
        state.interrupted = false;

        return true;
    }

    const currentRotation = getPlayerRotation(player);

    const startOffset = sanitizeVector3(
        options.startOffset ?? state.currentOffset
    );

    const targetOffset = sanitizeVector3(
        options.targetOffset ?? { x: 0, y: 0, z: 0 }
    );

    const startRotation = normalizeRotation(
        options.startRotation ?? (
            state.active
                ? state.currentRotation
                : currentRotation
        )
    );

    const targetRotation = normalizeRotation(
        options.targetRotation ?? currentRotation
    );

    state.active = true;
    state.from = currentMode;
    state.to = normalizedTarget;
    state.elapsed = 0;
    state.duration = normalizeDuration(options.duration);
    state.progress = 0;

    state.positionSmoothing = normalizeSmoothing(
        options.positionSmoothing,
        DEFAULTS.positionSmoothing
    );

    state.rotationSmoothing = normalizeSmoothing(
        options.rotationSmoothing,
        DEFAULTS.rotationSmoothing
    );

    state.startOffset = copyVector(startOffset);
    state.targetOffset = copyVector(targetOffset);
    state.currentOffset = copyVector(startOffset);

    state.startRotation = copyRotation(startRotation);
    state.targetRotation = copyRotation(targetRotation);
    state.currentRotation = copyRotation(startRotation);

    state.started = true;
    state.completed = false;
    state.interrupted = false;

    if (state.duration <= 0) {
        return complete(player, state);
    }

    return true;
}

export function update(player, deltaTime = 1 / 20) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state.active) {
        return false;
    }

    const dt = clamp(
        Math.max(
            0,
            sanitizeNumber(deltaTime, 1 / 20)
        ),
        0,
        0.25
    );

    if (dt <= 0) {
        return true;
    }

    state.elapsed = Math.min(
        state.duration,
        state.elapsed + dt
    );

    const linearProgress = state.duration <= 0
        ? 1
        : clamp01(state.elapsed / state.duration);

    const progress = easeInOut(linearProgress);

    state.progress = linearProgress;

    const targetOffset = {
        x: lerp(
            state.startOffset.x,
            state.targetOffset.x,
            progress
        ),
        y: lerp(
            state.startOffset.y,
            state.targetOffset.y,
            progress
        ),
        z: lerp(
            state.startOffset.z,
            state.targetOffset.z,
            progress
        )
    };

    const targetRotation = {
        x: lerp(
            state.startRotation.x,
            state.targetRotation.x,
            progress
        ),
        y: lerpAngle(
            state.startRotation.y,
            state.targetRotation.y,
            progress
        )
    };

    state.currentOffset = exponentialSmoothingVector3(
        state.currentOffset,
        targetOffset,
        state.positionSmoothing,
        dt
    );

    state.currentRotation.x = exponentialSmoothing(
        state.currentRotation.x,
        targetRotation.x,
        state.rotationSmoothing,
        dt
    );

    state.currentRotation.y = exponentialSmoothingAngle(
        state.currentRotation.y,
        targetRotation.y,
        state.rotationSmoothing,
        dt
    );

    if (linearProgress >= 1) {
        return complete(player, state);
    }

    return true;
}

export function cancel(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state.active) {
        return false;
    }

    abort(state);

    return true;
}

export function completeTransition(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state.active) {
        return false;
    }

    return complete(player, state);
}

export function transitionToFirstPerson(player, options = {}) {
    return begin(
        player,
        CAMERA_MODES.FIRST_PERSON,
        options
    );
}

export function transitionToThirdPerson(player, options = {}) {
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

    return getState(player).active;
}

export function getProgress(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getState(player).progress;
}

export function getElapsed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getState(player).elapsed;
}

export function getDuration(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getState(player).duration;
}

export function getCurrentOffset(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return copyVector(
        getState(player).currentOffset
    );
}

export function getCurrentRotation(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return copyRotation(
        getState(player).currentRotation
    );
}

export function getStartOffset(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return copyVector(
        getState(player).startOffset
    );
}

export function getTargetOffset(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return copyVector(
        getState(player).targetOffset
    );
}

export function getStartRotation(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return copyRotation(
        getState(player).startRotation
    );
}

export function getTargetRotation(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return copyRotation(
        getState(player).targetRotation
    );
}

export function getTransitionState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return {
        active: state.active,
        from: state.from,
        to: state.to,
        elapsed: state.elapsed,
        duration: state.duration,
        progress: state.progress,
        positionSmoothing: state.positionSmoothing,
        rotationSmoothing: state.rotationSmoothing,
        started: state.started,
        completed: state.completed,
        interrupted: state.interrupted,
        startOffset: copyVector(state.startOffset),
        targetOffset: copyVector(state.targetOffset),
        currentOffset: copyVector(state.currentOffset),
        startRotation: copyRotation(state.startRotation),
        targetRotation: copyRotation(state.targetRotation),
        currentRotation: copyRotation(state.currentRotation)
    };
}

export function reset(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    states.delete(player);

    return true;
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

export function isTransitioningToFirstPerson(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    return (
        state.active &&
        state.to === CAMERA_MODES.FIRST_PERSON
    );
}

export function isTransitioningToThirdPerson(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    return (
        state.active &&
        state.to === CAMERA_MODES.THIRD_PERSON
    );
}

export function isCurrentlyFirstPerson(player) {
    return isValidPlayer(player) && isFirstPerson(player);
}

export function isCurrentlyThirdPerson(player) {
    return isValidPlayer(player) && isThirdPerson(player);
}

export function getTransitionMode(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return state.active
        ? state.to
        : getMode(player);
}

export function hasCompleted(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).completed;
}

export function wasInterrupted(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).interrupted;
}

export function setTransitionDuration(player, duration) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    state.duration = normalizeDuration(duration);

    if (state.active) {
        state.elapsed = Math.min(
            state.elapsed,
            state.duration
        );
    }

    return true;
}

export function setPositionSmoothing(player, smoothing) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    state.positionSmoothing = normalizeSmoothing(
        smoothing,
        state.positionSmoothing
    );

    return true;
}

export function setRotationSmoothing(player, smoothing) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    state.rotationSmoothing = normalizeSmoothing(
        smoothing,
        state.rotationSmoothing
    );

    return true;
} // YAEY, IM DONE!! =D