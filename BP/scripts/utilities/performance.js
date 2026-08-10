const DEFAULT_INTERVAL = 1;
const DEFAULT_CACHE_TTL = 1000;
const DEFAULT_TICKS_PER_SECOND = 20;
const DEFAULT_DELTA_TIME = 1 / DEFAULT_TICKS_PER_SECOND;
const DEFAULT_EPSILON = 0.000001;

function sanitizeNonNegative(value, fallback = 0) {
    if (!Number.isFinite(value)) {
        return Math.max(0, fallback);
    }

    return Math.max(0, value);
}

function sanitizeInterval(value, fallback = DEFAULT_INTERVAL) {
    if (!Number.isFinite(value)) {
        return Math.max(0, fallback);
    }

    return Math.max(0, value);
}

function sanitizeTick(value, fallback = 0) {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return value;
}

function sanitizeVector3(value) {
    return {
        x: Number.isFinite(value?.x) ? value.x : 0,
        y: Number.isFinite(value?.y) ? value.y : 0,
        z: Number.isFinite(value?.z) ? value.z : 0
    };
}

function cloneVector3(value) {
    return {
        x: value.x,
        y: value.y,
        z: value.z
    };
}

function getTime(time) {
    return Number.isFinite(time)
        ? time
        : Date.now();
}

export class PerformanceTimer {
    constructor() {
        this.lastTime = 0;
        this.initialized = false;
    }

    reset(time = Date.now()) {
        this.lastTime = getTime(time);
        this.initialized = true;

        return this.lastTime;
    }

    start(time = Date.now()) {
        return this.reset(time);
    }

    elapsed(time = Date.now()) {
        if (!this.initialized) {
            return 0;
        }

        return Math.max(
            0,
            getTime(time) - this.lastTime
        );
    }

    elapsedSeconds(time = Date.now()) {
        return this.elapsed(time) / 1000;
    }

    hasElapsed(
        duration,
        time = Date.now()
    ) {
        return (
            this.elapsed(time) >=
            sanitizeNonNegative(duration)
        );
    }

    isRunning() {
        return this.initialized;
    }

    stop(time = Date.now()) {
        const elapsed = this.elapsed(time);

        this.initialized = false;

        return elapsed;
    }
}

export class Throttle {
    constructor(interval = DEFAULT_INTERVAL) {
        this.interval = sanitizeInterval(interval);
        this.lastExecution = -Infinity;
    }

    reset() {
        this.lastExecution = -Infinity;
    }

    ready(tick) {
        tick = sanitizeTick(tick);

        if (
            tick - this.lastExecution <
            this.interval
        ) {
            return false;
        }

        this.lastExecution = tick;

        return true;
    }

    peek(tick) {
        tick = sanitizeTick(tick);

        return (
            tick - this.lastExecution >=
            this.interval
        );
    }

    setInterval(interval) {
        this.interval = sanitizeInterval(interval);

        return this.interval;
    }

    getInterval() {
        return this.interval;
    }

    getLastExecution() {
        return this.lastExecution;
    }
}

export class Cooldown {
    constructor(duration = 0) {
        this.duration = sanitizeNonNegative(duration);
        this.remaining = 0;
    }

    update(deltaTime) {
        if (this.remaining <= 0) {
            this.remaining = 0;
            return this.remaining;
        }

        this.remaining = Math.max(
            0,
            this.remaining -
            sanitizeNonNegative(deltaTime)
        );

        return this.remaining;
    }

    start(duration = this.duration) {
        this.duration = sanitizeNonNegative(duration);
        this.remaining = this.duration;

        return this.remaining;
    }

    reset() {
        this.remaining = 0;
    }

    ready() {
        return this.remaining <= 0;
    }

    active() {
        return this.remaining > 0;
    }

    getRemaining() {
        return this.remaining;
    }

    getDuration() {
        return this.duration;
    }

    getProgress() {
        if (this.duration <= 0) {
            return 1;
        }

        return Math.min(
            1,
            Math.max(
                0,
                1 -
                this.remaining /
                this.duration
            )
        );
    }

    setDuration(duration) {
        this.duration =
            sanitizeNonNegative(duration);

        this.remaining = Math.min(
            this.remaining,
            this.duration
        );

        return this.duration;
    }
}

export class ValueCache {
    constructor(ttl = DEFAULT_CACHE_TTL) {
        this.ttl = sanitizeNonNegative(ttl);
        this.value = undefined;
        this.timestamp = -Infinity;
        this.initialized = false;
    }

    get(currentTime = Date.now()) {
        if (!this.initialized) {
            return undefined;
        }

        currentTime = getTime(currentTime);

        if (
            currentTime - this.timestamp >
            this.ttl
        ) {
            this.invalidate();
            return undefined;
        }

        return this.value;
    }

    set(
        value,
        currentTime = Date.now()
    ) {
        this.value = value;
        this.timestamp = getTime(currentTime);
        this.initialized = true;

        return value;
    }

    getOrCompute(
        callback,
        currentTime = Date.now()
    ) {
        if (typeof callback !== "function") {
            return undefined;
        }

        const cached = this.get(currentTime);

        if (cached !== undefined) {
            return cached;
        }

        return this.set(
            callback(),
            currentTime
        );
    }

    has(currentTime = Date.now()) {
        if (!this.initialized) {
            return false;
        }

        return (
            this.get(currentTime) !==
            undefined
        );
    }

    age(currentTime = Date.now()) {
        if (!this.initialized) {
            return Infinity;
        }

        return Math.max(
            0,
            getTime(currentTime) -
            this.timestamp
        );
    }

    isExpired(currentTime = Date.now()) {
        return (
            this.initialized &&
            this.age(currentTime) >
            this.ttl
        );
    }

    invalidate() {
        this.value = undefined;
        this.timestamp = -Infinity;
        this.initialized = false;
    }

    setTTL(ttl) {
        this.ttl = sanitizeNonNegative(ttl);

        return this.ttl;
    }

    getTTL() {
        return this.ttl;
    }

    getTimestamp() {
        return this.timestamp;
    }
}

export class TickCache {
    constructor() {
        this.tick = -1;
        this.value = undefined;
        this.initialized = false;
    }

    get(currentTick) {
        if (!this.initialized) {
            return undefined;
        }

        currentTick = sanitizeTick(currentTick);

        if (currentTick !== this.tick) {
            return undefined;
        }

        return this.value;
    }

    has(currentTick) {
        return (
            this.initialized &&
            sanitizeTick(currentTick) ===
            this.tick
        );
    }

    set(currentTick, value) {
        this.tick = sanitizeTick(currentTick);
        this.value = value;
        this.initialized = true;

        return value;
    }

    getOrCompute(
        currentTick,
        callback
    ) {
        if (typeof callback !== "function") {
            return undefined;
        }

        const cached = this.get(currentTick);

        if (cached !== undefined) {
            return cached;
        }

        return this.set(
            currentTick,
            callback()
        );
    }

    invalidate() {
        this.tick = -1;
        this.value = undefined;
        this.initialized = false;
    }

    getTick() {
        return this.tick;
    }

    isInitialized() {
        return this.initialized;
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

    reset(value = this.current) {
        this.previous = value;
        this.current = value;
        this.changed = false;
    }

    forceChange(value) {
        this.previous = this.current;
        this.current = value;
        this.changed = true;

        return true;
    }

    acknowledge() {
        this.changed = false;
    }
}

export class Vector3ChangeTracker {
    constructor(
        initialValue = {
            x: 0,
            y: 0,
            z: 0
        }
    ) {
        const value =
            sanitizeVector3(initialValue);

        this.previous =
            cloneVector3(value);

        this.current =
            cloneVector3(value);

        this.changed = false;
    }

    update(
        value,
        epsilon = 0
    ) {
        const next =
            sanitizeVector3(value);

        const threshold =
            sanitizeNonNegative(
                epsilon
            );

        this.changed =
            Math.abs(
                this.current.x -
                next.x
            ) > threshold ||
            Math.abs(
                this.current.y -
                next.y
            ) > threshold ||
            Math.abs(
                this.current.z -
                next.z
            ) > threshold;

        this.previous =
            cloneVector3(
                this.current
            );

        this.current =
            cloneVector3(next);

        return this.changed;
    }

    get() {
        return cloneVector3(
            this.current
        );
    }

    getPrevious() {
        return cloneVector3(
            this.previous
        );
    }

    hasChanged() {
        return this.changed;
    }

    reset(
        value = this.current
    ) {
        const next =
            sanitizeVector3(value);

        this.previous =
            cloneVector3(next);

        this.current =
            cloneVector3(next);

        this.changed = false;
    }

    acknowledge() {
        this.changed = false;
    }

    distance() {
        return Math.hypot(
            this.current.x -
            this.previous.x,
            this.current.y -
            this.previous.y,
            this.current.z -
            this.previous.z
        );
    }
}

export class TaskQueue {
    constructor() {
        this.queue = [];
        this.running = false;
        this.totalExecuted = 0;
        this.totalFailed = 0;
    }

    add(task) {
        if (typeof task !== "function") {
            return false;
        }

        this.queue.push(task);

        return true;
    }

    addMany(tasks) {
        if (!tasks || !Symbol.iterator in Object(tasks)) {
            return 0;
        }

        let added = 0;

        for (const task of tasks) {
            if (this.add(task)) {
                added++;
            }
        }

        return added;
    }

    clear() {
        this.queue.length = 0;
    }

    size() {
        return this.queue.length;
    }

    isEmpty() {
        return this.queue.length === 0;
    }

    isRunning() {
        return this.running;
    }

    run(limit = Infinity) {
        if (
            this.running ||
            this.queue.length === 0
        ) {
            return 0;
        }

        const maximum =
            Number.isFinite(limit)
                ? Math.max(0, Math.floor(limit))
                : Infinity;

        this.running = true;

        let executed = 0;

        try {
            while (
                this.queue.length > 0 &&
                executed < maximum
            ) {
                const task =
                    this.queue.shift();

                if (
                    typeof task !==
                    "function"
                ) {
                    continue;
                }

                try {
                    task();
                    this.totalExecuted++;
                } catch {
                    this.totalFailed++;
                }

                executed++;
            }
        } finally {
            this.running = false;
        }

        return executed;
    }

    runOne() {
        return this.run(1);
    }

    getStatistics() {
        return {
            queued: this.queue.length,
            running: this.running,
            totalExecuted:
                this.totalExecuted,
            totalFailed:
                this.totalFailed
        };
    }

    resetStatistics() {
        this.totalExecuted = 0;
        this.totalFailed = 0;
    }
}

export class Stopwatch {
    constructor() {
        this.startTime = 0;
        this.accumulated = 0;
        this.running = false;
    }

    start(time = Date.now()) {
        if (!this.running) {
            this.startTime = getTime(time);
            this.running = true;
        }

        return this;
    }

    stop(time = Date.now()) {
        if (this.running) {
            this.accumulated += Math.max(
                0,
                getTime(time) -
                this.startTime
            );

            this.running = false;
        }

        return this.accumulated;
    }

    reset() {
        this.startTime = 0;
        this.accumulated = 0;
        this.running = false;
    }

    elapsed(time = Date.now()) {
        if (!this.running) {
            return this.accumulated;
        }

        return (
            this.accumulated +
            Math.max(
                0,
                getTime(time) -
                this.startTime
            )
        );
    }

    elapsedSeconds(time = Date.now()) {
        return this.elapsed(time) / 1000;
    }

    isRunning() {
        return this.running;
    }
}

export function shouldUpdate(
    previousValue,
    currentValue
) {
    return !Object.is(
        previousValue,
        currentValue
    );
}

export function shouldUpdateVector3(
    previous,
    current,
    epsilon = 0
) {
    const threshold =
        sanitizeNonNegative(epsilon);

    const a =
        sanitizeVector3(previous);

    const b =
        sanitizeVector3(current);

    return (
        Math.abs(a.x - b.x) >
        threshold ||
        Math.abs(a.y - b.y) >
        threshold ||
        Math.abs(a.z - b.z) >
        threshold
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
        return sanitizeNonNegative(
            fallback,
            DEFAULT_DELTA_TIME
        );
    }

    return deltaTime;
}

export function millisecondsToSeconds(
    milliseconds
) {
    return (
        sanitizeNonNegative(
            milliseconds
        ) / 1000
    );
}

export function secondsToMilliseconds(
    seconds
) {
    return (
        sanitizeNonNegative(seconds) *
        1000
    );
}

export function ticksToSeconds(
    ticks,
    ticksPerSecond =
        DEFAULT_TICKS_PER_SECOND
) {
    ticks = sanitizeNonNegative(ticks);

    ticksPerSecond =
        sanitizeNonNegative(
            ticksPerSecond
        );

    if (ticksPerSecond <= 0) {
        return 0;
    }

    return ticks / ticksPerSecond;
}

export function secondsToTicks(
    seconds,
    ticksPerSecond =
        DEFAULT_TICKS_PER_SECOND
) {
    seconds =
        sanitizeNonNegative(seconds);

    ticksPerSecond =
        sanitizeNonNegative(
            ticksPerSecond
        );

    if (ticksPerSecond <= 0) {
        return 0;
    }

    return seconds * ticksPerSecond;
}

export function createTickThrottle(
    interval = DEFAULT_INTERVAL
) {
    return new Throttle(interval);
}

export function createCache(
    ttl = DEFAULT_CACHE_TTL
) {
    return new ValueCache(ttl);
}

export function createTickCache() {
    return new TickCache();
}

export function createCooldown(
    duration = 0
) {
    return new Cooldown(duration);
}

export function createChangeTracker(
    initialValue
) {
    return new ChangeTracker(
        initialValue
    );
}

export function createVector3ChangeTracker(
    initialValue = {
        x: 0,
        y: 0,
        z: 0
    }
) {
    return new Vector3ChangeTracker(
        initialValue
    );
}

export function createTaskQueue() {
    return new TaskQueue();
}

export function createPerformanceTimer() {
    return new PerformanceTimer();
}

export function createStopwatch() {
    return new Stopwatch();
}

export function getPerformanceConstants() {
    return Object.freeze({
        DEFAULT_INTERVAL,
        DEFAULT_CACHE_TTL,
        DEFAULT_TICKS_PER_SECOND,
        DEFAULT_DELTA_TIME,
        DEFAULT_EPSILON
    });
}