import { system, world } from "@minecraft/server";

import {
    getCompatibilityStatus,
    getCompatibilitySnapshot,
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
    SHARED: "shared",
    INDEPENDENT: "independent",
    SERVER_SAFE: "server_safe"
});

const PLAYER_STATUS = Object.freeze({
    UNKNOWN: "unknown",
    ACTIVE: "active",
    INACTIVE: "inactive",
    INVALID: "invalid",
    LIMITED: "limited"
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
    cleanupInterval: 40,
    maximumErrors: 10,
    sessionPrefix: "vantage"
});

const playerRecords = new WeakMap();
const playerIds = new Map();
const sessions = new Map();

let initialized = false;
let tickHandle;
let revision = 0;
let lastSweepTick = -1;
let lastCompatibilityTick = -1;
let lastCleanupTick = -1;
let sessionId;

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
    return Array.isArray(value)
        ? [...new Set(
            value.filter(
                item =>
                    typeof item === "string" &&
                    item.length > 0
            )
        )]
        : [];
}

function bumpRevision() {
    revision++;
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

function getNow() {
    return Date.now();
}

function getPlayerId(player) {
    if (!player) {
        return null;
    }

    try {
        if (typeof player.id === "string" && player.id.length > 0) {
            return player.id;
        }
    } catch {
    }

    return null;
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

function getPlayerName(player) {
    try {
        return normalizeString(
            player.name,
            "Player"
        );
    } catch {
        return "Player";
    }
}

function getPlayerDimension(player) {
    if (!isValidPlayer(player)) {
        return "";
    }

    try {
        return normalizeString(
            player.dimension?.id
        );
    } catch {
        return "";
    }
}

function getPlayerLocation(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    try {
        const location = player.location;

        if (!location) {
            return null;
        }

        return {
            x: normalizeNumber(location.x),
            y: normalizeNumber(location.y),
            z: normalizeNumber(location.z)
        };
    } catch {
        return null;
    }
}

function getPlayerControlMode(player) {
    if (!isValidPlayer(player)) {
        return CONTROL_MODES.UNKNOWN;
    }

    try {
        const inputMode =
            player.inputInfo?.lastInputModeUsed;

        if (inputMode === undefined || inputMode === null) {
            return CONTROL_MODES.UNKNOWN;
        }

        const value = String(inputMode).toLowerCase();

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

        return CONTROL_MODES.UNKNOWN;
    } catch {
        return CONTROL_MODES.UNKNOWN;
    }
}

function getPlayerCameraMode(player) {
    if (!isValidPlayer(player)) {
        return CAMERA_MODES.UNKNOWN;
    }

    try {
        const cameraState = getCameraState(player);

        if (
            !cameraState ||
            !cameraState.active
        ) {
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

function getPlayerRecord(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    let record = playerRecords.get(player);

    if (!record) {
        const now = getNow();
        const id = getPlayerId(player);

        record = {
            id,
            name: getPlayerName(player),
            status: PLAYER_STATUS.ACTIVE,
            syncState: SYNC_STATES.UNSYNCED,
            cameraMode: getPlayerCameraMode(player),
            controlMode: getPlayerControlMode(player),
            animationState: getPlayerAnimationState(player),
            animationStrategy: getPlayerAnimationStrategy(player),
            enabled: true,
            joinedAt: now,
            lastSeen: now,
            lastSync: 0,
            lastTick: -1,
            lastDimension: getPlayerDimension(player),
            lastLocation: getPlayerLocation(player),
            errors: 0,
            consecutiveErrors: 0,
            compatibilityRevision: -1,
            animationRevision: -1,
            revision
        };

        playerRecords.set(player, record);

        if (id) {
            playerIds.set(id, player);
        }
    }

    return record;
}

function enumeratePlayers() {
    try {
        if (typeof world.getPlayers === "function") {
            return world.getPlayers();
        }
    } catch {
    }

    try {
        if (typeof world.getAllPlayers === "function") {
            return world.getAllPlayers();
        }
    } catch {
    }

    return [];
}

function createSessionId() {
    const timestamp = getNow().toString(36);

    let random = "";

    try {
        random = Math.random()
            .toString(36)
            .slice(2, 10);
    } catch {
        random = "local";
    }

    return `${DEFAULTS.sessionPrefix}:${timestamp}:${random}`;
}

function getSessionId() {
    if (sessionId) {
        return sessionId;
    }

    sessionId = createSessionId();

    return sessionId;
}

function getOrCreateSession() {
    const id = getSessionId();

    let session = sessions.get(id);

    if (!session) {
        session = {
            id,
            createdAt: getNow(),
            lastUpdate: getNow(),
            playerCount: 0,
            activePlayerCount: 0,
            active: true,
            syncState: SYNC_STATES.UNSYNCED,
            revision
        };

        sessions.set(id, session);
    }

    return session;
}

function getCompatibilityState(player) {
    try {
        return getPlayerCompatibility(player);
    } catch {
        return null;
    }
}

function getCompatibilityStatusForPlayer(player) {
    const compatibility =
        getCompatibilityState(player);

    return compatibility?.status ?? "unknown";
}

function getPlayerStatusFromCompatibility(player) {
    const status =
        getCompatibilityStatusForPlayer(player);

    if (status === "incompatible") {
        return PLAYER_STATUS.LIMITED;
    }

    if (status === "limited") {
        return PLAYER_STATUS.LIMITED;
    }

    return PLAYER_STATUS.ACTIVE;
}

function synchronizeCompatibility(player, record, force = false) {
    const tick = getCurrentTick();

    if (
        !force &&
        record.compatibilityRevision === getPackRevision() &&
        tick - record.lastSync <
        DEFAULTS.compatibilityInterval
    ) {
        return;
    }

    try {
        const compatibility =
            getCompatibilityState(player);

        if (compatibility) {
            updatePlayerCompatibility(
                player,
                {
                    status: compatibility.status,
                    capabilities: normalizeArray(
                        compatibility.capabilities
                    ),
                    conflicts: normalizeArray(
                        compatibility.conflicts
                    )
                }
            );
        }

        record.compatibilityRevision =
            getPackRevision();
    } catch {
        record.errors++;
        record.consecutiveErrors++;
    }
}

function synchronizeAnimations(player, record, force = false) {
    const packRevision =
        getPackRevision();

    if (
        !force &&
        record.animationRevision === packRevision &&
        record.lastTick >= 0 &&
        getCurrentTick() - record.lastTick <
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
        record.errors++;
        record.consecutiveErrors++;
    }
}

function synchronizePlayer(
    player,
    tick,
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

    const now = getNow();

    try {
        record.status =
            PLAYER_STATUS.ACTIVE;

        record.lastSeen = now;
        record.lastTick = tick;

        const dimension =
            getPlayerDimension(player);

        if (
            dimension !==
            record.lastDimension
        ) {
            record.lastDimension =
                dimension;

            record.syncState =
                SYNC_STATES.SYNCING;
        }

        record.lastLocation =
            getPlayerLocation(player);

        record.controlMode =
            getPlayerControlMode(player);

        record.cameraMode =
            getPlayerCameraMode(player);

        if (options.updateCompatibility) {
            synchronizeCompatibility(
                player,
                record,
                options.force
            );
        }

        if (options.updateAnimations) {
            synchronizeAnimations(
                player,
                record,
                options.force
            );
        } else {
            record.animationState =
                getPlayerAnimationState(player);

            record.animationStrategy =
                getPlayerAnimationStrategy(player);
        }

        const compatibility =
            getCompatibilityState(player);

        const compatibilityStatus =
            compatibility?.status ??
            "unknown";

        record.status =
            getPlayerStatusFromCompatibility(
                player
            );

        if (
            compatibilityStatus ===
            "incompatible"
        ) {
            record.syncState =
                SYNC_STATES.DEGRADED;
        } else if (
            compatibilityStatus ===
            "limited"
        ) {
            record.syncState =
                SYNC_STATES.DEGRADED;
        } else {
            record.syncState =
                SYNC_STATES.SYNCED;
        }

        record.lastSync = now;
        record.consecutiveErrors = 0;
        record.revision = revision;

        const id = getPlayerId(player);

        if (id) {
            record.id = id;
            playerIds.set(id, player);
        }

        return true;
    } catch {
        record.errors++;
        record.consecutiveErrors++;

        record.syncState =
            SYNC_STATES.DEGRADED;

        if (
            record.consecutiveErrors >=
            DEFAULTS.maximumErrors
        ) {
            record.status =
                PLAYER_STATUS.LIMITED;
        }

        return false;
    }
}

function synchronizePlayers(
    tick,
    options = {}
) {
    const players =
        enumeratePlayers();

    const activePlayers = [];
    const activeIds = new Set();

    for (const player of players) {
        if (!isValidPlayer(player)) {
            continue;
        }

        activePlayers.push(player);

        const id = getPlayerId(player);

        if (id) {
            activeIds.add(id);
        }

        synchronizePlayer(
            player,
            tick,
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

    const session =
        getOrCreateSession();

    session.playerCount =
        players.length;

    session.activePlayerCount =
        activePlayers.length;

    session.lastUpdate =
        getNow();

    session.syncState =
        activePlayers.length > 0
            ? SYNC_STATES.SYNCED
            : SYNC_STATES.UNSYNCED;

    session.revision =
        revision;

    lastSweepTick = tick;

    return activePlayers.length;
}

function scheduleSynchronization() {
    if (tickHandle !== undefined) {
        return false;
    }

    try {
        tickHandle = system.runInterval(
            () => {
                const tick =
                    getCurrentTick();

                if (
                    lastSweepTick === tick
                ) {
                    return;
                }

                const shouldUpdateCompatibility =
                    lastCompatibilityTick < 0 ||
                    tick -
                    lastCompatibilityTick >=
                    DEFAULTS.compatibilityInterval;

                const shouldCleanup =
                    lastCleanupTick < 0 ||
                    tick -
                    lastCleanupTick >=
                    DEFAULTS.cleanupInterval;

                synchronizePlayers(
                    tick,
                    {
                        updateCompatibility:
                            shouldUpdateCompatibility,
                        updateAnimations:
                            shouldUpdateCompatibility,
                        cleanup:
                            shouldCleanup,
                        force: false
                    }
                );

                if (shouldUpdateCompatibility) {
                    lastCompatibilityTick =
                        tick;
                }

                if (shouldCleanup) {
                    lastCleanupTick =
                        tick;
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
        system.clearRun(
            tickHandle
        );
    } catch {
    }

    tickHandle = undefined;

    return true;
}

function removePlayerReference(player) {
    if (!player) {
        return false;
    }

    const id =
        getPlayerId(player);

    if (id) {
        const current =
            playerIds.get(id);

        if (current === player) {
            playerIds.delete(id);
        }
    }

    try {
        clearPlayer(player);
    } catch {
    }

    try {
        resetPlayer(player);
    } catch {
    }

    try {
        playerRecords.delete(player);
    } catch {
    }

    return true;
}

export function initialize() {
    if (initialized) {
        return getSnapshot();
    }

    initialized = true;
    revision++;

    getOrCreateSession();

    synchronizePlayers(
        getCurrentTick(),
        {
            updateCompatibility: true,
            updateAnimations: true,
            cleanup: true,
            force: true
        }
    );

    scheduleSynchronization();

    return getSnapshot();
}

export function isInitialized() {
    return initialized;
}

export function getPlayers() {
    return enumeratePlayers();
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

    for (const player of enumeratePlayers()) {
        if (
            isValidPlayer(player) &&
            getPlayerId(player) ===
            normalized
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

    const id =
        getPlayerId(player);

    if (!id) {
        return false;
    }

    return playerIds.get(id) === player;
}

export function getPlayerStatus(player) {
    const record =
        getPlayerRecord(player);

    return record?.status ??
        PLAYER_STATUS.INVALID;
}

export function getPlayerSyncState(player) {
    const record =
        getPlayerRecord(player);

    return record?.syncState ??
        SYNC_STATES.UNSYNCED;
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
        getPlayerCompatibility(player)
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

    record.lastSync =
        getNow();

    bumpRevision();

    return true;
}

export function isPlayerEnabled(player) {
    const record =
        getPlayerRecord(player);

    return Boolean(
        record &&
        record.enabled
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

    record.cameraMode =
        mode;

    record.lastSync =
        getNow();

    bumpRevision();

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

    record.controlMode =
        mode;

    record.lastSync =
        getNow();

    bumpRevision();

    return true;
}

export function getPlayerControlModeSafe(
    player
) {
    const record =
        getPlayerRecord(player);

    return record?.controlMode ??
        CONTROL_MODES.UNKNOWN;
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

    record.syncState =
        state;

    record.lastSync =
        getNow();

    bumpRevision();

    return true;
}

export function synchronizePlayerNow(
    player
) {
    const tick =
        getCurrentTick();

    return synchronizePlayer(
        player,
        tick,
        {
            updateCompatibility: true,
            updateAnimations: true,
            cleanup: false,
            force: true
        }
    );
}

export function synchronizeNow() {
    const tick =
        getCurrentTick();

    const result =
        synchronizePlayers(
            tick,
            {
                updateCompatibility: true,
                updateAnimations: true,
                cleanup: true,
                force: true
            }
        );

    bumpRevision();

    return result;
}

export function getPlayerCount() {
    return enumeratePlayers().length;
}

export function getActivePlayerCount() {
    let count = 0;

    for (const player of enumeratePlayers()) {
        if (isValidPlayer(player)) {
            count++;
        }
    }

    return count;
}

export function getPlayersInDimension(
    dimensionId
) {
    const id =
        normalizeString(dimensionId);

    if (!id) {
        return [];
    }

    return enumeratePlayers().filter(
        player =>
            isValidPlayer(player) &&
            getPlayerDimension(player) === id
    );
}

export function getPlayersWithVantageEnabled() {
    return enumeratePlayers().filter(
        player =>
            isValidPlayer(player) &&
            isPlayerEnabled(player)
    );
}

export function getPlayersUsingFirstPerson() {
    return enumeratePlayers().filter(
        player =>
            isValidPlayer(player) &&
            isPlayerInFirstPerson(player)
    );
}

export function getPlayersUsingThirdPerson() {
    return enumeratePlayers().filter(
        player =>
            isValidPlayer(player) &&
            isPlayerInThirdPerson(player)
    );
}

export function getPlayersWithAnimationSupport() {
    return enumeratePlayers().filter(
        player =>
            isValidPlayer(player) &&
            isAnimationEnabled(player)
    );
}

export function getPlayersWithDegradedSync() {
    return enumeratePlayers().filter(
        player =>
            isValidPlayer(player) &&
            getPlayerSyncState(player) ===
            SYNC_STATES.DEGRADED
    );
}

export function getPlayersWithCompatibilityConflicts() {
    return enumeratePlayers().filter(
        player => {
            if (!isValidPlayer(player)) {
                return false;
            }

            const compatibility =
                getPlayerCompatibility(player);

            return Boolean(
                compatibility &&
                Array.isArray(
                    compatibility.conflicts
                ) &&
                compatibility.conflicts.length > 0
            );
        }
    );
}

export function getSharedCompatibilityStatus() {
    return getCompatibilityStatus();
}

export function getSharedCompatibilitySnapshot() {
    return clone(
        getCompatibilitySnapshot()
    );
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
        getPlayerCompatibility(player);

    if (!compatibility) {
        return true;
    }

    return (
        Array.isArray(
            compatibility.conflicts
        ) &&
        compatibility.conflicts.length > 0
    ) ||
        compatibility.status ===
        "incompatible";
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

    if (status === "incompatible") {
        return MULTIPLAYER_MODES.INDEPENDENT;
    }

    if (status === "limited") {
        return MULTIPLAYER_MODES.SERVER_SAFE;
    }

    return MULTIPLAYER_MODES.INDEPENDENT;
}

export function isMultiplayerSafe(
    player = null
) {
    if (
        player &&
        !isValidPlayer(player)
    ) {
        return false;
    }

    const status =
        player
            ? getPlayerCompatibility(player)
                ?.status
            : getCompatibilityStatus();

    return (
        status === "compatible" ||
        status === "unknown" ||
        status === "limited"
    );
}

export function isCameraSystemActive(
    player
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    try {
        return isCameraActive(player);
    } catch {
        return false;
    }
}

export function getSessionSnapshot() {
    return clone(
        getOrCreateSession()
    );
}

export function getSessionIdSafe() {
    return getSessionId();
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
        bumpRevision();
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

    for (const player of enumeratePlayers()) {
        removePlayerReference(player);
    }

    sessions.clear();
    playerIds.clear();

    sessionId = undefined;
    initialized = false;
    lastSweepTick = -1;
    lastCompatibilityTick = -1;
    lastCleanupTick = -1;

    bumpRevision();

    return stopped;
}

export function getSnapshot() {
    const players =
        enumeratePlayers();

    const playerSnapshots = [];

    for (const player of players) {
        if (!isValidPlayer(player)) {
            continue;
        }

        const record =
            getPlayerRecord(player);

        if (record) {
            playerSnapshots.push(
                clone(record)
            );
        }
    }

    const activePlayerCount =
        players.filter(
            player =>
                isValidPlayer(player)
        ).length;

    return {
        initialized,
        revision,
        packRevision:
            getPackRevision(),
        playerCount:
            players.length,
        activePlayerCount,
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
        session:
            getSessionSnapshot(),
        players:
            playerSnapshots
    };
}