const DEFAULT_TICKS_PER_SECOND = 20;
const DEFAULT_DELTA_TIME = 1 / DEFAULT_TICKS_PER_SECOND;
const DEFAULT_EPSILON = 0.000001;

function nonNegative(value, fallback = 0) {
    return Number.isFinite(value)
        ? Math.max(0, value)
        : Math.max(0, fallback);
}

function vector3(value) {
    return {
        x: Number.isFinite(value?.x) ? value.x : 0,
        y: Number.isFinite(value?.y) ? value.y : 0,
        z: Number.isFinite(value?.z) ? value.z : 0
    };
}

export class TickThrottle {
    constructor(interval = 1) {
        this.interval = Math.max(
            1,
            Math.floor(nonNegative(interval, 1))
        );

        this.lastTick = -Infinity;
    }

    ready(tick) {
        if (!Number.isFinite(tick)) {
            return false;
        }

        if (
            tick - this.lastTick <
            this.interval
        ) {
            return false;
        }

        this.lastTick = tick;
        return true;
    }

    reset() {
        this.lastTick = -Infinity;
    }

    setInterval(interval) {
        this.interval = Math.max(
            1,
            Math.floor(nonNegative(interval, 1))
        );
    }
}

export class TickCache {
    constructor() {
        this.tick = -1;
        this.value = undefined;
    }

    get(tick) {
        return this.tick === tick
            ? this.value
            : undefined;
    }

    has(tick) {
        return this.tick === tick;
    }

    set(tick, value) {
        this.tick = tick;
        this.value = value;

        return value;
    }

    getOrCompute(tick, callback) {
        if (this.tick === tick) {
            return this.value;
        }

        if (typeof callback !== "function") {
            return undefined;
        }

        return this.set(
            tick,
            callback()
        );
    }

    invalidate() {
        this.tick = -1;
        this.value = undefined;
    }
}

export class ChangeTracker {
    constructor(initialValue) {
        this.previous = initialValue;
        this.current = initialValue;
        this.changed = false;
    }

    update(value) {
        this.changed = !Object.is(
            this.current,
            value
        );

        this.previous = this.current;
        this.current = value;

        return this.changed;
    }

    get() {
        return this.current;
    }

    getPrevious() {
        return this.previous;
    }

    hasChanged() {
        return this.changed;
    }

    acknowledge() {
        this.changed = false;
    }

    reset(value = this.current) {
        this.previous = value;
        this.current = value;
        this.changed = false;
    }
}

export class Vector3ChangeTracker {
    constructor(initialValue = {
        x: 0,
        y: 0,
        z: 0
    }) {
        const value = vector3(initialValue);

        this.previous = { ...value };
        this.current = { ...value };
        this.changed = false;
    }

    update(value, epsilon = DEFAULT_EPSILON) {
        const next = vector3(value);
        const threshold = nonNegative(
            epsilon,
            DEFAULT_EPSILON
        );

        this.changed =
            Math.abs(this.current.x - next.x) > threshold ||
            Math.abs(this.current.y - next.y) > threshold ||
            Math.abs(this.current.z - next.z) > threshold;

        this.previous = {
            ...this.current
        };

        this.current = {
            ...next
        };

        return this.changed;
    }

    get() {
        return {
            ...this.current
        };
    }

    getPrevious() {
        return {
            ...this.previous
        };
    }

    hasChanged() {
        return this.changed;
    }

    reset(value = this.current) {
        const next = vector3(value);

        this.previous = {
            ...next
        };

        this.current = {
            ...next
        };

        this.changed = false;
    }

    acknowledge() {
        this.changed = false;
    }
}

export function shouldUpdate(
    previous,
    current
) {
    return !Object.is(
        previous,
        current
    );
}

export function shouldUpdateVector3(
    previous,
    current,
    epsilon = DEFAULT_EPSILON
) {
    const a = vector3(previous);
    const b = vector3(current);
    const threshold = nonNegative(
        epsilon,
        DEFAULT_EPSILON
    );

    return (
        Math.abs(a.x - b.x) > threshold ||
        Math.abs(a.y - b.y) > threshold ||
        Math.abs(a.z - b.z) > threshold
    );
}

export function normalizeDeltaTime(
    deltaTime,
    fallback = DEFAULT_DELTA_TIME
) {
    if (
        !Number.isFinite(deltaTime) ||
        deltaTime <= 0
    ) {
        return fallback;
    }

    return deltaTime;
}

export function millisecondsToSeconds(
    milliseconds
) {
    return nonNegative(milliseconds) / 1000;
}

export function ticksToSeconds(
    ticks,
    ticksPerSecond = DEFAULT_TICKS_PER_SECOND
) {
    const rate = nonNegative(ticksPerSecond);

    if (rate <= 0) {
        return 0;
    }

    return nonNegative(ticks) / rate;
}

export function secondsToTicks(
    seconds,
    ticksPerSecond = DEFAULT_TICKS_PER_SECOND
) {
    const rate = nonNegative(ticksPerSecond);

    if (rate <= 0) {
        return 0;
    }

    return nonNegative(seconds) * rate;
}

export function createTickThrottle(interval = 1) {
    return new TickThrottle(interval);
}

export function createTickCache() {
    return new TickCache();
}

export function createChangeTracker(initialValue) {
    return new ChangeTracker(initialValue);
}

export function createVector3ChangeTracker(
    initialValue = {
        x: 0,
        y: 0,
        z: 0
    }
) {
    return new Vector3ChangeTracker(initialValue);
}

export function getPerformanceConstants() {
    return Object.freeze({
        DEFAULT_TICKS_PER_SECOND,
        DEFAULT_DELTA_TIME,
        DEFAULT_EPSILON
    });
}