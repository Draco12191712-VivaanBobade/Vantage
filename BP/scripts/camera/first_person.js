import {
    CAMERA_MODES,
    CAMERA_PRESETS,
    setFirstPerson,
    setFov,
    clearFov,
    getFov,
    isFirstPerson,
    isActive,
    isTransitionActive,
    getTransitionProgress,
    updateCamera
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
    exponentialSmoothingVector3
} from "../utilities/interpolation.js";

const DEFAULTS = Object.freeze({
    cameraOffset: Object.freeze({
        x: 0,
        y: 0,
        z: 0
    }),
    fov: null,
    smoothing: 14,
    rotationSmoothing: 18,
    positionSmoothing: 18,
    transitionSpeed: 12,
    minFov: 1,
    maxFov: 179,
    maxDeltaTime: 0.25,
    defaultDeltaTime: 1 / 20
});

const states = new WeakMap();

function createState() {
    return {
        enabled: false,
        initialized: false,
        offset: {
            x: DEFAULTS.cameraOffset.x,
            y: DEFAULTS.cameraOffset.y,
            z: DEFAULTS.cameraOffset.z
        },
        currentOffset: {
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
        currentYaw: 0,
        currentPitch: 0,
        targetYaw: 0,
        targetPitch: 0,
        smoothing: DEFAULTS.smoothing,
        rotationSmoothing: DEFAULTS.rotationSmoothing,
        positionSmoothing: DEFAULTS.positionSmoothing,
        transitionSpeed: DEFAULTS.transitionSpeed,
        lastDeltaTime: DEFAULTS.defaultDeltaTime,
        lastUpdate: 0,
        updateCount: 0,
        transitionProgress: 1,
        cameraOptions: undefined
    };
}

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
        state = createState();
        states.set(player, state);
    }

    return state;
}

function getPlayerRotation(player) {
    try {
        const rotation = player.getRotation();

        return {
            x: sanitizeNumber(rotation?.x, 0),
            y: sanitizeNumber(rotation?.y, 0)
        };
    } catch {
        return {
            x: 0,
            y: 0
        };
    }
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

function initializeRotation(player, state) {
    const rotation =
        normalizeRotation(
            getPlayerRotation(player)
        );

    state.currentPitch = rotation.x;
    state.targetPitch = rotation.x;
    state.currentYaw = rotation.y;
    state.targetYaw = rotation.y;
    state.initialized = true;
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

function sanitizeSmoothing(value, fallback) {
    return Math.max(
        0,
        sanitizeNumber(
            value,
            fallback
        )
    );
}

function sanitizeCameraOptions(options) {
    if (
        options === undefined ||
        options === null ||
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

function copyVector3(value) {
    return {
        x: value.x,
        y: value.y,
        z: value.z
    };
}

function updateRotationState(
    player,
    state,
    deltaTime
) {
    const rotation =
        normalizeRotation(
            getPlayerRotation(player)
        );

    state.targetPitch = rotation.x;
    state.targetYaw = rotation.y;

    const rotationFactor =
        clamp01(
            1 -
            Math.exp(
                -state.rotationSmoothing *
                deltaTime
            )
        );

    state.currentPitch = lerp(
        state.currentPitch,
        state.targetPitch,
        rotationFactor
    );

    state.currentYaw = lerpAngle(
        state.currentYaw,
        state.targetYaw,
        rotationFactor
    );
}

function updateOffsetState(
    state,
    deltaTime
) {
    state.currentOffset =
        exponentialSmoothingVector3(
            state.currentOffset,
            state.targetOffset,
            state.positionSmoothing,
            deltaTime
        );
}

function updateFovState(
    player,
    state,
    deltaTime
) {
    if (
        state.targetFov === null ||
        state.targetFov === undefined
    ) {
        return;
    }

    if (state.fov === null) {
        state.fov = state.targetFov;
        setFov(
            player,
            state.fov
        );
        return;
    }

    if (
        Math.abs(
            state.fov -
            state.targetFov
        ) <= 0.001
    ) {
        state.fov =
            state.targetFov;

        return;
    }

    state.fov =
        exponentialSmoothing(
            state.fov,
            state.targetFov,
            state.smoothing,
            deltaTime
        );

    setFov(
        player,
        state.fov
    );
}

function updateTransitionState(
    player,
    state
) {
    if (
        !isTransitionActive(player)
    ) {
        state.transitionProgress = 1;
        return;
    }

    state.transitionProgress =
        clamp01(
            getTransitionProgress(player)
        );
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
        options.smoothing !== undefined
    ) {
        setSmoothing(
            player,
            options.smoothing
        );
    }

    if (
        options.rotationSmoothing !==
        undefined
    ) {
        setRotationSmoothing(
            player,
            options.rotationSmoothing
        );
    }

    if (
        options.positionSmoothing !==
        undefined
    ) {
        setPositionSmoothing(
            player,
            options.positionSmoothing
        );
    }

    if (
        options.transitionSpeed !==
        undefined
    ) {
        setTransitionSpeed(
            player,
            options.transitionSpeed
        );
    }

    const cameraOptions =
        sanitizeCameraOptions(
            options.cameraOptions
        );

    if (
        !setFirstPerson(
            player,
            cameraOptions
        )
    ) {
        return false;
    }

    state.cameraOptions =
        cameraOptions;

    if (!state.initialized) {
        initializeRotation(
            player,
            state
        );
    }

    state.enabled = true;
    state.lastUpdate = Date.now();

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

    return Boolean(
        getState(player)?.enabled
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
        !isFirstPerson(player) ||
        !isEnabled(player) ||
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
        ? copyVector3(state.offset)
        : null;
}

export function getCurrentCameraOffset(
    player
) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return state
        ? copyVector3(state.currentOffset)
        : null;
}

export function getTargetCameraOffset(
    player
) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return state
        ? copyVector3(state.targetOffset)
        : null;
}

export function setFirstPersonFov(
    player,
    fov
) {
    if (
        !isValidPlayer(player) ||
        fov === null ||
        fov === undefined
    ) {
        return false;
    }

    const value =
        clamp(
            sanitizeNumber(
                fov,
                70
            ),
            DEFAULTS.minFov,
            DEFAULTS.maxFov
        );

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
        fov === null ||
        fov === undefined
    ) {
        return false;
    }

    const value =
        clamp(
            sanitizeNumber(
                fov,
                70
            ),
            DEFAULTS.minFov,
            DEFAULTS.maxFov
        );

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.targetFov = value;

    if (state.fov === null) {
        state.fov = value;
    }

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

export function setSmoothing(
    player,
    smoothing
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.smoothing =
        sanitizeSmoothing(
            smoothing,
            DEFAULTS.smoothing
        );

    return true;
}

export function getSmoothing(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player)?.smoothing ??
        null;
}

export function setRotationSmoothing(
    player,
    smoothing
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.rotationSmoothing =
        sanitizeSmoothing(
            smoothing,
            DEFAULTS.rotationSmoothing
        );

    return true;
}

export function getRotationSmoothing(
    player
) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player)
        ?.rotationSmoothing ??
        null;
}

export function setPositionSmoothing(
    player,
    smoothing
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.positionSmoothing =
        sanitizeSmoothing(
            smoothing,
            DEFAULTS.positionSmoothing
        );

    return true;
}

export function getPositionSmoothing(
    player
) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player)
        ?.positionSmoothing ??
        null;
}

export function setTransitionSpeed(
    player,
    speed
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    state.transitionSpeed =
        sanitizeSmoothing(
            speed,
            DEFAULTS.transitionSpeed
        );

    return true;
}

export function getTransitionSpeed(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player)
        ?.transitionSpeed ??
        null;
}

export function setRotationTarget(
    player,
    rotation
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    const value =
        normalizeRotation(rotation);

    state.targetPitch = value.x;
    state.targetYaw = value.y;

    return true;
}

export function getRotation(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    if (!state) {
        return null;
    }

    return {
        x: state.currentPitch,
        y: state.currentYaw
    };
}

export function getTargetRotation(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    if (!state) {
        return null;
    }

    return {
        x: state.targetPitch,
        y: state.targetYaw
    };
}

export function getTransitionProgressForFirstPerson(
    player
) {
    if (!isValidPlayer(player)) {
        return 1;
    }

    return getState(player)
        ?.transitionProgress ??
        1;
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

    if (
        !isFirstPerson(player)
    ) {
        state.enabled = false;
        return false;
    }

    if (!state.initialized) {
        initializeRotation(
            player,
            state
        );
    }

    updateRotationState(
        player,
        state,
        dt
    );

    updateOffsetState(
        state,
        dt
    );

    updateFovState(
        player,
        state,
        dt
    );

    updateTransitionState(
        player,
        state
    );

    updateCamera(
        player,
        dt
    );

    state.lastUpdate =
        Date.now();

    state.updateCount++;

    return true;
}

export function reset(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    states.delete(player);

    return true;
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
        offset: copyVector3(
            state.offset
        ),
        currentOffset:
            copyVector3(
                state.currentOffset
            ),
        targetOffset:
            copyVector3(
                state.targetOffset
            ),
        fov: state.fov,
        targetFov: state.targetFov,
        rotation: {
            x: state.currentPitch,
            y: state.currentYaw
        },
        targetRotation: {
            x: state.targetPitch,
            y: state.targetYaw
        },
        smoothing: state.smoothing,
        rotationSmoothing:
            state.rotationSmoothing,
        positionSmoothing:
            state.positionSmoothing,
        transitionSpeed:
            state.transitionSpeed,
        transitionProgress:
            state.transitionProgress,
        transitionActive:
            isTransitionActive(player),
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
        smoothing: DEFAULTS.smoothing,
        rotationSmoothing:
            DEFAULTS.rotationSmoothing,
        positionSmoothing:
            DEFAULTS.positionSmoothing,
        transitionSpeed:
            DEFAULTS.transitionSpeed,
        minFov: DEFAULTS.minFov,
        maxFov: DEFAULTS.maxFov,
        maxDeltaTime:
            DEFAULTS.maxDeltaTime,
        defaultDeltaTime:
            DEFAULTS.defaultDeltaTime
    };
}