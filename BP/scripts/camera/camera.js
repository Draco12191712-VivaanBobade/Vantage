import { clamp } from "../utilities/math.js";
import { normalizeDeltaTime } from "../utilities/performance.js";

export const CAMERA_PRESETS = Object.freeze({
    FIRST_PERSON: "vantage:first_person",
    THIRD_PERSON: "vantage:third_person"
});

export const CAMERA_MODES = Object.freeze({
    FIRST_PERSON: "first_person",
    THIRD_PERSON: "third_person"
});

export const CAMERA_STATUS = Object.freeze({
    INACTIVE: "inactive",
    ACTIVE: "active",
    DEGRADED: "degraded",
    FAILED: "failed"
});

const MIN_FOV = 1;
const MAX_FOV = 179;
const DEFAULT_DELTA_TIME = 1 / 20;
const MAX_DELTA_TIME = 0.25;
const MAX_ERRORS_BEFORE_DEGRADED = 3;

const playerStates = new WeakMap();

let globalRevision = 0;

function createState() {
    return {
        mode: CAMERA_MODES.FIRST_PERSON,
        active: false,
        status: CAMERA_STATUS.INACTIVE,

        preset: null,
        lastPreset: null,

        fov: null,
        lastFov: null,
        fovOverride: false,

        lastOptions: null,

        lastUpdate: 0,
        lastTransition: 0,

        transitionActive: false,
        transitionDuration: 0,
        transitionStart: 0,

        errorCount: 0,
        revision: ++globalRevision
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

    let state = playerStates.get(player);

    if (!state) {
        state = createState();
        playerStates.set(player, state);
    }

    return state;
}

function getCamera(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    try {
        const camera = player.camera;

        if (!camera) {
            return null;
        }

        try {
            if (
                "isValid" in camera &&
                camera.isValid === false
            ) {
                return null;
            }
        } catch {
        }

        return camera;
    } catch {
        return null;
    }
}

function clone(value) {
    if (value === undefined || value === null) {
        return value;
    }

    if (
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function normalizePreset(preset) {
    if (typeof preset !== "string") {
        return null;
    }

    const normalized = preset.trim();

    return normalized.length > 0
        ? normalized
        : null;
}

function normalizeOptions(options) {
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

    return clone(options);
}

function normalizeFov(fov) {
    if (!Number.isFinite(fov)) {
        return null;
    }

    return clamp(
        fov,
        MIN_FOV,
        MAX_FOV
    );
}

function normalizeDelta(deltaTime) {
    const value =
        Number.isFinite(deltaTime)
            ? deltaTime
            : DEFAULT_DELTA_TIME;

    return clamp(
        value,
        0,
        MAX_DELTA_TIME
    );
}

function optionsEqual(a, b) {
    if (a === b) {
        return true;
    }

    if (
        a === undefined ||
        b === undefined
    ) {
        return false;
    }

    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

function getEaseDuration(options) {
    if (!options) {
        return 0;
    }

    if (
        Number.isFinite(options.easeTime)
    ) {
        return Math.max(
            0,
            options.easeTime
        );
    }

    if (
        options.easeOptions &&
        Number.isFinite(
            options.easeOptions.easeTime
        )
    ) {
        return Math.max(
            0,
            options.easeOptions.easeTime
        );
    }

    return 0;
}

function startTransition(
    player,
    duration
) {
    const state = getState(player);

    if (!state) {
        return;
    }

    const normalizedDuration =
        Number.isFinite(duration)
            ? Math.max(0, duration)
            : 0;

    state.transitionDuration =
        normalizedDuration;

    state.transitionActive =
        normalizedDuration > 0;

    state.transitionStart =
        normalizedDuration > 0
            ? Date.now()
            : 0;

    state.lastTransition =
        Date.now();
}

function clearTransition(player) {
    const state = getState(player);

    if (!state) {
        return;
    }

    state.transitionActive = false;
    state.transitionDuration = 0;
    state.transitionStart = 0;
}

function markSuccess(
    player,
    preset,
    options,
    mode = null
) {
    const state = getState(player);

    if (!state) {
        return;
    }

    state.active = true;
    state.status = CAMERA_STATUS.ACTIVE;

    state.preset = preset;
    state.lastPreset = preset;
    state.lastOptions = clone(options);

    state.errorCount = 0;
    state.lastUpdate = Date.now();

    if (mode !== null) {
        state.mode = mode;
    }

    state.revision = ++globalRevision;
}

function markFailure(player) {
    const state = getState(player);

    if (!state) {
        return;
    }

    state.errorCount++;

    if (
        state.errorCount >=
        MAX_ERRORS_BEFORE_DEGRADED
    ) {
        state.status =
            CAMERA_STATUS.DEGRADED;
    } else {
        state.status =
            CAMERA_STATUS.FAILED;
    }

    state.revision = ++globalRevision;
}

function resolveModeFromPreset(preset) {
    if (
        preset ===
        CAMERA_PRESETS.FIRST_PERSON
    ) {
        return CAMERA_MODES.FIRST_PERSON;
    }

    if (
        preset ===
        CAMERA_PRESETS.THIRD_PERSON
    ) {
        return CAMERA_MODES.THIRD_PERSON;
    }

    return null;
}

function resolvePresetFromMode(mode) {
    if (
        mode ===
        CAMERA_MODES.FIRST_PERSON
    ) {
        return CAMERA_PRESETS.FIRST_PERSON;
    }

    if (
        mode ===
        CAMERA_MODES.THIRD_PERSON
    ) {
        return CAMERA_PRESETS.THIRD_PERSON;
    }

    return null;
}

function isSameRequest(
    player,
    preset,
    options
) {
    const state = getState(player);

    if (!state) {
        return false;
    }

    return (
        state.preset === preset &&
        optionsEqual(
            state.lastOptions,
            options
        )
    );
}

function callSetCamera(
    camera,
    preset,
    options
) {
    if (!camera) {
        return false;
    }

    try {
        if (
            options &&
            options.easeOptions &&
            typeof camera.setCameraWithEase ===
            "function"
        ) {
            const {
                easeOptions,
                ...cameraOptions
            } = options;

            if (
                Object.keys(cameraOptions).length ===
                0
            ) {
                camera.setCameraWithEase(
                    preset,
                    easeOptions
                );
            } else {
                camera.setCamera(
                    preset,
                    cameraOptions
                );
            }

            return true;
        }

        if (options !== undefined) {
            camera.setCamera(
                preset,
                options
            );
        } else {
            camera.setCamera(preset);
        }

        return true;
    } catch {
        return false;
    }
}

function applyPreset(
    player,
    preset,
    options,
    mode = null
) {
    const normalizedPreset =
        normalizePreset(preset);

    if (!normalizedPreset) {
        return false;
    }

    const camera = getCamera(player);

    if (!camera) {
        markFailure(player);
        return false;
    }

    const normalizedOptions =
        normalizeOptions(options);

    if (
        isSameRequest(
            player,
            normalizedPreset,
            normalizedOptions
        )
    ) {
        const state = getState(player);

        if (state) {
            state.active = true;
            state.status =
                CAMERA_STATUS.ACTIVE;

            if (mode !== null) {
                state.mode = mode;
            }

            state.lastUpdate = Date.now();
        }

        return true;
    }

    if (
        !callSetCamera(
            camera,
            normalizedPreset,
            normalizedOptions
        )
    ) {
        markFailure(player);
        return false;
    }

    markSuccess(
        player,
        normalizedPreset,
        normalizedOptions,
        mode
    );

    startTransition(
        player,
        getEaseDuration(
            normalizedOptions
        )
    );

    return true;
}

export function setCamera(
    player,
    preset,
    options
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const normalizedPreset =
        normalizePreset(preset);

    const mode =
        resolveModeFromPreset(
            normalizedPreset
        );

    return applyPreset(
        player,
        normalizedPreset,
        options,
        mode
    );
}

export function setFirstPerson(
    player,
    options
) {
    return applyPreset(
        player,
        CAMERA_PRESETS.FIRST_PERSON,
        options,
        CAMERA_MODES.FIRST_PERSON
    );
}

export function setThirdPerson(
    player,
    options
) {
    return applyPreset(
        player,
        CAMERA_PRESETS.THIRD_PERSON,
        options,
        CAMERA_MODES.THIRD_PERSON
    );
}

export function setMode(
    player,
    mode,
    options
) {
    const preset =
        resolvePresetFromMode(mode);

    if (!preset) {
        return false;
    }

    return applyPreset(
        player,
        preset,
        options,
        mode
    );
}

export function getMode(player) {
    const state = getState(player);

    return state
        ? state.mode
        : CAMERA_MODES.FIRST_PERSON;
}

export function isFirstPerson(player) {
    return (
        getMode(player) ===
        CAMERA_MODES.FIRST_PERSON
    );
}

export function isThirdPerson(player) {
    return (
        getMode(player) ===
        CAMERA_MODES.THIRD_PERSON
    );
}

export function isActive(player) {
    const state = getState(player);

    return Boolean(
        state &&
        state.active
    );
}

export function getStatus(player) {
    const state = getState(player);

    return state
        ? state.status
        : CAMERA_STATUS.INACTIVE;
}

export function isDegraded(player) {
    return (
        getStatus(player) ===
        CAMERA_STATUS.DEGRADED
    );
}

export function setDefaultCamera(
    player,
    preset,
    easeOptions
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const camera = getCamera(player);

    if (!camera) {
        return false;
    }

    const normalizedPreset =
        normalizePreset(preset);

    if (!normalizedPreset) {
        return false;
    }

    const normalizedEase =
        normalizeOptions(easeOptions);

    try {
        if (
            normalizedEase !== undefined &&
            typeof camera.setDefaultCamera ===
            "function"
        ) {
            camera.setDefaultCamera(
                normalizedPreset,
                normalizedEase
            );
        } else {
            camera.setDefaultCamera(
                normalizedPreset
            );
        }
    } catch {
        markFailure(player);
        return false;
    }

    const state = getState(player);

    if (state) {
        state.active = true;
        state.status =
            CAMERA_STATUS.ACTIVE;

        state.preset =
            normalizedPreset;

        state.lastPreset =
            normalizedPreset;

        state.lastOptions =
            clone(normalizedEase);

        state.lastUpdate =
            Date.now();

        state.errorCount = 0;

        const mode =
            resolveModeFromPreset(
                normalizedPreset
            );

        if (mode !== null) {
            state.mode = mode;
        }

        state.revision =
            ++globalRevision;
    }

    clearTransition(player);

    return true;
}

export function clearCamera(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const camera = getCamera(player);

    if (!camera) {
        return false;
    }

    try {
        camera.clear();
    } catch {
        markFailure(player);
        return false;
    }

    const state = getState(player);

    if (state) {
        state.active = false;
        state.status =
            CAMERA_STATUS.INACTIVE;

        state.preset = null;
        state.lastPreset = null;
        state.lastOptions = null;

        state.fov = null;
        state.lastFov = null;
        state.fovOverride = false;

        state.errorCount = 0;
        state.lastUpdate = Date.now();

        state.revision =
            ++globalRevision;
    }

    clearTransition(player);

    return true;
}

export function setFov(
    player,
    fov,
    easeOptions
) {
    if (
        !isValidPlayer(player) ||
        !Number.isFinite(fov)
    ) {
        return false;
    }

    const camera = getCamera(player);

    if (!camera) {
        return false;
    }

    const normalizedFov =
        normalizeFov(fov);

    if (normalizedFov === null) {
        return false;
    }

    const normalizedEase =
        normalizeOptions(easeOptions);

    const state = getState(player);

    if (
        state &&
        state.fovOverride &&
        state.fov === normalizedFov &&
        optionsEqual(
            state.lastOptions?.fovEaseOptions,
            normalizedEase
        )
    ) {
        return true;
    }

    try {
        if (normalizedEase === undefined) {
            camera.setFov({
                fov: normalizedFov
            });
        } else {
            camera.setFov({
                fov: normalizedFov,
                easeOptions: normalizedEase
            });
        }
    } catch {
        markFailure(player);
        return false;
    }

    if (state) {
        state.lastFov = state.fov;
        state.fov = normalizedFov;
        state.fovOverride = true;

        state.lastOptions = {
            ...(state.lastOptions ?? {}),
            fovEaseOptions: clone(
                normalizedEase
            )
        };

        state.lastUpdate = Date.now();
        state.errorCount = 0;
        state.status =
            CAMERA_STATUS.ACTIVE;

        state.revision =
            ++globalRevision;
    }

    return true;
}

export function clearFov(
    player,
    easeOptions
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const camera = getCamera(player);

    if (!camera) {
        return false;
    }

    const normalizedEase =
        normalizeOptions(easeOptions);

    try {
        if (normalizedEase === undefined) {
            camera.setFov();
        } else {
            camera.setFov({
                easeOptions: normalizedEase
            });
        }
    } catch {
        markFailure(player);
        return false;
    }

    const state = getState(player);

    if (state) {
        state.lastFov = state.fov;
        state.fov = null;
        state.fovOverride = false;

        state.lastUpdate = Date.now();

        if (state.lastOptions) {
            const {
                fovEaseOptions,
                ...remaining
            } = state.lastOptions;

            state.lastOptions = remaining;
        }

        state.revision =
            ++globalRevision;
    }

    return true;
}

export function getFov(player) {
    return getState(player)?.fov ?? null;
}

export function getLastFov(player) {
    return getState(player)?.lastFov ?? null;
}

export function hasFovOverride(player) {
    return Boolean(
        getState(player)?.fovOverride
    );
}

export function getPreset(player) {
    return getState(player)?.preset ?? null;
}

export function getLastPreset(player) {
    return getState(player)?.lastPreset ?? null;
}

export function isTransitionActive(player) {
    const state = getState(player);

    if (
        !state ||
        !state.transitionActive ||
        state.transitionDuration <= 0
    ) {
        return false;
    }

    const elapsed =
        Date.now() -
        state.transitionStart;

    if (
        elapsed >=
        state.transitionDuration * 1000
    ) {
        clearTransition(player);
        return false;
    }

    return true;
}

export function getTransitionProgress(player) {
    const state = getState(player);

    if (
        !state ||
        !state.transitionActive ||
        state.transitionDuration <= 0
    ) {
        return 1;
    }

    const elapsed =
        Date.now() -
        state.transitionStart;

    return clamp(
        elapsed /
        (state.transitionDuration * 1000),
        0,
        1
    );
}

export function setTransitionState(
    player,
    active,
    duration = 0
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (!active) {
        clearTransition(player);
        return true;
    }

    startTransition(
        player,
        duration
    );

    return true;
}

export function updateCamera(
    player,
    deltaTime = DEFAULT_DELTA_TIME
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    if (!state) {
        return false;
    }

    const normalizedDelta =
        normalizeDelta(deltaTime);

    state.lastUpdate =
        normalizedDelta;

    if (state.transitionActive) {
        isTransitionActive(player);
    }

    return true;
}

export function getCameraState(player) {
    const state = getState(player);

    if (!state) {
        return {
            mode: CAMERA_MODES.FIRST_PERSON,
            active: false,
            status: CAMERA_STATUS.INACTIVE,
            preset: null,
            fov: null,
            fovOverride: false,
            lastFov: null,
            lastPreset: null,
            lastOptions: null,
            lastUpdate: 0,
            lastTransition: 0,
            transitionActive: false,
            transitionDuration: 0,
            transitionStart: 0,
            transitionProgress: 1,
            errorCount: 0,
            revision: globalRevision
        };
    }

    return {
        mode: state.mode,
        active: state.active,
        status: state.status,

        preset: state.preset,

        fov: state.fov,
        fovOverride: state.fovOverride,
        lastFov: state.lastFov,

        lastPreset: state.lastPreset,
        lastOptions: clone(
            state.lastOptions
        ),

        lastUpdate: state.lastUpdate,
        lastTransition:
            state.lastTransition,

        transitionActive:
            isTransitionActive(player),

        transitionDuration:
            state.transitionDuration,

        transitionStart:
            state.transitionStart,

        transitionProgress:
            getTransitionProgress(player),

        errorCount: state.errorCount,
        revision: state.revision
    };
}

export function getCameraObject(player) {
    return getCamera(player);
}

export function getCameraPresetForMode(mode) {
    return resolvePresetFromMode(mode);
}

export function getModeForPreset(preset) {
    return resolveModeFromPreset(
        normalizePreset(preset)
    );
}

export function isPresetSupported(preset) {
    const normalized =
        normalizePreset(preset);

    return (
        normalized ===
        CAMERA_PRESETS.FIRST_PERSON ||
        normalized ===
        CAMERA_PRESETS.THIRD_PERSON
    );
}

export function resetCameraState(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return playerStates.delete(player);
}

export function resetAllCameraState(players) {
    if (!players) {
        return 0;
    }

    let count = 0;

    for (const player of players) {
        if (resetCameraState(player)) {
            count++;
        }
    }

    return count;
}

export function getRevision() {
    return globalRevision;
}

export function getConstants() {
    return Object.freeze({
        minFov: MIN_FOV,
        maxFov: MAX_FOV,
        defaultDeltaTime: DEFAULT_DELTA_TIME,
        maxDeltaTime: MAX_DELTA_TIME,
        maxErrorsBeforeDegraded:
            MAX_ERRORS_BEFORE_DEGRADED
    });
}