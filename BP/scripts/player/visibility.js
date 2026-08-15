import {
    DEFAULT_VISIBILITY_CONFIG
} from "../config/defaults.js";

const BODY_PARTS = Object.freeze([
    "head",
    "body",
    "left_arm",
    "right_arm",
    "left_leg",
    "right_leg",
    "cape",
    "armor",
    "held_item"
]);

const VISIBILITY_MODES = Object.freeze({
    FULL: "full",
    CUSTOM: "custom",
    HIDDEN: "hidden"
});

const CAMERA_MODES = Object.freeze({
    FIRST_PERSON: "first_person",
    THIRD_PERSON: "third_person"
});

const PART_INDEX = Object.freeze({
    head: 0,
    body: 1,
    left_arm: 2,
    right_arm: 3,
    left_leg: 4,
    right_leg: 5,
    cape: 6,
    armor: 7,
    held_item: 8
});

const DEFAULTS = Object.freeze({
    enabled:
        DEFAULT_VISIBILITY_CONFIG.enabled ??
        true,

    mode:
        DEFAULT_VISIBILITY_CONFIG.mode ??
        VISIBILITY_MODES.FULL,

    firstPersonOnly:
        DEFAULT_VISIBILITY_CONFIG.firstPersonOnly ??
        true,

    thirdPersonOnly:
        DEFAULT_VISIBILITY_CONFIG.thirdPersonOnly ??
        false,

    head:
        DEFAULT_VISIBILITY_CONFIG.head ??
        true,

    body:
        DEFAULT_VISIBILITY_CONFIG.body ??
        true,

    left_arm:
        DEFAULT_VISIBILITY_CONFIG.leftArm ??
        true,

    right_arm:
        DEFAULT_VISIBILITY_CONFIG.rightArm ??
        true,

    left_leg:
        DEFAULT_VISIBILITY_CONFIG.leftLeg ??
        true,

    right_leg:
        DEFAULT_VISIBILITY_CONFIG.rightLeg ??
        true,

    cape:
        DEFAULT_VISIBILITY_CONFIG.cape ??
        true,

    armor:
        DEFAULT_VISIBILITY_CONFIG.armor ??
        true,

    held_item:
        DEFAULT_VISIBILITY_CONFIG.heldItem ??
        true
});

const states = new WeakMap();

function isValidPlayer(player) {
    if (!player) {
        return false;
    }

    try {
        return typeof player.isValid !== "function" ||
            player.isValid();
    } catch {
        return false;
    }
}

function normalizeBoolean(value, fallback) {
    return typeof value === "boolean"
        ? value
        : fallback;
}

function normalizeMode(mode) {
    if (
        mode === VISIBILITY_MODES.FULL ||
        mode === VISIBILITY_MODES.CUSTOM ||
        mode === VISIBILITY_MODES.HIDDEN
    ) {
        return mode;
    }

    return VISIBILITY_MODES.FULL;
}

function normalizeCameraMode(mode) {
    return mode === CAMERA_MODES.THIRD_PERSON
        ? CAMERA_MODES.THIRD_PERSON
        : CAMERA_MODES.FIRST_PERSON;
}

function createParts() {
    return {
        head: DEFAULTS.head,
        body: DEFAULTS.body,

        left_arm:
            DEFAULTS.left_arm,

        right_arm:
            DEFAULTS.right_arm,

        left_leg:
            DEFAULTS.left_leg,

        right_leg:
            DEFAULTS.right_leg,

        cape:
            DEFAULTS.cape,

        armor:
            DEFAULTS.armor,

        held_item:
            DEFAULTS.held_item
    };
}

function cloneParts(parts) {
    return {
        head: parts.head === true,
        body: parts.body === true,

        left_arm:
            parts.left_arm === true,

        right_arm:
            parts.right_arm === true,

        left_leg:
            parts.left_leg === true,

        right_leg:
            parts.right_leg === true,

        cape:
            parts.cape === true,

        armor:
            parts.armor === true,

        held_item:
            parts.held_item === true
    };
}

function createState() {
    return {
        enabled: DEFAULTS.enabled,

        mode:
            normalizeMode(
                DEFAULTS.mode
            ),

        firstPersonOnly:
            DEFAULTS.firstPersonOnly,

        thirdPersonOnly:
            DEFAULTS.thirdPersonOnly,

        cameraMode:
            CAMERA_MODES.FIRST_PERSON,

        firstPerson: true,
        thirdPerson: false,

        parts: createParts(),

        effectiveParts: {
            head: false,
            body: false,

            left_arm: false,
            right_arm: false,

            left_leg: false,
            right_leg: false,

            cape: false,
            armor: false,
            held_item: false
        },

        visibilityMask: 0,

        initialized: false,
        changed: false,
        revision: 0
    };
}

function getState(player) {
    let state = states.get(player);

    if (!state) {
        state = createState();
        states.set(player, state);
        rebuild(state);
    }

    return state;
}

function setChanged(state) {
    state.changed = true;
    state.revision++;
}

function isValidPart(part) {
    return Object.prototype.hasOwnProperty.call(
        PART_INDEX,
        part
    );
}

function resetEffectiveParts(state) {
    for (const part of BODY_PARTS) {
        state.effectiveParts[part] = false;
    }
}

function applyVisibilityMode(state) {
    switch (state.mode) {
        case VISIBILITY_MODES.FULL:
            for (const part of BODY_PARTS) {
                state.effectiveParts[part] = true;
            }
            break;

        case VISIBILITY_MODES.CUSTOM:
            for (const part of BODY_PARTS) {
                state.effectiveParts[part] =
                    state.parts[part] === true;
            }
            break;

        case VISIBILITY_MODES.HIDDEN:
        default:
            resetEffectiveParts(state);
            break;
    }
}

function applyCameraRules(state) {
    if (
        state.firstPersonOnly &&
        state.thirdPersonOnly
    ) {
        resetEffectiveParts(state);
        return;
    }

    if (
        state.firstPersonOnly &&
        !state.firstPerson
    ) {
        resetEffectiveParts(state);
        return;
    }

    if (
        state.thirdPersonOnly &&
        !state.thirdPerson
    ) {
        resetEffectiveParts(state);
    }
}

function applyEnabledRule(state) {
    if (!state.enabled) {
        resetEffectiveParts(state);
    }
}

function calculateMask(state) {
    let mask = 0;

    for (const part of BODY_PARTS) {
        if (state.effectiveParts[part]) {
            mask |= 1 << PART_INDEX[part];
        }
    }

    return mask;
}

function rebuild(state) {
    applyVisibilityMode(state);
    applyCameraRules(state);
    applyEnabledRule(state);

    state.visibilityMask =
        calculateMask(state);
}

function applyOptions(state, options) {
    if (
        !options ||
        typeof options !== "object" ||
        Array.isArray(options)
    ) {
        return false;
    }

    let changed = false;

    if (
        Object.prototype.hasOwnProperty.call(
            options,
            "enabled"
        )
    ) {
        const value = normalizeBoolean(
            options.enabled,
            state.enabled
        );

        if (value !== state.enabled) {
            state.enabled = value;
            changed = true;
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(
            options,
            "mode"
        )
    ) {
        const value =
            normalizeMode(options.mode);

        if (value !== state.mode) {
            state.mode = value;
            changed = true;
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(
            options,
            "firstPersonOnly"
        )
    ) {
        const value = normalizeBoolean(
            options.firstPersonOnly,
            state.firstPersonOnly
        );

        if (value !== state.firstPersonOnly) {
            state.firstPersonOnly = value;
            changed = true;
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(
            options,
            "thirdPersonOnly"
        )
    ) {
        const value = normalizeBoolean(
            options.thirdPersonOnly,
            state.thirdPersonOnly
        );

        if (value !== state.thirdPersonOnly) {
            state.thirdPersonOnly = value;
            changed = true;
        }
    }

    if (
        options.parts &&
        typeof options.parts === "object" &&
        !Array.isArray(options.parts)
    ) {
        for (const part of BODY_PARTS) {
            if (
                typeof options.parts[part] !==
                "boolean"
            ) {
                continue;
            }

            if (
                state.parts[part] !==
                options.parts[part]
            ) {
                state.parts[part] =
                    options.parts[part];

                changed = true;
            }
        }
    }

    return changed;
}

function updateCamera(state, cameraMode) {
    const mode =
        normalizeCameraMode(cameraMode);

    const firstPerson =
        mode === CAMERA_MODES.FIRST_PERSON;

    const thirdPerson =
        !firstPerson;

    const changed =
        state.cameraMode !== mode ||
        state.firstPerson !== firstPerson ||
        state.thirdPerson !== thirdPerson;

    state.cameraMode = mode;
    state.firstPerson = firstPerson;
    state.thirdPerson = thirdPerson;

    return changed;
}

export function initialize(
    player,
    options = {}
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    const wasInitialized =
        state.initialized;

    const changed =
        applyOptions(state, options);

    rebuild(state);

    state.initialized = true;

    if (
        changed ||
        !wasInitialized
    ) {
        setChanged(state);
    }

    return true;
}

export function update(
    player,
    cameraMode = CAMERA_MODES.FIRST_PERSON
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);

    const previousMask =
        state.visibilityMask;

    const cameraChanged =
        updateCamera(
            state,
            cameraMode
        );

    rebuild(state);

    const visibilityChanged =
        previousMask !==
        state.visibilityMask;

    if (
        cameraChanged ||
        visibilityChanged
    ) {
        setChanged(state);
    }

    state.initialized = true;

    return true;
}

export function setEnabled(
    player,
    enabled
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);
    const value = Boolean(enabled);

    if (state.enabled === value) {
        return true;
    }

    state.enabled = value;

    rebuild(state);
    setChanged(state);

    return true;
}

export function isEnabled(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).enabled;
}

export function setMode(player, mode) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);
    const value = normalizeMode(mode);

    if (state.mode === value) {
        return true;
    }

    state.mode = value;

    rebuild(state);
    setChanged(state);

    return true;
}

export function getMode(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player).mode;
}

export function setPartVisible(
    player,
    part,
    visible
) {
    if (
        !isValidPlayer(player) ||
        !isValidPart(part)
    ) {
        return false;
    }

    const state = getState(player);
    const value = Boolean(visible);

    const changed =
        state.parts[part] !== value ||
        state.mode !==
        VISIBILITY_MODES.CUSTOM;

    state.parts[part] = value;
    state.mode = VISIBILITY_MODES.CUSTOM;

    rebuild(state);

    if (changed) {
        setChanged(state);
    }

    return true;
}

export function isPartVisible(
    player,
    part
) {
    if (
        !isValidPlayer(player) ||
        !isValidPart(part)
    ) {
        return false;
    }

    return getState(player)
        .effectiveParts[part];
}

export function setHeadVisible(
    player,
    visible
) {
    return setPartVisible(
        player,
        "head",
        visible
    );
}

export function setBodyVisible(
    player,
    visible
) {
    return setPartVisible(
        player,
        "body",
        visible
    );
}

export function setArmsVisible(
    player,
    visible
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);
    const value = Boolean(visible);

    const changed =
        state.parts.left_arm !== value ||
        state.parts.right_arm !== value ||
        state.mode !==
        VISIBILITY_MODES.CUSTOM;

    state.parts.left_arm = value;
    state.parts.right_arm = value;
    state.mode = VISIBILITY_MODES.CUSTOM;

    rebuild(state);

    if (changed) {
        setChanged(state);
    }

    return true;
}

export function setLegsVisible(
    player,
    visible
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);
    const value = Boolean(visible);

    const changed =
        state.parts.left_leg !== value ||
        state.parts.right_leg !== value ||
        state.mode !==
        VISIBILITY_MODES.CUSTOM;

    state.parts.left_leg = value;
    state.parts.right_leg = value;
    state.mode = VISIBILITY_MODES.CUSTOM;

    rebuild(state);

    if (changed) {
        setChanged(state);
    }

    return true;
}

export function setCapeVisible(
    player,
    visible
) {
    return setPartVisible(
        player,
        "cape",
        visible
    );
}

export function setArmorVisible(
    player,
    visible
) {
    return setPartVisible(
        player,
        "armor",
        visible
    );
}

export function setHeldItemVisible(
    player,
    visible
) {
    return setPartVisible(
        player,
        "held_item",
        visible
    );
}

export function setFirstPersonOnly(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);
    const normalized = Boolean(value);

    if (
        state.firstPersonOnly ===
        normalized
    ) {
        return true;
    }

    state.firstPersonOnly = normalized;

    rebuild(state);
    setChanged(state);

    return true;
}

export function setThirdPersonOnly(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getState(player);
    const normalized = Boolean(value);

    if (
        state.thirdPersonOnly ===
        normalized
    ) {
        return true;
    }

    state.thirdPersonOnly = normalized;

    rebuild(state);
    setChanged(state);

    return true;
}

export function getVisibleParts(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return cloneParts(
        getState(player).effectiveParts
    );
}

export function getRawVisibility(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return cloneParts(
        getState(player).parts
    );
}

export function getVisibilityMask(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getState(player)
        .visibilityMask;
}

export function isEverythingVisible(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).visibilityMask ===
        (1 << BODY_PARTS.length) - 1;
}

export function isEverythingHidden(player) {
    if (!isValidPlayer(player)) {
        return true;
    }

    return getState(player).visibilityMask === 0;
}

export function getCameraMode(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player).cameraMode;
}

export function isFirstPerson(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).firstPerson;
}

export function isThirdPerson(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).thirdPerson;
}

export function getSnapshot(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getState(player);

    return {
        enabled: state.enabled,

        mode: state.mode,

        cameraMode:
            state.cameraMode,

        firstPerson:
            state.firstPerson,

        thirdPerson:
            state.thirdPerson,

        firstPersonOnly:
            state.firstPersonOnly,

        thirdPersonOnly:
            state.thirdPersonOnly,

        parts:
            cloneParts(
                state.effectiveParts
            ),

        rawParts:
            cloneParts(
                state.parts
            ),

        mask:
            state.visibilityMask,

        changed:
            state.changed,

        revision:
            state.revision,

        initialized:
            state.initialized
    };
}

export function hasChanged(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).changed;
}

export function getRevision(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getState(player).revision;
}

export function acknowledge(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getState(player).changed = false;

    return true;
}

export function getBodyParts() {
    return BODY_PARTS;
}

export function getPartIndex(part) {
    if (!isValidPart(part)) {
        return -1;
    }

    return PART_INDEX[part];
}

export function getModes() {
    return VISIBILITY_MODES;
}

export function getCameraModes() {
    return CAMERA_MODES;
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