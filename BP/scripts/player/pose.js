import {
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
    clamp,
    sanitizeNumber
} from "../utilities/math.js";

import {
    exponentialSmoothing
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

const DEFAULTS = Object.freeze({
    smoothing: 14,
    minimumDeltaTime: 0,
    maximumDeltaTime: 0.25
});

const states = new WeakMap();

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

function createState() {
    return {
        pose: POSES.IDLE,
        previousPose: POSES.IDLE,

        progress: 1,

        smoothing:
            DEFAULTS.smoothing,

        deltaTime:
            1 / 20,

        initialized: false,
        changed: false
    };
}

function getState(player) {
    let state = states.get(player);

    if (!state) {
        state = createState();
        states.set(player, state);
    }

    return state;
}

function getAnimationSettings(
    player,
    state
) {
    try {
        const config =
            getAnimationConfig(player);

        if (!config) {
            state.smoothing =
                DEFAULTS.smoothing;

            return;
        }

        state.smoothing =
            Math.max(
                0,
                sanitizeNumber(
                    config.smoothing,
                    DEFAULTS.smoothing
                )
            );
    } catch {
        state.smoothing =
            DEFAULTS.smoothing;
    }
}

function isPoseEnabled(
    player,
    pose
) {
    const key =
        POSE_CONFIG_KEYS[pose];

    if (!key) {
        return true;
    }

    try {
        const config =
            getAnimationConfig(player);

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

function resolvePose(
    player,
    pose
) {
    if (pose === POSES.DEAD) {
        return POSES.DEAD;
    }

    if (isPoseEnabled(player, pose)) {
        return pose;
    }

    return POSES.IDLE;
}

function updatePose(
    player,
    state
) {
    const detectedPose =
        determinePose(player);

    const pose =
        resolvePose(
            player,
            detectedPose
        );

    state.previousPose =
        state.pose;

    state.pose =
        pose;

    state.changed =
        state.previousPose !==
        state.pose;

    if (state.changed) {
        state.progress = 0;
    }
}

function smoothPoseTransition(
    state
) {
    if (state.progress >= 1) {
        return;
    }

    state.progress =
        exponentialSmoothing(
            state.progress,
            1,
            state.smoothing,
            state.deltaTime
        );

    state.progress =
        clamp(
            state.progress,
            0,
            1
        );
}

export function update(
    player,
    deltaTime = 1 / 20
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getState(player);

    state.deltaTime =
        clamp(
            sanitizeNumber(
                deltaTime,
                1 / 20
            ),
            DEFAULTS.minimumDeltaTime,
            DEFAULTS.maximumDeltaTime
        );

    let animationEnabled = true;

    try {
        const config =
            getAnimationConfig(player);

        if (
            config &&
            config.enabled === false
        ) {
            animationEnabled = false;
        }
    } catch {
        animationEnabled = true;
    }

    if (!animationEnabled) {
        state.previousPose =
            state.pose;

        state.pose =
            POSES.IDLE;

        state.changed =
            state.previousPose !==
            state.pose;

        state.progress = 1;
        state.initialized = true;

        return true;
    }

    getAnimationSettings(
        player,
        state
    );

    updatePose(
        player,
        state
    );

    if (!state.initialized) {
        state.progress = 1;
        state.initialized = true;
    } else {
        smoothPoseTransition(state);
    }

    return true;
}

export function getPose(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player).pose;
}

export function getPreviousPose(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    return getState(player).previousPose;
}

export function hasPoseChanged(player) {
    if (!isValidPlayer(player)) {
        return false;
    }

    return getState(player).changed;
}

export function getPoseProgress(player) {
    if (!isValidPlayer(player)) {
        return 0;
    }

    return getState(player).progress;
}

export function getConfiguration(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state =
        getState(player);

    return {
        smoothing:
            state.smoothing
    };
}

export function setSmoothing(
    player,
    value
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    const state =
        getState(player);

    state.smoothing =
        Math.max(
            0,
            sanitizeNumber(
                value,
                DEFAULTS.smoothing
            )
        );

    return true;
}

export function getSnapshot(player) {
    if (!isValidPlayer(player)) {
        return null;
    }

    const state =
        getState(player);

    return {
        pose:
            state.pose,

        previousPose:
            state.previousPose,

        changed:
            state.changed,

        progress:
            state.progress,

        initialized:
            state.initialized,

        deltaTime:
            state.deltaTime
    };
}

export function getAllPoses() {
    return POSES;
}

export function isPoseSupported(
    player,
    pose
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    if (
        !Object.values(POSES).includes(
            pose
        )
    ) {
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