import { system, world } from "@minecraft/server";

import {
    getCompatibilityStatus,
    getPlayerCompatibility,
    updatePlayerCompatibility,
    clearPlayer,
    getRevision as getPackRevision
} from "./packs.js";

import {
    getPlayerAnimationStrategy,
    getPlayerAnimationState,
    updatePlayerAnimations,
    resetPlayer,
    isAnimationEnabled
} from "./animations.js";

import {
    getMode as getCameraMode,
    isActive as isCameraActive,
    getCameraState
} from "../camera/camera.js";

const MULTIPLAYER_MODES = Object.freeze({
    INDEPENDENT: "independent",
    SERVER_SAFE: "server_safe"
});

const PLAYER_STATUS = Object.freeze({
    ACTIVE: "active",
    LIMITED: "limited",
    INVALID: "invalid"
});

const SYNC_STATES = Object.freeze({
    UNSYNCED: "unsynced",
    SYNCING: "syncing",
    SYNCED: "synced",
    DEGRADED: "degraded"
});

const CAMERA_MODES = Object.freeze({
    FIRST_PERSON: "first_person",
    THIRD_PERSON: "third_person",
    UNKNOWN: "unknown"
});

const CONTROL_MODES = Object.freeze({
    TOUCH: "touch",
    KEYBOARD_MOUSE: "keyboard_mouse",
    CONTROLLER: "controller",
    UNKNOWN: "unknown"
});

const DEFAULTS = Object.freeze({
    synchronizationInterval: 2,
    compatibilityInterval: 10,
    cleanupInterval: 40
});

const playerRecords = new WeakMap();
const playerIds = new Map();

let initialized = false;
let tickHandle;
let revision = 0;
let lastSynchronizationTick = -1;
let lastCompatibilityTick = -1;
let lastCleanupTick = -1;

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

function normalizeString(value, fallback = "") {
    return typeof value === "string" && value.length > 0
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
            value.filter(
                item =>
                    typeof item === "string" &&
                    item.length > 0
            )
        )
    ];
}

function getCurrentTick() {
    try {
        return typeof system.currentTick === "number"
            ? system.currentTick
            : Date.now();
    } catch {
        return Date.now();
    }
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

function getPlayerId(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    try {
        return normalizeString(player.id, null);
    } catch {
        return null;
    }
}

function getPlayerName(player) {
    try {
        return normalizeString(player.name, "Player");
    } catch {
        return "Player";
    }
}

function getPlayerControlMode(player) {
    if (!isValidPlayer(player)) {
        return CONTROL_MODES.UNKNOWN;
    }

    try {
        const input =
            player.inputInfo?.lastInputModeUsed;

        if (input === undefined || input === null) {
            return CONTROL_MODES.UNKNOWN;
        }

        const value =
            String(input).toLowerCase();

        if (
            value.includes("touch") ||
            value.includes("mobile")
        ) {
            return CONTROL_MODES.TOUCH;
        }

        if (
            value.includes("gamepad") ||
            value.includes("controller")
        ) {
            return CONTROL_MODES.CONTROLLER;
        }

        if (
            value.includes("keyboard") ||
            value.includes("mouse") ||
            value.includes("keyboardandmouse")
        ) {
            return CONTROL_MODES.KEYBOARD_MOUSE;
        }
    } catch {
    }

    return CONTROL_MODES.UNKNOWN;
}

function getPlayerCameraMode(player) {
    if (!isValidPlayer(player)) {
        return CAMERA_MODES.UNKNOWN;
    }

    try {
        const state = getCameraState(player);

        if (!state?.active) {
            return CAMERA_MODES.UNKNOWN;
        }

        const mode = getCameraMode(player);

        if (
            mode === CAMERA_MODES.FIRST_PERSON ||
            mode === CAMERA_MODES.THIRD_PERSON
        ) {
            return mode;
        }
    } catch {
    }

    return CAMERA_MODES.UNKNOWN;
}

function getCompatibility(player) {
    try {
        return getPlayerCompatibility(player);
    } catch {
        return null;
    }
}

function getPlayerRecord(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    let record = playerRecords.get(player);

    if (!record) {
        const id = getPlayerId(player);

        record = {
            id,
            name: getPlayerName(player),
            status: PLAYER_STATUS.ACTIVE,
            syncState: SYNC_STATES.UNSYNCED,
            cameraMode: getPlayerCameraMode(player),
            controlMode: getPlayerControlMode(player),
            animationState:
                getPlayerAnimationState(player),
            animationStrategy:
                getPlayerAnimationStrategy(player),
            enabled: true,
            lastSync: 0,
            compatibilityRevision: -1,
            animationRevision: -1
        };

        playerRecords.set(player, record);

        if (id) {
            playerIds.set(id, player);
        }
    }

    return record;
}

function getPlayers() {
    try {
        return world.getPlayers();
    } catch {
        return [];
    }
}

function updateCompatibility(player, record, force = false) {
    const tick = getCurrentTick();
    const packRevision = getPackRevision();

    if (
        !force &&
        record.compatibilityRevision === packRevision &&
        tick - record.lastSync <
        DEFAULTS.compatibilityInterval
    ) {
        return;
    }

    try {
        const compatibility =
            getCompatibility(player);

        if (compatibility) {
            updatePlayerCompatibility(
                player,
                {
                    status:
                        compatibility.status,
                    capabilities:
                        normalizeArray(
                            compatibility.capabilities
                        ),
                    conflicts:
                        normalizeArray(
                            compatibility.conflicts
                        )
                }
            );

            if (
                compatibility.status ===
                "incompatible"
            ) {
                record.status =
                    PLAYER_STATUS.LIMITED;
                record.syncState =
                    SYNC_STATES.DEGRADED;
            } else if (
                compatibility.status ===
                "limited"
            ) {
                record.status =
                    PLAYER_STATUS.LIMITED;
                record.syncState =
                    SYNC_STATES.DEGRADED;
            } else {
                record.status =
                    PLAYER_STATUS.ACTIVE;
                record.syncState =
                    SYNC_STATES.SYNCED;
            }
        }

        record.compatibilityRevision =
            packRevision;
    } catch {
        record.status =
            PLAYER_STATUS.LIMITED;
        record.syncState =
            SYNC_STATES.DEGRADED;
    }
}

function updateAnimations(player, record, force = false) {
    const tick = getCurrentTick();
    const packRevision = getPackRevision();

    if (
        !force &&
        record.animationRevision === packRevision &&
        tick - record.lastSync <
        DEFAULTS.compatibilityInterval
    ) {
        return;
    }

    try {
        updatePlayerAnimations(player);

        record.animationState =
            getPlayerAnimationState(player);

        record.animationStrategy =
            getPlayerAnimationStrategy(player);

        record.animationRevision =
            packRevision;
    } catch {
        record.syncState =
            SYNC_STATES.DEGRADED;
    }
}

function synchronizePlayer(
    player,
    options = {}
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const record =
        getPlayerRecord(player);

    if (!record) {
        return false;
    }

    try {
        record.cameraMode =
            getPlayerCameraMode(player);

        record.controlMode =
            getPlayerControlMode(player);

        if (options.compatibility) {
            updateCompatibility(
                player,
                record,
                options.force
            );
        }

        if (options.animations) {
            updateAnimations(
                player,
                record,
                options.force
            );
        }

        record.lastSync = Date.now();

        const id = getPlayerId(player);

        if (id) {
            record.id = id;
            playerIds.set(id, player);
        }

        return true;
    } catch {
        record.syncState =
            SYNC_STATES.DEGRADED;

        return false;
    }
}

function synchronizePlayers(options = {}) {
    const players = getPlayers();
    const activeIds = new Set();

    for (const player of players) {
        if (!isValidPlayer(player)) {
            continue;
        }

        const id = getPlayerId(player);

        if (id) {
            activeIds.add(id);
        }

        synchronizePlayer(
            player,
            options
        );
    }

    if (options.cleanup) {
        for (const [id, player] of playerIds) {
            if (!activeIds.has(id)) {
                removePlayerReference(player);
            }
        }
    }

    lastSynchronizationTick =
        getCurrentTick();

    return players.length;
}

function removePlayerReference(player) {
    if (!player) {
        return false;
    }

    const id = getPlayerId(player);

    if (id && playerIds.get(id) === player) {
        playerIds.delete(id);
    }

    try {
        clearPlayer(player);
    } catch {
    }

    try {
        resetPlayer(player);
    } catch {
    }

    playerRecords.delete(player);

    return true;
}

function startSynchronization() {
    if (tickHandle !== undefined) {
        return false;
    }

    try {
        tickHandle = system.runInterval(
            () => {
                const tick =
                    getCurrentTick();

                if (
                    lastSynchronizationTick ===
                    tick
                ) {
                    return;
                }

                const updateCompatibility =
                    lastCompatibilityTick < 0 ||
                    tick -
                    lastCompatibilityTick >=
                    DEFAULTS.compatibilityInterval;

                const cleanup =
                    lastCleanupTick < 0 ||
                    tick -
                    lastCleanupTick >=
                    DEFAULTS.cleanupInterval;

                synchronizePlayers({
                    compatibility:
                        updateCompatibility,
                    animations:
                        updateCompatibility,
                    cleanup,
                    force: false
                });

                if (updateCompatibility) {
                    lastCompatibilityTick = tick;
                }

                if (cleanup) {
                    lastCleanupTick = tick;
                }
            },
            DEFAULTS.synchronizationInterval
        );

        return true;
    } catch {
        tickHandle = undefined;
        return false;
    }
}

function stopSynchronization() {
    if (tickHandle === undefined) {
        return false;
    }

    try {
        system.clearRun(tickHandle);
    } catch {
    }

    tickHandle = undefined;

    return true;
}

export function initialize() {
    if (initialized) {
        return getSnapshot();
    }

    initialized = true;
    revision++;

    synchronizePlayers({
        compatibility: true,
        animations: true,
        cleanup: true,
        force: true
    });

    startSynchronization();

    return getSnapshot();
}

export function isInitialized() {
    return initialized;
}

export function getPlayerById(id) {
    const normalized =
        normalizeString(id);

    if (!normalized) {
        return null;
    }

    const cached =
        playerIds.get(normalized);

    if (
        cached &&
        isValidPlayer(cached)
    ) {
        return cached;
    }

    for (const player of getPlayers()) {
        if (
            isValidPlayer(player) &&
            getPlayerId(player) === normalized
        ) {
            playerIds.set(
                normalized,
                player
            );

            return player;
        }
    }

    playerIds.delete(normalized);

    return null;
}

export function hasPlayer(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const id = getPlayerId(player);

    return Boolean(
        id &&
        playerIds.get(id) === player
    );
}

export function getPlayerStatus(player) {
    return (
        getPlayerRecord(player)?.status ??
        PLAYER_STATUS.INVALID
    );
}

export function getPlayerSyncState(player) {
    return (
        getPlayerRecord(player)?.syncState ??
        SYNC_STATES.UNSYNCED
    );
}

export function getPlayerRecordSnapshot(player) {
    const record =
        getPlayerRecord(player);

    return record
        ? clone(record)
        : null;
}

export function getPlayerCompatibilityState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return clone(
        getCompatibility(player)
    );
}

export function setPlayerEnabled(
    player,
    enabled
) {
    const record =
        getPlayerRecord(player);

    if (!record) {
        return false;
    }

    record.enabled =
        normalizeBoolean(
            enabled,
            true
        );

    record.lastSync = Date.now();

    revision++;

    return true;
}

export function isPlayerEnabled(player) {
    return Boolean(
        getPlayerRecord(player)?.enabled
    );
}

export function setPlayerCameraMode(
    player,
    mode
) {
    const record =
        getPlayerRecord(player);

    if (!record) {
        return false;
    }

    if (
        mode !== CAMERA_MODES.FIRST_PERSON &&
        mode !== CAMERA_MODES.THIRD_PERSON &&
        mode !== CAMERA_MODES.UNKNOWN
    ) {
        return false;
    }

    record.cameraMode = mode;
    record.lastSync = Date.now();

    revision++;

    return true;
}

export function getPlayerCameraModeSafe(
    player
) {
    return getPlayerCameraMode(player);
}

export function setPlayerControlMode(
    player,
    mode
) {
    const record =
        getPlayerRecord(player);

    if (!record) {
        return false;
    }

    if (
        !Object.values(
            CONTROL_MODES
        ).includes(mode)
    ) {
        return false;
    }

    record.controlMode = mode;
    record.lastSync = Date.now();

    revision++;

    return true;
}

export function getPlayerControlModeSafe(
    player
) {
    return (
        getPlayerRecord(player)?.controlMode ??
        CONTROL_MODES.UNKNOWN
    );
}

export function isPlayerInFirstPerson(player) {
    return (
        getPlayerCameraMode(player) ===
        CAMERA_MODES.FIRST_PERSON
    );
}

export function isPlayerInThirdPerson(player) {
    return (
        getPlayerCameraMode(player) ===
        CAMERA_MODES.THIRD_PERSON
    );
}

export function setPlayerSyncState(
    player,
    state
) {
    const record =
        getPlayerRecord(player);

    if (!record) {
        return false;
    }

    if (
        !Object.values(
            SYNC_STATES
        ).includes(state)
    ) {
        return false;
    }

    record.syncState = state;
    record.lastSync = Date.now();

    revision++;

    return true;
}

export function synchronizePlayerNow(player) {
    return synchronizePlayer(
        player,
        {
            compatibility: true,
            animations: true,
            cleanup: false,
            force: true
        }
    );
}

export function synchronizeNow() {
    const result =
        synchronizePlayers({
            compatibility: true,
            animations: true,
            cleanup: true,
            force: true
        });

    revision++;

    return result;
}

export function getPlayerCount() {
    return getPlayers().length;
}

export function getActivePlayerCount() {
    return getPlayers().filter(
        isValidPlayer
    ).length;
}

export function getPlayersInDimension(
    dimensionId
) {
    const id =
        normalizeString(dimensionId);

    if (!id) {
        return [];
    }

    return getPlayers().filter(
        player => {
            if (!isValidPlayer(player)) {
                return false;
            }

            try {
                return player.dimension?.id === id;
            } catch {
                return false;
            }
        }
    );
}

export function getPlayersWithVantageEnabled() {
    return getPlayers().filter(
        player =>
            isValidPlayer(player) &&
            isPlayerEnabled(player)
    );
}

export function getPlayersUsingFirstPerson() {
    return getPlayers().filter(
        player =>
            isValidPlayer(player) &&
            isPlayerInFirstPerson(player)
    );
}

export function getPlayersUsingThirdPerson() {
    return getPlayers().filter(
        player =>
            isValidPlayer(player) &&
            isPlayerInThirdPerson(player)
    );
}

export function getPlayersWithAnimationSupport() {
    return getPlayers().filter(
        player =>
            isValidPlayer(player) &&
            isAnimationEnabled(player)
    );
}

export function getPlayersWithDegradedSync() {
    return getPlayers().filter(
        player =>
            isValidPlayer(player) &&
            getPlayerSyncState(player) ===
            SYNC_STATES.DEGRADED
    );
}

export function getPlayersWithCompatibilityConflicts() {
    return getPlayers().filter(
        player => {
            if (!isValidPlayer(player)) {
                return false;
            }

            const compatibility =
                getCompatibility(player);

            return Boolean(
                compatibility?.conflicts?.length
            );
        }
    );
}

export function getSharedCompatibilityStatus() {
    return getCompatibilityStatus();
}

export function getSharedCompatibilitySnapshot() {
    try {
        return clone(
            getCompatibilityStatus()
        );
    } catch {
        return null;
    }
}

export function canUseSharedCameraPreset() {
    const status =
        getCompatibilityStatus();

    return (
        status === "compatible" ||
        status === "unknown"
    );
}

export function shouldIsolatePlayer(player) {
    if (!isValidPlayer(player)) {
        return true;
    }

    const compatibility =
        getCompatibility(player);

    if (!compatibility) {
        return false;
    }

    return Boolean(
        compatibility.status ===
        "incompatible" ||
        compatibility.conflicts?.length
    );
}

export function getRecommendedMultiplayerMode(
    player = null
) {
    if (
        player &&
        shouldIsolatePlayer(player)
    ) {
        return MULTIPLAYER_MODES.INDEPENDENT;
    }

    const status =
        getCompatibilityStatus();

    if (status === "limited") {
        return MULTIPLAYER_MODES.SERVER_SAFE;
    }

    return MULTIPLAYER_MODES.INDEPENDENT;
}

export function isMultiplayerSafe(player = null) {
    if (
        player &&
        !isValidPlayer(player)
    ) {
        return false;
    }

    const status =
        player
            ? getCompatibility(player)?.status
            : getCompatibilityStatus();

    return (
        status === "compatible" ||
        status === "unknown" ||
        status === "limited"
    );
}

export function isCameraSystemActive(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    try {
        return isCameraActive(player);
    } catch {
        return false;
    }
}

export function getSynchronizationInterval() {
    return DEFAULTS.synchronizationInterval;
}

export function getCompatibilitySynchronizationInterval() {
    return DEFAULTS.compatibilityInterval;
}

export function getCleanupInterval() {
    return DEFAULTS.cleanupInterval;
}

export function isSynchronizationRunning() {
    return tickHandle !== undefined;
}

export function getRevision() {
    return revision;
}

export function getPackRevisionSafe() {
    return getPackRevision();
}

export function getModes() {
    return MULTIPLAYER_MODES;
}

export function getPlayerStatuses() {
    return PLAYER_STATUS;
}

export function getSyncStates() {
    return SYNC_STATES;
}

export function getCameraModes() {
    return CAMERA_MODES;
}

export function getControlModes() {
    return CONTROL_MODES;
}

export function removePlayer(player) {
    if (!player) {
        return false;
    }

    const existed =
        playerRecords.has(player);

    removePlayerReference(player);

    if (existed) {
        revision++;
    }

    return existed;
}

export function refresh() {
    synchronizeNow();

    return getSnapshot();
}

export function shutdown() {
    const stopped =
        stopSynchronization();

    for (const player of getPlayers()) {
        removePlayerReference(player);
    }

    playerIds.clear();

    initialized = false;
    lastSynchronizationTick = -1;
    lastCompatibilityTick = -1;
    lastCleanupTick = -1;

    revision++;

    return stopped;
}

export function getSnapshot() {
    const players = getPlayers();
    const snapshots = [];

    for (const player of players) {
        if (!isValidPlayer(player)) {
            continue;
        }

        const record =
            getPlayerRecord(player);

        if (record) {
            snapshots.push(
                clone(record)
            );
        }
    }

    return {
        initialized,
        revision,
        packRevision:
            getPackRevision(),
        playerCount:
            players.length,
        activePlayerCount:
            players.filter(
                isValidPlayer
            ).length,
        synchronizationRunning:
            isSynchronizationRunning(),
        synchronizationInterval:
            DEFAULTS.synchronizationInterval,
        compatibilitySynchronizationInterval:
            DEFAULTS.compatibilityInterval,
        cleanupInterval:
            DEFAULTS.cleanupInterval,
        compatibilityStatus:
            getCompatibilityStatus(),
        players: snapshots
    };
}