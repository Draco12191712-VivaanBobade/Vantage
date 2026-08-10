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
    VANILLA: "vanilla",
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
    mode: DEFAULT_VISIBILITY_CONFIG.mode ?? VISIBILITY_MODES.FULL,

    enabled:
        DEFAULT_VISIBILITY_CONFIG.enabled ??
        true,

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
    return Boolean(
        player &&
        typeof player.isValid === "function" &&
        player.isValid()
    );
}

function createState() {
    return {
        mode: DEFAULTS.mode,

        enabled: DEFAULTS.enabled,

        firstPersonOnly: DEFAULTS.firstPersonOnly,
        thirdPersonOnly: DEFAULTS.thirdPersonOnly,

        parts: {
            head: DEFAULTS.head,
            body: DEFAULTS.body,
            left_arm: DEFAULTS.left_arm,
            right_arm: DEFAULTS.right_arm,
            left_leg: DEFAULTS.left_leg,
            right_leg: DEFAULTS.right_leg,
            cape: DEFAULTS.cape,
            armor: DEFAULTS.armor,
            held_item: DEFAULTS.held_item
        },

        hideHead: false,
        hideBody: false,
        hideArms: false,
        hideLegs: false,
        hideCape: false,
        hideArmor: false,
        hideHeldItem: false,

        cameraMode: CAMERA_MODES.FIRST_PERSON,

        firstPerson: true,
        thirdPerson: false,

        effectiveParts: {
            head: true,
            body: true,
            left_arm: true,
            right_arm: true,
            left_leg: true,
            right_leg: true,
            cape: true,
            armor: true,
            held_item: true
        },

        visibilityMask: 0,

        initialized: false,
        changed: false,
        revision: 0
    };
}

function getInternalState(player) {
    let state = states.get(player);

    if (!state) {
        state = createState();
        states.set(player, state);
        rebuild(state);
    }

    return state;
}

function normalizeBoolean(value, fallback) {
    return typeof value === "boolean"
        ? value
        : fallback;
}

function normalizeMode(mode) {
    switch (mode) {
        case VISIBILITY_MODES.FULL:
        case VISIBILITY_MODES.VANILLA:
        case VISIBILITY_MODES.CUSTOM:
        case VISIBILITY_MODES.HIDDEN:
            return mode;

        default:
            return DEFAULTS.mode;
    }
}

function normalizeCameraMode(mode) {
    return mode === CAMERA_MODES.THIRD_PERSON
        ? CAMERA_MODES.THIRD_PERSON
        : CAMERA_MODES.FIRST_PERSON;
}

function cloneParts(parts) {
    return {
        head: parts.head === true,
        body: parts.body === true,
        left_arm: parts.left_arm === true,
        right_arm: parts.right_arm === true,
        left_leg: parts.left_leg === true,
        right_leg: parts.right_leg === true,
        cape: parts.cape === true,
        armor: parts.armor === true,
        held_item: parts.held_item === true
    };
}

function setChanged(state) {
    state.changed = true;
    state.revision++;
}

function setPart(state, part, visible) {
    if (!Object.prototype.hasOwnProperty.call(state.parts, part)) {
        return false;
    }

    const value = Boolean(visible);

    if (state.parts[part] === value) {
        return false;
    }

    state.parts[part] = value;

    return true;
}

function resetEffectiveParts(state) {
    for (const part of BODY_PARTS) {
        state.effectiveParts[part] = false;
    }
}

function applyMode(state) {
    switch (state.mode) {
        case VISIBILITY_MODES.FULL:
        case VISIBILITY_MODES.VANILLA:
            for (const part of BODY_PARTS) {
                state.effectiveParts[part] = true;
            }
            break;

        case VISIBILITY_MODES.HIDDEN:
            resetEffectiveParts(state);
            break;

        case VISIBILITY_MODES.CUSTOM:
            for (const part of BODY_PARTS) {
                state.effectiveParts[part] =
                    state.parts[part] === true;
            }
            break;

        default:
            resetEffectiveParts(state);
            break;
    }
}

function applyGroupRules(state) {
    if (state.hideHead) {
        state.effectiveParts.head = false;
    }

    if (state.hideBody) {
        state.effectiveParts.body = false;
    }

    if (state.hideArms) {
        state.effectiveParts.left_arm = false;
        state.effectiveParts.right_arm = false;
    }

    if (state.hideLegs) {
        state.effectiveParts.left_leg = false;
        state.effectiveParts.right_leg = false;
    }

    if (state.hideCape) {
        state.effectiveParts.cape = false;
    }

    if (state.hideArmor) {
        state.effectiveParts.armor = false;
    }

    if (state.hideHeldItem) {
        state.effectiveParts.held_item = false;
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

function calculateVisibilityMask(state) {
    let mask = 0;

    for (const part of BODY_PARTS) {
        if (state.effectiveParts[part] === true) {
            mask |= 1 << PART_INDEX[part];
        }
    }

    return mask;
}

function rebuild(state) {
    applyMode(state);
    applyGroupRules(state);
    applyCameraRules(state);
    applyEnabledRule(state);

    state.visibilityMask =
        calculateVisibilityMask(state);
}

function applyOptions(state, options) {
    if (!options || typeof options !== "object") {
        return false;
    }

    let changed = false;

    if (Object.prototype.hasOwnProperty.call(options, "mode")) {
        const mode = normalizeMode(options.mode);

        if (state.mode !== mode) {
            state.mode = mode;
            changed = true;
        }
    }

    if (Object.prototype.hasOwnProperty.call(options, "enabled")) {
        const enabled = normalizeBoolean(
            options.enabled,
            state.enabled
        );

        if (state.enabled !== enabled) {
            state.enabled = enabled;
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

        if (state.firstPersonOnly !== value) {
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

        if (state.thirdPersonOnly !== value) {
            state.thirdPersonOnly = value;
            changed = true;
        }
    }

    const groupOptions = [
        "hideHead",
        "hideBody",
        "hideArms",
        "hideLegs",
        "hideCape",
        "hideArmor",
        "hideHeldItem"
    ];

    for (const property of groupOptions) {
        if (
            !Object.prototype.hasOwnProperty.call(
                options,
                property
            )
        ) {
            continue;
        }

        const value = normalizeBoolean(
            options[property],
            state[property]
        );

        if (state[property] !== value) {
            state[property] = value;
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

function getPartVisibility(state, part) {
    if (!Object.prototype.hasOwnProperty.call(
        PART_INDEX,
        part
    )) {
        return false;
    }

    return state.effectiveParts[part] === true;
}

function getRawParts(state) {
    return cloneParts(state.parts);
}

function getEffectiveParts(state) {
    return cloneParts(state.effectiveParts);
}

function updateCameraFlags(state, cameraMode) {
    const normalized =
        normalizeCameraMode(cameraMode);

    const firstPerson =
        normalized === CAMERA_MODES.FIRST_PERSON;

    const thirdPerson =
        normalized === CAMERA_MODES.THIRD_PERSON;

    const changed =
        state.cameraMode !== normalized ||
        state.firstPerson !== firstPerson ||
        state.thirdPerson !== thirdPerson;

    state.cameraMode = normalized;
    state.firstPerson = firstPerson;
    state.thirdPerson = thirdPerson;

    return changed;
}

export function initialize(player, options = {}) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);

    const changed =
        applyOptions(state, options);

    rebuild(state);

    state.initialized = true;

    if (changed || !state.initialized) {
        setChanged(state);
    } else {
        state.changed = true;
        state.revision++;
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

    const state = getInternalState(player);

    const cameraChanged =
        updateCameraFlags(state, cameraMode);

    const previousMask =
        state.visibilityMask;

    rebuild(state);

    const visibilityChanged =
        previousMask !== state.visibilityMask;

    if (cameraChanged || visibilityChanged) {
        setChanged(state);
    }

    state.initialized = true;

    return true;
}

export function setEnabled(player, enabled) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);
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

    return getInternalState(player).enabled;
}

export function setMode(player, mode) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);
    const normalized = normalizeMode(mode);

    if (state.mode === normalized) {
        return true;
    }

    state.mode = normalized;

    rebuild(state);
    setChanged(state);

    return true;
}

export function getMode(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player).mode;
}

export function setPartVisible(
    player,
    part,
    visible
) {
    if (
        !isValidPlayer(player) ||
        !Object.prototype.hasOwnProperty.call(
            PART_INDEX,
            part
        )
    ) {
        return false;
    }

    const state = getInternalState(player);
    const changed = setPart(
        state,
        part,
        visible
    );

    state.mode = VISIBILITY_MODES.CUSTOM;

    rebuild(state);

    if (changed) {
        setChanged(state);
    }

    return true;
}

export function isPartVisible(player, part) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getPartVisibility(
        getInternalState(player),
        part
    );
}

export function setHeadVisible(player, visible) {
    return setPartVisible(
        player,
        "head",
        visible
    );
}

export function setBodyVisible(player, visible) {
    return setPartVisible(
        player,
        "body",
        visible
    );
}

export function setArmsVisible(player, visible) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);
    const value = Boolean(visible);

    const changed =
        state.parts.left_arm !== value ||
        state.parts.right_arm !== value ||
        state.mode !== VISIBILITY_MODES.CUSTOM;

    state.parts.left_arm = value;
    state.parts.right_arm = value;
    state.mode = VISIBILITY_MODES.CUSTOM;

    rebuild(state);

    if (changed) {
        setChanged(state);
    }

    return true;
}

export function setLegsVisible(player, visible) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);
    const value = Boolean(visible);

    const changed =
        state.parts.left_leg !== value ||
        state.parts.right_leg !== value ||
        state.mode !== VISIBILITY_MODES.CUSTOM;

    state.parts.left_leg = value;
    state.parts.right_leg = value;
    state.mode = VISIBILITY_MODES.CUSTOM;

    rebuild(state);

    if (changed) {
        setChanged(state);
    }

    return true;
}

export function setCapeVisible(player, visible) {
    return setPartVisible(
        player,
        "cape",
        visible
    );
}

export function setArmorVisible(player, visible) {
    return setPartVisible(
        player,
        "armor",
        visible
    );
}

export function setHeldItemVisible(player, visible) {
    return setPartVisible(
        player,
        "held_item",
        visible
    );
}

export function setFirstPersonOnly(player, value) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);
    const normalized = Boolean(value);

    if (
        state.firstPersonOnly === normalized
    ) {
        return true;
    }

    state.firstPersonOnly = normalized;

    rebuild(state);
    setChanged(state);

    return true;
}

export function setThirdPersonOnly(player, value) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);
    const normalized = Boolean(value);

    if (
        state.thirdPersonOnly === normalized
    ) {
        return true;
    }

    state.thirdPersonOnly = normalized;

    rebuild(state);
    setChanged(state);

    return true;
}

function setHideFlag(
    player,
    property,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);
    const normalized = Boolean(value);

    if (state[property] === normalized) {
        return true;
    }

    state[property] = normalized;

    rebuild(state);
    setChanged(state);

    return true;
}

export function setHideHead(player, value) {
    return setHideFlag(
        player,
        "hideHead",
        value
    );
}

export function setHideBody(player, value) {
    return setHideFlag(
        player,
        "hideBody",
        value
    );
}

export function setHideArms(player, value) {
    return setHideFlag(
        player,
        "hideArms",
        value
    );
}

export function setHideLegs(player, value) {
    return setHideFlag(
        player,
        "hideLegs",
        value
    );
}

export function setHideCape(player, value) {
    return setHideFlag(
        player,
        "hideCape",
        value
    );
}

export function setHideArmor(player, value) {
    return setHideFlag(
        player,
        "hideArmor",
        value
    );
}

export function setHideHeldItem(player, value) {
    return setHideFlag(
        player,
        "hideHeldItem",
        value
    );
}

export function getVisibleParts(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getEffectiveParts(
        getInternalState(player)
    );
}

export function getRawVisibility(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getRawParts(
        getInternalState(player)
    );
}

export function getVisibilityMask(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).visibilityMask;
}

export function isEverythingVisible(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player).visibilityMask ===
        (1 << BODY_PARTS.length) - 1;
}

export function isEverythingHidden(player) {
    if (!isValidPlayer(player)) {
        return true;
    }

    return getInternalState(player).visibilityMask === 0;
}

export function getSnapshot(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getInternalState(player);

    return {
        enabled: state.enabled,

        mode: state.mode,

        cameraMode: state.cameraMode,

        firstPerson: state.firstPerson,
        thirdPerson: state.thirdPerson,

        firstPersonOnly:
            state.firstPersonOnly,

        thirdPersonOnly:
            state.thirdPersonOnly,

        parts: getEffectiveParts(state),

        rawParts: getRawParts(state),

        mask: state.visibilityMask,

        changed: state.changed,

        revision: state.revision,

        initialized: state.initialized
    };
}

export function hasChanged(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player).changed;
}

export function getRevision(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).revision;
}

export function acknowledge(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getInternalState(player).changed = false;

    return true;
}

export function getCameraMode(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player).cameraMode;
}

export function isFirstPerson(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player).firstPerson;
}

export function isThirdPerson(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player).thirdPerson;
}

export function getBodyParts() {
    return BODY_PARTS;
}

export function getPartIndex(part) {
    if (!Object.prototype.hasOwnProperty.call(
        PART_INDEX,
        part
    )) {
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