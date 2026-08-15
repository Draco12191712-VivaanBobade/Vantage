const EPSILON = 0.000001;

export function sanitizeNumber(value, fallback = 0) {
    return Number.isFinite(value)
        ? value
        : Number.isFinite(fallback)
            ? fallback
            : 0;
}

export function clamp(value, min, max) {
    value = sanitizeNumber(value, min);
    min = sanitizeNumber(min, 0);
    max = sanitizeNumber(max, 1);

    if (min > max) {
        const temp = min;
        min = max;
        max = temp;
    }

    return Math.min(Math.max(value, min), max);
}

export function clamp01(value) {
    return clamp(value, 0, 1);
}

export function lerp(start, end, amount) {
    start = sanitizeNumber(start);
    end = sanitizeNumber(end);
    amount = clamp01(amount);

    return start + (end - start) * amount;
}

export function inverseLerp(start, end, value) {
    start = sanitizeNumber(start);
    end = sanitizeNumber(end);
    value = sanitizeNumber(value, start);

    if (Math.abs(end - start) <= EPSILON) {
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
    return lerp(
        outputMin,
        outputMax,
        inverseLerp(
            inputMin,
            inputMax,
            value
        )
    );
}

export function remapClamped(
    value,
    inputMin,
    inputMax,
    outputMin,
    outputMax
) {
    return lerp(
        outputMin,
        outputMax,
        clamp01(
            inverseLerp(
                inputMin,
                inputMax,
                value
            )
        )
    );
}

export function smoothstep(edge0, edge1, value) {
    const t = clamp01(
        inverseLerp(edge0, edge1, value)
    );

    return t * t * (3 - 2 * t);
}

export function nearlyEqual(
    a,
    b,
    epsilon = EPSILON
) {
    return Math.abs(
        sanitizeNumber(a) -
        sanitizeNumber(b)
    ) <= Math.abs(
        sanitizeNumber(epsilon, EPSILON)
    );
}

export function sign(value) {
    value = sanitizeNumber(value);

    if (value > 0) return 1;
    if (value < 0) return -1;

    return 0;
}

export function length2(x, y) {
    return Math.hypot(
        sanitizeNumber(x),
        sanitizeNumber(y)
    );
}

export function length3(x, y, z) {
    return Math.hypot(
        sanitizeNumber(x),
        sanitizeNumber(y),
        sanitizeNumber(z)
    );
}

export function horizontalLength(vector) {
    return Math.hypot(
        sanitizeNumber(vector?.x),
        sanitizeNumber(vector?.z)
    );
}

export function distance3(a, b) {
    return Math.hypot(
        sanitizeNumber(b?.x) - sanitizeNumber(a?.x),
        sanitizeNumber(b?.y) - sanitizeNumber(a?.y),
        sanitizeNumber(b?.z) - sanitizeNumber(a?.z)
    );
}

export function distanceSquared3(a, b) {
    const x =
        sanitizeNumber(b?.x) -
        sanitizeNumber(a?.x);

    const y =
        sanitizeNumber(b?.y) -
        sanitizeNumber(a?.y);

    const z =
        sanitizeNumber(b?.z) -
        sanitizeNumber(a?.z);

    return x * x + y * y + z * z;
}

export function add3(a, b) {
    return {
        x: sanitizeNumber(a?.x) + sanitizeNumber(b?.x),
        y: sanitizeNumber(a?.y) + sanitizeNumber(b?.y),
        z: sanitizeNumber(a?.z) + sanitizeNumber(b?.z)
    };
}

export function subtract3(a, b) {
    return {
        x: sanitizeNumber(a?.x) - sanitizeNumber(b?.x),
        y: sanitizeNumber(a?.y) - sanitizeNumber(b?.y),
        z: sanitizeNumber(a?.z) - sanitizeNumber(b?.z)
    };
}

export function multiply3(vector, scalar) {
    scalar = sanitizeNumber(scalar);

    return {
        x: sanitizeNumber(vector?.x) * scalar,
        y: sanitizeNumber(vector?.y) * scalar,
        z: sanitizeNumber(vector?.z) * scalar
    };
}

export function divide3(vector, scalar) {
    scalar = sanitizeNumber(scalar);

    if (Math.abs(scalar) <= EPSILON) {
        return {
            x: 0,
            y: 0,
            z: 0
        };
    }

    return {
        x: sanitizeNumber(vector?.x) / scalar,
        y: sanitizeNumber(vector?.y) / scalar,
        z: sanitizeNumber(vector?.z) / scalar
    };
}

export function normalize3(vector) {
    const x = sanitizeNumber(vector?.x);
    const y = sanitizeNumber(vector?.y);
    const z = sanitizeNumber(vector?.z);

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

export function dot3(a, b) {
    return (
        sanitizeNumber(a?.x) * sanitizeNumber(b?.x) +
        sanitizeNumber(a?.y) * sanitizeNumber(b?.y) +
        sanitizeNumber(a?.z) * sanitizeNumber(b?.z)
    );
}

export function cross3(a, b) {
    const ax = sanitizeNumber(a?.x);
    const ay = sanitizeNumber(a?.y);
    const az = sanitizeNumber(a?.z);

    const bx = sanitizeNumber(b?.x);
    const by = sanitizeNumber(b?.y);
    const bz = sanitizeNumber(b?.z);

    return {
        x: ay * bz - az * by,
        y: az * bx - ax * bz,
        z: ax * by - ay * bx
    };
}

export function copy3(vector) {
    return {
        x: sanitizeNumber(vector?.x),
        y: sanitizeNumber(vector?.y),
        z: sanitizeNumber(vector?.z)
    };
}

export function zero3() {
    return {
        x: 0,
        y: 0,
        z: 0
    };
}

export function approach(
    current,
    target,
    maxDelta
) {
    current = sanitizeNumber(current);
    target = sanitizeNumber(target, current);
    maxDelta = Math.abs(
        sanitizeNumber(maxDelta)
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

export function getEpsilon() {
    return EPSILON;
}