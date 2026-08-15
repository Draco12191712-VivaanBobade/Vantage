import {
    CAMERA_MODES,
    CAMERA_PRESETS,
    setFirstPerson,
    setFov,
    clearFov,
    getFov,
    isFirstPerson,
    isActive,
    updateCamera
} from "./camera.js";

import {
    clamp,
    sanitizeNumber,
    sanitizeVector3
} from "../utilities/math.js";

const DEFAULTS = Object.freeze({
    cameraOffset: Object.freeze({
        x: 0,
        y: 0,
        z: 0
    }),
    fov: null,
    minFov: 1,
    maxFov: 179,
    defaultDeltaTime: 1 / 20,
    maxDeltaTime: 0.25
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

function createState() {
    return {
        enabled: false,
        initialized: false,

        offset: {
            x: DEFAULTS.cameraOffset.x,
            y: DEFAULTS.cameraOffset.y,
            z: DEFAULTS.cameraOffset.z
        },

        targetOffset: {
            x: DEFAULTS.cameraOffset.x,
            y: DEFAULTS.cameraOffset.y,
            z: DEFAULTS.cameraOffset.z
        },

        fov: DEFAULTS.fov,
        targetFov: DEFAULTS.fov,

        cameraOptions: undefined,

        lastDeltaTime:
            DEFAULTS.defaultDeltaTime,

        lastUpdate: 0,
        updateCount: 0
    };
}

function getState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    let state = states.get(player);

    if (!state) {
        state = createState();
        states.set(player, state);
    }

    return state;
}

function normalizeDeltaTime(deltaTime) {
    return clamp(
        sanitizeNumber(
            deltaTime,
            DEFAULTS.defaultDeltaTime
        ),
        0,
        DEFAULTS.maxDeltaTime
    );
}

function normalizeFov(fov) {
    if (!Number.isFinite(fov)) {
        return null;
    }

    return clamp(
        fov,
        DEFAULTS.minFov,
        DEFAULTS.maxFov
    );
}

function cloneVector3(value) {
    return {
        x: sanitizeNumber(value?.x, 0),
        y: sanitizeNumber(value?.y, 0),
        z: sanitizeNumber(value?.z, 0)
    };
}

function cloneOptions(options) {
    if (
        options === undefined ||
        options === null
    ) {
        return undefined;
    }

    if (
        typeof options !== "object" ||
        Array.isArray(options)
    ) {
        return undefined;
    }

    try {
        return JSON.parse(
            JSON.stringify(options)
        );
    } catch {
        return undefined;
    }
}

function normalizeCameraOptions(options) {
    const normalized =
        cloneOptions(options);

    if (!normalized) {
        return undefined;
    }

    return normalized;
}

function buildCameraOptions(state) {
    const options =
        cloneOptions(
            state.cameraOptions
        ) ?? {};

    const offset =
        cloneVector3(
            state.targetOffset
        );

    if (
        offset.x !== 0 ||
        offset.y !== 0 ||
        offset.z !== 0
    ) {
        options.location = {
            x: offset.x,
            y: offset.y,
            z: offset.z
        };
    }

    return Object.keys(options).length > 0
        ? options
        : undefined;
}

function applyFov(player, state) {
    if (
        state.targetFov === null ||
        state.targetFov === undefined
    ) {
        return true;
    }

    const value =
        normalizeFov(
            state.targetFov
        );

    if (value === null) {
        return false;
    }

    if (
        state.fov !== null &&
        Math.abs(state.fov - value) < 0.001
    ) {
        return true;
    }

    if (
        !setFov(
            player,
            value
        )
    ) {
        return false;
    }

    state.fov = value;

    return true;
}

export function enable(
    player,
    options = {}
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    if (
        options &&
        typeof options === "object"
    ) {
        if (
            options.offset !== undefined
        ) {
            setCameraOffset(
                player,
                options.offset
            );
        }

        if (
            options.fov !== undefined
        ) {
            setFirstPersonFov(
                player,
                options.fov
            );
        }

        if (
            options.cameraOptions !== undefined
        ) {
            state.cameraOptions =
                normalizeCameraOptions(
                    options.cameraOptions
                );
        }
    }

    const cameraOptions =
        buildCameraOptions(state);

    if (
        !setFirstPerson(
            player,
            cameraOptions
        )
    ) {
        return false;
    }

    state.enabled = true;
    state.initialized = true;
    state.lastUpdate = Date.now();

    applyFov(
        player,
        state
    );

    return true;
}

export function disable(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.enabled = false;

    return true;
}

export function isEnabled(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    return Boolean(
        state?.enabled
    );
}

export function ensureEnabled(
    player,
    options = {}
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (
        !isEnabled(player) ||
        !isFirstPerson(player) ||
        !isActive(player)
    ) {
        return enable(
            player,
            options
        );
    }

    return true;
}

export function setCameraOffset(
    player,
    offset
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    const value =
        sanitizeVector3(offset);

    state.offset = {
        x: value.x,
        y: value.y,
        z: value.z
    };

    state.targetOffset = {
        x: value.x,
        y: value.y,
        z: value.z
    };

    return true;
}

export function setTargetCameraOffset(
    player,
    offset
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    const value =
        sanitizeVector3(offset);

    state.targetOffset = {
        x: value.x,
        y: value.y,
        z: value.z
    };

    return true;
}

export function getCameraOffset(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return state
        ? cloneVector3(state.offset)
        : null;
}

export function getCurrentCameraOffset(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return state
        ? cloneVector3(state.targetOffset)
        : null;
}

export function getTargetCameraOffset(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return state
        ? cloneVector3(state.targetOffset)
        : null;
}

export function setFirstPersonFov(
    player,
    fov
) {
    if (
        !isValidPlayer(player) ||
        !Number.isFinite(fov)
    ) {
        return false;
    }

    const value =
        normalizeFov(fov);

    if (value === null) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.fov = value;
    state.targetFov = value;

    return setFov(
        player,
        value
    );
}

export function setTargetFov(
    player,
    fov
) {
    if (
        !isValidPlayer(player) ||
        !Number.isFinite(fov)
    ) {
        return false;
    }

    const value =
        normalizeFov(fov);

    if (value === null) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.targetFov = value;

    return true;
}

export function resetFov(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.fov = null;
    state.targetFov = null;

    return clearFov(player);
}

export function getConfiguredFov(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return state?.fov ??
        getFov(player);
}

export function getTargetFov(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player)?.targetFov ??
        null;
}

export function setCameraOptions(
    player,
    options
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.cameraOptions =
        normalizeCameraOptions(
            options
        );

    return true;
}

export function getCameraOptions(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    if (!state) {
        return null;
    }

    return cloneOptions(
        state.cameraOptions
    ) ?? null;
}

export function update(
    player,
    deltaTime = DEFAULTS.defaultDeltaTime
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    const dt =
        normalizeDeltaTime(
            deltaTime
        );

    state.lastDeltaTime = dt;

    if (!state.enabled) {
        return false;
    }

    if (!isFirstPerson(player)) {
        state.enabled = false;
        return false;
    }

    if (!isActive(player)) {
        const cameraOptions =
            buildCameraOptions(state);

        if (
            !setFirstPerson(
                player,
                cameraOptions
            )
        ) {
            return false;
        }
    }

    applyFov(
        player,
        state
    );

    updateCamera(
        player,
        dt
    );

    state.lastUpdate = Date.now();
    state.updateCount++;

    return true;
}

export function reset(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return states.delete(player);
}

export function getStateSnapshot(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    if (!state) {
        return null;
    }

    return {
        enabled: state.enabled,
        initialized: state.initialized,

        offset: cloneVector3(
            state.offset
        ),

        targetOffset:
            cloneVector3(
                state.targetOffset
            ),

        fov: state.fov,
        targetFov: state.targetFov,

        cameraOptions:
            cloneOptions(
                state.cameraOptions
            ),

        lastDeltaTime:
            state.lastDeltaTime,

        lastUpdate:
            state.lastUpdate,

        updateCount:
            state.updateCount
    };
}

export function getPresetId() {
    return CAMERA_PRESETS.FIRST_PERSON;
}

export function getMode() {
    return CAMERA_MODES.FIRST_PERSON;
}

export function getDefaults() {
    return {
        cameraOffset: {
            x: DEFAULTS.cameraOffset.x,
            y: DEFAULTS.cameraOffset.y,
            z: DEFAULTS.cameraOffset.z
        },
        fov: DEFAULTS.fov,
        minFov: DEFAULTS.minFov,
        maxFov: DEFAULTS.maxFov,
        defaultDeltaTime:
            DEFAULTS.defaultDeltaTime,
        maxDeltaTime:
            DEFAULTS.maxDeltaTime
    };
}