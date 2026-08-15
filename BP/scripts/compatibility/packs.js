import { system, world } from "@minecraft/server";

const PACK_STATUS = Object.freeze({
    UNKNOWN: "unknown",
    COMPATIBLE: "compatible",
    LIMITED: "limited",
    INCOMPATIBLE: "incompatible"
});

const PACK_TYPES = Object.freeze({
    UNKNOWN: "unknown",
    RESOURCE: "resource",
    BEHAVIOR: "behavior",
    ADDON: "addon",
    CUSTOM: "custom"
});

const CAPABILITIES = Object.freeze({
    SCRIPT_API: "script_api",
    CAMERA_PRESETS: "camera_presets",
    ANIMATION_CONTROLLERS: "animation_controllers",
    PLAYER_ANIMATIONS: "player_animations",
    CUSTOM_GEOMETRY: "custom_geometry",
    CUSTOM_RENDER_CONTROLLERS: "custom_render_controllers",
    ATTACHABLES: "attachables",
    CUSTOM_PLAYER_RENDERING: "custom_player_rendering"
});

const packs = new Map();
const playerProfiles = new WeakMap();

let initialized = false;
let revision = 0;

function clone(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function normalizeString(value, fallback = "") {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : fallback;
}

function normalizeArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [...new Set(
        value
            .filter(item => typeof item === "string" && item.trim())
            .map(item => item.trim())
    )];
}

function normalizeIdentifier(value) {
    return normalizeString(value).toLowerCase();
}

function normalizeStatus(value) {
    return Object.values(PACK_STATUS).includes(value)
        ? value
        : PACK_STATUS.UNKNOWN;
}

function normalizeType(value) {
    return Object.values(PACK_TYPES).includes(value)
        ? value
        : PACK_TYPES.UNKNOWN;
}

function normalizeCapability(value) {
    return normalizeString(value);
}

function bumpRevision() {
    revision++;
}

function getPlayerId(player) {
    try {
        return typeof player?.id === "string" && player.id.length > 0
            ? player.id
            : null;
    } catch {
        return null;
    }
}

function detectScriptApi() {
    try {
        return Boolean(
            world &&
            system &&
            typeof world.getPlayers === "function" &&
            typeof system.run === "function"
        );
    } catch {
        return false;
    }
}

function detectCameraSupport() {
    try {
        return Boolean(
            world &&
            typeof world.getPlayers === "function"
        );
    } catch {
        return false;
    }
}

function getRuntimeCapabilities() {
    const capabilities = [];

    if (detectScriptApi()) {
        capabilities.push(CAPABILITIES.SCRIPT_API);
    }

    if (detectCameraSupport()) {
        capabilities.push(CAPABILITIES.CAMERA_PRESETS);
    }

    return capabilities;
}

function getRuntimeProfile() {
    const capabilities = getRuntimeCapabilities();
    const scriptApi = capabilities.includes(CAPABILITIES.SCRIPT_API);

    return {
        status: scriptApi
            ? PACK_STATUS.COMPATIBLE
            : PACK_STATUS.LIMITED,
        type: PACK_TYPES.ADDON,
        capabilities,
        conflicts: [],
        warnings: scriptApi
            ? []
            : ["script_api_unavailable"]
    };
}

function createPack(identifier, metadata = {}) {
    const id = normalizeIdentifier(identifier);

    if (!id) {
        return null;
    }

    const profile = metadata.profile ?? {};

    return {
        identifier: id,
        name: normalizeString(metadata.name, id),
        version: normalizeString(metadata.version, "unknown"),
        type: normalizeType(metadata.type),
        namespace: normalizeString(metadata.namespace),
        enabled: metadata.enabled !== false,
        profile: {
            status: normalizeStatus(profile.status),
            capabilities: normalizeArray(profile.capabilities),
            conflicts: normalizeArray(profile.conflicts),
            warnings: normalizeArray(profile.warnings ?? profile.notes)
        }
    };
}

function getPack(identifier) {
    return packs.get(
        normalizeIdentifier(identifier)
    ) ?? null;
}

function calculateCompatibility() {
    const runtime = getRuntimeProfile();
    const enabledPacks = [...packs.values()].filter(pack => pack.enabled);

    let status = runtime.status;
    const capabilities = [...runtime.capabilities];
    const conflicts = [];
    const warnings = [...runtime.warnings];

    for (const pack of enabledPacks) {
        const profile = pack.profile;

        capabilities.push(...profile.capabilities);
        conflicts.push(...profile.conflicts);
        warnings.push(...profile.warnings);

        if (profile.status === PACK_STATUS.INCOMPATIBLE) {
            status = PACK_STATUS.INCOMPATIBLE;
        } else if (
            profile.status === PACK_STATUS.LIMITED &&
            status === PACK_STATUS.COMPATIBLE
        ) {
            status = PACK_STATUS.LIMITED;
        }
    }

    return {
        status,
        packs: enabledPacks.length,
        capabilities: [...new Set(capabilities)],
        conflicts: [...new Set(conflicts)],
        warnings: [...new Set(warnings)],
        revision
    };
}

function getPlayerProfile(player) {
    if (!player) {
        return null;
    }

    let profile = playerProfiles.get(player);

    if (!profile) {
        profile = {
            status: PACK_STATUS.UNKNOWN,
            capabilities: [],
            conflicts: [],
            warnings: []
        };

        playerProfiles.set(player, profile);
    }

    return profile;
}

export function initialize() {
    if (initialized) {
        return getCompatibilitySnapshot();
    }

    initialized = true;

    const runtime = getRuntimeProfile();

    packs.set(
        "vantage:runtime",
        createPack("vantage:runtime", {
            name: "Vantage Runtime",
            version: "1.0.0",
            type: PACK_TYPES.ADDON,
            namespace: "vantage",
            profile: runtime
        })
    );

    bumpRevision();

    return getCompatibilitySnapshot();
}

export function registerPack(identifier, metadata = {}) {
    const pack = createPack(identifier, metadata);

    if (!pack) {
        return false;
    }

    packs.set(pack.identifier, pack);
    bumpRevision();

    return true;
}

export function unregisterPack(identifier) {
    const id = normalizeIdentifier(identifier);

    if (!id) {
        return false;
    }

    const removed = packs.delete(id);

    if (removed) {
        bumpRevision();
    }

    return removed;
}

export function registerCompatibilityProfile(identifier, profile = {}) {
    const id = normalizeIdentifier(identifier);

    if (!id) {
        return false;
    }

    const existing = getPack(id);

    if (existing) {
        existing.profile = {
            ...existing.profile,
            ...profile,
            status: normalizeStatus(
                profile.status ?? existing.profile.status
            ),
            capabilities: [
                ...new Set([
                    ...existing.profile.capabilities,
                    ...normalizeArray(profile.capabilities)
                ])
            ],
            conflicts: [
                ...new Set([
                    ...existing.profile.conflicts,
                    ...normalizeArray(profile.conflicts)
                ])
            ],
            warnings: [
                ...new Set([
                    ...existing.profile.warnings,
                    ...normalizeArray(profile.warnings ?? profile.notes)
                ])
            ]
        };

        bumpRevision();

        return true;
    }

    return registerPack(id, {
        profile
    });
}

export function getRegisteredPack(identifier) {
    const pack = getPack(identifier);

    return pack
        ? clone(pack)
        : null;
}

export function getRegisteredPacks() {
    return clone([...packs.values()]);
}

export function getEnabledRegisteredPacks() {
    return clone(
        [...packs.values()].filter(pack => pack.enabled)
    );
}

export function isPackRegistered(identifier) {
    return Boolean(getPack(identifier));
}

export function getPackStatus(identifier) {
    const pack = getPack(identifier);

    if (!pack || !pack.enabled) {
        return PACK_STATUS.UNKNOWN;
    }

    return pack.profile.status;
}

export function getPackCapabilities(identifier) {
    const pack = getPack(identifier);

    if (!pack || !pack.enabled) {
        return [];
    }

    return [...pack.profile.capabilities];
}

export function packHasCapability(identifier, capability) {
    const pack = getPack(identifier);

    if (!pack || !pack.enabled) {
        return false;
    }

    return pack.profile.capabilities.includes(
        normalizeCapability(capability)
    );
}

export function setPackEnabled(identifier, enabled) {
    const pack = getPack(identifier);

    if (!pack) {
        return false;
    }

    const value = Boolean(enabled);

    if (pack.enabled === value) {
        return true;
    }

    pack.enabled = value;
    bumpRevision();

    return true;
}

export function isPackEnabled(identifier) {
    const pack = getPack(identifier);

    return Boolean(pack?.enabled);
}

export function addPackConflict(identifier, conflict) {
    const pack = getPack(identifier);
    const value = normalizeString(conflict);

    if (!pack || !value) {
        return false;
    }

    if (!pack.profile.conflicts.includes(value)) {
        pack.profile.conflicts.push(value);
        bumpRevision();
    }

    return true;
}

export function removePackConflict(identifier, conflict) {
    const pack = getPack(identifier);

    if (!pack) {
        return false;
    }

    const index = pack.profile.conflicts.indexOf(conflict);

    if (index === -1) {
        return false;
    }

    pack.profile.conflicts.splice(index, 1);
    bumpRevision();

    return true;
}

export function addPackCapability(identifier, capability) {
    const pack = getPack(identifier);
    const value = normalizeCapability(capability);

    if (!pack || !value) {
        return false;
    }

    if (!pack.profile.capabilities.includes(value)) {
        pack.profile.capabilities.push(value);
        bumpRevision();
    }

    return true;
}

export function removePackCapability(identifier, capability) {
    const pack = getPack(identifier);

    if (!pack) {
        return false;
    }

    const index = pack.profile.capabilities.indexOf(capability);

    if (index === -1) {
        return false;
    }

    pack.profile.capabilities.splice(index, 1);
    bumpRevision();

    return true;
}

export function getRuntimeCapabilitiesSafe() {
    return getRuntimeCapabilities();
}

export function getRuntimeCapabilities() {
    return getRuntimeCapabilitiesInternal();
}

function getRuntimeCapabilitiesInternal() {
    return getRuntimeCapabilities();
}

export function runtimeSupports(capability) {
    return getRuntimeCapabilitiesInternal().includes(
        normalizeCapability(capability)
    );
}

export function getCompatibilitySnapshot() {
    return calculateCompatibility();
}

export function getCompatibilityStatus() {
    return getCompatibilitySnapshot().status;
}

export function isCompatible() {
    const status = getCompatibilityStatus();

    return (
        status === PACK_STATUS.COMPATIBLE ||
        status === PACK_STATUS.UNKNOWN
    );
}

export function hasCompatibilityConflicts() {
    return getCompatibilityConflicts().length > 0;
}

export function getCompatibilityConflicts() {
    return getCompatibilitySnapshot().conflicts;
}

export function getCompatibilityWarnings() {
    return getCompatibilitySnapshot().warnings;
}

export function getPlayerCompatibility(player) {
    const key = getPlayerId(player);

    if (!key) {
        return null;
    }

    const profile = getPlayerProfile(player);
    const global = getCompatibilitySnapshot();

    return {
        status:
            profile.status === PACK_STATUS.UNKNOWN
                ? global.status
                : profile.status,
        capabilities: [
            ...new Set([
                ...global.capabilities,
                ...profile.capabilities
            ])
        ],
        conflicts: [
            ...new Set([
                ...global.conflicts,
                ...profile.conflicts
            ])
        ],
        warnings: [
            ...new Set([
                ...global.warnings,
                ...profile.warnings
            ])
        ]
    };
}

export function updatePlayerCompatibility(player, profile = {}) {
    const current = getPlayerProfile(player);

    if (!current) {
        return false;
    }

    if (profile.status !== undefined) {
        current.status = normalizeStatus(profile.status);
    }

    if (profile.capabilities !== undefined) {
        current.capabilities = [
            ...new Set([
                ...current.capabilities,
                ...normalizeArray(profile.capabilities)
            ])
        ];
    }

    if (profile.conflicts !== undefined) {
        current.conflicts = [
            ...new Set([
                ...current.conflicts,
                ...normalizeArray(profile.conflicts)
            ])
        ];
    }

    if (profile.warnings !== undefined) {
        current.warnings = [
            ...new Set([
                ...current.warnings,
                ...normalizeArray(profile.warnings)
            ])
        ];
    }

    bumpRevision();

    return true;
}

export function setPlayerCompatibilityStatus(player, status) {
    return updatePlayerCompatibility(player, {
        status
    });
}

export function addPlayerCapability(player, capability) {
    return updatePlayerCompatibility(player, {
        capabilities: [capability]
    });
}

export function removePlayerCapability(player, capability) {
    const profile = getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    const index = profile.capabilities.indexOf(capability);

    if (index === -1) {
        return false;
    }

    profile.capabilities.splice(index, 1);
    bumpRevision();

    return true;
}

export function addPlayerConflict(player, conflict) {
    return updatePlayerCompatibility(player, {
        conflicts: [conflict]
    });
}

export function removePlayerConflict(player, conflict) {
    const profile = getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    const index = profile.conflicts.indexOf(conflict);

    if (index === -1) {
        return false;
    }

    profile.conflicts.splice(index, 1);
    bumpRevision();

    return true;
}

export function clearPlayerConflicts(player) {
    const profile = getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    profile.conflicts = [];
    bumpRevision();

    return true;
}

export function getRecommendedRenderStrategy(player = null) {
    const compatibility = player
        ? getPlayerCompatibility(player)
        : getCompatibilitySnapshot();

    if (!compatibility) {
        return "vanilla";
    }

    if (compatibility.status === PACK_STATUS.INCOMPATIBLE) {
        return "vanilla";
    }

    if (
        compatibility.status === PACK_STATUS.LIMITED ||
        compatibility.conflicts.length > 0
    ) {
        return "minimal";
    }

    return "vantage";
}

export function getRecommendedAnimationStrategy(player = null) {
    return getRecommendedRenderStrategy(player);
}

export function shouldUseVantageRendering(player = null) {
    return getRecommendedRenderStrategy(player) === "vantage";
}

export function shouldUseMinimalRendering(player = null) {
    return getRecommendedRenderStrategy(player) === "minimal";
}

export function shouldUseVanillaRendering(player = null) {
    return getRecommendedRenderStrategy(player) === "vanilla";
}

export function shouldUseVantageAnimations(player = null) {
    return getRecommendedAnimationStrategy(player) === "vantage";
}

export function shouldUseMinimalAnimations(player = null) {
    return getRecommendedAnimationStrategy(player) === "minimal";
}

export function shouldUseVanillaAnimations(player = null) {
    return getRecommendedAnimationStrategy(player) === "vanilla";
}

export function playerSupports(player, capability) {
    const compatibility = getPlayerCompatibility(player);

    return Boolean(
        compatibility?.capabilities.includes(
            normalizeCapability(capability)
        )
    );
}

export function playerHasConflicts(player) {
    const compatibility = getPlayerCompatibility(player);

    return Boolean(
        compatibility?.conflicts.length
    );
}

export function getPackTypes() {
    return PACK_TYPES;
}

export function getPackStatuses() {
    return PACK_STATUS;
}

export function getCapabilities() {
    return CAPABILITIES;
}

export function getRevision() {
    return revision;
}

export function isInitialized() {
    return initialized;
}

export function refresh() {
    bumpRevision();

    return getCompatibilitySnapshot();
}

export function clearPlayer(player) {
    if (!player) {
        return false;
    }

    const removed = playerProfiles.delete(player);

    if (removed) {
        bumpRevision();
    }

    return removed;
}

export function clear() {
    packs.clear();
    revision++;
    initialized = false;

    return true;
}

export function getPlayerProfileSnapshot(player) {
    const profile = getPlayerProfile(player);

    return profile
        ? clone(profile)
        : null;
}

export function getSnapshot() {
    return {
        initialized,
        revision,
        runtimeCapabilities: getRuntimeCapabilitiesInternal(),
        compatibility: getCompatibilitySnapshot(),
        packs: getRegisteredPacks()
    };
}