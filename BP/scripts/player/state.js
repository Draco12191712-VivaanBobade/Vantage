import {
    sanitizeNumber,
    clamp01
} from "../utilities/math.js";

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
        return typeof player.isValid !== "function" ||
            player.isValid();
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
        stateChanged: false
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

function readBoolean(player, property) {
    try {
        const value = player?.[property];

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "function") {
            return value.call(player) === true;
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

function getHorizontalSpeed(velocity) {
    return Math.hypot(
        sanitizeNumber(velocity.x, 0),
        sanitizeNumber(velocity.z, 0)
    );
}

function getVerticalSpeed(velocity) {
    return Math.abs(
        sanitizeNumber(velocity.y, 0)
    );
}

function isGrounded(player, velocity) {
    try {
        if (typeof player.isOnGround === "boolean") {
            return player.isOnGround;
        }
    } catch {
    }

    return Math.abs(
        sanitizeNumber(velocity.y, 0)
    ) <= VERTICAL_EPSILON;
}

function isRidingPlayer(player) {
    try {
        if (typeof player.getComponent !== "function") {
            return false;
        }

        return Boolean(
            player.getComponent("minecraft:riding")
        );
    } catch {
        return false;
    }
}

function isDeadPlayer(player) {
    try {
        if (typeof player.getComponent !== "function") {
            return false;
        }

        const health =
            player.getComponent("minecraft:health");

        if (!health) {
            return false;
        }

        const value = sanitizeNumber(
            health.currentValue,
            NaN
        );

        return Number.isFinite(value) && value <= 0;
    } catch {
        return false;
    }
}

function getMovementSpeed(player) {
    try {
        if (typeof player.getComponent !== "function") {
            return 0;
        }

        const movement =
            player.getComponent("minecraft:movement");

        if (!movement) {
            return 0;
        }

        return Math.max(
            0,
            sanitizeNumber(
                movement.currentValue ??
                movement.defaultValue,
                0
            )
        );
    } catch {
        return 0;
    }
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
    const velocity = readVelocity(player);

    const horizontalSpeed =
        getHorizontalSpeed(velocity);

    const grounded =
        isGrounded(player, velocity);

    const swimming =
        readBoolean(player, "isSwimming");

    const gliding =
        readBoolean(player, "isGliding");

    const flying =
        readBoolean(player, "isFlying");

    const climbing =
        readBoolean(player, "isClimbing");

    const riding =
        isRidingPlayer(player);

    const dead =
        isDeadPlayer(player);

    const sneaking =
        readBoolean(player, "isSneaking");

    const sprinting =
        readBoolean(player, "isSprinting");

    const crawling =
        !swimming &&
        readBoolean(player, "isCrawling");

    const moving =
        horizontalSpeed > SPEED_EPSILON;

    const falling =
        !grounded &&
        velocity.y < -VERTICAL_EPSILON &&
        !swimming &&
        !gliding &&
        !flying;

    const jumping =
        !grounded &&
        velocity.y > VERTICAL_EPSILON &&
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

        velocity,
        horizontalSpeed,

        verticalSpeed:
            getVerticalSpeed(velocity),

        movementSpeed:
            getMovementSpeed(player)
    };

    data.current = detectState(data);

    return data;
}

function applyState(state, data, tick) {
    const previous = state.current;

    state.previous =
        state.initialized
            ? previous
            : data.current;

    state.current = data.current;

    state.grounded = data.grounded;
    state.moving = data.moving;

    state.sprinting = data.sprinting;
    state.sneaking = data.sneaking;
    state.swimming = data.swimming;
    state.crawling = data.crawling;

    state.falling = data.falling;
    state.jumping = data.jumping;
    state.climbing = data.climbing;

    state.gliding = data.gliding;
    state.riding = data.riding;
    state.flying = data.flying;
    state.dead = data.dead;

    state.velocity =
        cloneVelocity(data.velocity);

    state.horizontalSpeed =
        data.horizontalSpeed;

    state.verticalSpeed =
        data.verticalSpeed;

    state.movementSpeed =
        data.movementSpeed;

    state.tick = tick;

    state.stateChanged =
        state.initialized &&
        state.previous !== state.current;

    state.initialized = true;
}

function normalizeTick(tick) {
    return Number.isFinite(tick)
        ? Math.floor(tick)
        : 0;
}

export function update(player, tick = 0) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getInternalState(player);

    applyState(
        state,
        readPlayerState(player),
        normalizeTick(tick)
    );

    return true;
}

export function refresh(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getInternalState(player);

    const tick =
        state.tick < 0
            ? 0
            : state.tick + 1;

    applyState(
        state,
        readPlayerState(player),
        tick
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
            cloneVelocity(state.velocity),

        horizontalSpeed:
            state.horizontalSpeed,

        verticalSpeed:
            state.verticalSpeed,

        movementSpeed:
            state.movementSpeed,

        tick: state.tick,
        initialized: state.initialized,
        stateChanged: state.stateChanged
    };
}

export function getState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player).current;
}

export function getPreviousState(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player).previous;
}

export function hasChanged(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player).stateChanged;
}

export function is(player, stateName) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player).current === stateName;
}

export function isMoving(player) {
    return isValidPlayer(player) &&
        getInternalState(player).moving;
}

export function isGrounded(player) {
    return isValidPlayer(player) &&
        getInternalState(player).grounded;
}

export function isSprinting(player) {
    return isValidPlayer(player) &&
        getInternalState(player).sprinting;
}

export function isSneaking(player) {
    return isValidPlayer(player) &&
        getInternalState(player).sneaking;
}

export function isSwimming(player) {
    return isValidPlayer(player) &&
        getInternalState(player).swimming;
}

export function isCrawling(player) {
    return isValidPlayer(player) &&
        getInternalState(player).crawling;
}

export function isFalling(player) {
    return isValidPlayer(player) &&
        getInternalState(player).falling;
}

export function isJumping(player) {
    return isValidPlayer(player) &&
        getInternalState(player).jumping;
}

export function isClimbing(player) {
    return isValidPlayer(player) &&
        getInternalState(player).climbing;
}

export function isGliding(player) {
    return isValidPlayer(player) &&
        getInternalState(player).gliding;
}

export function isRiding(player) {
    return isValidPlayer(player) &&
        getInternalState(player).riding;
}

export function isFlying(player) {
    return isValidPlayer(player) &&
        getInternalState(player).flying;
}

export function isDead(player) {
    return isValidPlayer(player) &&
        getInternalState(player).dead;
}

export function getVelocity(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return cloneVelocity(
        getInternalState(player).velocity
    );
}

export function getHorizontalSpeed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).horizontalSpeed;
}

export function getVerticalSpeed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).verticalSpeed;
}

export function getMovementSpeed(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).movementSpeed;
}

export function getMovementFactor(
    player,
    maximumSpeed = DEFAULT_MAXIMUM_SPEED
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
        getHorizontalSpeed(player) / maximum
    );
}

export function getStateId(player) {
    return getState(player);
}

export function getAllStates() {
    return PLAYER_STATES;
}

export function isInitialized(player) {
    return isValidPlayer(player) &&
        getInternalState(player).initialized;
}

export function getTick(player) {
    if (!isValidPlayer(player)) {
        return -1;
    }

    return getInternalState(player).tick;
}

export function reset(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return states.delete(player);
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