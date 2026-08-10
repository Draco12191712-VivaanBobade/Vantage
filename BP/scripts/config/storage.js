import { world } from "@minecraft/server";

import {
    DEFAULT_CONFIG,
    CONFIG_VERSION
} from "./defaults.js";

const STORAGE_PREFIX = "vantage";

const WORLD_CONFIG_KEY =
    `${STORAGE_PREFIX}:config`;

const PLAYER_CONFIG_KEY =
    `${STORAGE_PREFIX}:player_config`;

const STORAGE_VERSION = 2;

const MAX_DYNAMIC_PROPERTY_STRING_LENGTH = 32767;

const cache = {
    world: null,
    worldLoaded: false,
    players: new WeakMap()
};

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

function cloneValue(value) {
    if (value === undefined) {
        return undefined;
    }

    try {
        return JSON.parse(
            JSON.stringify(value)
        );
    } catch {
        return undefined;
    }
}

function normalizeData(data) {
    if (!isObject(data)) {
        return null;
    }

    const cloned = cloneValue(data);

    return isObject(cloned)
        ? cloned
        : null;
}

function createEnvelope(data) {
    return {
        storageVersion: STORAGE_VERSION,
        configVersion: CONFIG_VERSION,
        timestamp: Date.now(),
        data: cloneValue(data)
    };
}

function serialize(data) {
    const normalized =
        normalizeData(data);

    if (!normalized) {
        return null;
    }

    try {
        const serialized =
            JSON.stringify(
                createEnvelope(normalized)
            );

        if (
            typeof serialized !== "string" ||
            serialized.length === 0
        ) {
            return null;
        }

        if (
            serialized.length >
            MAX_DYNAMIC_PROPERTY_STRING_LENGTH
        ) {
            return null;
        }

        return serialized;
    } catch {
        return null;
    }
}

function deserialize(value) {
    if (
        typeof value !== "string" ||
        value.length === 0
    ) {
        return null;
    }

    if (
        value.length >
        MAX_DYNAMIC_PROPERTY_STRING_LENGTH
    ) {
        return null;
    }

    try {
        const parsed =
            JSON.parse(value);

        if (!isObject(parsed)) {
            return null;
        }

        const storageVersion =
            parsed.storageVersion;

        if (
            typeof storageVersion !== "number" ||
            !Number.isFinite(storageVersion)
        ) {
            return null;
        }

        if (
            storageVersion < 1 ||
            storageVersion > STORAGE_VERSION
        ) {
            return null;
        }

        if (
            !isObject(parsed.data)
        ) {
            return null;
        }

        return {
            storageVersion,
            configVersion:
                typeof parsed.configVersion === "number"
                    ? parsed.configVersion
                    : 1,
            timestamp:
                typeof parsed.timestamp === "number"
                    ? parsed.timestamp
                    : 0,
            data:
                cloneValue(parsed.data)
        };
    } catch {
        return null;
    }
}

function readDynamicProperty(
    target,
    key
) {
    try {
        return target.getDynamicProperty(key);
    } catch {
        return undefined;
    }
}

function writeDynamicProperty(
    target,
    key,
    value
) {
    if (
        typeof value !== "string" ||
        value.length === 0
    ) {
        return false;
    }

    if (
        value.length >
        MAX_DYNAMIC_PROPERTY_STRING_LENGTH
    ) {
        return false;
    }

    try {
        target.setDynamicProperty(
            key,
            value
        );

        return true;
    } catch {
        return false;
    }
}

function deleteDynamicProperty(
    target,
    key
) {
    try {
        target.setDynamicProperty(
            key,
            undefined
        );

        return true;
    } catch {
        return false;
    }
}

function getPlayerCache(player) {
    let entry =
        cache.players.get(player);

    if (!entry) {
        entry = {
            loaded: false,
            data: null,
            storageVersion: null,
            configVersion: null,
            migrated: false,
            lastLoaded: 0
        };

        cache.players.set(
            player,
            entry
        );
    }

    return entry;
}

function readWorldRaw() {
    return readDynamicProperty(
        world,
        WORLD_CONFIG_KEY
    );
}

function readPlayerRaw(player) {
    if (!isValidPlayer(player)) {
        return undefined;
    }

    return readDynamicProperty(
        player,
        PLAYER_CONFIG_KEY
    );
}

function migrateData(
    data,
    fromStorageVersion,
    fromConfigVersion
) {
    let migrated =
        cloneValue(data);

    if (!isObject(migrated)) {
        return null;
    }

    if (
        fromStorageVersion < 2
    ) {
        migrated =
            migrateStorageV1ToV2(
                migrated
            );

        if (!migrated) {
            return null;
        }
    }

    if (
        fromConfigVersion < CONFIG_VERSION
    ) {
        migrated =
            migrateConfigVersion(
                migrated,
                fromConfigVersion,
                CONFIG_VERSION
            );

        if (!migrated) {
            return null;
        }
    }

    return normalizeData(
        migrated
    );
}

function migrateStorageV1ToV2(
    data
) {
    if (!isObject(data)) {
        return null;
    }

    const result =
        cloneValue(data);

    if (!isObject(result)) {
        return null;
    }

    return result;
}

function migrateConfigVersion(
    data,
    fromVersion,
    toVersion
) {
    if (!isObject(data)) {
        return null;
    }

    let result =
        cloneValue(data);

    if (!isObject(result)) {
        return null;
    }

    /*
     * Configuration migrations should be added here
     * whenever DEFAULT_CONFIG changes structurally.
     *
     * Version 1 -> Version 2 currently requires no
     * destructive transformation because config.js
     * performs structural default merging and validation.
     */

    if (
        fromVersion < 2 &&
        toVersion >= 2
    ) {
        result.version =
            CONFIG_VERSION;
    }

    return result;
}

function writeMigratedWorldConfig(
    data
) {
    const success =
        saveWorldConfig(data);

    return success;
}

function writeMigratedPlayerConfig(
    player,
    data
) {
    return savePlayerConfig(
        player,
        data
    );
}

function loadWorldEnvelope() {
    const raw =
        readWorldRaw();

    if (raw === undefined) {
        return null;
    }

    return deserialize(raw);
}

function loadPlayerEnvelope(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const raw =
        readPlayerRaw(player);

    if (raw === undefined) {
        return null;
    }

    return deserialize(raw);
}

export function loadWorldConfig() {
    if (cache.worldLoaded) {
        return cloneValue(
            cache.world
        );
    }

    const envelope =
        loadWorldEnvelope();

    if (!envelope) {
        cache.worldLoaded = true;
        cache.world = null;

        return null;
    }

    let data =
        normalizeData(
            envelope.data
        );

    if (!data) {
        cache.worldLoaded = true;
        cache.world = null;

        return null;
    }

    const needsMigration =
        envelope.storageVersion <
        STORAGE_VERSION ||
        envelope.configVersion <
        CONFIG_VERSION;

    if (needsMigration) {
        data =
            migrateData(
                data,
                envelope.storageVersion,
                envelope.configVersion
            );

        if (!data) {
            cache.worldLoaded = true;
            cache.world = null;

            return null;
        }

        writeMigratedWorldConfig(
            data
        );
    }

    cache.world = cloneValue(data);
    cache.worldLoaded = true;

    return cloneValue(data);
}

export function saveWorldConfig(
    config
) {
    const data =
        normalizeData(config);

    if (!data) {
        return false;
    }

    const serialized =
        serialize(data);

    if (!serialized) {
        return false;
    }

    const success =
        writeDynamicProperty(
            world,
            WORLD_CONFIG_KEY,
            serialized
        );

    if (!success) {
        return false;
    }

    cache.world =
        cloneValue(data);

    cache.worldLoaded = true;

    return true;
}

export function hasWorldConfig() {
    return (
        readWorldRaw() !==
        undefined
    );
}

export function deleteWorldConfig() {
    const success =
        deleteDynamicProperty(
            world,
            WORLD_CONFIG_KEY
        );

    if (success) {
        cache.world = null;
        cache.worldLoaded = true;
    }

    return success;
}

export function loadPlayerConfig(
    player
) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const entry =
        getPlayerCache(player);

    if (entry.loaded) {
        return cloneValue(
            entry.data
        );
    }

    const envelope =
        loadPlayerEnvelope(player);

    if (!envelope) {
        entry.loaded = true;
        entry.data = null;
        entry.storageVersion = null;
        entry.configVersion = null;
        entry.migrated = false;
        entry.lastLoaded = Date.now();

        return null;
    }

    let data =
        normalizeData(
            envelope.data
        );

    if (!data) {
        entry.loaded = true;
        entry.data = null;
        entry.storageVersion =
            envelope.storageVersion;
        entry.configVersion =
            envelope.configVersion;
        entry.migrated = false;
        entry.lastLoaded = Date.now();

        return null;
    }

    const needsMigration =
        envelope.storageVersion <
        STORAGE_VERSION ||
        envelope.configVersion <
        CONFIG_VERSION;

    if (needsMigration) {
        data =
            migrateData(
                data,
                envelope.storageVersion,
                envelope.configVersion
            );

        if (!data) {
            entry.loaded = true;
            entry.data = null;
            entry.migrated = false;
            entry.lastLoaded = Date.now();

            return null;
        }

        const migrated =
            writeMigratedPlayerConfig(
                player,
                data
            );

        entry.migrated =
            migrated;
    }

    entry.loaded = true;
    entry.data = cloneValue(data);
    entry.storageVersion =
        STORAGE_VERSION;
    entry.configVersion =
        CONFIG_VERSION;
    entry.lastLoaded =
        Date.now();

    return cloneValue(data);
}

export function savePlayerConfig(
    player,
    config
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const data =
        normalizeData(config);

    if (!data) {
        return false;
    }

    const serialized =
        serialize(data);

    if (!serialized) {
        return false;
    }

    const success =
        writeDynamicProperty(
            player,
            PLAYER_CONFIG_KEY,
            serialized
        );

    if (!success) {
        return false;
    }

    const entry =
        getPlayerCache(player);

    entry.loaded = true;
    entry.data =
        cloneValue(data);
    entry.storageVersion =
        STORAGE_VERSION;
    entry.configVersion =
        CONFIG_VERSION;
    entry.migrated = false;
    entry.lastLoaded =
        Date.now();

    return true;
}

export function hasPlayerConfig(
    player
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return (
        readPlayerRaw(player) !==
        undefined
    );
}

export function deletePlayerConfig(
    player
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const success =
        deleteDynamicProperty(
            player,
            PLAYER_CONFIG_KEY
        );

    if (success) {
        cache.players.delete(
            player
        );
    }

    return success;
}

export function clearWorldConfig() {
    return deleteWorldConfig();
}

export function clearPlayerConfig(
    player
) {
    return deletePlayerConfig(
        player
    );
}

export function clearPlayerCache(
    player
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return cache.players.delete(
        player
    );
}

export function clearAllCaches() {
    cache.world = null;
    cache.worldLoaded = false;
    cache.players = new WeakMap();

    return true;
}

export function getWorldConfigKey() {
    return WORLD_CONFIG_KEY;
}

export function getPlayerConfigKey() {
    return PLAYER_CONFIG_KEY;
}

export function getStorageVersion() {
    return STORAGE_VERSION;
}

export function getConfigVersion() {
    return CONFIG_VERSION;
}

export function getMaxStorageSize() {
    return MAX_DYNAMIC_PROPERTY_STRING_LENGTH;
}

export function getStorageInfo() {
    return {
        storageVersion:
            STORAGE_VERSION,

        configVersion:
            CONFIG_VERSION,

        worldKey:
            WORLD_CONFIG_KEY,

        playerKey:
            PLAYER_CONFIG_KEY,

        maxStringLength:
            MAX_DYNAMIC_PROPERTY_STRING_LENGTH,

        worldCached:
            cache.worldLoaded
    };
}

export function worldConfigExists() {
    return hasWorldConfig();
}

export function playerConfigExists(
    player
) {
    return hasPlayerConfig(
        player
    );
}

export function resetWorldToDefaults() {
    return saveWorldConfig(
        cloneValue(DEFAULT_CONFIG)
    );
}

export function resetPlayerToDefaults(
    player
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return savePlayerConfig(
        player,
        cloneValue(DEFAULT_CONFIG)
    );
}

export function loadWorldConfigOrDefaults() {
    const config =
        loadWorldConfig();

    return (
        config ??
        cloneValue(DEFAULT_CONFIG)
    );
}

export function loadPlayerConfigOrDefaults(
    player
) {
    if (!isValidPlayer(player)) {
        return cloneValue(
            DEFAULT_CONFIG
        );
    }

    return (
        loadPlayerConfig(player) ??
        cloneValue(DEFAULT_CONFIG)
    );
}

export function migrateWorldConfig(
    migrator
) {
    if (
        typeof migrator !==
        "function"
    ) {
        return false;
    }

    const current =
        loadWorldConfig();

    if (!current) {
        return false;
    }

    try {
        const migrated =
            migrator(
                cloneValue(current),
                CONFIG_VERSION
            );

        if (!isObject(migrated)) {
            return false;
        }

        return saveWorldConfig(
            migrated
        );
    } catch {
        return false;
    }
}

export function migratePlayerConfig(
    player,
    migrator
) {
    if (
        !isValidPlayer(player) ||
        typeof migrator !==
        "function"
    ) {
        return false;
    }

    const current =
        loadPlayerConfig(player);

    if (!current) {
        return false;
    }

    try {
        const migrated =
            migrator(
                cloneValue(current),
                CONFIG_VERSION
            );

        if (!isObject(migrated)) {
            return false;
        }

        return savePlayerConfig(
            player,
            migrated
        );
    } catch {
        return false;
    }
}

export function exportWorldConfig() {
    const config =
        loadWorldConfig();

    if (!config) {
        return null;
    }

    return serialize(config);
}

export function exportPlayerConfig(
    player
) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const config =
        loadPlayerConfig(player);

    if (!config) {
        return null;
    }

    return serialize(config);
}

export function importWorldConfig(
    serialized
) {
    const envelope =
        deserialize(serialized);

    if (!envelope) {
        return false;
    }

    let data =
        normalizeData(
            envelope.data
        );

    if (!data) {
        return false;
    }

    if (
        envelope.storageVersion <
        STORAGE_VERSION ||
        envelope.configVersion <
        CONFIG_VERSION
    ) {
        data =
            migrateData(
                data,
                envelope.storageVersion,
                envelope.configVersion
            );

        if (!data) {
            return false;
        }
    }

    return saveWorldConfig(
        data
    );
}

export function importPlayerConfig(
    player,
    serialized
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const envelope =
        deserialize(serialized);

    if (!envelope) {
        return false;
    }

    let data =
        normalizeData(
            envelope.data
        );

    if (!data) {
        return false;
    }

    if (
        envelope.storageVersion <
        STORAGE_VERSION ||
        envelope.configVersion <
        CONFIG_VERSION
    ) {
        data =
            migrateData(
                data,
                envelope.storageVersion,
                envelope.configVersion
            );

        if (!data) {
            return false;
        }
    }

    return savePlayerConfig(
        player,
        data
    );
}

export function getWorldStorageStatus() {
    const raw =
        readWorldRaw();

    if (raw === undefined) {
        return {
            exists: false,
            valid: false,
            migrated: false,
            storageVersion: null,
            configVersion: null,
            size: 0
        };
    }

    const envelope =
        deserialize(raw);

    if (!envelope) {
        return {
            exists: true,
            valid: false,
            migrated: false,
            storageVersion: null,
            configVersion: null,
            size:
                typeof raw === "string"
                    ? raw.length
                    : 0
        };
    }

    return {
        exists: true,
        valid: true,
        migrated:
            envelope.storageVersion <
            STORAGE_VERSION ||
            envelope.configVersion <
            CONFIG_VERSION,
        storageVersion:
            envelope.storageVersion,
        configVersion:
            envelope.configVersion,
        size: raw.length
    };
}

export function getPlayerStorageStatus(
    player
) {
    if (!isValidPlayer(player)) {
        return {
            exists: false,
            valid: false,
            migrated: false,
            storageVersion: null,
            configVersion: null,
            size: 0
        };
    }

    const raw =
        readPlayerRaw(player);

    if (raw === undefined) {
        return {
            exists: false,
            valid: false,
            migrated: false,
            storageVersion: null,
            configVersion: null,
            size: 0
        };
    }

    const envelope =
        deserialize(raw);

    if (!envelope) {
        return {
            exists: true,
            valid: false,
            migrated: false,
            storageVersion: null,
            configVersion: null,
            size:
                typeof raw === "string"
                    ? raw.length
                    : 0
        };
    }

    return {
        exists: true,
        valid: true,
        migrated:
            envelope.storageVersion <
            STORAGE_VERSION ||
            envelope.configVersion <
            CONFIG_VERSION,
        storageVersion:
            envelope.storageVersion,
        configVersion:
            envelope.configVersion,
        size: raw.length
    };
}

export function validateSerializedConfig(
    serialized
) {
    const envelope =
        deserialize(serialized);

    if (!envelope) {
        return {
            valid: false,
            reason: "invalid_storage_data"
        };
    }

    const data =
        normalizeData(
            envelope.data
        );

    if (!data) {
        return {
            valid: false,
            reason: "invalid_configuration"
        };
    }

    return {
        valid: true,
        reason: null,
        storageVersion:
            envelope.storageVersion,
        configVersion:
            envelope.configVersion,
        requiresMigration:
            envelope.storageVersion <
            STORAGE_VERSION ||
            envelope.configVersion <
            CONFIG_VERSION,
        data:
            cloneValue(data)
    };
}