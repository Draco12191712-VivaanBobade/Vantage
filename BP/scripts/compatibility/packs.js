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

const DEFAULT_PROFILE = Object.freeze({
    status: PACK_STATUS.UNKNOWN,
    type: PACK_TYPES.UNKNOWN,
    priority: 0,
    trusted: false,
    registered: false,
    capabilities: Object.freeze([]),
    conflicts: Object.freeze([]),
    notes: Object.freeze([])
});

const packs = new Map();
const compatibilityCache = new Map();
const playerProfiles = new WeakMap();

let initialized = false;
let revision = 0;

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

function normalizeIdentifier(identifier) {
    return normalizeString(identifier)
        .toLowerCase();
}

function normalizeStatus(status) {
    return Object.values(PACK_STATUS).includes(status)
        ? status
        : PACK_STATUS.UNKNOWN;
}

function normalizePackType(type) {
    return Object.values(PACK_TYPES).includes(type)
        ? type
        : PACK_TYPES.UNKNOWN;
}

function normalizeCapability(capability) {
    const value = normalizeString(capability);

    if (!value) {
        return null;
    }

    return value;
}

function bumpRevision() {
    revision++;

    compatibilityCache.clear();
}

function normalizeProfile(profile = {}) {
    const source =
        profile &&
            typeof profile === "object"
            ? profile
            : {};

    return {
        status: normalizeStatus(
            source.status ??
            DEFAULT_PROFILE.status
        ),

        type: normalizePackType(
            source.type ??
            DEFAULT_PROFILE.type
        ),

        priority: normalizeNumber(
            source.priority,
            DEFAULT_PROFILE.priority
        ),

        trusted: normalizeBoolean(
            source.trusted,
            DEFAULT_PROFILE.trusted
        ),

        registered: normalizeBoolean(
            source.registered,
            DEFAULT_PROFILE.registered
        ),

        capabilities: normalizeArray(
            source.capabilities
        ),

        conflicts: normalizeArray(
            source.conflicts
        ),

        notes: normalizeArray(
            source.notes
        )
    };
}

function createPack(identifier, metadata = {}) {
    const id = normalizeIdentifier(identifier);

    if (!id) {
        return null;
    }

    const source =
        metadata &&
            typeof metadata === "object"
            ? metadata
            : {};

    return {
        identifier: id,

        name: normalizeString(
            source.name,
            id
        ),

        version: normalizeString(
            source.version,
            "unknown"
        ),

        type: normalizePackType(
            source.type ??
            PACK_TYPES.UNKNOWN
        ),

        namespace: normalizeString(
            source.namespace
        ),

        description: normalizeString(
            source.description
        ),

        profile: normalizeProfile(
            source.profile
        ),

        enabled: normalizeBoolean(
            source.enabled,
            true
        ),

        registeredAt: Date.now(),

        metadata: clone(source)
    };
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

function detectCameraPresetSupport() {
    try {
        return Boolean(
            world &&
            typeof world.getPlayers === "function"
        );
    } catch {
        return false;
    }
}

function detectRuntimeCapabilities() {
    const capabilities = [];

    if (detectScriptApi()) {
        capabilities.push(
            CAPABILITIES.SCRIPT_API
        );
    }

    if (detectCameraPresetSupport()) {
        capabilities.push(
            CAPABILITIES.CAMERA_PRESETS
        );
    }

    return capabilities;
}

function getRuntimeProfile() {
    const capabilities =
        detectRuntimeCapabilities();

    const scriptApiAvailable =
        capabilities.includes(
            CAPABILITIES.SCRIPT_API
        );

    return {
        status: scriptApiAvailable
            ? PACK_STATUS.COMPATIBLE
            : PACK_STATUS.LIMITED,

        type: PACK_TYPES.ADDON,

        priority: Number.MAX_SAFE_INTEGER,

        trusted: true,

        registered: false,

        capabilities,

        conflicts: [],

        notes: scriptApiAvailable
            ? []
            : [
                "Minecraft Script API runtime is unavailable."
            ]
    };
}

function getPack(identifier) {
    const id =
        normalizeIdentifier(identifier);

    if (!id) {
        return null;
    }

    return packs.get(id) ?? null;
}

function setPack(identifier, metadata = {}) {
    const pack =
        createPack(
            identifier,
            metadata
        );

    if (!pack) {
        return false;
    }

    packs.set(
        pack.identifier,
        pack
    );

    bumpRevision();

    return true;
}

function removePack(identifier) {
    const id =
        normalizeIdentifier(identifier);

    if (!id) {
        return false;
    }

    const removed =
        packs.delete(id);

    if (removed) {
        bumpRevision();
    }

    return removed;
}

function getAllRegisteredPacks() {
    return [
        ...packs.values()
    ];
}

function getEnabledPacks() {
    return getAllRegisteredPacks()
        .filter(pack => pack.enabled);
}

function hasCapability(profile, capability) {
    const normalized =
        normalizeCapability(capability);

    if (!normalized) {
        return false;
    }

    return Array.isArray(profile?.capabilities) &&
        profile.capabilities.includes(
            normalized
        );
}

function mergeProfiles(base, override) {
    const result =
        normalizeProfile(base);

    if (
        !override ||
        typeof override !== "object"
    ) {
        return result;
    }

    if (override.status !== undefined) {
        result.status =
            normalizeStatus(
                override.status
            );
    }

    if (override.type !== undefined) {
        result.type =
            normalizePackType(
                override.type
            );
    }

    if (override.priority !== undefined) {
        result.priority =
            normalizeNumber(
                override.priority,
                result.priority
            );
    }

    if (override.trusted !== undefined) {
        result.trusted =
            normalizeBoolean(
                override.trusted,
                result.trusted
            );
    }

    if (override.registered !== undefined) {
        result.registered =
            normalizeBoolean(
                override.registered,
                result.registered
            );
    }

    result.capabilities = [
        ...new Set([
            ...result.capabilities,
            ...normalizeArray(
                override.capabilities
            )
        ])
    ];

    result.conflicts = [
        ...new Set([
            ...result.conflicts,
            ...normalizeArray(
                override.conflicts
            )
        ])
    ];

    result.notes = [
        ...new Set([
            ...result.notes,
            ...normalizeArray(
                override.notes
            )
        ])
    ];

    return result;
}

function calculateCompatibility() {
    const registered =
        getEnabledPacks();

    const allRegistered =
        getAllRegisteredPacks();

    const runtimeCapabilities =
        detectRuntimeCapabilities();

    const result = {
        status: PACK_STATUS.COMPATIBLE,

        packs: registered.length,

        registeredPacks:
            allRegistered.length,

        enabledPacks:
            registered.length,

        disabledPacks:
            allRegistered.length -
            registered.length,

        conflicts: [],

        warnings: [],

        capabilities: [
            ...runtimeCapabilities
        ],

        revision
    };

    if (
        !runtimeCapabilities.includes(
            CAPABILITIES.SCRIPT_API
        )
    ) {
        result.status =
            PACK_STATUS.LIMITED;

        result.warnings.push(
            "Minecraft Script API is unavailable."
        );
    }

    for (const pack of registered) {
        const profile =
            normalizeProfile(
                pack.profile
            );

        result.capabilities = [
            ...new Set([
                ...result.capabilities,
                ...profile.capabilities
            ])
        ];

        result.conflicts.push(
            ...profile.conflicts
        );

        result.warnings.push(
            ...profile.notes
        );

        if (
            profile.status ===
            PACK_STATUS.INCOMPATIBLE
        ) {
            result.status =
                PACK_STATUS.INCOMPATIBLE;
        } else if (
            profile.status ===
            PACK_STATUS.LIMITED &&
            result.status ===
            PACK_STATUS.COMPATIBLE
        ) {
            result.status =
                PACK_STATUS.LIMITED;
        }
    }

    result.conflicts = [
        ...new Set(
            result.conflicts
        )
    ];

    result.warnings = [
        ...new Set(
            result.warnings
        )
    ];

    return result;
}

function cacheCompatibility(
    key,
    value
) {
    compatibilityCache.set(
        key,
        {
            revision,
            value: clone(value)
        }
    );
}

function getCachedCompatibility(key) {
    const entry =
        compatibilityCache.get(key);

    if (
        !entry ||
        entry.revision !== revision
    ) {
        return null;
    }

    return clone(
        entry.value
    );
}

function getPlayerKey(player) {
    if (!player) {
        return null;
    }

    try {
        const id = player.id;

        return typeof id === "string" &&
            id.length > 0
            ? id
            : null;
    } catch {
        return null;
    }
}

function getPlayerProfile(player) {
    if (!player) {
        return null;
    }

    let profile =
        playerProfiles.get(player);

    if (!profile) {
        profile = {
            known: true,
            firstSeen: Date.now(),
            lastUpdated: Date.now(),
            status: PACK_STATUS.UNKNOWN,
            capabilities: [],
            conflicts: [],
            warnings: []
        };

        playerProfiles.set(
            player,
            profile
        );
    }

    return profile;
}

function updatePlayerProfile(
    player,
    profile
) {
    if (!player) {
        return false;
    }

    const current =
        getPlayerProfile(player);

    if (!current) {
        return false;
    }

    const normalized =
        normalizeProfile(profile);

    current.status =
        normalized.status;

    current.capabilities = [
        ...new Set([
            ...current.capabilities,
            ...normalized.capabilities
        ])
    ];

    current.conflicts = [
        ...new Set([
            ...current.conflicts,
            ...normalized.conflicts
        ])
    ];

    current.warnings = [
        ...new Set([
            ...current.warnings,
            ...normalized.notes
        ])
    ];

    current.lastUpdated =
        Date.now();

    return true;
}

function removeFromArray(array, value) {
    const index =
        array.indexOf(value);

    if (index === -1) {
        return false;
    }

    array.splice(index, 1);

    return true;
}

function normalizePlayerStatus(
    status
) {
    return normalizeStatus(status);
}

export function initialize() {
    if (initialized) {
        return getCompatibilitySnapshot();
    }

    initialized = true;

    const runtimeProfile =
        getRuntimeProfile();

    setPack(
        "vantage:runtime",
        {
            name: "Vantage Runtime",
            version: "1.0.0",
            type: PACK_TYPES.ADDON,
            namespace: "vantage",
            description:
                "Runtime capabilities exposed by the Minecraft Script API.",
            profile: runtimeProfile
        }
    );

    return getCompatibilitySnapshot();
}

export function registerPack(
    identifier,
    metadata = {}
) {
    const id =
        normalizeIdentifier(identifier);

    if (!id) {
        return false;
    }

    const profile =
        normalizeProfile(
            metadata.profile
        );

    profile.registered = true;

    return setPack(
        id,
        {
            ...metadata,
            profile
        }
    );
}

export function unregisterPack(
    identifier
) {
    return removePack(identifier);
}

export function registerCompatibilityProfile(
    identifier,
    profile = {}
) {
    const id =
        normalizeIdentifier(identifier);

    if (!id) {
        return false;
    }

    const existing =
        getPack(id);

    if (existing) {
        existing.profile =
            mergeProfiles(
                existing.profile,
                profile
            );

        existing.profile.registered =
            true;

        bumpRevision();

        return true;
    }

    return registerPack(
        id,
        {
            profile: {
                ...profile,
                registered: true
            }
        }
    );
}

export function getRegisteredPack(
    identifier
) {
    const pack =
        getPack(identifier);

    return pack
        ? clone(pack)
        : null;
}

export function getRegisteredPacks() {
    return clone(
        getAllRegisteredPacks()
    );
}

export function getEnabledRegisteredPacks() {
    return clone(
        getEnabledPacks()
    );
}

export function isPackRegistered(
    identifier
) {
    return Boolean(
        getPack(identifier)
    );
}

export function getPackStatus(
    identifier
) {
    const pack =
        getPack(identifier);

    if (!pack) {
        return PACK_STATUS.UNKNOWN;
    }

    if (!pack.enabled) {
        return PACK_STATUS.UNKNOWN;
    }

    return pack.profile?.status ??
        PACK_STATUS.UNKNOWN;
}

export function getPackCapabilities(
    identifier
) {
    const pack =
        getPack(identifier);

    if (!pack || !pack.enabled) {
        return [];
    }

    return [
        ...pack.profile.capabilities
    ];
}

export function packHasCapability(
    identifier,
    capability
) {
    const pack =
        getPack(identifier);

    if (
        !pack ||
        !pack.enabled
    ) {
        return false;
    }

    return hasCapability(
        pack.profile,
        capability
    );
}

export function setPackEnabled(
    identifier,
    enabled
) {
    const pack =
        getPack(identifier);

    if (!pack) {
        return false;
    }

    const value =
        normalizeBoolean(
            enabled,
            true
        );

    if (
        pack.enabled === value
    ) {
        return true;
    }

    pack.enabled = value;

    bumpRevision();

    return true;
}

export function isPackEnabled(
    identifier
) {
    const pack =
        getPack(identifier);

    return Boolean(
        pack &&
        pack.enabled === true
    );
}

export function setPackPriority(
    identifier,
    priority
) {
    const pack =
        getPack(identifier);

    if (!pack) {
        return false;
    }

    const value =
        normalizeNumber(
            priority,
            0
        );

    if (
        pack.profile.priority ===
        value
    ) {
        return true;
    }

    pack.profile.priority =
        value;

    bumpRevision();

    return true;
}

export function getPackPriority(
    identifier
) {
    const pack =
        getPack(identifier);

    return pack?.profile?.priority ??
        0;
}

export function addPackConflict(
    identifier,
    conflict
) {
    const pack =
        getPack(identifier);

    const value =
        normalizeString(conflict);

    if (
        !pack ||
        !value
    ) {
        return false;
    }

    if (
        !pack.profile.conflicts.includes(
            value
        )
    ) {
        pack.profile.conflicts.push(
            value
        );

        bumpRevision();
    }

    return true;
}

export function removePackConflict(
    identifier,
    conflict
) {
    const pack =
        getPack(identifier);

    if (!pack) {
        return false;
    }

    const removed =
        removeFromArray(
            pack.profile.conflicts,
            conflict
        );

    if (removed) {
        bumpRevision();
    }

    return removed;
}

export function addPackCapability(
    identifier,
    capability
) {
    const pack =
        getPack(identifier);

    const value =
        normalizeCapability(
            capability
        );

    if (
        !pack ||
        !value
    ) {
        return false;
    }

    if (
        !pack.profile.capabilities.includes(
            value
        )
    ) {
        pack.profile.capabilities.push(
            value
        );

        bumpRevision();
    }

    return true;
}

export function removePackCapability(
    identifier,
    capability
) {
    const pack =
        getPack(identifier);

    if (!pack) {
        return false;
    }

    const removed =
        removeFromArray(
            pack.profile.capabilities,
            capability
        );

    if (removed) {
        bumpRevision();
    }

    return removed;
}

export function addPackWarning(
    identifier,
    warning
) {
    const pack =
        getPack(identifier);

    const value =
        normalizeString(warning);

    if (
        !pack ||
        !value
    ) {
        return false;
    }

    if (
        !pack.profile.notes.includes(
            value
        )
    ) {
        pack.profile.notes.push(
            value
        );

        bumpRevision();
    }

    return true;
}

export function removePackWarning(
    identifier,
    warning
) {
    const pack =
        getPack(identifier);

    if (!pack) {
        return false;
    }

    const removed =
        removeFromArray(
            pack.profile.notes,
            warning
        );

    if (removed) {
        bumpRevision();
    }

    return removed;
}

export function getRuntimeCapabilities() {
    return detectRuntimeCapabilities();
}

export function runtimeSupports(
    capability
) {
    return detectRuntimeCapabilities()
        .includes(
            capability
        );
}

export function getCompatibilitySnapshot() {
    const cached =
        getCachedCompatibility(
            "global"
        );

    if (cached) {
        return cached;
    }

    const result =
        calculateCompatibility();

    cacheCompatibility(
        "global",
        result
    );

    return clone(result);
}

export function getCompatibilityStatus() {
    return getCompatibilitySnapshot()
        .status;
}

export function isCompatible() {
    const status =
        getCompatibilityStatus();

    return (
        status === PACK_STATUS.COMPATIBLE ||
        status === PACK_STATUS.UNKNOWN
    );
}

export function hasCompatibilityConflicts() {
    return (
        getCompatibilityConflicts()
            .length > 0
    );
}

export function getCompatibilityConflicts() {
    return [
        ...getCompatibilitySnapshot()
            .conflicts
    ];
}

export function getCompatibilityWarnings() {
    return [
        ...getCompatibilitySnapshot()
            .warnings
    ];
}

export function getPlayerCompatibility(
    player
) {
    if (!player) {
        return null;
    }

    const key =
        getPlayerKey(player);

    if (!key) {
        return null;
    }

    const cached =
        getCachedCompatibility(
            `player:${key}`
        );

    if (cached) {
        return cached;
    }

    const profile =
        getPlayerProfile(player);

    const global =
        getCompatibilitySnapshot();

    if (!profile) {
        return clone({
            status: global.status,
            capabilities: global.capabilities,
            conflicts: global.conflicts,
            warnings: global.warnings
        });
    }

    const result = {
        status:
            profile.status ===
                PACK_STATUS.UNKNOWN
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

    cacheCompatibility(
        `player:${key}`,
        result
    );

    return clone(result);
}

export function updatePlayerCompatibility(
    player,
    profile
) {
    const result =
        updatePlayerProfile(
            player,
            profile
        );

    if (result) {
        bumpRevision();
    }

    return result;
}

export function setPlayerCompatibilityStatus(
    player,
    status
) {
    if (!player) {
        return false;
    }

    const normalized =
        normalizePlayerStatus(
            status
        );

    if (
        normalized ===
        PACK_STATUS.UNKNOWN
    ) {
        return false;
    }

    return updatePlayerCompatibility(
        player,
        {
            status: normalized
        }
    );
}

export function addPlayerCapability(
    player,
    capability
) {
    const value =
        normalizeCapability(
            capability
        );

    if (!player || !value) {
        return false;
    }

    const profile =
        getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    if (
        profile.capabilities.includes(
            value
        )
    ) {
        return true;
    }

    profile.capabilities.push(
        value
    );

    profile.lastUpdated =
        Date.now();

    bumpRevision();

    return true;
}

export function removePlayerCapability(
    player,
    capability
) {
    const profile =
        getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    const removed =
        removeFromArray(
            profile.capabilities,
            capability
        );

    if (removed) {
        profile.lastUpdated =
            Date.now();

        bumpRevision();
    }

    return removed;
}

export function addPlayerConflict(
    player,
    conflict
) {
    const value =
        normalizeString(conflict);

    if (!player || !value) {
        return false;
    }

    const profile =
        getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    if (
        profile.conflicts.includes(
            value
        )
    ) {
        return true;
    }

    profile.conflicts.push(
        value
    );

    profile.lastUpdated =
        Date.now();

    bumpRevision();

    return true;
}

export function removePlayerConflict(
    player,
    conflict
) {
    const profile =
        getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    const removed =
        removeFromArray(
            profile.conflicts,
            conflict
        );

    if (removed) {
        profile.lastUpdated =
            Date.now();

        bumpRevision();
    }

    return removed;
}

export function clearPlayerConflicts(
    player
) {
    const profile =
        getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    if (
        profile.conflicts.length === 0
    ) {
        return true;
    }

    profile.conflicts = [];
    profile.lastUpdated =
        Date.now();

    bumpRevision();

    return true;
}

export function addPlayerWarning(
    player,
    warning
) {
    const value =
        normalizeString(warning);

    if (!player || !value) {
        return false;
    }

    const profile =
        getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    if (
        profile.warnings.includes(
            value
        )
    ) {
        return true;
    }

    profile.warnings.push(
        value
    );

    profile.lastUpdated =
        Date.now();

    bumpRevision();

    return true;
}

export function clearPlayerWarnings(
    player
) {
    const profile =
        getPlayerProfile(player);

    if (!profile) {
        return false;
    }

    if (
        profile.warnings.length === 0
    ) {
        return true;
    }

    profile.warnings = [];
    profile.lastUpdated =
        Date.now();

    bumpRevision();

    return true;
}

export function playerSupports(
    player,
    capability
) {
    const profile =
        getPlayerCompatibility(
            player
        );

    return Boolean(
        profile &&
        profile.capabilities.includes(
            capability
        )
    );
}

export function playerHasConflicts(
    player
) {
    const profile =
        getPlayerCompatibility(
            player
        );

    return Boolean(
        profile &&
        profile.conflicts.length > 0
    );
}

export function getRecommendedRenderStrategy(
    player = null
) {
    const compatibility =
        player
            ? getPlayerCompatibility(player)
            : getCompatibilitySnapshot();

    if (!compatibility) {
        return "vanilla";
    }

    if (
        compatibility.status ===
        PACK_STATUS.INCOMPATIBLE
    ) {
        return "vanilla";
    }

    if (
        compatibility.conflicts.length > 0
    ) {
        return "minimal";
    }

    if (
        compatibility.status ===
        PACK_STATUS.LIMITED
    ) {
        return "minimal";
    }

    return "vantage";
}

export function getRecommendedAnimationStrategy(
    player = null
) {
    const compatibility =
        player
            ? getPlayerCompatibility(player)
            : getCompatibilitySnapshot();

    if (!compatibility) {
        return "vanilla";
    }

    if (
        compatibility.status ===
        PACK_STATUS.INCOMPATIBLE
    ) {
        return "vanilla";
    }

    if (
        compatibility.conflicts.length > 0
    ) {
        return "minimal";
    }

    if (
        compatibility.status ===
        PACK_STATUS.LIMITED
    ) {
        return "minimal";
    }

    return "vantage";
}

export function shouldUseVantageRendering(
    player = null
) {
    return (
        getRecommendedRenderStrategy(
            player
        ) === "vantage"
    );
}

export function shouldUseMinimalRendering(
    player = null
) {
    return (
        getRecommendedRenderStrategy(
            player
        ) === "minimal"
    );
}

export function shouldUseVanillaRendering(
    player = null
) {
    return (
        getRecommendedRenderStrategy(
            player
        ) === "vanilla"
    );
}

export function shouldUseVantageAnimations(
    player = null
) {
    return (
        getRecommendedAnimationStrategy(
            player
        ) === "vantage"
    );
}

export function shouldUseMinimalAnimations(
    player = null
) {
    return (
        getRecommendedAnimationStrategy(
            player
        ) === "minimal"
    );
}

export function shouldUseVanillaAnimations(
    player = null
) {
    return (
        getRecommendedAnimationStrategy(
            player
        ) === "vanilla"
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

export function clear() {
    packs.clear();
    compatibilityCache.clear();

    initialized = false;

    revision++;

    return true;
}

export function clearPlayer(
    player
) {
    if (!player) {
        return false;
    }

    const removed =
        playerProfiles.delete(
            player
        );

    const key =
        getPlayerKey(player);

    if (key) {
        compatibilityCache.delete(
            `player:${key}`
        );
    }

    if (removed) {
        bumpRevision();
    }

    return removed;
}

export function getPlayerProfileSnapshot(
    player
) {
    const profile =
        getPlayerProfile(player);

    return profile
        ? clone(profile)
        : null;
}

export function getSnapshot() {
    return {
        initialized,

        revision,

        runtimeCapabilities:
            detectRuntimeCapabilities(),

        compatibility:
            getCompatibilitySnapshot(),

        packs:
            getRegisteredPacks()
    };
}