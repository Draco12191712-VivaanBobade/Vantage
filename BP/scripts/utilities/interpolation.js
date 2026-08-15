import {
    clamp01,
    lerp,
    normalizeAngle,
    shortestAngleDelta,
    sanitizeNumber,
    smoothstep,
    smootherstep
} from "./math.js";

function safeAmount(value) {
    return clamp01(
        sanitizeNumber(value, 0)
    );
}

function safeDeltaTime(value) {
    return Math.max(
        0,
        sanitizeNumber(value, 0)
    );
}

function safeSpeed(value) {
    return Math.max(
        0,
        sanitizeNumber(value, 0)
    );
}

function vector3(value) {
    return {
        x: sanitizeNumber(value?.x, 0),
        y: sanitizeNumber(value?.y, 0),
        z: sanitizeNumber(value?.z, 0)
    };
}

function vector2(value) {
    return {
        x: sanitizeNumber(value?.x, 0),
        y: sanitizeNumber(value?.y, 0)
    };
}

/*
 * Basic scalar interpolation.
 */
export function interpolate(
    current,
    target,
    amount
) {
    return lerp(
        sanitizeNumber(current, 0),
        sanitizeNumber(target, 0),
        safeAmount(amount)
    );
}

/*
 * Angle interpolation using the shortest rotation path.
 */
export function interpolateAngle(
    current,
    target,
    amount
) {
    const from = normalizeAngle(
        sanitizeNumber(current, 0)
    );

    const to = normalizeAngle(
        sanitizeNumber(target, 0)
    );

    return normalizeAngle(
        from +
        shortestAngleDelta(from, to) *
        safeAmount(amount)
    );
}

/*
 * Vector interpolation.
 */
export function interpolateVector3(
    current,
    target,
    amount
) {
    const a = vector3(current);
    const b = vector3(target);
    const t = safeAmount(amount);

    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t)
    };
}

export function interpolateVector2(
    current,
    target,
    amount
) {
    const a = vector2(current);
    const b = vector2(target);
    const t = safeAmount(amount);

    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t)
    };
}

/*
 * Smooth interpolation for camera/body transitions.
 */
export function smoothInterpolate(
    current,
    target,
    amount
) {
    return interpolate(
        current,
        target,
        smoothstep(
            0,
            1,
            safeAmount(amount)
        )
    );
}

export function smootherInterpolate(
    current,
    target,
    amount
) {
    return interpolate(
        current,
        target,
        smootherstep(
            0,
            1,
            safeAmount(amount)
        )
    );
}

export function smoothInterpolateVector3(
    current,
    target,
    amount
) {
    const a = vector3(current);
    const b = vector3(target);

    const t = smoothstep(
        0,
        1,
        safeAmount(amount)
    );

    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t)
    };
}

export function smootherInterpolateVector3(
    current,
    target,
    amount
) {
    const a = vector3(current);
    const b = vector3(target);

    const t = smootherstep(
        0,
        1,
        safeAmount(amount)
    );

    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t)
    };
}

/*
 * Frame-rate independent smoothing.
 *
 * This is preferable for camera movement because the result
 * does not depend heavily on the tick/frame rate.
 */
export function exponentialFactor(
    speed,
    deltaTime
) {
    const rate = safeSpeed(speed);
    const dt = safeDeltaTime(deltaTime);

    if (rate <= 0 || dt <= 0) {
        return 0;
    }

    return 1 - Math.exp(
        -rate * dt
    );
}

export function damp(
    current,
    target,
    speed,
    deltaTime
) {
    return interpolate(
        current,
        target,
        exponentialFactor(
            speed,
            deltaTime
        )
    );
}

export function dampAngle(
    current,
    target,
    speed,
    deltaTime
) {
    return interpolateAngle(
        current,
        target,
        exponentialFactor(
            speed,
            deltaTime
        )
    );
}

export function dampVector3(
    current,
    target,
    speed,
    deltaTime
) {
    return interpolateVector3(
        current,
        target,
        exponentialFactor(
            speed,
            deltaTime
        )
    );
}

export function dampVector2(
    current,
    target,
    speed,
    deltaTime
) {
    return interpolateVector2(
        current,
        target,
        exponentialFactor(
            speed,
            deltaTime
        )
    );
}

/*
 * Constant-speed interpolation.
 *
 * Useful when a camera/body value must reach its target
 * without overshooting.
 */
export function approach(
    current,
    target,
    speed,
    deltaTime
) {
    const source = sanitizeNumber(
        current,
        0
    );

    const destination = sanitizeNumber(
        target,
        source
    );

    const step =
        safeSpeed(speed) *
        safeDeltaTime(deltaTime);

    const distance =
        destination - source;

    if (
        step <= 0 ||
        Math.abs(distance) <= step
    ) {
        return destination;
    }

    return source +
        Math.sign(distance) * step;
}

export function approachAngle(
    current,
    target,
    speed,
    deltaTime
) {
    const source = normalizeAngle(
        sanitizeNumber(current, 0)
    );

    const destination = normalizeAngle(
        sanitizeNumber(target, 0)
    );

    const step =
        safeSpeed(speed) *
        safeDeltaTime(deltaTime);

    const distance =
        shortestAngleDelta(
            source,
            destination
        );

    if (
        step <= 0 ||
        Math.abs(distance) <= step
    ) {
        return destination;
    }

    return normalizeAngle(
        source +
        Math.sign(distance) * step
    );
}

/*
 * Constant-speed vector movement.
 */
export function approachVector3(
    current,
    target,
    speed,
    deltaTime
) {
    const a = vector3(current);
    const b = vector3(target);

    const step =
        safeSpeed(speed) *
        safeDeltaTime(deltaTime);

    const x = b.x - a.x;
    const y = b.y - a.y;
    const z = b.z - a.z;

    const distance = Math.hypot(
        x,
        y,
        z
    );

    if (
        step <= 0 ||
        distance <= step
    ) {
        return b;
    }

    const factor =
        step / distance;

    return {
        x: a.x + x * factor,
        y: a.y + y * factor,
        z: a.z + z * factor
    };
}

/*
 * Simple stateful scalar interpolator.
 */
export function createInterpolator(
    initialValue = 0
) {
    let value = sanitizeNumber(
        initialValue,
        0
    );

    return {
        get() {
            return value;
        },

        set(next) {
            value = sanitizeNumber(
                next,
                value
            );

            return value;
        },

        update(target, amount) {
            value = interpolate(
                value,
                target,
                amount
            );

            return value;
        },

        damp(target, speed, deltaTime) {
            value = damp(
                value,
                target,
                speed,
                deltaTime
            );

            return value;
        },

        approach(target, speed, deltaTime) {
            value = approach(
                value,
                target,
                speed,
                deltaTime
            );

            return value;
        },

        reset(next = initialValue) {
            value = sanitizeNumber(
                next,
                0
            );

            return value;
        }
    };
}

/*
 * Stateful angle interpolator.
 */
export function createAngleInterpolator(
    initialValue = 0
) {
    let value = normalizeAngle(
        sanitizeNumber(
            initialValue,
            0
        )
    );

    return {
        get() {
            return value;
        },

        set(next) {
            value = normalizeAngle(
                sanitizeNumber(
                    next,
                    value
                )
            );

            return value;
        },

        update(target, amount) {
            value = interpolateAngle(
                value,
                target,
                amount
            );

            return value;
        },

        damp(target, speed, deltaTime) {
            value = dampAngle(
                value,
                target,
                speed,
                deltaTime
            );

            return value;
        },

        approach(target, speed, deltaTime) {
            value = approachAngle(
                value,
                target,
                speed,
                deltaTime
            );

            return value;
        },

        reset(next = initialValue) {
            value = normalizeAngle(
                sanitizeNumber(next, 0)
            );

            return value;
        }
    };
}

/*
 * Stateful 3D interpolator.
 */
export function createVector3Interpolator(
    initialValue = {
        x: 0,
        y: 0,
        z: 0
    }
) {
    let value = vector3(
        initialValue
    );

    function copy() {
        return {
            x: value.x,
            y: value.y,
            z: value.z
        };
    }

    return {
        get() {
            return copy();
        },

        set(next) {
            value = vector3(next);
            return copy();
        },

        update(target, amount) {
            value = interpolateVector3(
                value,
                target,
                amount
            );

            return copy();
        },

        smoothUpdate(target, amount) {
            value = smoothInterpolateVector3(
                value,
                target,
                amount
            );

            return copy();
        },

        damp(target, speed, deltaTime) {
            value = dampVector3(
                value,
                target,
                speed,
                deltaTime
            );

            return copy();
        },

        approach(target, speed, deltaTime) {
            value = approachVector3(
                value,
                target,
                speed,
                deltaTime
            );

            return copy();
        },

        reset(next = initialValue) {
            value = vector3(next);
            return copy();
        }
    };
}