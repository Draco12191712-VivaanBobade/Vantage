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

export const DEFAULT_CAMERA_STATE = Object.freeze({
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
    errorCount: 0,
    revision: 0
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
        mode: DEFAULT_CAMERA_STATE.mode,
        active: DEFAULT_CAMERA_STATE.active,
        status: DEFAULT_CAMERA_STATE.status,
        preset: DEFAULT_CAMERA_STATE.preset,
        fov: DEFAULT_CAMERA_STATE.fov,
        fovOverride: DEFAULT_CAMERA_STATE.fovOverride,
        lastFov: DEFAULT_CAMERA_STATE.lastFov,
        lastPreset: DEFAULT_CAMERA_STATE.lastPreset,
        lastOptions: DEFAULT_CAMERA_STATE.lastOptions,
        lastUpdate: DEFAULT_CAMERA_STATE.lastUpdate,
        lastTransition: DEFAULT_CAMERA_STATE.lastTransition,
        transitionActive: DEFAULT_CAMERA_STATE.transitionActive,
        transitionDuration: DEFAULT_CAMERA_STATE.transitionDuration,
        transitionStart: DEFAULT_CAMERA_STATE.transitionStart,
        errorCount: DEFAULT_CAMERA_STATE.errorCount,
        revision: globalRevision
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
        return player.camera ?? null;
    } catch {
        return null;
    }
}

function clone(value) {
    if (value === undefined) {
        return undefined;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function normalizePreset(preset) {
    if (
        typeof preset !== "string" ||
        preset.length === 0
    ) {
        return null;
    }

    return preset.trim();
}

function normalizeDelta(deltaTime) {
    const value = Number.isFinite(deltaTime)
        ? deltaTime
        : DEFAULT_DELTA_TIME;

    return clamp(
        value,
        0,
        MAX_DELTA_TIME
    );
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
    state.lastOptions = normalizeOptions(options);
    state.errorCount = 0;

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

    state.status =
        state.errorCount >=
            MAX_ERRORS_BEFORE_DEGRADED
            ? CAMERA_STATUS.DEGRADED
            : CAMERA_STATUS.FAILED;

    state.revision = ++globalRevision;
}

function markTransition(
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

    state.transitionActive =
        normalizedDuration > 0;

    state.transitionDuration =
        normalizedDuration;

    state.transitionStart =
        Date.now();

    state.lastTransition =
        Date.now();
}

function clearTransitionState(player) {
    const state = getState(player);

    if (!state) {
        return;
    }

    state.transitionActive = false;
    state.transitionDuration = 0;
    state.transitionStart = 0;
}

function extractEaseDuration(options) {
    if (!options || typeof options !== "object") {
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

function applyPreset(
    player,
    preset,
    options
) {
    const camera = getCamera(player);

    if (!camera) {
        markFailure(player);
        return false;
    }

    const normalizedPreset =
        normalizePreset(preset);

    if (!normalizedPreset) {
        markFailure(player);
        return false;
    }

    const normalizedOptions =
        normalizeOptions(options);

    try {
        if (
            normalizedOptions &&
            normalizedOptions.easeOptions &&
            typeof camera.setCameraWithEase === "function"
        ) {
            const {
                easeOptions,
                ...cameraOptions
            } = normalizedOptions;

            if (
                Object.keys(cameraOptions).length === 0
            ) {
                camera.setCameraWithEase(
                    normalizedPreset,
                    easeOptions
                );
            } else {
                camera.setCamera(
                    normalizedPreset,
                    cameraOptions
                );
            }
        } else if (
            normalizedOptions
        ) {
            camera.setCamera(
                normalizedPreset,
                normalizedOptions
            );
        } else {
            camera.setCamera(
                normalizedPreset
            );
        }

        markSuccess(
            player,
            normalizedPreset,
            normalizedOptions
        );

        markTransition(
            player,
            extractEaseDuration(
                normalizedOptions
            )
        );

        return true;
    } catch {
        markFailure(player);
        return false;
    }
}

function isSamePresetRequest(
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
            normalizeOptions(options)
        )
    );
}

function resolveModeFromPreset(preset) {
    if (
        preset === CAMERA_PRESETS.FIRST_PERSON
    ) {
        return CAMERA_MODES.FIRST_PERSON;
    }

    if (
        preset === CAMERA_PRESETS.THIRD_PERSON
    ) {
        return CAMERA_MODES.THIRD_PERSON;
    }

    return null;
}

function applyMode(
    player,
    mode,
    options
) {
    const preset =
        mode === CAMERA_MODES.FIRST_PERSON
            ? CAMERA_PRESETS.FIRST_PERSON
            : mode === CAMERA_MODES.THIRD_PERSON
                ? CAMERA_PRESETS.THIRD_PERSON
                : null;

    if (!preset) {
        return false;
    }

    const normalizedOptions =
        normalizeOptions(options);

    if (
        isSamePresetRequest(
            player,
            preset,
            normalizedOptions
        )
    ) {
        const state = getState(player);

        if (state) {
            state.mode = mode;
            state.active = true;
            state.status = CAMERA_STATUS.ACTIVE;
            state.lastUpdate = Date.now();
        }

        return true;
    }

    const success =
        applyPreset(
            player,
            preset,
            normalizedOptions
        );

    if (!success) {
        return false;
    }

    const state = getState(player);

    if (state) {
        state.mode = mode;
        state.active = true;
        state.status = CAMERA_STATUS.ACTIVE;
        state.lastUpdate = Date.now();
    }

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

    return applyPreset(
        player,
        preset,
        options
    );
}

export function setFirstPerson(
    player,
    options
) {
    return applyMode(
        player,
        CAMERA_MODES.FIRST_PERSON,
        options
    );
}

export function setThirdPerson(
    player,
    options
) {
    return applyMode(
        player,
        CAMERA_MODES.THIRD_PERSON,
        options
    );
}

export function setMode(
    player,
    mode,
    options
) {
    if (
        mode !== CAMERA_MODES.FIRST_PERSON &&
        mode !== CAMERA_MODES.THIRD_PERSON
    ) {
        return false;
    }

    return applyMode(
        player,
        mode,
        options
    );
}

export function getMode(player) {
    const state = getState(player);

    return state?.mode ??
        CAMERA_MODES.FIRST_PERSON;
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

    return state?.status ??
        CAMERA_STATUS.INACTIVE;
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
            typeof camera.setDefaultCamera === "function"
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

        const state = getState(player);

        if (state) {
            state.preset =
                normalizedPreset;

            state.lastPreset =
                normalizedPreset;

            state.lastOptions =
                normalizedEase;

            state.active = true;
            state.status =
                CAMERA_STATUS.ACTIVE;

            const mode =
                resolveModeFromPreset(
                    normalizedPreset
                );

            if (mode !== null) {
                state.mode = mode;
            }

            state.lastUpdate =
                Date.now();

            state.errorCount = 0;
            state.revision =
                ++globalRevision;
        }

        clearTransitionState(player);

        return true;
    } catch {
        markFailure(player);
        return false;
    }
}

export function clearCamera(player) {
    const camera = getCamera(player);

    if (!camera) {
        return false;
    }

    try {
        camera.clear();

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

        clearTransitionState(player);

        return true;
    } catch {
        markFailure(player);
        return false;
    }
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

    const value =
        normalizeFov(fov);

    if (value === null) {
        return false;
    }

    const state = getState(player);

    if (
        state &&
        state.fovOverride &&
        state.fov === value &&
        optionsEqual(
            state.lastOptions?.fovEaseOptions,
            easeOptions
        )
    ) {
        return true;
    }

    const normalizedEase =
        normalizeOptions(easeOptions);

    try {
        if (
            normalizedEase === undefined
        ) {
            camera.setFov({
                fov: value
            });
        } else {
            camera.setFov({
                fov: value,
                easeOptions:
                    normalizedEase
            });
        }

        if (state) {
            state.lastFov =
                state.fov;

            state.fov = value;
            state.fovOverride = true;
            state.lastUpdate = Date.now();

            state.lastOptions = {
                ...(
                    state.lastOptions ?? {}
                ),
                fovEaseOptions:
                    normalizedEase
            };

            state.errorCount = 0;
            state.status =
                CAMERA_STATUS.ACTIVE;

            state.revision =
                ++globalRevision;
        }

        return true;
    } catch {
        markFailure(player);
        return false;
    }
}

export function clearFov(
    player,
    easeOptions
) {
    const camera = getCamera(player);

    if (!camera) {
        return false;
    }

    const normalizedEase =
        normalizeOptions(easeOptions);

    try {
        if (
            normalizedEase === undefined
        ) {
            camera.setFov();
        } else {
            camera.setFov({
                easeOptions:
                    normalizedEase
            });
        }

        const state = getState(player);

        if (state) {
            state.lastFov =
                state.fov;

            state.fov = null;
            state.fovOverride = false;
            state.lastUpdate = Date.now();

            if (state.lastOptions) {
                const {
                    fovEaseOptions,
                    ...remaining
                } = state.lastOptions;

                state.lastOptions =
                    remaining;
            }

            state.revision =
                ++globalRevision;
        }

        return true;
    } catch {
        markFailure(player);
        return false;
    }
}

export function getFov(player) {
    return getState(player)?.fov ??
        null;
}

export function getLastFov(player) {
    return getState(player)?.lastFov ??
        null;
}

export function hasFovOverride(player) {
    return Boolean(
        getState(player)?.fovOverride
    );
}

export function getPreset(player) {
    return getState(player)?.preset ??
        null;
}

export function getLastPreset(player) {
    return getState(player)?.lastPreset ??
        null;
}

export function isTransitionActive(player) {
    const state = getState(player);

    if (!state) {
        return false;
    }

    if (!state.transitionActive) {
        return false;
    }

    if (
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
        state.transitionActive = false;
        state.transitionDuration = 0;
        state.transitionStart = 0;

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

    state.revision =
        ++globalRevision;

    isTransitionActive(player);

    return true;
}

export function getCameraState(player) {
    const state = getState(player);

    if (!state) {
        return {
            ...DEFAULT_CAMERA_STATE
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
        lastTransition: state.lastTransition,
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
    if (
        mode === CAMERA_MODES.FIRST_PERSON
    ) {
        return CAMERA_PRESETS.FIRST_PERSON;
    }

    if (
        mode === CAMERA_MODES.THIRD_PERSON
    ) {
        return CAMERA_PRESETS.THIRD_PERSON;
    }

    return null;
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

export function setTransitionState(
    player,
    active,
    duration = 0
) {
    const state = getState(player);

    if (!state) {
        return false;
    }

    if (!active) {
        clearTransitionState(player);
        return true;
    }

    markTransition(
        player,
        duration
    );

    return true;
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

    let reset = 0;

    for (const player of players) {
        if (
            resetCameraState(player)
        ) {
            reset++;
        }
    }

    return reset;
}

export function getRevision() {
    return globalRevision;
}

export function getConstants() {
    return {
        minFov: MIN_FOV,
        maxFov: MAX_FOV,
        defaultDeltaTime:
            DEFAULT_DELTA_TIME,
        maxDeltaTime:
            MAX_DELTA_TIME,
        maxErrorsBeforeDegraded:
            MAX_ERRORS_BEFORE_DEGRADED
    };
}