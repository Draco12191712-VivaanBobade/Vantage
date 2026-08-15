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

const STORAGE_VERSION = 1;

const MAX_STRING_LENGTH = 32767;

let worldCache = null;
let worldLoaded = false;

let playerCache = new WeakMap();

function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function clone(value) {
    try {
        return JSON.parse(
            JSON.stringify(value)
        );
    } catch {
        return null;
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

function createStorageData(config) {
    if (!isObject(config)) {
        return null;
    }

    return {
        storageVersion: STORAGE_VERSION,
        configVersion: CONFIG_VERSION,
        data: clone(config)
    };
}

function serialize(config) {
    const data =
        createStorageData(config);

    if (!data) {
        return null;
    }

    try {
        const value =
            JSON.stringify(data);

        if (
            value.length === 0 ||
            value.length > MAX_STRING_LENGTH
        ) {
            return null;
        }

        return value;
    } catch {
        return null;
    }
}

function deserialize(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > MAX_STRING_LENGTH
    ) {
        return null;
    }

    try {
        const parsed =
            JSON.parse(value);

        if (!isObject(parsed)) {
            return null;
        }

        if (
            parsed.storageVersion !==
            STORAGE_VERSION
        ) {
            return null;
        }

        if (!isObject(parsed.data)) {
            return null;
        }

        return clone(parsed.data);
    } catch {
        return null;
    }
}

function read(target, key) {
    try {
        return target.getDynamicProperty(key);
    } catch {
        return undefined;
    }
}

function write(target, key, config) {
    const serialized =
        serialize(config);

    if (!serialized) {
        return false;
    }

    try {
        target.setDynamicProperty(
            key,
            serialized
        );

        return true;
    } catch {
        return false;
    }
}

function remove(target, key) {
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

function getPlayerEntry(player) {
    let entry =
        playerCache.get(player);

    if (!entry) {
        entry = {
            loaded: false,
            config: null
        };

        playerCache.set(
            player,
            entry
        );
    }

    return entry;
}

function readWorldConfig() {
    const raw =
        read(
            world,
            WORLD_CONFIG_KEY
        );

    if (raw === undefined) {
        return null;
    }

    return deserialize(raw);
}

function readPlayerConfig(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const raw =
        read(
            player,
            PLAYER_CONFIG_KEY
        );

    if (raw === undefined) {
        return null;
    }

    return deserialize(raw);
}

/* World configuration */

export function loadWorldConfig() {
    if (worldLoaded) {
        return clone(worldCache);
    }

    const config =
        readWorldConfig();

    worldCache =
        config
            ? clone(config)
            : null;

    worldLoaded = true;

    return clone(worldCache);
}

export function saveWorldConfig(config) {
    if (!isObject(config)) {
        return false;
    }

    const success =
        write(
            world,
            WORLD_CONFIG_KEY,
            config
        );

    if (!success) {
        return false;
    }

    worldCache =
        clone(config);

    worldLoaded = true;

    return true;
}

export function deleteWorldConfig() {
    const success =
        remove(
            world,
            WORLD_CONFIG_KEY
        );

    if (success) {
        worldCache = null;
        worldLoaded = true;
    }

    return success;
}

/* Player configuration */

export function loadPlayerConfig(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const entry =
        getPlayerEntry(player);

    if (entry.loaded) {
        return clone(entry.config);
    }

    const config =
        readPlayerConfig(player);

    entry.config =
        config
            ? clone(config)
            : null;

    entry.loaded = true;

    return clone(entry.config);
}

export function savePlayerConfig(
    player,
    config
) {
    if (
        !isValidPlayer(player) ||
        !isObject(config)
    ) {
        return false;
    }

    const success =
        write(
            player,
            PLAYER_CONFIG_KEY,
            config
        );

    if (!success) {
        return false;
    }

    const entry =
        getPlayerEntry(player);

    entry.loaded = true;
    entry.config =
        clone(config);

    return true;
}

export function deletePlayerConfig(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const success =
        remove(
            player,
            PLAYER_CONFIG_KEY
        );

    if (success) {
        playerCache.delete(player);
    }

    return success;
}

/* Defaults */

export function resetWorldConfig() {
    return saveWorldConfig(
        clone(DEFAULT_CONFIG)
    );
}

export function resetPlayerConfig(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return savePlayerConfig(
        player,
        clone(DEFAULT_CONFIG)
    );
}

/* Cache */

export function clearWorldCache() {
    worldCache = null;
    worldLoaded = false;

    return true;
}

export function clearPlayerCache(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return playerCache.delete(player);
}

export function clearCaches() {
    worldCache = null;
    worldLoaded = false;
    playerCache = new WeakMap();

    return true;
}

/* Existence */

export function hasWorldConfig() {
    return (
        read(
            world,
            WORLD_CONFIG_KEY
        ) !== undefined
    );
}

export function hasPlayerConfig(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return (
        read(
            player,
            PLAYER_CONFIG_KEY
        ) !== undefined
    );
}

/* Storage information */

export function getStorageVersion() {
    return STORAGE_VERSION;
}

export function getConfigVersion() {
    return CONFIG_VERSION;
}

export function getWorldConfigKey() {
    return WORLD_CONFIG_KEY;
}

export function getPlayerConfigKey() {
    return PLAYER_CONFIG_KEY;
}