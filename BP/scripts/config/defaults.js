export const CONFIG_VERSION = 2;

export const CAMERA_MODES = Object.freeze({
    FIRST_PERSON: "first_person",
    THIRD_PERSON: "third_person"
});

export const VISIBILITY_MODES = Object.freeze({
    FULL: "full",
    VANILLA: "vanilla",
    CUSTOM: "custom",
    HIDDEN: "hidden"
});

export const ANIMATION_CONFLICT_POLICIES = Object.freeze({
    MINIMAL: "minimal",
    VANILLA_PRIORITY: "vanilla_priority",
    VANTAGE_PRIORITY: "vantage_priority"
});

export const RENDER_CONFLICT_POLICIES = Object.freeze({
    MINIMAL: "minimal",
    VANILLA_PRIORITY: "vanilla_priority",
    VANTAGE_PRIORITY: "vantage_priority"
});

export const PERFORMANCE_PRESETS = Object.freeze({
    QUALITY: Object.freeze({
        enabled: true,

        updateInterval: 1,
        maxUpdatesPerTick: 100,

        cachePlayerState: true,
        cachePoseState: true,
        cacheVisibilityState: true,

        updateOnlyWhenChanged: false,
        skipInvalidPlayers: true,

        lowPowerMode: false
    }),

    BALANCED: Object.freeze({
        enabled: true,

        updateInterval: 1,
        maxUpdatesPerTick: 32,

        cachePlayerState: true,
        cachePoseState: true,
        cacheVisibilityState: true,

        updateOnlyWhenChanged: true,
        skipInvalidPlayers: true,

        lowPowerMode: false
    }),

    PERFORMANCE: Object.freeze({
        enabled: true,

        updateInterval: 2,
        maxUpdatesPerTick: 16,

        cachePlayerState: true,
        cachePoseState: true,
        cacheVisibilityState: true,

        updateOnlyWhenChanged: true,
        skipInvalidPlayers: true,

        lowPowerMode: true
    }),

    LOW_POWER: Object.freeze({
        enabled: true,

        updateInterval: 4,
        maxUpdatesPerTick: 8,

        cachePlayerState: true,
        cachePoseState: true,
        cacheVisibilityState: true,

        updateOnlyWhenChanged: true,
        skipInvalidPlayers: true,

        lowPowerMode: true
    })
});

export const DEFAULT_CAMERA_CONFIG = Object.freeze({
    mode: CAMERA_MODES.FIRST_PERSON,

    firstPersonPreset: "vantage:first_person",
    thirdPersonPreset: "vantage:third_person",

    position: Object.freeze({
        x: 0,
        y: 0,
        z: 0
    }),

    firstPersonPosition: Object.freeze({
        x: 0,
        y: 0,
        z: 0
    }),

    thirdPersonPosition: Object.freeze({
        x: 0,
        y: 0,
        z: 0
    }),

    fov: null,

    fovCompatibility: true,

    transition: Object.freeze({
        enabled: true,

        duration: 0.2,

        positionSmoothing: 16,
        rotationSmoothing: 18
    })
});

export const DEFAULT_BODY_CONFIG = Object.freeze({
    enabled: true,

    visibility: Object.freeze({
        mode: VISIBILITY_MODES.FULL,

        firstPersonOnly: true,
        thirdPersonOnly: false,

        head: true,
        body: true,

        leftArm: true,
        rightArm: true,

        leftLeg: true,
        rightLeg: true,

        cape: true,
        armor: true,
        heldItem: true
    }),

    rendering: Object.freeze({
        showHead: true,
        showBody: true,
        showArms: true,
        showLegs: true,
        showCape: true,
        showArmor: true,
        showHeldItem: true
    })
});

export const DEFAULT_VISIBILITY_CONFIG =
    DEFAULT_BODY_CONFIG.visibility;

export const DEFAULT_ANIMATION_CONFIG = Object.freeze({
    enabled: true,

    smoothing: 14,
    rotationSmoothing: 18,

    movementScale: 1,

    bob: Object.freeze({
        enabled: true,
        amount: 1,
        maximum: 1
    }),

    sway: Object.freeze({
        enabled: true,
        amount: 1,
        maximum: 1
    }),

    lean: Object.freeze({
        enabled: true,
        amount: 1,
        maximum: 1
    }),

    poses: Object.freeze({
        idle: true,
        walking: true,
        sprinting: true,
        sneaking: true,
        swimming: true,
        crawling: true,
        jumping: true,
        falling: true,
        climbing: true,
        gliding: true,
        riding: true,
        flying: true
    })
});

export const DEFAULT_GAMEPLAY_CONFIG = Object.freeze({
    preserveVanillaInteraction: true,
    preserveVanillaHitDetection: true,
    preserveVanillaReach: true,
    preserveVanillaMovement: true,
    preserveVanillaControls: true,
    preserveVanillaFov: true
});

export const DEFAULT_COMPATIBILITY_CONFIG = Object.freeze({
    addons: true,
    resourcePacks: true,
    texturePacks: true,

    customAnimations: true,
    customPlayerModels: true,

    animationConflictPolicy:
        ANIMATION_CONFLICT_POLICIES.MINIMAL,

    renderConflictPolicy:
        RENDER_CONFLICT_POLICIES.MINIMAL,

    avoidEntityMutation: true,
    avoidGameplayMutation: true,
    avoidInputMutation: true
});

export const DEFAULT_MULTIPLAYER_CONFIG = Object.freeze({
    enabled: true,

    clientOnlyVisuals: true,

    synchronizeCamera: false,
    synchronizePose: false,
    synchronizeVisibility: false
});

export const DEFAULT_CONTROLS_CONFIG = Object.freeze({
    touch: true,
    mouseKeyboard: true,
    controller: true,

    preserveSensitivity: true,
    preserveTouchLayout: true,
    preserveControllerBindings: true
});

export const DEFAULT_PERFORMANCE_CONFIG = Object.freeze({
    enabled: true,

    updateInterval: 1,

    maxUpdatesPerTick: 32,

    cachePlayerState: true,
    cachePoseState: true,
    cacheVisibilityState: true,

    updateOnlyWhenChanged: true,
    skipInvalidPlayers: true,

    lowPowerMode: false
});

export const DEFAULT_DEBUG_CONFIG = Object.freeze({
    enabled: false,

    logging: false,

    cameraLogging: false,
    animationLogging: false,
    compatibilityLogging: false,
    performanceLogging: false
});

export const DEFAULT_CONFIG = Object.freeze({
    version: CONFIG_VERSION,

    enabled: true,

    camera: DEFAULT_CAMERA_CONFIG,

    body: DEFAULT_BODY_CONFIG,

    animation: DEFAULT_ANIMATION_CONFIG,

    gameplay: DEFAULT_GAMEPLAY_CONFIG,

    compatibility: DEFAULT_COMPATIBILITY_CONFIG,

    multiplayer: DEFAULT_MULTIPLAYER_CONFIG,

    controls: DEFAULT_CONTROLS_CONFIG,

    performance: DEFAULT_PERFORMANCE_CONFIG,

    debugging: DEFAULT_DEBUG_CONFIG
});

export function getDefaultConfig() {
    return DEFAULT_CONFIG;
}

export function getDefaultCameraConfig() {
    return DEFAULT_CAMERA_CONFIG;
}

export function getDefaultBodyConfig() {
    return DEFAULT_BODY_CONFIG;
}

export function getDefaultVisibilityConfig() {
    return DEFAULT_VISIBILITY_CONFIG;
}

export function getDefaultAnimationConfig() {
    return DEFAULT_ANIMATION_CONFIG;
}

export function getDefaultGameplayConfig() {
    return DEFAULT_GAMEPLAY_CONFIG;
}

export function getDefaultCompatibilityConfig() {
    return DEFAULT_COMPATIBILITY_CONFIG;
}

export function getDefaultMultiplayerConfig() {
    return DEFAULT_MULTIPLAYER_CONFIG;
}

export function getDefaultControlsConfig() {
    return DEFAULT_CONTROLS_CONFIG;
}

export function getDefaultPerformanceConfig() {
    return DEFAULT_PERFORMANCE_CONFIG;
}

export function getDefaultDebugConfig() {
    return DEFAULT_DEBUG_CONFIG;
}

export function getPerformancePreset(
    name = "BALANCED"
) {
    if (
        typeof name !== "string" ||
        name.length === 0
    ) {
        return PERFORMANCE_PRESETS.BALANCED;
    }

    const normalized =
        name.trim().toUpperCase();

    return (
        PERFORMANCE_PRESETS[normalized] ??
        PERFORMANCE_PRESETS.BALANCED
    );
}