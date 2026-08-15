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
    BODY: "body",
    POSE: "pose",
    EXTERNAL: "external"
});

const CONFLICT_TYPES = Object.freeze({
    CUSTOM_ANIMATION: "custom_animation",
    CUSTOM_PLAYER_MODEL: "custom_player_model",
    EXTERNAL_CONTROLLER: "external_animation_controller",
    EXTERNAL_RENDER_CONTROLLER: "external_render_controller"
});

const CONFLICT_POLICIES = Object.freeze({
    PRESERVE: "preserve",
    MINIMAL: "minimal",
    VANTAGE: "vantage",
    DISABLE: "disable"
});

const playerStates = new WeakMap();
const animationProfiles = new Map();

let revision = 0;
let initialized = false;

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

function clone(value) {
    if (value === undefined || value === null) {
        return value;
    }

    if (typeof value !== "object") {
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return null;
    }
}

function string(value, fallback = "") {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : fallback;
}

function boolean(value, fallback = false) {
    return typeof value === "boolean"
        ? value
        : fallback;
}

function number(value, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : fallback;
}

function array(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [
        ...new Set(
            value
                .filter(
                    item =>
                        typeof item === "string" &&
                        item.trim()
                )
                .map(item => item.trim())
        )
    ];
}

function stateValue(value) {
    return Object.values(ANIMATION_STATES).includes(value)
        ? value
        : ANIMATION_STATES.UNKNOWN;
}

function strategyValue(value) {
    return Object.values(ANIMATION_STRATEGIES).includes(value)
        ? value
        : ANIMATION_STRATEGIES.VANILLA;
}

function layerValue(value) {
    return Object.values(ANIMATION_LAYERS).includes(value)
        ? value
        : ANIMATION_LAYERS.BODY;
}

function policyValue(value) {
    return Object.values(CONFLICT_POLICIES).includes(value)
        ? value
        : CONFLICT_POLICIES.PRESERVE;
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

function getAnimationConfigSafe() {
    try {
        const config = getAnimationConfig();

        return config && typeof config === "object"
            ? config
            : {};
    } catch {
        return {};
    }
}

function getCompatibilityConfigSafe() {
    try {
        const config = getCompatibilityConfig();

        return config && typeof config === "object"
            ? config
            : {};
    } catch {
        return {};
    }
}

function animationsEnabled() {
    return getAnimationConfigSafe().enabled !== false;
}

function getPolicy() {
    const config = getCompatibilityConfigSafe();

    return policyValue(
        config.animationConflictPolicy
    );
}

function poseEnabled(state) {
    const config = getAnimationConfigSafe();

    const poses =
        config.poses &&
            typeof config.poses === "object"
            ? config.poses
            : {};

    return poses[state] !== false;
}

function getRecommendedStrategySafe(player) {
    try {
        return strategyValue(
            getRecommendedAnimationStrategy(player)
        );
    } catch {
        return ANIMATION_STRATEGIES.VANILLA;
    }
}

function detectConflicts(player) {
    if (!isValidPlayer(player)) {
        return {
            externalAnimationDetected: false,
            customModelDetected: false,
            controllerConflict: false,
            renderConflict: false
        };
    }

    const config = getCompatibilityConfigSafe();

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
        packConflict = playerHasConflicts(player);
    } catch {
        packConflict = false;
    }

    return {
        externalAnimationDetected:
            config.customAnimations === true,

        customModelDetected:
            config.customPlayerModels === true,

        controllerConflict:
            controllerConflict || packConflict,

        renderConflict
    };
}

function calculateStrategy(player, state) {
    if (!animationsEnabled()) {
        return ANIMATION_STRATEGIES.DISABLED;
    }

    const policy = getPolicy();

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
        getRecommendedStrategySafe(player);

    if (
        recommended === ANIMATION_STRATEGIES.DISABLED ||
        recommended === ANIMATION_STRATEGIES.VANILLA
    ) {
        return recommended;
    }

    if (
        state.externalAnimationDetected ||
        state.customModelDetected ||
        state.controllerConflict ||
        state.renderConflict
    ) {
        return ANIMATION_STRATEGIES.MINIMAL;
    }

    return ANIMATION_STRATEGIES.VANTAGE;
}

function addConflict(state, conflict) {
    if (
        !Object.values(CONFLICT_TYPES).includes(
            conflict
        )
    ) {
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

    const detected = detectConflicts(player);

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

    state.strategy =
        calculateStrategy(
            player,
            state
        );

    try {
        updatePlayerCompatibility(
            player,
            {
                conflicts: [...state.conflicts]
            }
        );
    } catch {
    }

    state.lastUpdate = Date.now();
    state.revision = revision;

    return state;
}

function registerDefaultAnimations() {
    animationProfiles.clear();

    animationProfiles.set(
        "vantage:body",
        {
            identifier: "vantage:body",
            name: "Vantage Body",
            enabled: true,
            priority: 100,
            layer: ANIMATION_LAYERS.BODY,
            external: false,
            customModel: false,
            controller: false,
            renderController: false,
            states: Object.values(ANIMATION_STATES),
            conflicts: []
        }
    );

    animationProfiles.set(
        "vantage:pose",
        {
            identifier: "vantage:pose",
            name: "Vantage Pose",
            enabled: true,
            priority: 90,
            layer: ANIMATION_LAYERS.POSE,
            external: false,
            customModel: false,
            controller: false,
            renderController: false,
            states: Object.values(ANIMATION_STATES),
            conflicts: []
        }
    );
}

function normalizeProfile(identifier, profile = {}) {
    const id = string(identifier);

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
        name: string(source.name, id),
        enabled: boolean(
            source.enabled,
            true
        ),
        priority: number(
            source.priority,
            0
        ),
        layer: layerValue(
            source.layer
        ),
        external: boolean(
            source.external,
            false
        ),
        customModel: boolean(
            source.customModel,
            false
        ),
        controller: boolean(
            source.controller,
            false
        ),
        renderController: boolean(
            source.renderController,
            false
        ),
        states: array(
            source.states
        ),
        conflicts: array(
            source.conflicts
        )
    };
}

function canPlayAnimation(
    player,
    identifier
) {
    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.DISABLED
    ) {
        return false;
    }

    const animation =
        animationProfiles.get(identifier);

    if (!animation || !animation.enabled) {
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
        animation.states.length &&
        !animation.states.includes(state.state)
    ) {
        return false;
    }

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.MINIMAL
    ) {
        return animation.layer ===
            ANIMATION_LAYERS.EXTERNAL;
    }

    return true;
}

function rebuild(player) {
    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    state.activeLayers = [];

    if (
        state.strategy ===
        ANIMATION_STRATEGIES.VANTAGE
    ) {
        state.activeLayers = [
            ANIMATION_LAYERS.BODY,
            ANIMATION_LAYERS.POSE
        ];
    } else if (
        state.strategy ===
        ANIMATION_STRATEGIES.MINIMAL
    ) {
        state.activeLayers = [
            ANIMATION_LAYERS.EXTERNAL
        ];
    }

    const animations = [
        ...animationProfiles.values()
    ].sort(
        (a, b) =>
            b.priority - a.priority ||
            a.identifier.localeCompare(
                b.identifier
            )
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

    state.revision = revision;

    return true;
}

export function initialize() {
    if (initialized) {
        return getSnapshot();
    }

    registerDefaultAnimations();

    initialized = true;
    revision++;

    return getSnapshot();
}

export function registerAnimation(
    identifier,
    profile = {}
) {
    const normalized =
        normalizeProfile(
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

    revision++;

    return true;
}

export function unregisterAnimation(identifier) {
    const id = string(identifier);

    if (!id) {
        return false;
    }

    const removed =
        animationProfiles.delete(id);

    if (removed) {
        revision++;
    }

    return removed;
}

export function getAnimation(identifier) {
    const animation =
        animationProfiles.get(
            string(identifier)
        );

    return animation
        ? clone(animation)
        : null;
}

export function getAnimations() {
    return clone(
        [...animationProfiles.values()].sort(
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
    nextState
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    const normalized =
        stateValue(nextState);

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

    updateConflictState(player);
    rebuild(player);

    return true;
}

export function getPlayerAnimationState(player) {
    return (
        getPlayerState(player)?.state ??
        ANIMATION_STATES.UNKNOWN
    );
}

export function getPreviousAnimationState(player) {
    return (
        getPlayerState(player)?.previousState ??
        ANIMATION_STATES.UNKNOWN
    );
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
            !setPlayerAnimationState(
                player,
                nextState
            )
        ) {
            return false;
        }

        return true;
    }

    updateConflictState(player);

    return rebuild(player);
}

export function getPlayerAnimationStrategy(player) {
    if (!isValidPlayer(player)) {
        return ANIMATION_STRATEGIES.VANILLA;
    }

    const state =
        updateConflictState(player);

    return (
        state?.strategy ??
        ANIMATION_STRATEGIES.VANILLA
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
        string(animationIdentifier)
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

    const state =
        updateConflictState(player);

    if (!state) {
        return false;
    }

    return state.activeLayers.includes(layer);
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

    return state
        ? clone(state)
        : null;
}

export function isPoseSupported(
    player,
    pose
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (
        !Object.values(
            ANIMATION_STATES
        ).includes(pose)
    ) {
        return false;
    }

    return poseEnabled(pose);
}

export function shouldAnimatePose(
    player,
    pose
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (!animationsEnabled()) {
        return false;
    }

    if (!poseEnabled(pose)) {
        return false;
    }

    const strategy =
        getPlayerAnimationStrategy(player);

    return (
        strategy ===
        ANIMATION_STRATEGIES.VANTAGE
    );
}

export function reportExternalAnimation(
    player,
    identifier = "external"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    state.externalAnimationDetected = true;

    addConflict(
        state,
        CONFLICT_TYPES.CUSTOM_ANIMATION
    );

    if (identifier) {
        registerAnimation(
            identifier,
            {
                enabled: true,
                external: true,
                layer: ANIMATION_LAYERS.EXTERNAL,
                priority: 10
            }
        );
    }

    updateConflictState(player);
    rebuild(player);

    return true;
}

export function reportCustomPlayerModel(
    player,
    identifier = "external_model"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    state.customModelDetected = true;

    addConflict(
        state,
        CONFLICT_TYPES.CUSTOM_PLAYER_MODEL
    );

    if (identifier) {
        registerAnimation(
            identifier,
            {
                enabled: true,
                customModel: true,
                layer: ANIMATION_LAYERS.EXTERNAL,
                priority: 10
            }
        );
    }

    updateConflictState(player);
    rebuild(player);

    return true;
}

export function reportControllerConflict(
    player,
    identifier = "external_controller"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    state.controllerConflict = true;

    addConflict(
        state,
        CONFLICT_TYPES.EXTERNAL_CONTROLLER
    );

    if (identifier) {
        registerAnimation(
            identifier,
            {
                enabled: true,
                controller: true,
                layer: ANIMATION_LAYERS.EXTERNAL,
                priority: 10
            }
        );
    }

    updateConflictState(player);
    rebuild(player);

    return true;
}

export function reportRenderControllerConflict(
    player,
    identifier = "external_render_controller"
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    state.renderConflict = true;

    addConflict(
        state,
        CONFLICT_TYPES.EXTERNAL_RENDER_CONTROLLER
    );

    if (identifier) {
        registerAnimation(
            identifier,
            {
                enabled: true,
                renderController: true,
                layer: ANIMATION_LAYERS.EXTERNAL,
                priority: 10
            }
        );
    }

    updateConflictState(player);
    rebuild(player);

    return true;
}

export function clearPlayerConflicts(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getPlayerState(player);

    if (!state) {
        return false;
    }

    state.externalAnimationDetected = false;
    state.customModelDetected = false;
    state.controllerConflict = false;
    state.renderConflict = false;
    state.conflicts = [];

    updateConflictState(player);
    rebuild(player);

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
        initialized ||
        animationProfiles.size > 0;

    animationProfiles.clear();
    initialized = false;
    revision++;

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
        compatibilityStatus
    };
}