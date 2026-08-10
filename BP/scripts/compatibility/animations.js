import {
    getAnimationConfig,
    getCompatibilityConfig
} from "../config/config.js";

import {
    getCompatibilityStatus,
    getRecommendedAnimationStrategy,
    playerHasConflicts,
    playerSupports,
    updatePlayerCompatibility
} from "./packs.js";

const ANIMATION_STRATEGIES = Object.freeze({
    VANTAGE: "vantage",
    MINIMAL: "minimal",
    VANILLA: "vanilla",
    DISABLED: "disabled"
});

const ANIMATION_STATES = Object.freeze({
    UNKNOWN: "unknown",
    IDLE: "idle",
    WALKING: "walking",
    SPRINTING: "sprinting",
    SNEAKING: "sneaking",
    SWIMMING: "swimming",
    CRAWLING: "crawling",
    JUMPING: "jumping",
    FALLING: "falling",
    CLIMBING: "climbing",
    GLIDING: "gliding",
    RIDING: "riding",
    FLYING: "flying"
});

const ANIMATION_LAYERS = Object.freeze({
    BASE: "base",
    MOVEMENT: "movement",
    POSE: "pose",
    CAMERA: "camera",
    OVERLAY: "overlay",
    EXTERNAL: "external"
});

const CONFLICT_TYPES = Object.freeze({
    CUSTOM_ANIMATION: "custom_animation",
    CUSTOM_PLAYER_MODEL: "custom_player_model",
    EXTERNAL_CONTROLLER: "external_animation_controller",
    EXTERNAL_RENDER_CONTROLLER: "external_render_controller",
    UNKNOWN: "unknown"
});

const CONFLICT_POLICIES = Object.freeze({
    PRESERVE: "preserve",
    MINIMAL: "minimal",
    VANTAGE: "vantage",
    DISABLE: "disable"
});

const playerStates = new WeakMap();
const animationProfiles = new Map();
const registeredControllers = new Map();

let revision = 0;
let initialized = false;

function clone(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (
        typeof value !== "object" ||
        value instanceof Date
    ) {
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return null;
    }
}

function isValidPlayer(player) {
    try {
        return Boolean(
            player &&
            typeof player.isValid === "function" &&
            player.isValid()
        );
    } catch {
        return false;
    }
}

function normalizeString(value, fallback = "") {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : fallback;
}

function normalizeNumber(value, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : fallback;
}

function normalizeBoolean(value, fallback = false) {
    return typeof value === "boolean"
        ? value
        : fallback;
}

function normalizeArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [
        ...new Set(
            value
                .filter(
                    item =>
                        typeof item === "string" &&
                        item.trim().length > 0
                )
                .map(item => item.trim())
        )
    ];
}

function normalizeLayer(layer) {
    return Object.values(ANIMATION_LAYERS).includes(layer)
        ? layer
        : ANIMATION_LAYERS.BASE;
}

function normalizeState(state) {
    return Object.values(ANIMATION_STATES).includes(state)
        ? state
        : ANIMATION_STATES.UNKNOWN;
}

function normalizeStrategy(strategy) {
    return Object.values(ANIMATION_STRATEGIES).includes(strategy)
        ? strategy
        : ANIMATION_STRATEGIES.VANILLA;
}

function normalizePolicy(policy) {
    return Object.values(CONFLICT_POLICIES).includes(policy)
        ? policy
        : CONFLICT_POLICIES.PRESERVE;
}

function bumpRevision() {
    revision++;
}

function createPlayerState() {
    return {
        state: ANIMATION_STATES.UNKNOWN,
        previousState: ANIMATION_STATES.UNKNOWN,
        strategy: ANIMATION_STRATEGIES.VANILLA,
        enabled: true,
        externalAnimationDetected: false,
        customModelDetected: false,
        controllerConflict: false,
        renderConflict: false,
        conflicts: [],
        activeLayers: [],
        activeAnimations: [],
        blockedAnimations: [],
        lastUpdate: 0,
        revision
    };
}

function getPlayerState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    let state = playerStates.get(player);

    if (!state) {
        state = createPlayerState();
        playerStates.set(player, state);
    }

    return state;
}

function getAnimationProfile(identifier) {
    const id = normalizeString(identifier);

    if (!id) {
        return null;
    }

    return animationProfiles.get(id) ?? null;
}

function normalizeAnimationProfile(identifier, profile = {}) {
    const id = normalizeString(identifier);

    if (!id) {
        return null;
    }

    const source =
        profile &&
            typeof profile === "object"
            ? profile
            : {};

    return {
        identifier: id,
        name: normalizeString(
            source.name,
            id
        ),
        enabled: normalizeBoolean(
            source.enabled,
            true
        ),
        priority: normalizeNumber(
            source.priority,
            0
        ),
        layer: normalizeLayer(
            source.layer
        ),
        external: normalizeBoolean(
            source.external,
            false
        ),
        customModel: normalizeBoolean(
            source.customModel,
            false
        ),
        controller: normalizeBoolean(
            source.controller,
            false
        ),
        renderController: normalizeBoolean(
            source.renderController,
            false
        ),
        states: normalizeArray(
            source.states
        ),
        conflicts: normalizeArray(
            source.conflicts
        ),
        metadata: clone(
            source.metadata ?? {}
        )
    };
}

function getAnimationConfigSafe() {
    try {
        const config = getAnimationConfig();

        return (
            config &&
                typeof config === "object"
                ? config
                : {}
        );
    } catch {
        return {};
    }
}

function getCompatibilityConfigSafe() {
    try {
        const config = getCompatibilityConfig();

        return (
            config &&
                typeof config === "object"
                ? config
                : {}
        );
    } catch {
        return {};
    }
}

function getConfiguredAnimationEnabled() {
    const config = getAnimationConfigSafe();

    return config.enabled !== false;
}

function getConfiguredPolicy() {
    const compatibility =
        getCompatibilityConfigSafe();

    return normalizePolicy(
        compatibility.animationConflictPolicy
    );
}

function getPoseEnabled(state) {
    const config =
        getAnimationConfigSafe();

    const poses =
        config.poses &&
            typeof config.poses === "object"
            ? config.poses
            : {};

    const poseMap = {
        [ANIMATION_STATES.IDLE]: poses.idle,
        [ANIMATION_STATES.WALKING]: poses.walking,
        [ANIMATION_STATES.SPRINTING]: poses.sprinting,
        [ANIMATION_STATES.SNEAKING]: poses.sneaking,
        [ANIMATION_STATES.SWIMMING]: poses.swimming,
        [ANIMATION_STATES.CRAWLING]: poses.crawling,
        [ANIMATION_STATES.JUMPING]: poses.jumping,
        [ANIMATION_STATES.FALLING]: poses.falling,
        [ANIMATION_STATES.CLIMBING]: poses.climbing,
        [ANIMATION_STATES.GLIDING]: poses.gliding,
        [ANIMATION_STATES.RIDING]: poses.riding,
        [ANIMATION_STATES.FLYING]: poses.flying
    };

    return poseMap[state] !== false;
}

function detectPlayerConflictState(player) {
    if (!isValidPlayer(player)) {
        return {
            externalAnimationDetected: false,
            customModelDetected: false,
            controllerConflict: false,
            renderConflict: false
        };
    }

    const compatibility =
        getCompatibilityConfigSafe();

    let controllerConflict = false;
    let renderConflict = false;
    let packConflict = false;

    try {
        controllerConflict =
            playerSupports(
                player,
                "animation_controllers"
            ) ||
            playerHasConflicts(player);
    } catch {
        controllerConflict = false;
    }

    try {
        renderConflict =
            playerSupports(
                player,
                "custom_render_controllers"
            ) ||
            playerSupports(
                player,
                "custom_player_rendering"
            );
    } catch {
        renderConflict = false;
    }

    try {
        packConflict =
            playerHasConflicts(player);
    } catch {
        packConflict = false;
    }

    return {
        externalAnimationDetected:
            compatibility.customAnimations === true,

        customModelDetected:
            compatibility.customPlayerModels === true,

        controllerConflict:
            controllerConflict || packConflict,

        renderConflict
    };
}

function getRecommendedStrategy(player) {
    try {
        return normalizeStrategy(
            getRecommendedAnimationStrategy(player)
        );
    } catch {
        return ANIMATION_STRATEGIES.VANILLA;
    }
}

function calculateStrategy(player) {
    if (!getConfiguredAnimationEnabled()) {
        return ANIMATION_STRATEGIES.DISABLED;
    }

    const state = getPlayerState(player);

    if (!state) {
        return ANIMATION_STRATEGIES.VANILLA;
    }

    const policy = getConfiguredPolicy();

    if (policy === CONFLICT_POLICIES.DISABLE) {
        return ANIMATION_STRATEGIES.DISABLED;
    }

    if (policy === CONFLICT_POLICIES.MINIMAL) {
        return ANIMATION_STRATEGIES.MINIMAL;
    }

    if (policy === CONFLICT_POLICIES.VANTAGE) {
        return ANIMATION_STRATEGIES.VANTAGE;
    }

    const recommended =
        getRecommendedStrategy(player);

    if (
        recommended === ANIMATION_STRATEGIES.DISABLED ||
        recommended === ANIMATION_STRATEGIES.VANILLA
    ) {
        return recommended;
    }

    if (
        state.customModelDetected ||
        state.controllerConflict ||
        state.renderConflict ||
        state.externalAnimationDetected
    ) {
        return ANIMATION_STRATEGIES.MINIMAL;
    }

    return ANIMATION_STRATEGIES.VANTAGE;
}

function addConflict(state, conflict) {
    if (!Object.values(CONFLICT_TYPES).includes(conflict)) {
        return;
    }

    if (!state.conflicts.includes(conflict)) {
        state.conflicts.push(conflict);
    }
}

function updateConflictState(player) {
    const state = getPlayerState(player);

    if (!state) {
        return null;
    }

    const detected =
        detectPlayerConflictState(player);

    state.externalAnimationDetected =
        detected.externalAnimationDetected;

    state.customModelDetected =
        detected.customModelDetected;

    state.controllerConflict =
        detected.controllerConflict;

    state.renderConflict =
        detected.renderConflict;

    state.conflicts = [];

    if (state.externalAnimationDetected) {
        addConflict(
            state,
            CONFLICT_TYPES.CUSTOM_ANIMATION
        );
    }

    if (state.customModelDetected) {
        addConflict(
            state,
            CONFLICT_TYPES.CUSTOM_PLAYER_MODEL
        );
    }

    if (state.controllerConflict) {
        addConflict(
            state,
            CONFLICT_TYPES.EXTERNAL_CONTROLLER
        );
    }

    if (state.renderConflict) {
        addConflict(
            state,
            CONFLICT_TYPES.EXTERNAL_RENDER_CONTROLLER
        );
    }

    try {
        if (state.conflicts.length > 0) {
            updatePlayerCompatibility(
                player,
                {
                    conflicts: [...state.conflicts]
                }
            );
        }
    } catch {
    }

    state.strategy =
        calculateStrategy(player);

    state.lastUpdate = Date.now();
    state.revision = revision;

    return state;
}

function setCurrentState(player, nextState) {
    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    const normalized =
        normalizeState(nextState);

    if (
        normalized === ANIMATION_STATES.UNKNOWN &&
        nextState !== ANIMATION_STATES.UNKNOWN
    ) {
        return false;
    }

    if (state.state !== normalized) {
        state.previousState = state.state;
        state.state = normalized;
    }

    state.lastUpdate = Date.now();

    return true;
}

function getCurrentState(player) {
    const state =
        getPlayerState(player);

    return state?.state ??
        ANIMATION_STATES.UNKNOWN;
}

function canPlayAnimation(
    player,
    animationIdentifier
) {
    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    const animation =
        getAnimationProfile(
            animationIdentifier
        );

    if (!animation) {
        return (
            state.strategy !==
            ANIMATION_STRATEGIES.DISABLED &&
            state.strategy !==
            ANIMATION_STRATEGIES.VANILLA
        );
    }

    if (!animation.enabled) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.DISABLED
    ) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.VANILLA
    ) {
        return false;
    }

    if (
        animation.external &&
        state.externalAnimationDetected
    ) {
        return false;
    }

    if (
        animation.customModel &&
        state.customModelDetected
    ) {
        return false;
    }

    if (
        animation.controller &&
        state.controllerConflict
    ) {
        return false;
    }

    if (
        animation.renderController &&
        state.renderConflict
    ) {
        return false;
    }

    if (
        animation.states.length > 0 &&
        !animation.states.includes(
            state.state
        )
    ) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.MINIMAL
    ) {
        if (
            animation.layer ===
            ANIMATION_LAYERS.BASE ||
            animation.layer ===
            ANIMATION_LAYERS.MOVEMENT ||
            animation.layer ===
            ANIMATION_LAYERS.POSE
        ) {
            return false;
        }
    }

    return true;
}

function shouldApplyLayer(player, layer) {
    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    if (
        !Object.values(
            ANIMATION_LAYERS
        ).includes(layer)
    ) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.DISABLED
    ) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.VANILLA
    ) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.MINIMAL
    ) {
        return (
            layer === ANIMATION_LAYERS.CAMERA ||
            layer === ANIMATION_LAYERS.OVERLAY
        );
    }

    return true;
}

function registerAnimationInternal(
    identifier,
    profile = {},
    shouldBump = true
) {
    const normalized =
        normalizeAnimationProfile(
            identifier,
            profile
        );

    if (!normalized) {
        return false;
    }

    animationProfiles.set(
        normalized.identifier,
        normalized
    );

    if (shouldBump) {
        bumpRevision();
    }

    return true;
}

function registerControllerInternal(
    identifier,
    profile = {},
    shouldBump = true
) {
    const id =
        normalizeString(identifier);

    if (!id) {
        return false;
    }

    const source =
        profile &&
            typeof profile === "object"
            ? profile
            : {};

    registeredControllers.set(
        id,
        {
            identifier: id,
            enabled: normalizeBoolean(
                source.enabled,
                true
            ),
            priority: normalizeNumber(
                source.priority,
                0
            ),
            conflicts: normalizeArray(
                source.conflicts
            ),
            metadata: clone(
                source.metadata ?? {}
            )
        }
    );

    if (shouldBump) {
        bumpRevision();
    }

    return true;
}

function sortAnimations(animations) {
    return [...animations].sort(
        (a, b) =>
            b.priority - a.priority ||
            a.identifier.localeCompare(
                b.identifier
            )
    );
}

function rebuildPlayerAnimationLists(player) {
    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    state.activeLayers = Object.values(
        ANIMATION_LAYERS
    ).filter(
        layer =>
            shouldApplyLayer(
                player,
                layer
            )
    );

    const animations =
        sortAnimations(
            animationProfiles.values()
        );

    state.activeAnimations = [];
    state.blockedAnimations = [];

    for (const animation of animations) {
        if (
            canPlayAnimation(
                player,
                animation.identifier
            )
        ) {
            state.activeAnimations.push(
                animation.identifier
            );
        } else {
            state.blockedAnimations.push(
                animation.identifier
            );
        }
    }

    return true;
}

export function initialize() {
    if (initialized) {
        return getSnapshot();
    }

    registerAnimationInternal(
        "vantage:camera",
        {
            name: "Vantage Camera Animation",
            layer: ANIMATION_LAYERS.CAMERA,
            priority: 100,
            states: Object.values(
                ANIMATION_STATES
            )
        },
        false
    );

    registerAnimationInternal(
        "vantage:body",
        {
            name: "Vantage Body Animation",
            layer: ANIMATION_LAYERS.MOVEMENT,
            priority: 50,
            states: Object.values(
                ANIMATION_STATES
            )
        },
        false
    );

    registerAnimationInternal(
        "vantage:pose",
        {
            name: "Vantage Pose Animation",
            layer: ANIMATION_LAYERS.POSE,
            priority: 40,
            states: Object.values(
                ANIMATION_STATES
            )
        },
        false
    );

    registerControllerInternal(
        "vantage:first_person",
        {
            enabled: true,
            priority: 100
        },
        false
    );

    initialized = true;
    bumpRevision();

    return getSnapshot();
}

export function registerAnimation(
    identifier,
    profile = {}
) {
    return registerAnimationInternal(
        identifier,
        profile
    );
}

export function unregisterAnimation(identifier) {
    const id =
        normalizeString(identifier);

    if (!id) {
        return false;
    }

    const result =
        animationProfiles.delete(id);

    if (result) {
        bumpRevision();
    }

    return result;
}

export function getAnimation(identifier) {
    const animation =
        getAnimationProfile(identifier);

    return animation
        ? clone(animation)
        : null;
}

export function getAnimations() {
    return clone(
        sortAnimations(
            animationProfiles.values()
        )
    );
}

export function registerController(
    identifier,
    profile = {}
) {
    return registerControllerInternal(
        identifier,
        profile
    );
}

export function unregisterController(identifier) {
    const id =
        normalizeString(identifier);

    if (!id) {
        return false;
    }

    const result =
        registeredControllers.delete(id);

    if (result) {
        bumpRevision();
    }

    return result;
}

export function getController(identifier) {
    const controller =
        registeredControllers.get(
            normalizeString(identifier)
        );

    return controller
        ? clone(controller)
        : null;
}

export function getControllers() {
    return clone(
        [...registeredControllers.values()]
            .sort(
                (a, b) =>
                    b.priority - a.priority ||
                    a.identifier.localeCompare(
                        b.identifier
                    )
            )
    );
}

export function setPlayerAnimationState(
    player,
    state
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (!setCurrentState(player, state)) {
        return false;
    }

    updateConflictState(player);
    rebuildPlayerAnimationLists(player);

    return true;
}

export function getPlayerAnimationState(player) {
    return getCurrentState(player);
}

export function getPreviousAnimationState(player) {
    const state =
        getPlayerState(player);

    return state?.previousState ??
        ANIMATION_STATES.UNKNOWN;
}

export function getPlayerAnimationStrategy(player) {
    if (!isValidPlayer(player)) {
        return ANIMATION_STRATEGIES.VANILLA;
    }

    const state =
        updateConflictState(player);

    return state?.strategy ??
        ANIMATION_STRATEGIES.VANILLA;
}

export function updatePlayerAnimations(
    player,
    nextState = null
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (nextState !== null) {
        if (
            !setCurrentState(
                player,
                nextState
            )
        ) {
            return false;
        }
    }

    updateConflictState(player);

    return rebuildPlayerAnimationLists(
        player
    );
}

export function canPlay(
    player,
    animationIdentifier
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    updateConflictState(player);

    return canPlayAnimation(
        player,
        animationIdentifier
    );
}

export function canApplyLayer(
    player,
    layer
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (
        !Object.values(
            ANIMATION_LAYERS
        ).includes(layer)
    ) {
        return false;
    }

    updateConflictState(player);

    return shouldApplyLayer(
        player,
        layer
    );
}

export function isAnimationEnabled(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return (
        getPlayerAnimationStrategy(player) !==
        ANIMATION_STRATEGIES.DISABLED
    );
}

export function isVantageAnimationActive(player) {
    return (
        getPlayerAnimationStrategy(player) ===
        ANIMATION_STRATEGIES.VANTAGE
    );
}

export function isMinimalAnimationMode(player) {
    return (
        getPlayerAnimationStrategy(player) ===
        ANIMATION_STRATEGIES.MINIMAL
    );
}

export function isVanillaAnimationMode(player) {
    return (
        getPlayerAnimationStrategy(player) ===
        ANIMATION_STRATEGIES.VANILLA
    );
}

export function hasExternalAnimationConflict(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        updateConflictState(player);

    return Boolean(
        state?.externalAnimationDetected ||
        state?.controllerConflict
    );
}

export function hasCustomModelConflict(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        updateConflictState(player);

    return Boolean(
        state?.customModelDetected ||
        state?.renderConflict
    );
}

export function getActiveAnimations(player) {
    if (!isValidPlayer(player)) {
        return [];
    }

    updatePlayerAnimations(player);

    return [
        ...(
            getPlayerState(player)
                ?.activeAnimations ?? []
        )
    ];
}

export function getBlockedAnimations(player) {
    if (!isValidPlayer(player)) {
        return [];
    }

    updatePlayerAnimations(player);

    return [
        ...(
            getPlayerState(player)
                ?.blockedAnimations ?? []
        )
    ];
}

export function getActiveLayers(player) {
    if (!isValidPlayer(player)) {
        return [];
    }

    updatePlayerAnimations(player);

    return [
        ...(
            getPlayerState(player)
                ?.activeLayers ?? []
        )
    ];
}

export function getAnimationState(player) {
    const state =
        getPlayerState(player);

    if (!state) {
        return null;
    }

    return clone(state);
}

export function isPoseSupported(player, state) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (
        !Object.values(
            ANIMATION_STATES
        ).includes(state)
    ) {
        return false;
    }

    return getPoseEnabled(state);
}

export function shouldAnimatePose(player, state) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (!getConfiguredAnimationEnabled()) {
        return false;
    }

    if (!getPoseEnabled(state)) {
        return false;
    }

    const strategy =
        getPlayerAnimationStrategy(player);

    return (
        strategy ===
        ANIMATION_STRATEGIES.VANTAGE ||
        strategy ===
        ANIMATION_STRATEGIES.MINIMAL
    );
}

export function reportExternalAnimation(
    player,
    identifier = "external"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    state.externalAnimationDetected = true;

    addConflict(
        state,
        CONFLICT_TYPES.CUSTOM_ANIMATION
    );

    try {
        updatePlayerCompatibility(
            player,
            {
                conflicts: [
                    ...state.conflicts
                ]
            }
        );
    } catch {
    }

    if (identifier) {
        registerAnimation(
            identifier,
            {
                external: true,
                layer: ANIMATION_LAYERS.EXTERNAL,
                priority: 10
            }
        );
    }

    state.strategy =
        calculateStrategy(player);

    state.lastUpdate = Date.now();

    bumpRevision();

    return true;
}

export function reportCustomPlayerModel(
    player,
    identifier = "external_model"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    state.customModelDetected = true;

    addConflict(
        state,
        CONFLICT_TYPES.CUSTOM_PLAYER_MODEL
    );

    try {
        updatePlayerCompatibility(
            player,
            {
                conflicts: [
                    ...state.conflicts
                ]
            }
        );
    } catch {
    }

    if (identifier) {
        registerAnimation(
            identifier,
            {
                customModel: true,
                layer: ANIMATION_LAYERS.EXTERNAL,
                priority: 10
            }
        );
    }

    state.strategy =
        calculateStrategy(player);

    state.lastUpdate = Date.now();

    bumpRevision();

    return true;
}

export function reportControllerConflict(
    player,
    identifier = "external_controller"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    state.controllerConflict = true;

    addConflict(
        state,
        CONFLICT_TYPES.EXTERNAL_CONTROLLER
    );

    try {
        updatePlayerCompatibility(
            player,
            {
                conflicts: [
                    ...state.conflicts
                ]
            }
        );
    } catch {
    }

    if (identifier) {
        registerController(
            identifier,
            {
                enabled: true,
                conflicts: [
                    CONFLICT_TYPES.EXTERNAL_CONTROLLER
                ]
            }
        );
    }

    state.strategy =
        calculateStrategy(player);

    state.lastUpdate = Date.now();

    bumpRevision();

    return true;
}

export function reportRenderControllerConflict(
    player,
    identifier = "external_render_controller"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    state.renderConflict = true;

    addConflict(
        state,
        CONFLICT_TYPES.EXTERNAL_RENDER_CONTROLLER
    );

    try {
        updatePlayerCompatibility(
            player,
            {
                conflicts: [
                    ...state.conflicts
                ]
            }
        );
    } catch {
    }

    if (identifier) {
        registerController(
            identifier,
            {
                enabled: true,
                conflicts: [
                    CONFLICT_TYPES.EXTERNAL_RENDER_CONTROLLER
                ]
            }
        );
    }

    state.strategy =
        calculateStrategy(player);

    state.lastUpdate = Date.now();

    bumpRevision();

    return true;
}

export function clearPlayerConflicts(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getPlayerState(player);

    if (!state) {
        return false;
    }

    state.externalAnimationDetected = false;
    state.customModelDetected = false;
    state.controllerConflict = false;
    state.renderConflict = false;
    state.conflicts = [];

    state.strategy =
        calculateStrategy(player);

    state.lastUpdate = Date.now();

    bumpRevision();

    return true;
}

export function resetPlayer(player) {
    if (!player) {
        return false;
    }

    return playerStates.delete(player);
}

export function resetAll() {
    const hadState =
        animationProfiles.size > 0 ||
        registeredControllers.size > 0 ||
        initialized;

    animationProfiles.clear();
    registeredControllers.clear();

    initialized = false;

    bumpRevision();

    initialize();

    return hadState;
}

export function getStrategies() {
    return ANIMATION_STRATEGIES;
}

export function getStates() {
    return ANIMATION_STATES;
}

export function getLayers() {
    return ANIMATION_LAYERS;
}

export function getConflictTypes() {
    return CONFLICT_TYPES;
}

export function getConflictPolicies() {
    return CONFLICT_POLICIES;
}

export function getRevision() {
    return revision;
}

export function getSnapshot() {
    let compatibilityStatus = null;

    try {
        compatibilityStatus =
            getCompatibilityStatus();
    } catch {
        compatibilityStatus = null;
    }

    return {
        revision,
        initialized,
        strategies: clone(
            ANIMATION_STRATEGIES
        ),
        states: clone(
            ANIMATION_STATES
        ),
        layers: clone(
            ANIMATION_LAYERS
        ),
        conflictTypes: clone(
            CONFLICT_TYPES
        ),
        conflictPolicies: clone(
            CONFLICT_POLICIES
        ),
        animations: getAnimations(),
        controllers: getControllers(),
        compatibilityStatus
    };
}