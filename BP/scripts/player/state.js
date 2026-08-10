import {
    sanitizeNumber,
    clamp01
} from "../utilities/math.js";

import {
    TickCache,
    ChangeTracker
} from "../utilities/performance.js";

const PLAYER_STATES = Object.freeze({
    IDLE: "idle",
    WALKING: "walking",
    SPRINTING: "sprinting",
    SNEAKING: "sneaking",
    SWIMMING: "swimming",
    CRAWLING: "crawling",
    FALLING: "falling",
    JUMPING: "jumping",
    CLIMBING: "climbing",
    GLIDING: "gliding",
    RIDING: "riding",
    FLYING: "flying",
    DEAD: "dead"
});

const SPEED_EPSILON = 0.01;
const VERTICAL_EPSILON = 0.05;
const DEFAULT_MAXIMUM_SPEED = 0.1;

const states = new WeakMap();

function isValidPlayer(player) {
    if (!player) {
        return false;
    }

    try {
        if (typeof player.isValid === "function") {
            return player.isValid();
        }

        return true;
    } catch {
        return false;
    }
}

function createVelocity() {
    return {
        x: 0,
        y: 0,
        z: 0
    };
}

function cloneVelocity(value) {
    return {
        x: sanitizeNumber(value?.x, 0),
        y: sanitizeNumber(value?.y, 0),
        z: sanitizeNumber(value?.z, 0)
    };
}

function createState() {
    return {
        current: PLAYER_STATES.IDLE,
        previous: PLAYER_STATES.IDLE,

        grounded: true,
        moving: false,

        sprinting: false,
        sneaking: false,
        swimming: false,
        crawling: false,

        falling: false,
        jumping: false,
        climbing: false,

        gliding: false,
        riding: false,
        flying: false,
        dead: false,

        velocity: createVelocity(),

        horizontalSpeed: 0,
        verticalSpeed: 0,
        movementSpeed: 0,

        tick: -1,

        initialized: false,
        stateChanged: false,

        cache: new TickCache(),
        tracker: new ChangeTracker(PLAYER_STATES.IDLE)
    };
}

function getInternalState(player) {
    let state = states.get(player);

    if (!state) {
        state = createState();
        states.set(player, state);
    }

    return state;
}

function readBooleanProperty(object, propertyName) {
    if (!object) {
        return false;
    }

    try {
        return object[propertyName] === true;
    } catch {
        return false;
    }
}

function readBooleanMethod(object, methodName) {
    if (!object) {
        return false;
    }

    try {
        const method = object[methodName];

        if (typeof method !== "function") {
            return false;
        }

        return method.call(object) === true;
    } catch {
        return false;
    }
}

function readBooleanValue(object, name) {
    if (!object) {
        return false;
    }

    try {
        const value = object[name];

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "function") {
            return value.call(object) === true;
        }
    } catch {
    }

    return false;
}

function readVelocity(player) {
    try {
        if (typeof player.getVelocity !== "function") {
            return createVelocity();
        }

        return cloneVelocity(
            player.getVelocity()
        );
    } catch {
        return createVelocity();
    }
}

function calculateHorizontalSpeed(velocity) {
    const x = sanitizeNumber(velocity?.x, 0);
    const z = sanitizeNumber(velocity?.z, 0);

    return Math.hypot(x, z);
}

function calculateVerticalSpeed(velocity) {
    return Math.abs(
        sanitizeNumber(velocity?.y, 0)
    );
}

function readGroundedState(player, velocity) {
    try {
        if (typeof player.isOnGround === "boolean") {
            return player.isOnGround;
        }
    } catch {
    }

    try {
        if (typeof player.isOnGround === "function") {
            return player.isOnGround();
        }
    } catch {
    }

    return Math.abs(
        sanitizeNumber(velocity?.y, 0)
    ) <= VERTICAL_EPSILON;
}

function readSneakingState(player) {
    if (readBooleanProperty(player, "isSneaking")) {
        return true;
    }

    return readBooleanMethod(
        player,
        "isSneaking"
    );
}

function readSprintingState(player) {
    if (readBooleanProperty(player, "isSprinting")) {
        return true;
    }

    return readBooleanMethod(
        player,
        "isSprinting"
    );
}

function readSwimmingState(player) {
    if (readBooleanProperty(player, "isSwimming")) {
        return true;
    }

    return readBooleanMethod(
        player,
        "isSwimming"
    );
}

function readCrawlingState(player) {
    if (readBooleanProperty(player, "isCrawling")) {
        return true;
    }

    return readBooleanMethod(
        player,
        "isCrawling"
    );
}

function readClimbingState(player) {
    if (readBooleanProperty(player, "isClimbing")) {
        return true;
    }

    return readBooleanMethod(
        player,
        "isClimbing"
    );
}

function readGlidingState(player) {
    if (readBooleanProperty(player, "isGliding")) {
        return true;
    }

    return readBooleanMethod(
        player,
        "isGliding"
    );
}

function readFlyingState(player) {
    if (readBooleanProperty(player, "isFlying")) {
        return true;
    }

    return readBooleanMethod(
        player,
        "isFlying"
    );
}

function readRidingState(player) {
    try {
        if (
            typeof player.getComponent === "function"
        ) {
            const riding =
                player.getComponent(
                    "minecraft:riding"
                );

            if (riding) {
                return true;
            }
        }
    } catch {
    }

    return false;
}

function readDeadState(player) {
    try {
        if (
            typeof player.getComponent !== "function"
        ) {
            return false;
        }

        const health =
            player.getComponent(
                "minecraft:health"
            );

        if (!health) {
            return false;
        }

        const current =
            sanitizeNumber(
                health.currentValue,
                NaN
            );

        return Number.isFinite(current) &&
            current <= 0;
    } catch {
        return false;
    }
}

function readMovementSpeed(player) {
    try {
        if (
            typeof player.getComponent !== "function"
        ) {
            return 0;
        }

        const movement =
            player.getComponent(
                "minecraft:movement"
            );

        if (!movement) {
            return 0;
        }

        const current =
            sanitizeNumber(
                movement.currentValue,
                NaN
            );

        if (Number.isFinite(current)) {
            return Math.max(0, current);
        }

        const defaultValue =
            sanitizeNumber(
                movement.defaultValue,
                NaN
            );

        if (Number.isFinite(defaultValue)) {
            return Math.max(0, defaultValue);
        }
    } catch {
    }

    return 0;
}

function detectState(data) {
    if (data.dead) {
        return PLAYER_STATES.DEAD;
    }

    if (data.riding) {
        return PLAYER_STATES.RIDING;
    }

    if (data.gliding) {
        return PLAYER_STATES.GLIDING;
    }

    if (data.flying) {
        return PLAYER_STATES.FLYING;
    }

    if (data.swimming) {
        return PLAYER_STATES.SWIMMING;
    }

    if (data.crawling) {
        return PLAYER_STATES.CRAWLING;
    }

    if (data.climbing) {
        return PLAYER_STATES.CLIMBING;
    }

    if (data.falling) {
        return PLAYER_STATES.FALLING;
    }

    if (data.jumping) {
        return PLAYER_STATES.JUMPING;
    }

    if (data.sneaking) {
        return PLAYER_STATES.SNEAKING;
    }

    if (data.sprinting) {
        return PLAYER_STATES.SPRINTING;
    }

    if (data.moving) {
        return PLAYER_STATES.WALKING;
    }

    return PLAYER_STATES.IDLE;
}

function readPlayerState(player) {
    const velocity =
        readVelocity(player);

    const horizontalSpeed =
        calculateHorizontalSpeed(
            velocity
        );

    const verticalSpeed =
        calculateVerticalSpeed(
            velocity
        );

    const grounded =
        readGroundedState(
            player,
            velocity
        );

    const swimming =
        readSwimmingState(player);

    const gliding =
        readGlidingState(player);

    const flying =
        readFlyingState(player);

    const climbing =
        readClimbingState(player);

    const riding =
        readRidingState(player);

    const dead =
        readDeadState(player);

    const sneaking =
        readSneakingState(player);

    const sprinting =
        readSprintingState(player);

    const crawling =
        !swimming &&
        readCrawlingState(player);

    const moving =
        horizontalSpeed >
        SPEED_EPSILON;

    const falling =
        !grounded &&
        velocity.y <
        -VERTICAL_EPSILON &&
        !swimming &&
        !gliding &&
        !flying;

    const jumping =
        !grounded &&
        velocity.y >
        VERTICAL_EPSILON &&
        !swimming &&
        !gliding &&
        !flying;

    const data = {
        grounded,
        moving,

        sprinting,
        sneaking,
        swimming,
        crawling,

        falling,
        jumping,
        climbing,

        gliding,
        riding,
        flying,
        dead,

        velocity: cloneVelocity(
            velocity
        ),

        horizontalSpeed,
        verticalSpeed,

        movementSpeed:
            readMovementSpeed(player)
    };

    data.current =
        detectState(data);

    return data;
}

function applyState(
    state,
    data,
    tick
) {
    const wasInitialized =
        state.initialized;

    const previousState =
        state.current;

    state.previous =
        wasInitialized
            ? previousState
            : data.current;

    state.current =
        data.current;

    state.grounded =
        data.grounded;

    state.moving =
        data.moving;

    state.sprinting =
        data.sprinting;

    state.sneaking =
        data.sneaking;

    state.swimming =
        data.swimming;

    state.crawling =
        data.crawling;

    state.falling =
        data.falling;

    state.jumping =
        data.jumping;

    state.climbing =
        data.climbing;

    state.gliding =
        data.gliding;

    state.riding =
        data.riding;

    state.flying =
        data.flying;

    state.dead =
        data.dead;

    state.velocity =
        cloneVelocity(
            data.velocity
        );

    state.horizontalSpeed =
        sanitizeNumber(
            data.horizontalSpeed,
            0
        );

    state.verticalSpeed =
        sanitizeNumber(
            data.verticalSpeed,
            0
        );

    state.movementSpeed =
        sanitizeNumber(
            data.movementSpeed,
            0
        );

    state.tick = tick;

    state.stateChanged =
        wasInitialized &&
        state.previous !==
        state.current;

    state.tracker.update(
        state.current
    );

    state.initialized = true;
}

function normalizeTick(tick) {
    if (!Number.isFinite(tick)) {
        return 0;
    }

    return Math.floor(tick);
}

export function update(
    player,
    tick = 0
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getInternalState(player);

    const normalizedTick =
        normalizeTick(tick);

    if (
        state.cache.get(
            normalizedTick
        ) !== undefined
    ) {
        return true;
    }

    const data =
        readPlayerState(player);

    applyState(
        state,
        data,
        normalizedTick
    );

    state.cache.set(
        normalizedTick,
        true
    );

    return true;
}

export function refresh(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getInternalState(player);

    const nextTick =
        state.tick < 0
            ? 0
            : state.tick + 1;

    const data =
        readPlayerState(player);

    applyState(
        state,
        data,
        nextTick
    );

    state.cache.set(
        nextTick,
        true
    );

    return true;
}

export function get(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state =
        getInternalState(player);

    return {
        current: state.current,
        previous: state.previous,

        grounded: state.grounded,
        moving: state.moving,

        sprinting: state.sprinting,
        sneaking: state.sneaking,
        swimming: state.swimming,
        crawling: state.crawling,

        falling: state.falling,
        jumping: state.jumping,
        climbing: state.climbing,

        gliding: state.gliding,
        riding: state.riding,
        flying: state.flying,
        dead: state.dead,

        velocity:
            cloneVelocity(
                state.velocity
            ),

        horizontalSpeed:
            state.horizontalSpeed,

        verticalSpeed:
            state.verticalSpeed,

        movementSpeed:
            state.movementSpeed,

        tick: state.tick,

        initialized:
            state.initialized,

        stateChanged:
            state.stateChanged
    };
}

export function getState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player)
        .current;
}

export function getPreviousState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player)
        .previous;
}

export function hasChanged(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .stateChanged;
}

export function is(player, stateName) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (
        typeof stateName !== "string" ||
        stateName.length === 0
    ) {
        return false;
    }

    return getInternalState(player)
        .current === stateName;
}

export function isMoving(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .moving;
}

export function isGrounded(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .grounded;
}

export function isSprinting(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .sprinting;
}

export function isSneaking(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .sneaking;
}

export function isSwimming(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .swimming;
}

export function isCrawling(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .crawling;
}

export function isFalling(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .falling;
}

export function isJumping(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .jumping;
}

export function isClimbing(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .climbing;
}

export function isGliding(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .gliding;
}

export function isRiding(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .riding;
}

export function isFlying(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .flying;
}

export function isDead(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .dead;
}

export function getVelocity(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return cloneVelocity(
        getInternalState(player)
            .velocity
    );
}

export function getHorizontalSpeed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player)
        .horizontalSpeed;
}

export function getVerticalSpeed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player)
        .verticalSpeed;
}

export function getMovementSpeed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player)
        .movementSpeed;
}

export function getMovementFactor(
    player,
    maximumSpeed =
        DEFAULT_MAXIMUM_SPEED
) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    const maximum =
        sanitizeNumber(
            maximumSpeed,
            DEFAULT_MAXIMUM_SPEED
        );

    if (maximum <= 0) {
        return 0;
    }

    return clamp01(
        getInternalState(player)
            .horizontalSpeed / maximum
    );
}

export function getStateId(player) {
    return getState(player);
}

export function getAllStates() {
    return PLAYER_STATES;
}

export function isInitialized(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player)
        .initialized;
}

export function getTick(player) {
    if (!isValidPlayer(player)) {
        return -1;
    }

    return getInternalState(player)
        .tick;
}

export function getTracker(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player)
        .tracker;
}

export function reset(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    states.delete(player);

    return true;
}

export function resetAll(players) {
    if (!players) {
        return 0;
    }

    let count = 0;

    for (const player of players) {
        if (reset(player)) {
            count++;
        }
    }

    return count;
}