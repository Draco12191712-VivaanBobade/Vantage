import {
    clamp01,
    lerp,
    lerpAngle,
    smoothstep,
    smootherstep,
    shortestAngleDelta,
    sanitizeNumber,
    normalizeAngle
} from "./math.js";

function safeDeltaTime(deltaTime) {
    return Math.max(
        0,
        sanitizeNumber(deltaTime, 0)
    );
}

function safeSpeed(speed) {
    return Math.max(
        0,
        sanitizeNumber(speed, 0)
    );
}

function safeAmount(amount) {
    return clamp01(
        sanitizeNumber(amount, 0)
    );
}

function safeNumber(value, fallback = 0) {
    return sanitizeNumber(value, fallback);
}

function safeVector2(value) {
    return {
        x: safeNumber(value?.x),
        y: safeNumber(value?.y)
    };
}

function safeVector3(value) {
    return {
        x: safeNumber(value?.x),
        y: safeNumber(value?.y),
        z: safeNumber(value?.z)
    };
}

export function interpolate(current, target, amount) {
    return lerp(
        safeNumber(current),
        safeNumber(target),
        safeAmount(amount)
    );
}

export function interpolateAngle(current, target, amount) {
    return lerpAngle(
        normalizeAngle(safeNumber(current)),
        normalizeAngle(safeNumber(target)),
        safeAmount(amount)
    );
}

export function interpolateVector3(current, target, amount) {
    const source = safeVector3(current);
    const destination = safeVector3(target);
    const t = safeAmount(amount);

    return {
        x: lerp(source.x, destination.x, t),
        y: lerp(source.y, destination.y, t),
        z: lerp(source.z, destination.z, t)
    };
}

export function interpolateVector2(current, target, amount) {
    const source = safeVector2(current);
    const destination = safeVector2(target);
    const t = safeAmount(amount);

    return {
        x: lerp(source.x, destination.x, t),
        y: lerp(source.y, destination.y, t)
    };
}

export function smoothInterpolate(current, target, amount) {
    return lerp(
        safeNumber(current),
        safeNumber(target),
        smoothstep(
            0,
            1,
            safeAmount(amount)
        )
    );
}

export function smootherInterpolate(current, target, amount) {
    return lerp(
        safeNumber(current),
        safeNumber(target),
        smootherstep(
            0,
            1,
            safeAmount(amount)
        )
    );
}

export function smoothInterpolateVector3(current, target, amount) {
    const source = safeVector3(current);
    const destination = safeVector3(target);

    const t = smoothstep(
        0,
        1,
        safeAmount(amount)
    );

    return {
        x: lerp(source.x, destination.x, t),
        y: lerp(source.y, destination.y, t),
        z: lerp(source.z, destination.z, t)
    };
}

export function smootherInterpolateVector3(current, target, amount) {
    const source = safeVector3(current);
    const destination = safeVector3(target);

    const t = smootherstep(
        0,
        1,
        safeAmount(amount)
    );

    return {
        x: lerp(source.x, destination.x, t),
        y: lerp(source.y, destination.y, t),
        z: lerp(source.z, destination.z, t)
    };
}

export function interpolateAngleDelta(current, target, amount) {
    const source = normalizeAngle(
        safeNumber(current)
    );

    const destination = normalizeAngle(
        safeNumber(target)
    );

    const delta = shortestAngleDelta(
        source,
        destination
    );

    return normalizeAngle(
        source + delta * safeAmount(amount)
    );
}

export function exponentialFactor(speed, deltaTime) {
    const dt = safeDeltaTime(deltaTime);
    const rate = safeSpeed(speed);

    if (dt <= 0 || rate <= 0) {
        return 0;
    }

    return clamp01(
        1 - Math.exp(-rate * dt)
    );
}

export function exponentialSmoothing(
    current,
    target,
    speed,
    deltaTime
) {
    const source = safeNumber(current);
    const destination = safeNumber(target);

    const factor = exponentialFactor(
        speed,
        deltaTime
    );

    if (factor <= 0) {
        return source;
    }

    if (factor >= 1) {
        return destination;
    }

    return lerp(
        source,
        destination,
        factor
    );
}

export function exponentialSmoothingAngle(
    current,
    target,
    speed,
    deltaTime
) {
    const factor = exponentialFactor(
        speed,
        deltaTime
    );

    if (factor <= 0) {
        return normalizeAngle(
            safeNumber(current)
        );
    }

    return interpolateAngleDelta(
        current,
        target,
        factor
    );
}

export function exponentialSmoothingVector3(
    current,
    target,
    speed,
    deltaTime
) {
    const source = safeVector3(current);
    const destination = safeVector3(target);

    const factor = exponentialFactor(
        speed,
        deltaTime
    );

    if (factor <= 0) {
        return source;
    }

    if (factor >= 1) {
        return destination;
    }

    return {
        x: lerp(source.x, destination.x, factor),
        y: lerp(source.y, destination.y, factor),
        z: lerp(source.z, destination.z, factor)
    };
}

export function exponentialSmoothingVector2(
    current,
    target,
    speed,
    deltaTime
) {
    const source = safeVector2(current);
    const destination = safeVector2(target);

    const factor = exponentialFactor(
        speed,
        deltaTime
    );

    if (factor <= 0) {
        return source;
    }

    if (factor >= 1) {
        return destination;
    }

    return {
        x: lerp(source.x, destination.x, factor),
        y: lerp(source.y, destination.y, factor)
    };
}

export function damp(
    current,
    target,
    smoothing,
    deltaTime
) {
    return exponentialSmoothing(
        current,
        target,
        smoothing,
        deltaTime
    );
}

export function dampAngle(
    current,
    target,
    smoothing,
    deltaTime
) {
    return exponentialSmoothingAngle(
        current,
        target,
        smoothing,
        deltaTime
    );
}

export function dampVector3(
    current,
    target,
    smoothing,
    deltaTime
) {
    return exponentialSmoothingVector3(
        current,
        target,
        smoothing,
        deltaTime
    );
}

export function dampVector2(
    current,
    target,
    smoothing,
    deltaTime
) {
    return exponentialSmoothingVector2(
        current,
        target,
        smoothing,
        deltaTime
    );
}

export function interpolateBySpeed(
    current,
    target,
    speed,
    deltaTime
) {
    const source = safeNumber(current);
    const destination = safeNumber(target);
    const rate = safeSpeed(speed);
    const dt = safeDeltaTime(deltaTime);

    if (dt <= 0 || rate <= 0) {
        return source;
    }

    const distance = destination - source;
    const maxDistance = rate * dt;

    if (
        Math.abs(distance) <= maxDistance ||
        distance === 0
    ) {
        return destination;
    }

    return source +
        Math.sign(distance) * maxDistance;
}

export function interpolateAngleBySpeed(
    current,
    target,
    speed,
    deltaTime
) {
    const source = normalizeAngle(
        safeNumber(current)
    );

    const destination = normalizeAngle(
        safeNumber(target)
    );

    const rate = safeSpeed(speed);
    const dt = safeDeltaTime(deltaTime);

    if (dt <= 0 || rate <= 0) {
        return source;
    }

    const distance = shortestAngleDelta(
        source,
        destination
    );

    const maxDistance = rate * dt;

    if (
        Math.abs(distance) <= maxDistance ||
        distance === 0
    ) {
        return destination;
    }

    return normalizeAngle(
        source +
        Math.sign(distance) * maxDistance
    );
}

export function interpolateVector3BySpeed(
    current,
    target,
    speed,
    deltaTime
) {
    const source = safeVector3(current);
    const destination = safeVector3(target);

    const rate = safeSpeed(speed);
    const dt = safeDeltaTime(deltaTime);

    if (dt <= 0 || rate <= 0) {
        return source;
    }

    const dx = destination.x - source.x;
    const dy = destination.y - source.y;
    const dz = destination.z - source.z;

    const distance = Math.hypot(
        dx,
        dy,
        dz
    );

    const maxDistance = rate * dt;

    if (
        distance <= maxDistance ||
        distance === 0
    ) {
        return destination;
    }

    const factor =
        maxDistance / distance;

    return {
        x: source.x + dx * factor,
        y: source.y + dy * factor,
        z: source.z + dz * factor
    };
}

export function interpolateVector2BySpeed(
    current,
    target,
    speed,
    deltaTime
) {
    const source = safeVector2(current);
    const destination = safeVector2(target);

    const rate = safeSpeed(speed);
    const dt = safeDeltaTime(deltaTime);

    if (dt <= 0 || rate <= 0) {
        return source;
    }

    const dx = destination.x - source.x;
    const dy = destination.y - source.y;

    const distance = Math.hypot(
        dx,
        dy
    );

    const maxDistance = rate * dt;

    if (
        distance <= maxDistance ||
        distance === 0
    ) {
        return destination;
    }

    const factor =
        maxDistance / distance;

    return {
        x: source.x + dx * factor,
        y: source.y + dy * factor
    };
}

export function createInterpolator(
    initialValue = 0
) {
    let value = safeNumber(
        initialValue
    );

    return {
        get() {
            return value;
        },

        set(nextValue) {
            value = safeNumber(
                nextValue,
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

        smoothUpdate(target, amount) {
            value = smoothInterpolate(
                value,
                target,
                amount
            );

            return value;
        },

        smootherUpdate(target, amount) {
            value = smootherInterpolate(
                value,
                target,
                amount
            );

            return value;
        },

        damp(
            target,
            smoothing,
            deltaTime
        ) {
            value = exponentialSmoothing(
                value,
                target,
                smoothing,
                deltaTime
            );

            return value;
        },

        moveBySpeed(
            target,
            speed,
            deltaTime
        ) {
            value = interpolateBySpeed(
                value,
                target,
                speed,
                deltaTime
            );

            return value;
        },

        reset(nextValue = initialValue) {
            value = safeNumber(
                nextValue
            );

            return value;
        }
    };
}

export function createAngleInterpolator(
    initialValue = 0
) {
    let value = normalizeAngle(
        safeNumber(initialValue)
    );

    return {
        get() {
            return value;
        },

        set(nextValue) {
            value = normalizeAngle(
                safeNumber(
                    nextValue,
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

        updateDelta(target, amount) {
            value = interpolateAngleDelta(
                value,
                target,
                amount
            );

            return value;
        },

        damp(
            target,
            smoothing,
            deltaTime
        ) {
            value = exponentialSmoothingAngle(
                value,
                target,
                smoothing,
                deltaTime
            );

            return value;
        },

        moveBySpeed(
            target,
            speed,
            deltaTime
        ) {
            value = interpolateAngleBySpeed(
                value,
                target,
                speed,
                deltaTime
            );

            return value;
        },

        reset(nextValue = initialValue) {
            value = normalizeAngle(
                safeNumber(nextValue)
            );

            return value;
        }
    };
}

export function createVector2Interpolator(
    initialValue = {
        x: 0,
        y: 0
    }
) {
    let value = safeVector2(
        initialValue
    );

    const getValue = () => ({
        x: value.x,
        y: value.y
    });

    return {
        get() {
            return getValue();
        },

        set(nextValue) {
            value = safeVector2(
                nextValue
            );

            return getValue();
        },

        update(target, amount) {
            value = interpolateVector2(
                value,
                target,
                amount
            );

            return getValue();
        },

        smoothUpdate(target, amount) {
            const source = value;
            const destination = safeVector2(
                target
            );

            const t = smoothstep(
                0,
                1,
                safeAmount(amount)
            );

            value = {
                x: lerp(
                    source.x,
                    destination.x,
                    t
                ),
                y: lerp(
                    source.y,
                    destination.y,
                    t
                )
            };

            return getValue();
        },

        smootherUpdate(target, amount) {
            const source = value;
            const destination = safeVector2(
                target
            );

            const t = smootherstep(
                0,
                1,
                safeAmount(amount)
            );

            value = {
                x: lerp(
                    source.x,
                    destination.x,
                    t
                ),
                y: lerp(
                    source.y,
                    destination.y,
                    t
                )
            };

            return getValue();
        },

        damp(
            target,
            smoothing,
            deltaTime
        ) {
            value = exponentialSmoothingVector2(
                value,
                target,
                smoothing,
                deltaTime
            );

            return getValue();
        },

        moveBySpeed(
            target,
            speed,
            deltaTime
        ) {
            value = interpolateVector2BySpeed(
                value,
                target,
                speed,
                deltaTime
            );

            return getValue();
        },

        reset(nextValue = initialValue) {
            value = safeVector2(
                nextValue
            );

            return getValue();
        }
    };
}

export function createVector3Interpolator(
    initialValue = {
        x: 0,
        y: 0,
        z: 0
    }
) {
    let value = safeVector3(
        initialValue
    );

    const getValue = () => ({
        x: value.x,
        y: value.y,
        z: value.z
    });

    return {
        get() {
            return getValue();
        },

        set(nextValue) {
            value = safeVector3(
                nextValue
            );

            return getValue();
        },

        update(target, amount) {
            value = interpolateVector3(
                value,
                target,
                amount
            );

            return getValue();
        },

        smoothUpdate(target, amount) {
            value = smoothInterpolateVector3(
                value,
                target,
                amount
            );

            return getValue();
        },

        smootherUpdate(target, amount) {
            value = smootherInterpolateVector3(
                value,
                target,
                amount
            );

            return getValue();
        },

        damp(
            target,
            smoothing,
            deltaTime
        ) {
            value = exponentialSmoothingVector3(
                value,
                target,
                smoothing,
                deltaTime
            );

            return getValue();
        },

        moveBySpeed(
            target,
            speed,
            deltaTime
        ) {
            value = interpolateVector3BySpeed(
                value,
                target,
                speed,
                deltaTime
            );

            return getValue();
        },

        reset(nextValue = initialValue) {
            value = safeVector3(
                nextValue
            );

            return getValue();
        }
    };
}

export function criticallyDamped(
    current,
    target,
    velocity,
    frequency,
    deltaTime
) {
    const source = safeNumber(current);
    const destination = safeNumber(target);
    const currentVelocity = safeNumber(velocity);

    const dt = safeDeltaTime(deltaTime);
    const frequencyValue = safeSpeed(frequency);

    if (dt <= 0 || frequencyValue <= 0) {
        return {
            value: source,
            velocity: currentVelocity
        };
    }

    const omega = 2 * Math.PI * frequencyValue;
    const error = source - destination;

    const acceleration =
        -2 * omega * currentVelocity -
        omega * omega * error;

    const nextVelocity =
        currentVelocity +
        acceleration * dt;

    const nextValue =
        source +
        nextVelocity * dt;

    return {
        value: nextValue,
        velocity: nextVelocity
    };
}

export function approach(
    current,
    target,
    amount
) {
    const source = safeNumber(current);
    const destination = safeNumber(target);
    const distance = destination - source;

    if (distance === 0) {
        return destination;
    }

    const step = Math.abs(
        safeNumber(amount)
    );

    if (step <= 0) {
        return source;
    }

    if (Math.abs(distance) <= step) {
        return destination;
    }

    return source +
        Math.sign(distance) * step;
}

export function approachAngle(
    current,
    target,
    amount
) {
    const source = normalizeAngle(
        safeNumber(current)
    );

    const destination = normalizeAngle(
        safeNumber(target)
    );

    const distance = shortestAngleDelta(
        source,
        destination
    );

    const step = Math.abs(
        safeNumber(amount)
    );

    if (step <= 0) {
        return source;
    }

    if (Math.abs(distance) <= step) {
        return destination;
    }

    return normalizeAngle(
        source +
        Math.sign(distance) * step
    );
}