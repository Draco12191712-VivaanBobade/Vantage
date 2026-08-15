import {
    loadWorldConfig,
    saveWorldConfig,
    deleteWorldConfig,
    loadPlayerConfig,
    savePlayerConfig,
    deletePlayerConfig
} from "./storage.js";

const CONFIG_VERSION = 1;

const DEFAULT_CONFIG = {
    version: CONFIG_VERSION,

    enabled: true,

    camera: {
        mode: "first_person",

        firstPersonPosition: {
            x: 0,
            y: 0,
            z: 0
        },

        thirdPersonPosition: {
            x: 0,
            y: 0,
            z: 0
        },

        fov: null,
        preserveFov: true,

        transition: {
            enabled: true,
            duration: 0.12
        }
    },

    body: {
        enabled: true,

        visibility: {
            head: false,
            body: true,
            leftArm: true,
            rightArm: true,
            leftLeg: true,
            rightLeg: true,
            cape: true,
            armor: true,
            heldItem: true
        }
    },

    animation: {
        enabled: true,

        smoothing: 85,

        bob: {
            enabled: true,
            amount: 1,
            maximum: 1
        },

        sway: {
            enabled: true,
            amount: 1,
            maximum: 1
        },

        lean: {
            enabled: true,
            amount: 1,
            maximum: 1
        },

        poses: {
            sneaking: true,
            swimming: true,
            crawling: true,
            riding: true
        },

        preserveCustomAnimations: true
    },

    gameplay: {
        preserveVanillaInteraction: true,
        preserveVanillaHitDetection: true,
        preserveVanillaReach: true,
        preserveVanillaMovement: true,
        preserveVanillaControls: true
    },

    compatibility: {
        preserveResourcePacks: true,
        preserveTexturePacks: true,
        preserveOtherAddons: true,

        avoidEntityMutation: true,
        avoidGameplayMutation: true,
        avoidInputMutation: true,

        preserveCustomAnimations: true
    },

    multiplayer: {
        enabled: true,
        clientOnly: true
    },

    controls: {
        touch: true,
        mouseKeyboard: true,
        controller: true,

        preserveSensitivity: true
    },

    performance: {
        enabled: true,

        updateInterval: 1,

        updateOnlyWhenChanged: true,
        cachePlayerState: true,
        cachePoseState: true,

        skipInvalidPlayers: true,
        lowPowerMode: false
    },

    debugging: {
        enabled: false,
        logging: false
    }
};

const GLOBAL_PATHS = new Set([
    "enabled",

    "camera.mode",
    "camera.fov",
    "camera.preserveFov",
    "camera.transition.enabled",
    "camera.transition.duration",

    "gameplay.preserveVanillaInteraction",
    "gameplay.preserveVanillaHitDetection",
    "gameplay.preserveVanillaReach",
    "gameplay.preserveVanillaMovement",
    "gameplay.preserveVanillaControls",

    "compatibility.preserveResourcePacks",
    "compatibility.preserveTexturePacks",
    "compatibility.preserveOtherAddons",
    "compatibility.avoidEntityMutation",
    "compatibility.avoidGameplayMutation",
    "compatibility.avoidInputMutation",
    "compatibility.preserveCustomAnimations",

    "multiplayer.enabled",
    "multiplayer.clientOnly",

    "controls.touch",
    "controls.mouseKeyboard",
    "controls.controller",
    "controls.preserveSensitivity",

    "performance.enabled",
    "performance.updateInterval",
    "performance.updateOnlyWhenChanged",
    "performance.cachePlayerState",
    "performance.cachePoseState",
    "performance.skipInvalidPlayers",
    "performance.lowPowerMode",

    "debugging.enabled",
    "debugging.logging"
]);

const PLAYER_PATHS = new Set([
    "enabled",

    "camera.mode",

    "camera.firstPersonPosition.x",
    "camera.firstPersonPosition.y",
    "camera.firstPersonPosition.z",

    "camera.thirdPersonPosition.x",
    "camera.thirdPersonPosition.y",
    "camera.thirdPersonPosition.z",

    "camera.fov",
    "camera.preserveFov",

    "camera.transition.enabled",
    "camera.transition.duration",

    "body.enabled",

    "body.visibility.head",
    "body.visibility.body",
    "body.visibility.leftArm",
    "body.visibility.rightArm",
    "body.visibility.leftLeg",
    "body.visibility.rightLeg",
    "body.visibility.cape",
    "body.visibility.armor",
    "body.visibility.heldItem",

    "animation.enabled",
    "animation.smoothing",

    "animation.bob.enabled",
    "animation.bob.amount",
    "animation.bob.maximum",

    "animation.sway.enabled",
    "animation.sway.amount",
    "animation.sway.maximum",

    "animation.lean.enabled",
    "animation.lean.amount",
    "animation.lean.maximum",

    "animation.poses.sneaking",
    "animation.poses.swimming",
    "animation.poses.crawling",
    "animation.poses.riding",

    "animation.preserveCustomAnimations"
]);

let globalConfig = null;
let globalLoaded = false;

let playerConfigs = new WeakMap();

let revision = 0;
let initialized = false;

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

function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
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

function merge(base, override) {
    const result = clone(base);

    if (!isObject(override)) {
        return result;
    }

    for (const [key, value] of Object.entries(override)) {
        if (
            isObject(value) &&
            isObject(result[key])
        ) {
            result[key] = merge(
                result[key],
                value
            );
        } else {
            result[key] = clone(value);
        }
    }

    return result;
}

function getPath(object, path) {
    if (
        !isObject(object) ||
        typeof path !== "string"
    ) {
        return undefined;
    }

    let value = object;

    for (const part of path.split(".")) {
        if (
            value === null ||
            value === undefined
        ) {
            return undefined;
        }

        value = value[part];
    }

    return value;
}

function setPath(object, path, value) {
    if (
        !isObject(object) ||
        typeof path !== "string"
    ) {
        return false;
    }

    const parts = path.split(".");
    let current = object;

    for (
        let i = 0;
        i < parts.length - 1;
        i++
    ) {
        const part = parts[i];

        if (
            !isObject(current[part])
        ) {
            current[part] = {};
        }

        current = current[part];
    }

    current[
        parts[parts.length - 1]
    ] = clone(value);

    return true;
}

function clamp(value, min, max, fallback) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        return fallback;
    }

    return Math.max(
        min,
        Math.min(max, value)
    );
}

function validate(config) {
    const result = merge(
        DEFAULT_CONFIG,
        config
    );

    result.version = CONFIG_VERSION;

    result.enabled =
        Boolean(result.enabled);

    result.camera.fov =
        result.camera.fov === null
            ? null
            : clamp(
                result.camera.fov,
                30,
                110,
                null
            );

    result.camera.transition.duration =
        clamp(
            result.camera.transition.duration,
            0,
            2,
            DEFAULT_CONFIG.camera.transition.duration
        );

    for (const position of [
        result.camera.firstPersonPosition,
        result.camera.thirdPersonPosition
    ]) {
        position.x = clamp(
            position.x,
            -2,
            2,
            0
        );

        position.y = clamp(
            position.y,
            -2,
            2,
            0
        );

        position.z = clamp(
            position.z,
            -2,
            2,
            0
        );
    }

    result.animation.smoothing =
        clamp(
            result.animation.smoothing,
            0,
            100,
            DEFAULT_CONFIG.animation.smoothing
        );

    for (const group of [
        result.animation.bob,
        result.animation.sway,
        result.animation.lean
    ]) {
        group.amount =
            clamp(
                group.amount,
                0,
                2,
                1
            );

        group.maximum =
            clamp(
                group.maximum,
                0,
                2,
                1
            );
    }

    result.performance.updateInterval =
        Math.max(
            1,
            Math.floor(
                clamp(
                    result.performance.updateInterval,
                    1,
                    20,
                    1
                )
            )
        );

    return result;
}

function loadGlobal() {
    if (
        globalLoaded &&
        globalConfig
    ) {
        return clone(globalConfig);
    }

    let stored = null;

    try {
        stored = loadWorldConfig();
    } catch {
        stored = null;
    }

    globalConfig = validate(
        stored ?? DEFAULT_CONFIG
    );

    globalLoaded = true;

    try {
        saveWorldConfig(globalConfig);
    } catch {
        // Configuration persistence is optional.
    }

    return clone(globalConfig);
}

function getPlayerEntry(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    let entry =
        playerConfigs.get(player);

    if (!entry) {
        entry = {
            loaded: false,
            config: null
        };

        playerConfigs.set(
            player,
            entry
        );
    }

    return entry;
}

function loadPlayer(player) {
    const entry =
        getPlayerEntry(player);

    if (!entry) {
        return null;
    }

    if (entry.loaded) {
        return clone(entry.config);
    }

    let stored = null;

    try {
        stored = loadPlayerConfig(player);
    } catch {
        stored = null;
    }

    entry.config = validate(
        stored ?? {}
    );

    entry.loaded = true;

    return clone(entry.config);
}

function getEffectiveConfig(player) {
    const global =
        loadGlobal();

    if (!isValidPlayer(player)) {
        return global;
    }

    const playerConfig =
        loadPlayer(player);

    if (!playerConfig) {
        return global;
    }

    return validate(
        merge(
            global,
            playerConfig
        )
    );
}

function saveGlobal(config) {
    const validated =
        validate(config);

    try {
        if (!saveWorldConfig(validated)) {
            return false;
        }
    } catch {
        return false;
    }

    globalConfig =
        clone(validated);

    globalLoaded = true;

    revision++;

    return true;
}

function savePlayer(player, config) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const validated =
        validate(config);

    try {
        if (
            !savePlayerConfig(
                player,
                validated
            )
        ) {
            return false;
        }
    } catch {
        return false;
    }

    const entry =
        getPlayerEntry(player);

    if (entry) {
        entry.loaded = true;
        entry.config =
            clone(validated);
    }

    revision++;

    return true;
}

export function initialize() {
    const config = loadGlobal();

    initialized = true;

    return clone(config);
}

export function isInitialized() {
    return initialized;
}

export function getConfig(player = null) {
    return getEffectiveConfig(player);
}

export function getGlobalConfig() {
    return loadGlobal();
}

export function getPlayerConfig(player) {
    return loadPlayer(player);
}

export function get(
    path,
    player = null
) {
    return clone(
        getPath(
            getEffectiveConfig(player),
            path
        )
    );
}

export function getGlobal(path) {
    return clone(
        getPath(
            loadGlobal(),
            path
        )
    );
}

export function getPlayer(path, player) {
    if (!isValidPlayer(player)) {
        return undefined;
    }

    return clone(
        getPath(
            loadPlayer(player),
            path
        )
    );
}

export function set(
    path,
    value,
    player = null
) {
    const paths =
        player === null
            ? GLOBAL_PATHS
            : PLAYER_PATHS;

    if (!paths.has(path)) {
        return false;
    }

    const config =
        player === null
            ? loadGlobal()
            : loadPlayer(player);

    if (!config) {
        return false;
    }

    if (
        !setPath(
            config,
            path,
            value
        )
    ) {
        return false;
    }

    const validated =
        validate(config);

    return player === null
        ? saveGlobal(validated)
        : savePlayer(
            player,
            validated
        );
}

export function setGlobal(path, value) {
    return set(
        path,
        value
    );
}

export function setPlayer(
    path,
    value,
    player
) {
    return set(
        path,
        value,
        player
    );
}

export function setEnabled(
    enabled,
    player = null
) {
    return set(
        "enabled",
        Boolean(enabled),
        player
    );
}

export function isEnabled(player = null) {
    return Boolean(
        get(
            "enabled",
            player
        )
    );
}

export function setCameraMode(
    mode,
    player = null
) {
    if (
        ![
            "first_person",
            "third_person",
            "vanilla"
        ].includes(mode)
    ) {
        return false;
    }

    return set(
        "camera.mode",
        mode,
        player
    );
}

export function getCameraMode(player = null) {
    return get(
        "camera.mode",
        player
    );
}

export function setFirstPersonPosition(
    position,
    player = null
) {
    if (!isObject(position)) {
        return false;
    }

    const current =
        getEffectiveConfig(player)
            .camera
            .firstPersonPosition;

    return (
        set(
            "camera.firstPersonPosition.x",
            position.x ?? current.x,
            player
        ) &&
        set(
            "camera.firstPersonPosition.y",
            position.y ?? current.y,
            player
        ) &&
        set(
            "camera.firstPersonPosition.z",
            position.z ?? current.z,
            player
        )
    );
}

export function getFirstPersonPosition(
    player = null
) {
    return clone(
        getEffectiveConfig(player)
            .camera
            .firstPersonPosition
    );
}

export function setThirdPersonPosition(
    position,
    player = null
) {
    if (!isObject(position)) {
        return false;
    }

    const current =
        getEffectiveConfig(player)
            .camera
            .thirdPersonPosition;

    return (
        set(
            "camera.thirdPersonPosition.x",
            position.x ?? current.x,
            player
        ) &&
        set(
            "camera.thirdPersonPosition.y",
            position.y ?? current.y,
            player
        ) &&
        set(
            "camera.thirdPersonPosition.z",
            position.z ?? current.z,
            player
        )
    );
}

export function getThirdPersonPosition(
    player = null
) {
    return clone(
        getEffectiveConfig(player)
            .camera
            .thirdPersonPosition
    );
}

export function setFov(
    fov,
    player = null
) {
    if (
        fov !== null &&
        (
            typeof fov !== "number" ||
            !Number.isFinite(fov)
        )
    ) {
        return false;
    }

    return set(
        "camera.fov",
        fov,
        player
    );
}

export function getFov(player = null) {
    return get(
        "camera.fov",
        player
    );
}

export function setBodyVisibility(
    part,
    visible,
    player
) {
    const path =
        `body.visibility.${part}`;

    if (!PLAYER_PATHS.has(path)) {
        return false;
    }

    return set(
        path,
        Boolean(visible),
        player
    );
}

export function isBodyPartVisible(
    part,
    player
) {
    return Boolean(
        get(
            `body.visibility.${part}`,
            player
        )
    );
}

export function setAnimationEnabled(
    enabled,
    player = null
) {
    return set(
        "animation.enabled",
        Boolean(enabled),
        player
    );
}

export function isAnimationEnabled(
    player = null
) {
    return Boolean(
        get(
            "animation.enabled",
            player
        )
    );
}

export function getCameraConfig(
    player = null
) {
    return clone(
        getEffectiveConfig(player).camera
    );
}

export function getBodyConfig(
    player = null
) {
    return clone(
        getEffectiveConfig(player).body
    );
}

export function getAnimationConfig(
    player = null
) {
    return clone(
        getEffectiveConfig(player).animation
    );
}

export function getGameplayConfig() {
    return clone(
        loadGlobal().gameplay
    );
}

export function getCompatibilityConfig() {
    return clone(
        loadGlobal().compatibility
    );
}

export function getControlsConfig() {
    return clone(
        loadGlobal().controls
    );
}

export function getMultiplayerConfig() {
    return clone(
        loadGlobal().multiplayer
    );
}

export function getPerformanceConfig() {
    return clone(
        loadGlobal().performance
    );
}

export function getDebugConfig() {
    return clone(
        loadGlobal().debugging
    );
}

export function reset(player = null) {
    if (player === null) {
        try {
            if (!deleteWorldConfig()) {
                return false;
            }
        } catch {
            return false;
        }

        globalConfig = null;
        globalLoaded = false;

        revision++;

        initialize();

        return true;
    }

    if (!isValidPlayer(player)) {
        return false;
    }

    try {
        if (!deletePlayerConfig(player)) {
            return false;
        }
    } catch {
        return false;
    }

    playerConfigs.delete(player);

    revision++;

    return true;
}

export function resetGlobal() {
    return reset(null);
}

export function resetPlayer(player) {
    return reset(player);
}

export function reload(player = null) {
    if (player === null) {
        globalConfig = null;
        globalLoaded = false;

        initialized = false;

        return initialize();
    }

    if (!isValidPlayer(player)) {
        return null;
    }

    playerConfigs.delete(player);

    return loadPlayer(player);
}

export function clearPlayerCache(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return playerConfigs.delete(player);
}

export function clearCaches() {
    globalConfig = null;
    globalLoaded = false;

    playerConfigs =
        new WeakMap();

    revision++;

    return true;
}

export function getVersion() {
    return CONFIG_VERSION;
}

export function getRevision() {
    return revision;
}

export function getConfigurationSnapshot(
    player = null
) {
    return clone(
        getEffectiveConfig(player)
    );
}

export function getAllowedGlobalPaths() {
    return [...GLOBAL_PATHS];
}

export function getAllowedPlayerPaths() {
    return [...PLAYER_PATHS];
}

export function hasGlobalPath(path) {
    return GLOBAL_PATHS.has(path);
}

export function hasPlayerPath(path) {
    return PLAYER_PATHS.has(path);
}