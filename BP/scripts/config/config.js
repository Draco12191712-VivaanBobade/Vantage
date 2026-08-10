import {
    DEFAULT_CONFIG,
    CONFIG_VERSION,
    CAMERA_MODES,
    VISIBILITY_MODES,
    ANIMATION_CONFLICT_POLICIES,
    RENDER_CONFLICT_POLICIES,
    PERFORMANCE_PRESETS
} from "./defaults.js";

import {
    loadWorldConfig,
    saveWorldConfig,
    deleteWorldConfig,
    loadPlayerConfig,
    savePlayerConfig,
    deletePlayerConfig
} from "./storage.js";

let playerConfigs = new WeakMap();

let globalConfigCache = null;
let globalConfigLoaded = false;

let revision = 0;
let initialized = false;

const GLOBAL_PATHS = new Set([
    "enabled",

    "camera.mode",
    "camera.firstPersonPreset",
    "camera.thirdPersonPreset",
    "camera.position.x",
    "camera.position.y",
    "camera.position.z",
    "camera.firstPersonPosition.x",
    "camera.firstPersonPosition.y",
    "camera.firstPersonPosition.z",
    "camera.thirdPersonPosition.x",
    "camera.thirdPersonPosition.y",
    "camera.thirdPersonPosition.z",
    "camera.fov",
    "camera.fovCompatibility",
    "camera.transition.enabled",
    "camera.transition.duration",
    "camera.transition.positionSmoothing",
    "camera.transition.rotationSmoothing",

    "gameplay.preserveVanillaInteraction",
    "gameplay.preserveVanillaHitDetection",
    "gameplay.preserveVanillaReach",
    "gameplay.preserveVanillaMovement",
    "gameplay.preserveVanillaControls",
    "gameplay.preserveVanillaFov",

    "compatibility.addons",
    "compatibility.resourcePacks",
    "compatibility.texturePacks",
    "compatibility.customAnimations",
    "compatibility.customPlayerModels",
    "compatibility.animationConflictPolicy",
    "compatibility.renderConflictPolicy",
    "compatibility.avoidEntityMutation",
    "compatibility.avoidGameplayMutation",
    "compatibility.avoidInputMutation",

    "multiplayer.enabled",
    "multiplayer.clientOnlyVisuals",
    "multiplayer.synchronizeCamera",
    "multiplayer.synchronizePose",
    "multiplayer.synchronizeVisibility",

    "controls.touch",
    "controls.mouseKeyboard",
    "controls.controller",
    "controls.preserveSensitivity",
    "controls.preserveTouchLayout",
    "controls.preserveControllerBindings",

    "performance.enabled",
    "performance.updateInterval",
    "performance.maxUpdatesPerTick",
    "performance.cachePlayerState",
    "performance.cachePoseState",
    "performance.cacheVisibilityState",
    "performance.updateOnlyWhenChanged",
    "performance.skipInvalidPlayers",
    "performance.lowPowerMode",

    "debugging.enabled",
    "debugging.logging",
    "debugging.cameraLogging",
    "debugging.animationLogging",
    "debugging.compatibilityLogging",
    "debugging.performanceLogging"
]);

const PLAYER_PATHS = new Set([
    "enabled",

    "camera.mode",
    "camera.firstPersonPreset",
    "camera.thirdPersonPreset",
    "camera.position.x",
    "camera.position.y",
    "camera.position.z",
    "camera.firstPersonPosition.x",
    "camera.firstPersonPosition.y",
    "camera.firstPersonPosition.z",
    "camera.thirdPersonPosition.x",
    "camera.thirdPersonPosition.y",
    "camera.thirdPersonPosition.z",
    "camera.fov",
    "camera.fovCompatibility",
    "camera.transition.enabled",
    "camera.transition.duration",
    "camera.transition.positionSmoothing",
    "camera.transition.rotationSmoothing",

    "body.enabled",
    "body.visibility.mode",
    "body.visibility.firstPersonOnly",
    "body.visibility.thirdPersonOnly",
    "body.visibility.head",
    "body.visibility.body",
    "body.visibility.leftArm",
    "body.visibility.rightArm",
    "body.visibility.leftLeg",
    "body.visibility.rightLeg",
    "body.visibility.cape",
    "body.visibility.armor",
    "body.visibility.heldItem",

    "body.rendering.showHead",
    "body.rendering.showBody",
    "body.rendering.showArms",
    "body.rendering.showLegs",
    "body.rendering.showCape",
    "body.rendering.showArmor",
    "body.rendering.showHeldItem",

    "animation.enabled",
    "animation.smoothing",
    "animation.rotationSmoothing",
    "animation.movementScale",

    "animation.bob.enabled",
    "animation.bob.amount",
    "animation.bob.maximum",

    "animation.sway.enabled",
    "animation.sway.amount",
    "animation.sway.maximum",

    "animation.lean.enabled",
    "animation.lean.amount",
    "animation.lean.maximum",

    "animation.poses.idle",
    "animation.poses.walking",
    "animation.poses.sprinting",
    "animation.poses.sneaking",
    "animation.poses.swimming",
    "animation.poses.crawling",
    "animation.poses.jumping",
    "animation.poses.falling",
    "animation.poses.climbing",
    "animation.poses.gliding",
    "animation.poses.riding",
    "animation.poses.flying"
]);

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
    return Boolean(
        value &&
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

function deepMerge(base, override) {
    if (!isObject(base)) {
        return clone(override);
    }

    const result = clone(base);

    if (!isObject(override)) {
        return result;
    }

    for (const [key, value] of Object.entries(override)) {
        if (
            isObject(value) &&
            isObject(result[key])
        ) {
            result[key] = deepMerge(
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
        !object ||
        typeof path !== "string" ||
        path.length === 0
    ) {
        return undefined;
    }

    const parts = path.split(".");
    let current = object;

    for (const part of parts) {
        if (
            current === null ||
            current === undefined ||
            typeof current !== "object"
        ) {
            return undefined;
        }

        current = current[part];
    }

    return current;
}

function setPath(object, path, value) {
    if (
        !object ||
        typeof object !== "object" ||
        typeof path !== "string" ||
        path.length === 0
    ) {
        return false;
    }

    const parts = path.split(".");
    let current = object;

    for (
        let index = 0;
        index < parts.length - 1;
        index++
    ) {
        const part = parts[index];

        if (
            !current[part] ||
            typeof current[part] !== "object" ||
            Array.isArray(current[part])
        ) {
            current[part] = {};
        }

        current = current[part];
    }

    current[parts[parts.length - 1]] =
        clone(value);

    return true;
}

function deletePath(object, path) {
    if (
        !object ||
        typeof object !== "object" ||
        typeof path !== "string" ||
        path.length === 0
    ) {
        return false;
    }

    const parts = path.split(".");
    let current = object;

    for (
        let index = 0;
        index < parts.length - 1;
        index++
    ) {
        if (
            !current ||
            typeof current !== "object"
        ) {
            return false;
        }

        current = current[parts[index]];
    }

    if (
        current &&
        typeof current === "object"
    ) {
        delete current[
            parts[parts.length - 1]
        ];

        return true;
    }

    return false;
}

function clampNumber(
    value,
    minimum,
    maximum,
    fallback
) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        return fallback;
    }

    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
}

function booleanValue(value, fallback) {
    return typeof value === "boolean"
        ? value
        : fallback;
}

function stringValue(value, fallback) {
    return (
        typeof value === "string" &&
        value.length > 0
    )
        ? value
        : fallback;
}

function invalidateGlobalCache() {
    globalConfigCache = null;
    globalConfigLoaded = false;
}

function bumpRevision() {
    revision++;
}

function commitGlobalConfig(config) {
    const validated =
        createRuntimeConfig(config);

    const success =
        saveWorldConfig(validated);

    if (!success) {
        return false;
    }

    globalConfigCache =
        clone(validated);

    globalConfigLoaded = true;

    bumpRevision();

    return true;
}

function validateCamera(config) {
    if (!isObject(config.camera)) {
        config.camera =
            clone(DEFAULT_CONFIG.camera);
    }

    if (!isObject(config.camera.position)) {
        config.camera.position =
            clone(DEFAULT_CONFIG.camera.position);
    }

    if (!isObject(config.camera.firstPersonPosition)) {
        config.camera.firstPersonPosition =
            clone(
                DEFAULT_CONFIG.camera.firstPersonPosition
            );
    }

    if (!isObject(config.camera.thirdPersonPosition)) {
        config.camera.thirdPersonPosition =
            clone(
                DEFAULT_CONFIG.camera.thirdPersonPosition
            );
    }

    if (!isObject(config.camera.transition)) {
        config.camera.transition =
            clone(
                DEFAULT_CONFIG.camera.transition
            );
    }

    config.camera.mode =
        Object.values(CAMERA_MODES).includes(
            config.camera.mode
        )
            ? config.camera.mode
            : DEFAULT_CONFIG.camera.mode;

    config.camera.firstPersonPreset =
        stringValue(
            config.camera.firstPersonPreset,
            DEFAULT_CONFIG.camera.firstPersonPreset
        );

    config.camera.thirdPersonPreset =
        stringValue(
            config.camera.thirdPersonPreset,
            DEFAULT_CONFIG.camera.thirdPersonPreset
        );

    config.camera.fov =
        config.camera.fov === null
            ? null
            : clampNumber(
                config.camera.fov,
                30,
                110,
                DEFAULT_CONFIG.camera.fov
            );

    config.camera.fovCompatibility =
        booleanValue(
            config.camera.fovCompatibility,
            DEFAULT_CONFIG.camera.fovCompatibility
        );

    for (const axis of ["x", "y", "z"]) {
        config.camera.position[axis] =
            clampNumber(
                config.camera.position[axis],
                -16,
                16,
                DEFAULT_CONFIG.camera.position[axis]
            );

        config.camera.firstPersonPosition[axis] =
            clampNumber(
                config.camera.firstPersonPosition[axis],
                -16,
                16,
                DEFAULT_CONFIG.camera
                    .firstPersonPosition[axis]
            );

        config.camera.thirdPersonPosition[axis] =
            clampNumber(
                config.camera.thirdPersonPosition[axis],
                -16,
                16,
                DEFAULT_CONFIG.camera
                    .thirdPersonPosition[axis]
            );
    }

    config.camera.transition.enabled =
        booleanValue(
            config.camera.transition.enabled,
            DEFAULT_CONFIG.camera.transition.enabled
        );

    config.camera.transition.duration =
        clampNumber(
            config.camera.transition.duration,
            0,
            10,
            DEFAULT_CONFIG.camera.transition.duration
        );

    config.camera.transition.positionSmoothing =
        clampNumber(
            config.camera.transition.positionSmoothing,
            0,
            100,
            DEFAULT_CONFIG.camera.transition
                .positionSmoothing
        );

    config.camera.transition.rotationSmoothing =
        clampNumber(
            config.camera.transition.rotationSmoothing,
            0,
            100,
            DEFAULT_CONFIG.camera.transition
                .rotationSmoothing
        );
}

function validateBody(config) {
    if (!isObject(config.body)) {
        config.body =
            clone(DEFAULT_CONFIG.body);
    }

    if (!isObject(config.body.visibility)) {
        config.body.visibility =
            clone(
                DEFAULT_CONFIG.body.visibility
            );
    }

    if (!isObject(config.body.rendering)) {
        config.body.rendering =
            clone(
                DEFAULT_CONFIG.body.rendering
            );
    }

    config.body.enabled =
        booleanValue(
            config.body.enabled,
            DEFAULT_CONFIG.body.enabled
        );

    const visibility =
        config.body.visibility;

    visibility.mode =
        Object.values(VISIBILITY_MODES).includes(
            visibility.mode
        )
            ? visibility.mode
            : DEFAULT_CONFIG.body.visibility.mode;

    for (const key of [
        "firstPersonOnly",
        "thirdPersonOnly",
        "head",
        "body",
        "leftArm",
        "rightArm",
        "leftLeg",
        "rightLeg",
        "cape",
        "armor",
        "heldItem"
    ]) {
        visibility[key] =
            booleanValue(
                visibility[key],
                DEFAULT_CONFIG.body.visibility[key]
            );
    }

    const rendering =
        config.body.rendering;

    for (const key of [
        "showHead",
        "showBody",
        "showArms",
        "showLegs",
        "showCape",
        "showArmor",
        "showHeldItem"
    ]) {
        rendering[key] =
            booleanValue(
                rendering[key],
                DEFAULT_CONFIG.body.rendering[key]
            );
    }
}

function validateAnimation(config) {
    if (!isObject(config.animation)) {
        config.animation =
            clone(DEFAULT_CONFIG.animation);
    }

    const animation =
        config.animation;

    animation.enabled =
        booleanValue(
            animation.enabled,
            DEFAULT_CONFIG.animation.enabled
        );

    animation.smoothing =
        clampNumber(
            animation.smoothing,
            0,
            100,
            DEFAULT_CONFIG.animation.smoothing
        );

    animation.rotationSmoothing =
        clampNumber(
            animation.rotationSmoothing,
            0,
            100,
            DEFAULT_CONFIG.animation
                .rotationSmoothing
        );

    animation.movementScale =
        clampNumber(
            animation.movementScale,
            0,
            10,
            DEFAULT_CONFIG.animation.movementScale
        );

    for (const group of [
        "bob",
        "sway",
        "lean"
    ]) {
        if (!isObject(animation[group])) {
            animation[group] =
                clone(
                    DEFAULT_CONFIG.animation[group]
                );
        }

        animation[group].enabled =
            booleanValue(
                animation[group].enabled,
                DEFAULT_CONFIG.animation[group].enabled
            );

        animation[group].amount =
            clampNumber(
                animation[group].amount,
                0,
                10,
                DEFAULT_CONFIG.animation[group].amount
            );

        animation[group].maximum =
            clampNumber(
                animation[group].maximum,
                0,
                10,
                DEFAULT_CONFIG.animation[group].maximum
            );
    }

    if (!isObject(animation.poses)) {
        animation.poses =
            clone(
                DEFAULT_CONFIG.animation.poses
            );
    }

    for (const pose of Object.keys(
        DEFAULT_CONFIG.animation.poses
    )) {
        animation.poses[pose] =
            booleanValue(
                animation.poses[pose],
                DEFAULT_CONFIG.animation.poses[pose]
            );
    }
}

function validateGameplay(config) {
    if (!isObject(config.gameplay)) {
        config.gameplay =
            clone(DEFAULT_CONFIG.gameplay);
    }

    for (const key of Object.keys(
        DEFAULT_CONFIG.gameplay
    )) {
        config.gameplay[key] =
            booleanValue(
                config.gameplay[key],
                DEFAULT_CONFIG.gameplay[key]
            );
    }
}

function validateCompatibility(config) {
    if (!isObject(config.compatibility)) {
        config.compatibility =
            clone(
                DEFAULT_CONFIG.compatibility
            );
    }

    for (const key of [
        "addons",
        "resourcePacks",
        "texturePacks",
        "customAnimations",
        "customPlayerModels",
        "avoidEntityMutation",
        "avoidGameplayMutation",
        "avoidInputMutation"
    ]) {
        config.compatibility[key] =
            booleanValue(
                config.compatibility[key],
                DEFAULT_CONFIG.compatibility[key]
            );
    }

    config.compatibility.animationConflictPolicy =
        Object.values(
            ANIMATION_CONFLICT_POLICIES
        ).includes(
            config.compatibility.animationConflictPolicy
        )
            ? config.compatibility.animationConflictPolicy
            : DEFAULT_CONFIG.compatibility
                .animationConflictPolicy;

    config.compatibility.renderConflictPolicy =
        Object.values(
            RENDER_CONFLICT_POLICIES
        ).includes(
            config.compatibility.renderConflictPolicy
        )
            ? config.compatibility.renderConflictPolicy
            : DEFAULT_CONFIG.compatibility
                .renderConflictPolicy;
}

function validateMultiplayer(config) {
    if (!isObject(config.multiplayer)) {
        config.multiplayer =
            clone(
                DEFAULT_CONFIG.multiplayer
            );
    }

    for (const key of Object.keys(
        DEFAULT_CONFIG.multiplayer
    )) {
        config.multiplayer[key] =
            booleanValue(
                config.multiplayer[key],
                DEFAULT_CONFIG.multiplayer[key]
            );
    }
}

function validateControls(config) {
    if (!isObject(config.controls)) {
        config.controls =
            clone(DEFAULT_CONFIG.controls);
    }

    for (const key of Object.keys(
        DEFAULT_CONFIG.controls
    )) {
        config.controls[key] =
            booleanValue(
                config.controls[key],
                DEFAULT_CONFIG.controls[key]
            );
    }
}

function validatePerformance(config) {
    if (!isObject(config.performance)) {
        config.performance =
            clone(
                DEFAULT_CONFIG.performance
            );
    }

    const performance =
        config.performance;

    for (const key of [
        "enabled",
        "cachePlayerState",
        "cachePoseState",
        "cacheVisibilityState",
        "updateOnlyWhenChanged",
        "skipInvalidPlayers",
        "lowPowerMode"
    ]) {
        performance[key] =
            booleanValue(
                performance[key],
                DEFAULT_CONFIG.performance[key]
            );
    }

    performance.updateInterval =
        Math.max(
            1,
            Math.floor(
                clampNumber(
                    performance.updateInterval,
                    1,
                    20,
                    DEFAULT_CONFIG.performance
                        .updateInterval
                )
            )
        );

    performance.maxUpdatesPerTick =
        Math.max(
            1,
            Math.floor(
                clampNumber(
                    performance.maxUpdatesPerTick,
                    1,
                    100,
                    DEFAULT_CONFIG.performance
                        .maxUpdatesPerTick
                )
            )
        );
}

function validateDebugging(config) {
    if (!isObject(config.debugging)) {
        config.debugging =
            clone(
                DEFAULT_CONFIG.debugging
            );
    }

    for (const key of Object.keys(
        DEFAULT_CONFIG.debugging
    )) {
        config.debugging[key] =
            booleanValue(
                config.debugging[key],
                DEFAULT_CONFIG.debugging[key]
            );
    }
}

function validate(config = {}) {
    const result = deepMerge(
        DEFAULT_CONFIG,
        isObject(config)
            ? config
            : {}
    );

    result.version =
        CONFIG_VERSION;

    result.enabled =
        booleanValue(
            result.enabled,
            DEFAULT_CONFIG.enabled
        );

    validateCamera(result);
    validateBody(result);
    validateAnimation(result);
    validateGameplay(result);
    validateCompatibility(result);
    validateMultiplayer(result);
    validateControls(result);
    validatePerformance(result);
    validateDebugging(result);

    return result;
}

function createRuntimeConfig(config) {
    return validate(
        config ?? DEFAULT_CONFIG
    );
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
            config: null,
            revision: 0
        };

        playerConfigs.set(
            player,
            entry
        );
    }

    return entry;
}

function loadPlayerRuntimeConfig(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

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
        stored =
            loadPlayerConfig(player);
    } catch {
        stored = null;
    }

    entry.config =
        createRuntimeConfig(
            stored ?? {}
        );

    entry.loaded = true;
    entry.revision = revision;

    return clone(entry.config);
}

function loadGlobalRuntimeConfig() {
    if (
        globalConfigLoaded &&
        globalConfigCache
    ) {
        return clone(
            globalConfigCache
        );
    }

    let stored = null;

    try {
        stored =
            loadWorldConfig();
    } catch {
        stored = null;
    }

    const validated =
        createRuntimeConfig(
            stored ?? {}
        );

    if (
        !stored ||
        JSON.stringify(stored) !==
        JSON.stringify(validated)
    ) {
        try {
            saveWorldConfig(validated);
        } catch {
        }
    }

    globalConfigCache =
        clone(validated);

    globalConfigLoaded = true;

    return clone(validated);
}

function getEffectiveConfig(player) {
    const globalConfig =
        loadGlobalRuntimeConfig();

    if (!isValidPlayer(player)) {
        return globalConfig;
    }

    const playerConfig =
        loadPlayerRuntimeConfig(player);

    if (!playerConfig) {
        return globalConfig;
    }

    return validate(
        deepMerge(
            globalConfig,
            playerConfig
        )
    );
}

function savePlayerRuntimeConfig(
    player,
    config
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const validated =
        createRuntimeConfig(config);

    let success = false;

    try {
        success =
            savePlayerConfig(
                player,
                validated
            );
    } catch {
        success = false;
    }

    if (!success) {
        return false;
    }

    const entry =
        getPlayerEntry(player);

    if (entry) {
        entry.loaded = true;
        entry.config =
            clone(validated);
        entry.revision =
            revision + 1;
    }

    bumpRevision();

    return true;
}

function setMultiple(
    values,
    player = null
) {
    if (!isObject(values)) {
        return false;
    }

    const isGlobal =
        player === null;

    if (
        !isGlobal &&
        !isValidPlayer(player)
    ) {
        return false;
    }

    const allowedPaths =
        isGlobal
            ? GLOBAL_PATHS
            : PLAYER_PATHS;

    for (const path of Object.keys(values)) {
        if (!allowedPaths.has(path)) {
            return false;
        }
    }

    const config =
        isGlobal
            ? loadGlobalRuntimeConfig()
            : loadPlayerRuntimeConfig(player);

    if (!config) {
        return false;
    }

    for (const [path, value] of Object.entries(
        values
    )) {
        setPath(
            config,
            path,
            value
        );
    }

    const validated =
        createRuntimeConfig(config);

    if (isGlobal) {
        return commitGlobalConfig(
            validated
        );
    }

    return savePlayerRuntimeConfig(
        player,
        validated
    );
}

export function initialize() {
    const config =
        loadGlobalRuntimeConfig();

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
    return loadGlobalRuntimeConfig();
}

export function getPlayerConfig(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return loadPlayerRuntimeConfig(
        player
    );
}

export function get(
    path,
    player = null
) {
    if (
        typeof path !== "string" ||
        path.length === 0
    ) {
        return undefined;
    }

    return clone(
        getPath(
            getEffectiveConfig(player),
            path
        )
    );
}

export function getGlobal(path) {
    if (
        typeof path !== "string" ||
        path.length === 0
    ) {
        return undefined;
    }

    return clone(
        getPath(
            getGlobalConfig(),
            path
        )
    );
}

export function getPlayer(
    path,
    player
) {
    if (
        !isValidPlayer(player) ||
        typeof path !== "string" ||
        path.length === 0
    ) {
        return undefined;
    }

    return clone(
        getPath(
            getPlayerConfig(player),
            path
        )
    );
}

export function set(
    path,
    value,
    player = null
) {
    if (
        typeof path !== "string" ||
        path.length === 0
    ) {
        return false;
    }

    const isGlobal =
        player === null;

    if (
        !isGlobal &&
        !isValidPlayer(player)
    ) {
        return false;
    }

    const allowedPaths =
        isGlobal
            ? GLOBAL_PATHS
            : PLAYER_PATHS;

    if (!allowedPaths.has(path)) {
        return false;
    }

    const config =
        isGlobal
            ? loadGlobalRuntimeConfig()
            : loadPlayerRuntimeConfig(player);

    if (!config) {
        return false;
    }

    if (!setPath(config, path, value)) {
        return false;
    }

    const validated =
        createRuntimeConfig(config);

    if (isGlobal) {
        return commitGlobalConfig(
            validated
        );
    }

    return savePlayerRuntimeConfig(
        player,
        validated
    );
}

export function setGlobal(
    path,
    value
) {
    return set(
        path,
        value,
        null
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

export function reset(player = null) {
    if (player === null) {
        let success = false;

        try {
            success =
                deleteWorldConfig();
        } catch {
            success = false;
        }

        invalidateGlobalCache();

        if (success) {
            initialized = false;
            initialize();
            bumpRevision();
        }

        return success;
    }

    if (!isValidPlayer(player)) {
        return false;
    }

    let success = false;

    try {
        success =
            deletePlayerConfig(player);
    } catch {
        success = false;
    }

    if (success) {
        playerConfigs.delete(player);
        bumpRevision();
    }

    return success;
}

export function resetGlobal() {
    return reset(null);
}

export function resetPlayer(player) {
    return reset(player);
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
        !Object.values(CAMERA_MODES).includes(
            mode
        )
    ) {
        return false;
    }

    return set(
        "camera.mode",
        mode,
        player
    );
}

export function getCameraMode(
    player = null
) {
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

    return setMultiple(
        {
            "camera.firstPersonPosition.x":
                position.x ?? current.x,

            "camera.firstPersonPosition.y":
                position.y ?? current.y,

            "camera.firstPersonPosition.z":
                position.z ?? current.z
        },
        player
    );
}

export function getFirstPersonPosition(
    player = null
) {
    const position =
        getEffectiveConfig(player)
            .camera
            .firstPersonPosition;

    return {
        x: position.x,
        y: position.y,
        z: position.z
    };
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

    return setMultiple(
        {
            "camera.thirdPersonPosition.x":
                position.x ?? current.x,

            "camera.thirdPersonPosition.y":
                position.y ?? current.y,

            "camera.thirdPersonPosition.z":
                position.z ?? current.z
        },
        player
    );
}

export function getThirdPersonPosition(
    player = null
) {
    const position =
        getEffectiveConfig(player)
            .camera
            .thirdPersonPosition;

    return {
        x: position.x,
        y: position.y,
        z: position.z
    };
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

export function getFov(
    player = null
) {
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
    const paths = {
        head: "body.visibility.head",
        body: "body.visibility.body",
        leftArm: "body.visibility.leftArm",
        rightArm: "body.visibility.rightArm",
        leftLeg: "body.visibility.leftLeg",
        rightLeg: "body.visibility.rightLeg",
        cape: "body.visibility.cape",
        armor: "body.visibility.armor",
        heldItem: "body.visibility.heldItem"
    };

    const path = paths[part];

    if (!path) {
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
    const paths = {
        head: "body.visibility.head",
        body: "body.visibility.body",
        leftArm: "body.visibility.leftArm",
        rightArm: "body.visibility.rightArm",
        leftLeg: "body.visibility.leftLeg",
        rightLeg: "body.visibility.rightLeg",
        cape: "body.visibility.cape",
        armor: "body.visibility.armor",
        heldItem: "body.visibility.heldItem"
    };

    const path = paths[part];

    if (!path) {
        return false;
    }

    return Boolean(
        get(
            path,
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

export function setPerformancePreset(
    name
) {
    if (
        typeof name !== "string" ||
        !Object.prototype.hasOwnProperty.call(
            PERFORMANCE_PRESETS,
            name
        )
    ) {
        return false;
    }

    const config =
        getGlobalConfig();

    config.performance =
        deepMerge(
            config.performance,
            PERFORMANCE_PRESETS[name]
        );

    return commitGlobalConfig(
        config
    );
}

export function getPerformanceConfig() {
    return clone(
        getGlobalConfig().performance
    );
}

export function getCompatibilityConfig() {
    return clone(
        getGlobalConfig().compatibility
    );
}

export function getGameplayConfig() {
    return clone(
        getGlobalConfig().gameplay
    );
}

export function getControlsConfig() {
    return clone(
        getGlobalConfig().controls
    );
}

export function getMultiplayerConfig() {
    return clone(
        getGlobalConfig().multiplayer
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

export function getDebugConfig() {
    return clone(
        getGlobalConfig().debugging
    );
}

export function save(player = null) {
    if (player === null) {
        return commitGlobalConfig(
            getGlobalConfig()
        );
    }

    if (!isValidPlayer(player)) {
        return false;
    }

    const config =
        getPlayerConfig(player);

    if (!config) {
        return false;
    }

    return savePlayerRuntimeConfig(
        player,
        config
    );
}

export function reload(player = null) {
    if (player === null) {
        invalidateGlobalCache();
        initialized = false;

        return initialize();
    }

    if (!isValidPlayer(player)) {
        return null;
    }

    playerConfigs.delete(player);

    return loadPlayerRuntimeConfig(
        player
    );
}

export function clearPlayerCache(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return playerConfigs.delete(player);
}

export function clearCaches() {
    playerConfigs =
        new WeakMap();

    invalidateGlobalCache();

    bumpRevision();

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
    return (
        typeof path === "string" &&
        GLOBAL_PATHS.has(path)
    );
}

export function hasPlayerPath(path) {
    return (
        typeof path === "string" &&
        PLAYER_PATHS.has(path)
    );
}

export function deleteGlobalValue(path) {
    if (
        typeof path !== "string" ||
        !GLOBAL_PATHS.has(path)
    ) {
        return false;
    }

    const config =
        getGlobalConfig();

    if (!deletePath(config, path)) {
        return false;
    }

    return commitGlobalConfig(
        config
    );
}

export function deletePlayerValue(
    path,
    player
) {
    if (
        !isValidPlayer(player) ||
        typeof path !== "string" ||
        !PLAYER_PATHS.has(path)
    ) {
        return false;
    }

    const config =
        getPlayerConfig(player);

    if (!config) {
        return false;
    }

    if (!deletePath(config, path)) {
        return false;
    }

    return savePlayerRuntimeConfig(
        player,
        config
    );
}

export function getConfigurationStatus() {
    return {
        initialized,
        version: CONFIG_VERSION,
        revision,
        globalLoaded: globalConfigLoaded,
        hasGlobalCache:
            globalConfigCache !== null
    };
}