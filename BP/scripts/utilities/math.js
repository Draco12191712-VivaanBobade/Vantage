const EPSILON = 0.000001;
const FULL_CIRCLE = 360;
const HALF_CIRCLE = 180;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
        return Number.isFinite(min) ? min : 0;
    }

    if (!Number.isFinite(min)) {
        min = -Infinity;
    }

    if (!Number.isFinite(max)) {
        max = Infinity;
    }

    if (min > max) {
        const temporary = min;
        min = max;
        max = temporary;
    }

    return Math.min(Math.max(value, min), max);
}

export function clamp01(value) {
    return clamp(value, 0, 1);
}

export function lerp(start, end, amount) {
    start = sanitizeNumber(start, 0);
    end = sanitizeNumber(end, 0);
    amount = sanitizeNumber(amount, 0);

    return start + (end - start) * amount;
}

export function inverseLerp(start, end, value) {
    start = sanitizeNumber(start, 0);
    end = sanitizeNumber(end, 0);
    value = sanitizeNumber(value, start);

    if (nearlyEqual(start, end)) {
        return 0;
    }

    return (value - start) / (end - start);
}

export function remap(
    value,
    inputMin,
    inputMax,
    outputMin,
    outputMax
) {
    if (nearlyEqual(inputMin, inputMax)) {
        return sanitizeNumber(outputMin, 0);
    }

    const amount = inverseLerp(
        inputMin,
        inputMax,
        value
    );

    return lerp(
        outputMin,
        outputMax,
        amount
    );
}

export function remapClamped(
    value,
    inputMin,
    inputMax,
    outputMin,
    outputMax
) {
    if (nearlyEqual(inputMin, inputMax)) {
        return sanitizeNumber(outputMin, 0);
    }

    const amount = clamp01(
        inverseLerp(
            inputMin,
            inputMax,
            value
        )
    );

    return lerp(
        outputMin,
        outputMax,
        amount
    );
}

export function smoothstep(edge0, edge1, value) {
    const t = clamp01(
        inverseLerp(edge0, edge1, value)
    );

    return t * t * (3 - 2 * t);
}

export function smootherstep(edge0, edge1, value) {
    const t = clamp01(
        inverseLerp(edge0, edge1, value)
    );

    return (
        t *
        t *
        t *
        (t * (t * 6 - 15) + 10)
    );
}

export function degreesToRadians(degrees) {
    return sanitizeNumber(degrees, 0) * DEG_TO_RAD;
}

export function radiansToDegrees(radians) {
    return sanitizeNumber(radians, 0) * RAD_TO_DEG;
}

export function normalizeAngle(angle) {
    angle = sanitizeNumber(angle, 0);

    return (
        ((angle + HALF_CIRCLE) % FULL_CIRCLE +
            FULL_CIRCLE) %
        FULL_CIRCLE -
        HALF_CIRCLE
    );
}

export function shortestAngleDelta(from, to) {
    return normalizeAngle(
        sanitizeNumber(to, 0) -
        sanitizeNumber(from, 0)
    );
}

export function lerpAngle(from, to, amount) {
    return (
        normalizeAngle(from) +
        shortestAngleDelta(from, to) *
        clamp01(amount)
    );
}

export function nearlyEqual(
    a,
    b,
    epsilon = EPSILON
) {
    a = sanitizeNumber(a, 0);
    b = sanitizeNumber(b, 0);
    epsilon = Math.abs(
        sanitizeNumber(epsilon, EPSILON)
    );

    return Math.abs(a - b) <= epsilon;
}

export function sign(value) {
    value = sanitizeNumber(value, 0);

    if (value > 0) {
        return 1;
    }

    if (value < 0) {
        return -1;
    }

    return 0;
}

export function square(value) {
    value = sanitizeNumber(value, 0);

    return value * value;
}

export function cube(value) {
    value = sanitizeNumber(value, 0);

    return value * value * value;
}

export function length2(x, y) {
    return Math.hypot(
        sanitizeNumber(x, 0),
        sanitizeNumber(y, 0)
    );
}

export function length3(x, y, z) {
    return Math.hypot(
        sanitizeNumber(x, 0),
        sanitizeNumber(y, 0),
        sanitizeNumber(z, 0)
    );
}

export function distance2(a, b) {
    return Math.hypot(
        sanitizeNumber(b?.x, 0) -
        sanitizeNumber(a?.x, 0),
        sanitizeNumber(b?.y, 0) -
        sanitizeNumber(a?.y, 0)
    );
}

export function distance3(a, b) {
    return Math.hypot(
        sanitizeNumber(b?.x, 0) -
        sanitizeNumber(a?.x, 0),
        sanitizeNumber(b?.y, 0) -
        sanitizeNumber(a?.y, 0),
        sanitizeNumber(b?.z, 0) -
        sanitizeNumber(a?.z, 0)
    );
}

export function distanceSquared3(a, b) {
    const x =
        sanitizeNumber(b?.x, 0) -
        sanitizeNumber(a?.x, 0);

    const y =
        sanitizeNumber(b?.y, 0) -
        sanitizeNumber(a?.y, 0);

    const z =
        sanitizeNumber(b?.z, 0) -
        sanitizeNumber(a?.z, 0);

    return x * x + y * y + z * z;
}

export function add2(a, b) {
    return {
        x:
            sanitizeNumber(a?.x, 0) +
            sanitizeNumber(b?.x, 0),
        y:
            sanitizeNumber(a?.y, 0) +
            sanitizeNumber(b?.y, 0)
    };
}

export function add3(a, b) {
    return {
        x:
            sanitizeNumber(a?.x, 0) +
            sanitizeNumber(b?.x, 0),
        y:
            sanitizeNumber(a?.y, 0) +
            sanitizeNumber(b?.y, 0),
        z:
            sanitizeNumber(a?.z, 0) +
            sanitizeNumber(b?.z, 0)
    };
}

export function subtract2(a, b) {
    return {
        x:
            sanitizeNumber(a?.x, 0) -
            sanitizeNumber(b?.x, 0),
        y:
            sanitizeNumber(a?.y, 0) -
            sanitizeNumber(b?.y, 0)
    };
}

export function subtract3(a, b) {
    return {
        x:
            sanitizeNumber(a?.x, 0) -
            sanitizeNumber(b?.x, 0),
        y:
            sanitizeNumber(a?.y, 0) -
            sanitizeNumber(b?.y, 0),
        z:
            sanitizeNumber(a?.z, 0) -
            sanitizeNumber(b?.z, 0)
    };
}

export function multiply2(vector, scalar) {
    scalar = sanitizeNumber(scalar, 0);

    return {
        x: sanitizeNumber(vector?.x, 0) * scalar,
        y: sanitizeNumber(vector?.y, 0) * scalar
    };
}

export function multiply3(vector, scalar) {
    scalar = sanitizeNumber(scalar, 0);

    return {
        x: sanitizeNumber(vector?.x, 0) * scalar,
        y: sanitizeNumber(vector?.y, 0) * scalar,
        z: sanitizeNumber(vector?.z, 0) * scalar
    };
}

export function divide2(vector, scalar) {
    scalar = sanitizeNumber(scalar, 0);

    if (Math.abs(scalar) <= EPSILON) {
        return {
            x: 0,
            y: 0
        };
    }

    return {
        x: sanitizeNumber(vector?.x, 0) / scalar,
        y: sanitizeNumber(vector?.y, 0) / scalar
    };
}

export function divide3(vector, scalar) {
    scalar = sanitizeNumber(scalar, 0);

    if (Math.abs(scalar) <= EPSILON) {
        return {
            x: 0,
            y: 0,
            z: 0
        };
    }

    return {
        x: sanitizeNumber(vector?.x, 0) / scalar,
        y: sanitizeNumber(vector?.y, 0) / scalar,
        z: sanitizeNumber(vector?.z, 0) / scalar
    };
}

export function normalize2(vector) {
    const x = sanitizeNumber(vector?.x, 0);
    const y = sanitizeNumber(vector?.y, 0);

    const length = Math.hypot(x, y);

    if (length <= EPSILON) {
        return {
            x: 0,
            y: 0
        };
    }

    return {
        x: x / length,
        y: y / length
    };
}

export function normalize3(vector) {
    const x = sanitizeNumber(vector?.x, 0);
    const y = sanitizeNumber(vector?.y, 0);
    const z = sanitizeNumber(vector?.z, 0);

    const length = Math.hypot(x, y, z);

    if (length <= EPSILON) {
        return {
            x: 0,
            y: 0,
            z: 0
        };
    }

    return {
        x: x / length,
        y: y / length,
        z: z / length
    };
}

export function dot2(a, b) {
    return (
        sanitizeNumber(a?.x, 0) *
        sanitizeNumber(b?.x, 0) +
        sanitizeNumber(a?.y, 0) *
        sanitizeNumber(b?.y, 0)
    );
}

export function dot3(a, b) {
    return (
        sanitizeNumber(a?.x, 0) *
        sanitizeNumber(b?.x, 0) +
        sanitizeNumber(a?.y, 0) *
        sanitizeNumber(b?.y, 0) +
        sanitizeNumber(a?.z, 0) *
        sanitizeNumber(b?.z, 0)
    );
}

export function cross3(a, b) {
    const ax = sanitizeNumber(a?.x, 0);
    const ay = sanitizeNumber(a?.y, 0);
    const az = sanitizeNumber(a?.z, 0);

    const bx = sanitizeNumber(b?.x, 0);
    const by = sanitizeNumber(b?.y, 0);
    const bz = sanitizeNumber(b?.z, 0);

    return {
        x: ay * bz - az * by,
        y: az * bx - ax * bz,
        z: ax * by - ay * bx
    };
}

export function zero2() {
    return {
        x: 0,
        y: 0
    };
}

export function zero3() {
    return {
        x: 0,
        y: 0,
        z: 0
    };
}

export function copy2(vector) {
    return {
        x: sanitizeNumber(vector?.x, 0),
        y: sanitizeNumber(vector?.y, 0)
    };
}

export function copy3(vector) {
    return {
        x: sanitizeNumber(vector?.x, 0),
        y: sanitizeNumber(vector?.y, 0),
        z: sanitizeNumber(vector?.z, 0)
    };
}

export function isFiniteNumber(value) {
    return Number.isFinite(value);
}

export function sanitizeNumber(
    value,
    fallback = 0
) {
    return Number.isFinite(value)
        ? value
        : Number.isFinite(fallback)
            ? fallback
            : 0;
}

export function sanitizeVector2(
    vector,
    fallback = 0
) {
    return {
        x: sanitizeNumber(vector?.x, fallback),
        y: sanitizeNumber(vector?.y, fallback)
    };
}

export function sanitizeVector3(
    vector,
    fallback = 0
) {
    return {
        x: sanitizeNumber(vector?.x, fallback),
        y: sanitizeNumber(vector?.y, fallback),
        z: sanitizeNumber(vector?.z, fallback)
    };
}

export function approach(
    current,
    target,
    maxDelta
) {
    current = sanitizeNumber(current, 0);
    target = sanitizeNumber(target, current);
    maxDelta = Math.abs(
        sanitizeNumber(maxDelta, 0)
    );

    if (maxDelta <= 0) {
        return current;
    }

    const delta = target - current;

    if (Math.abs(delta) <= maxDelta) {
        return target;
    }

    return current + sign(delta) * maxDelta;
}

export function approachAngle(
    current,
    target,
    maxDelta
) {
    current = normalizeAngle(current);
    target = normalizeAngle(target);

    maxDelta = Math.abs(
        sanitizeNumber(maxDelta, 0)
    );

    if (maxDelta <= 0) {
        return current;
    }

    const delta = shortestAngleDelta(
        current,
        target
    );

    if (Math.abs(delta) <= maxDelta) {
        return target;
    }

    return normalizeAngle(
        current +
        sign(delta) * maxDelta
    );
}

export function project2(vector, onto) {
    const direction = normalize2(onto);

    const amount = dot2(
        vector,
        direction
    );

    return multiply2(
        direction,
        amount
    );
}

export function project3(vector, onto) {
    const direction = normalize3(onto);

    const amount = dot3(
        vector,
        direction
    );

    return multiply3(
        direction,
        amount
    );
}

export function reflect2(vector, normal) {
    const n = normalize2(normal);
    const factor = 2 * dot2(vector, n);

    return subtract2(
        vector,
        multiply2(n, factor)
    );
}

export function reflect3(vector, normal) {
    const n = normalize3(normal);
    const factor = 2 * dot3(vector, n);

    return subtract3(
        vector,
        multiply3(n, factor)
    );
}

export function angleBetween2(a, b) {
    const lengthA = length2(
        a?.x,
        a?.y
    );

    const lengthB = length2(
        b?.x,
        b?.y
    );

    if (
        lengthA <= EPSILON ||
        lengthB <= EPSILON
    ) {
        return 0;
    }

    const cosine = clamp(
        dot2(a, b) /
        (lengthA * lengthB),
        -1,
        1
    );

    return Math.acos(cosine);
}

export function angleBetween3(a, b) {
    const lengthA = length3(
        a?.x,
        a?.y,
        a?.z
    );

    const lengthB = length3(
        b?.x,
        b?.y,
        b?.z
    );

    if (
        lengthA <= EPSILON ||
        lengthB <= EPSILON
    ) {
        return 0;
    }

    const cosine = clamp(
        dot3(a, b) /
        (lengthA * lengthB),
        -1,
        1
    );

    return Math.acos(cosine);
}

export function horizontalLength(vector) {
    return Math.hypot(
        sanitizeNumber(vector?.x, 0),
        sanitizeNumber(vector?.z, 0)
    );
}

export function horizontalDistance3(a, b) {
    return Math.hypot(
        sanitizeNumber(b?.x, 0) -
        sanitizeNumber(a?.x, 0),
        sanitizeNumber(b?.z, 0) -
        sanitizeNumber(a?.z, 0)
    );
}

export function moveTowards(
    current,
    target,
    maxDelta
) {
    return approach(
        current,
        target,
        maxDelta
    );
}

export function moveTowardsAngle(
    current,
    target,
    maxDelta
) {
    return approachAngle(
        current,
        target,
        maxDelta
    );
}

export function isApproximatelyZero(
    value,
    epsilon = EPSILON
) {
    return nearlyEqual(
        value,
        0,
        epsilon
    );
}

export function getEpsilon() {
    return EPSILON;
}