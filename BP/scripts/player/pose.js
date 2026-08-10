import {
    getVelocity,
    getHorizontalSpeed,
    getVerticalSpeed,
    isMoving,
    isSprinting,
    isSneaking,
    isSwimming,
    isCrawling,
    isFalling,
    isJumping,
    isClimbing,
    isGliding,
    isRiding,
    isFlying,
    isDead
} from "./state.js";

import {
    getAnimationConfig
} from "../config/config.js";

import {
    shouldUseVantageAnimations,
    shouldUseMinimalAnimations,
    shouldUseVanillaAnimations
} from "../compatibility/packs.js";

import {
    clamp,
    clamp01,
    normalizeAngle,
    sanitizeNumber
} from "../utilities/math.js";

import {
    exponentialSmoothing,
    exponentialSmoothingAngle
} from "../utilities/interpolation.js";

const POSES = Object.freeze({
    IDLE: "idle",
    WALK: "walk",
    SPRINT: "sprint",
    SNEAK: "sneak",
    SWIM: "swim",
    CRAWL: "crawl",
    FALL: "fall",
    JUMP: "jump",
    CLIMB: "climb",
    GLIDE: "glide",
    RIDE: "ride",
    FLY: "fly",
    DEAD: "dead"
});

const DEFAULTS = Object.freeze({
    smoothing: 14,
    rotationSmoothing: 18,
    movementScale: 1,

    bobAmount: 1,
    swayAmount: 1,
    leanAmount: 1,

    maxBob: 1,
    maxSway: 1,
    maxLean: 1,

    poseTransitionSpeed: 5,

    minimumDeltaTime: 0,
    maximumDeltaTime: 0.25
});

const POSE_CONFIG_KEYS = Object.freeze({
    [POSES.IDLE]: "idle",
    [POSES.WALK]: "walking",
    [POSES.SPRINT]: "sprinting",
    [POSES.SNEAK]: "sneaking",
    [POSES.SWIM]: "swimming",
    [POSES.CRAWL]: "crawling",
    [POSES.FALL]: "falling",
    [POSES.JUMP]: "jumping",
    [POSES.CLIMB]: "climbing",
    [POSES.GLIDE]: "gliding",
    [POSES.RIDE]: "riding",
    [POSES.FLY]: "flying"
});

const states = new WeakMap();

function isValidPlayer(player) {
    return Boolean(
        player &&
        typeof player.isValid === "function" &&
        player.isValid()
    );
}

function createState() {
    return {
        pose: POSES.IDLE,
        previousPose: POSES.IDLE,

        progress: 0,
        movement: 0,

        horizontalSpeed: 0,
        verticalSpeed: 0,

        bob: 0,
        sway: 0,
        lean: 0,

        pitch: 0,
        yaw: 0,

        targetBob: 0,
        targetSway: 0,
        targetLean: 0,

        targetPitch: 0,
        targetYaw: 0,

        smoothMovement: 0,
        targetMovement: 0,

        phase: 0,

        deltaTime: 1 / 20,

        initialized: false,
        changed: false,

        config: {
            smoothing: DEFAULTS.smoothing,
            rotationSmoothing: DEFAULTS.rotationSmoothing,
            movementScale: DEFAULTS.movementScale,

            bobAmount: DEFAULTS.bobAmount,
            swayAmount: DEFAULTS.swayAmount,
            leanAmount: DEFAULTS.leanAmount,

            maxBob: DEFAULTS.maxBob,
            maxSway: DEFAULTS.maxSway,
            maxLean: DEFAULTS.maxLean
        }
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

function getAnimationSettings(player, state) {
    try {
        const config = getAnimationConfig(player);

        if (!config) {
            return;
        }

        state.config.smoothing = Math.max(
            0,
            sanitizeNumber(
                config.smoothing,
                DEFAULTS.smoothing
            )
        );

        state.config.rotationSmoothing = Math.max(
            0,
            sanitizeNumber(
                config.rotationSmoothing,
                DEFAULTS.rotationSmoothing
            )
        );

        state.config.movementScale = Math.max(
            0,
            sanitizeNumber(
                config.movementScale,
                DEFAULTS.movementScale
            )
        );

        state.config.bobAmount = Math.max(
            0,
            sanitizeNumber(
                config.bob?.amount,
                DEFAULTS.bobAmount
            )
        );

        state.config.swayAmount = Math.max(
            0,
            sanitizeNumber(
                config.sway?.amount,
                DEFAULTS.swayAmount
            )
        );

        state.config.leanAmount = Math.max(
            0,
            sanitizeNumber(
                config.lean?.amount,
                DEFAULTS.leanAmount
            )
        );

        state.config.maxBob = Math.max(
            0,
            sanitizeNumber(
                config.bob?.maximum,
                DEFAULTS.maxBob
            )
        );

        state.config.maxSway = Math.max(
            0,
            sanitizeNumber(
                config.sway?.maximum,
                DEFAULTS.maxSway
            )
        );

        state.config.maxLean = Math.max(
            0,
            sanitizeNumber(
                config.lean?.maximum,
                DEFAULTS.maxLean
            )
        );
    } catch {
        state.config.smoothing = DEFAULTS.smoothing;
        state.config.rotationSmoothing =
            DEFAULTS.rotationSmoothing;
        state.config.movementScale =
            DEFAULTS.movementScale;

        state.config.bobAmount =
            DEFAULTS.bobAmount;
        state.config.swayAmount =
            DEFAULTS.swayAmount;
        state.config.leanAmount =
            DEFAULTS.leanAmount;

        state.config.maxBob =
            DEFAULTS.maxBob;
        state.config.maxSway =
            DEFAULTS.maxSway;
        state.config.maxLean =
            DEFAULTS.maxLean;
    }
}

function isPoseEnabled(player, pose) {
    const key = POSE_CONFIG_KEYS[pose];

    if (!key) {
        return true;
    }

    try {
        const config = getAnimationConfig(player);

        if (!config?.poses) {
            return true;
        }

        return config.poses[key] !== false;
    } catch {
        return true;
    }
}

function determinePose(player) {
    if (isDead(player)) {
        return POSES.DEAD;
    }

    if (isRiding(player)) {
        return POSES.RIDE;
    }

    if (isGliding(player)) {
        return POSES.GLIDE;
    }

    if (isFlying(player)) {
        return POSES.FLY;
    }

    if (isSwimming(player)) {
        return POSES.SWIM;
    }

    if (isCrawling(player)) {
        return POSES.CRAWL;
    }

    if (isClimbing(player)) {
        return POSES.CLIMB;
    }

    if (isFalling(player)) {
        return POSES.FALL;
    }

    if (isJumping(player)) {
        return POSES.JUMP;
    }

    if (isSneaking(player)) {
        return POSES.SNEAK;
    }

    if (isSprinting(player)) {
        return POSES.SPRINT;
    }

    if (isMoving(player)) {
        return POSES.WALK;
    }

    return POSES.IDLE;
}

function resolveEnabledPose(player, pose) {
    if (pose === POSES.DEAD) {
        return POSES.DEAD;
    }

    if (isPoseEnabled(player, pose)) {
        return pose;
    }

    return POSES.IDLE;
}

function getMovementIntensity(player, movementScale) {
    const speed = Math.max(
        0,
        sanitizeNumber(
            getHorizontalSpeed(player),
            0
        )
    );

    return clamp01(
        speed * movementScale
    );
}

function calculateBob(pose, movement) {
    switch (pose) {
        case POSES.SPRINT:
            return movement;

        case POSES.WALK:
            return movement * 0.7;

        case POSES.SNEAK:
            return movement * 0.45;

        default:
            return 0;
    }
}

function calculateSway(pose, movement) {
    switch (pose) {
        case POSES.SPRINT:
            return movement;

        case POSES.WALK:
            return movement * 0.65;

        case POSES.SNEAK:
            return movement * 0.35;

        default:
            return 0;
    }
}

function calculateLean(pose, velocity, maximum) {
    if (
        pose !== POSES.WALK &&
        pose !== POSES.SPRINT &&
        pose !== POSES.SNEAK
    ) {
        return 0;
    }

    const lateralVelocity = sanitizeNumber(
        velocity?.x,
        0
    );

    return clamp(
        lateralVelocity * 0.5,
        -maximum,
        maximum
    );
}

function getRotation(player) {
    try {
        const rotation = player.getRotation();

        return {
            pitch: clamp(
                sanitizeNumber(
                    rotation?.x,
                    0
                ),
                -90,
                90
            ),

            yaw: normalizeAngle(
                sanitizeNumber(
                    rotation?.y,
                    0
                )
            )
        };
    } catch {
        return {
            pitch: 0,
            yaw: 0
        };
    }
}

function updateAnimationPhase(state) {
    const speed = clamp01(
        state.smoothMovement
    );

    state.phase += (
        state.deltaTime *
        (
            5 +
            speed * 12
        )
    );

    if (state.phase > Math.PI * 2) {
        state.phase -= Math.PI * 2;
    }
}

function applyCompatibility(
    player,
    state
) {
    try {
        if (shouldUseVanillaAnimations(player)) {
            state.targetBob = 0;
            state.targetSway = 0;
            state.targetLean = 0;
            return;
        }

        if (shouldUseMinimalAnimations(player)) {
            state.targetBob *= 0.5;
            state.targetSway *= 0.5;
            state.targetLean *= 0.5;
            return;
        }

        if (shouldUseVantageAnimations(player)) {
            return;
        }
    } catch {
        return;
    }
}

function updateTargetValues(player, state) {
    const detectedPose = determinePose(player);
    const pose = resolveEnabledPose(
        player,
        detectedPose
    );

    const velocity = getVelocity(player);

    const movement = getMovementIntensity(
        player,
        state.config.movementScale
    );

    const rotation = getRotation(player);

    state.previousPose = state.pose;
    state.pose = pose;

    state.changed =
        state.previousPose !== state.pose;

    state.horizontalSpeed = Math.max(
        0,
        sanitizeNumber(
            getHorizontalSpeed(player),
            0
        )
    );

    state.verticalSpeed = sanitizeNumber(
        getVerticalSpeed(player),
        0
    );

    state.targetMovement = movement;

    state.targetBob =
        calculateBob(
            pose,
            movement
        );

    state.targetSway =
        calculateSway(
            pose,
            movement
        );

    state.targetLean =
        calculateLean(
            pose,
            velocity,
            state.config.maxLean
        );

    state.targetPitch =
        rotation.pitch;

    state.targetYaw =
        rotation.yaw;

    applyCompatibility(
        player,
        state
    );
}

function smoothValues(state) {
    const dt = state.deltaTime;

    state.smoothMovement =
        exponentialSmoothing(
            state.smoothMovement,
            state.targetMovement,
            state.config.smoothing,
            dt
        );

    state.bob =
        exponentialSmoothing(
            state.bob,
            state.targetBob *
            state.config.bobAmount,
            state.config.smoothing,
            dt
        );

    state.sway =
        exponentialSmoothing(
            state.sway,
            state.targetSway *
            state.config.swayAmount,
            state.config.smoothing,
            dt
        );

    state.lean =
        exponentialSmoothing(
            state.lean,
            state.targetLean *
            state.config.leanAmount,
            state.config.smoothing,
            dt
        );

    state.pitch =
        exponentialSmoothing(
            state.pitch,
            state.targetPitch,
            state.config.rotationSmoothing,
            dt
        );

    state.yaw =
        exponentialSmoothingAngle(
            state.yaw,
            state.targetYaw,
            state.config.rotationSmoothing,
            dt
        );

    state.bob = clamp(
        state.bob,
        -state.config.maxBob,
        state.config.maxBob
    );

    state.sway = clamp(
        state.sway,
        -state.config.maxSway,
        state.config.maxSway
    );

    state.lean = clamp(
        state.lean,
        -state.config.maxLean,
        state.config.maxLean
    );

    state.progress = clamp01(
        state.progress +
        dt * DEFAULTS.poseTransitionSpeed
    );
}

function initializeState(
    state
) {
    state.smoothMovement =
        state.targetMovement;

    state.bob =
        state.targetBob *
        state.config.bobAmount;

    state.sway =
        state.targetSway *
        state.config.swayAmount;

    state.lean =
        state.targetLean *
        state.config.leanAmount;

    state.pitch =
        state.targetPitch;

    state.yaw =
        state.targetYaw;

    state.progress = 1;
    state.initialized = true;
}

export function update(
    player,
    deltaTime = 1 / 20
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state = getInternalState(player);

    state.deltaTime = clamp(
        sanitizeNumber(
            deltaTime,
            1 / 20
        ),
        DEFAULTS.minimumDeltaTime,
        DEFAULTS.maximumDeltaTime
    );

    try {
        const animationConfig =
            getAnimationConfig(player);

        if (
            animationConfig &&
            animationConfig.enabled === false
        ) {
            state.targetBob = 0;
            state.targetSway = 0;
            state.targetLean = 0;

            state.bob =
                exponentialSmoothing(
                    state.bob,
                    0,
                    state.config.smoothing,
                    state.deltaTime
                );

            state.sway =
                exponentialSmoothing(
                    state.sway,
                    0,
                    state.config.smoothing,
                    state.deltaTime
                );

            state.lean =
                exponentialSmoothing(
                    state.lean,
                    0,
                    state.config.smoothing,
                    state.deltaTime
                );

            return true;
        }
    } catch {
        // Fall through to normal animation processing.
    }

    getAnimationSettings(
        player,
        state
    );

    updateTargetValues(
        player,
        state
    );

    if (!state.initialized) {
        initializeState(state);
    } else {
        if (state.changed) {
            state.progress = 0;
        }

        smoothValues(state);
    }

    updateAnimationPhase(state);

    return true;
}

export function getPose(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player).pose;
}

export function getPreviousPose(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getInternalState(player).previousPose;
}

export function hasPoseChanged(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getInternalState(player).changed;
}

export function getPoseProgress(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).progress;
}

export function getMovement(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).smoothMovement;
}

export function getBob(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).bob;
}

export function getSway(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).sway;
}

export function getLean(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).lean;
}

export function getPitch(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).pitch;
}

export function getYaw(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).yaw;
}

export function getRotation(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state = getInternalState(player);

    return {
        x: state.pitch,
        y: state.yaw
    };
}

export function getHorizontalSpeedValue(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).horizontalSpeed;
}

export function getVerticalSpeedValue(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).verticalSpeed;
}

export function getPhase(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getInternalState(player).phase;
}

export function setSmoothing(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getInternalState(player)
        .config
        .smoothing = Math.max(
            0,
            sanitizeNumber(
                value,
                DEFAULTS.smoothing
            )
        );

    return true;
}

export function setRotationSmoothing(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getInternalState(player)
        .config
        .rotationSmoothing = Math.max(
            0,
            sanitizeNumber(
                value,
                DEFAULTS.rotationSmoothing
            )
        );

    return true;
}

export function setMovementScale(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getInternalState(player)
        .config
        .movementScale = Math.max(
            0,
            sanitizeNumber(
                value,
                DEFAULTS.movementScale
            )
        );

    return true;
}

export function setBobAmount(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getInternalState(player)
        .config
        .bobAmount = Math.max(
            0,
            sanitizeNumber(
                value,
                DEFAULTS.bobAmount
            )
        );

    return true;
}

export function setSwayAmount(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getInternalState(player)
        .config
        .swayAmount = Math.max(
            0,
            sanitizeNumber(
                value,
                DEFAULTS.swayAmount
            )
        );

    return true;
}

export function setLeanAmount(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    getInternalState(player)
        .config
        .leanAmount = Math.max(
            0,
            sanitizeNumber(
                value,
                DEFAULTS.leanAmount
            )
        );

    return true;
}

export function getConfiguration(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const config =
        getInternalState(player).config;

    return {
        smoothing: config.smoothing,
        rotationSmoothing:
            config.rotationSmoothing,

        movementScale:
            config.movementScale,

        bobAmount:
            config.bobAmount,

        swayAmount:
            config.swayAmount,

        leanAmount:
            config.leanAmount,

        maxBob:
            config.maxBob,

        maxSway:
            config.maxSway,

        maxLean:
            config.maxLean
    };
}

export function getSnapshot(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state =
        getInternalState(player);

    return {
        pose: state.pose,
        previousPose: state.previousPose,

        changed: state.changed,
        progress: state.progress,

        movement:
            state.smoothMovement,

        horizontalSpeed:
            state.horizontalSpeed,

        verticalSpeed:
            state.verticalSpeed,

        bob: state.bob,
        sway: state.sway,
        lean: state.lean,

        rotation: {
            x: state.pitch,
            y: state.yaw
        },

        phase: state.phase,

        initialized:
            state.initialized,

        deltaTime:
            state.deltaTime
    };
}

export function getAllPoses() {
    return POSES;
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

export function isPoseSupported(
    player,
    pose
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (!Object.values(POSES).includes(pose)) {
        return false;
    }

    if (pose === POSES.DEAD) {
        return true;
    }

    return isPoseEnabled(
        player,
        pose
    );
}