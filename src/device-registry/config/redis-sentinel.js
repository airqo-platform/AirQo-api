// config/redis-sentinel.js - Sentinel-mode client used by config/redis.js when
// REDIS_USE_SENTINEL is enabled. Exposes the subset of the node-redis client
// interface that device-registry uses, so callers work the same in both modes.
const { EventEmitter } = require("events");
const redis = require("redis");

// Every command called on the Redis client in this service, directly or through
// the wrappers in config/redis.js. A new command must be added here to be usable.
// These go through sendCommand because it is the only node-redis Sentinel call
// that honours an abort signal; set only maps the options callers use today.
const COMMAND_ARGS = {
  get: (key) => ["GET", key],
  set: (key, value, { NX, EX } = {}) => [
    "SET",
    key,
    typeof value === "number" ? String(value) : value,
    ...(NX ? ["NX"] : []),
    ...(EX ? ["EX", String(EX)] : []),
  ],
  setEx: (key, seconds, value) => ["SETEX", key, String(seconds), value],
  incr: (key) => ["INCR", key],
  expire: (key, seconds) => ["EXPIRE", key, String(seconds)],
  del: (key) => ["DEL", key],
  ping: () => ["PING"],
  eval: (script, { keys = [], arguments: scriptArgs = [] } = {}) => [
    "EVAL",
    script,
    String(keys.length),
    ...keys,
    ...scriptArgs,
  ],
};

// ── Fail-fast behaviour ───────────────────────────────────────────────────────
// The node-redis Sentinel client holds commands while it looks for a master and
// keeps reporting isReady=true, so during an outage commands never settle and the
// isReady guards in config/redis.js never trip. Timing commands out and pausing
// after a timeout keeps the fail-fast contract the fallback cache relies on.
// A timeout also aborts the command so it can't run once a master returns. A
// command already written to Redis can't be recalled, so its outcome is unknown.
const COMMAND_TIMEOUT_MS = 3000;
const CIRCUIT_COOLDOWN_MS = 5000;
const CONNECT_RETRY_DELAY_MS = 30000;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms).unref());

const createSentinelClient = (sentinelOptions) => {
  const client = new EventEmitter();
  let sentinel = null;
  let circuitOpenUntil = 0;
  let currentProbe = 0;

  const runCommand = async (command, args) => {
    const now = Date.now();
    if (!sentinel || now < circuitOpenUntil) {
      throw new Error("Redis Sentinel client unavailable");
    }
    // After the cooldown, let this command through as the only probe. Only the
    // current probe's reply may close the circuit, so a late reply from an
    // earlier command can't close a circuit opened since.
    const isProbe = circuitOpenUntil > 0;
    if (isProbe) {
      circuitOpenUntil = now + COMMAND_TIMEOUT_MS + CIRCUIT_COOLDOWN_MS;
      currentProbe += 1;
    }
    const probeId = currentProbe;

    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        currentProbe += 1;
        circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        reject(
          new Error(
            `Redis Sentinel ${command} timed out (outcome unknown if already sent)`,
          ),
        );
        controller.abort();
      }, COMMAND_TIMEOUT_MS);
    });
    const pending = sentinel
      .sendCommand(false, COMMAND_ARGS[command](...args), {
        abortSignal: controller.signal,
      })
      .then((result) => {
        if (isProbe && probeId === currentProbe) {
          circuitOpenUntil = 0;
        }
        return result;
      });

    try {
      return await Promise.race([pending, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  Object.keys(COMMAND_ARGS).forEach((command) => {
    client[command] = (...args) => runCommand(command, args);
  });

  // A failed connect() leaves a node-redis Sentinel instance unusable, so each
  // attempt uses a new one. Resolves only once connected.
  client.connect = async () => {
    while (!sentinel) {
      const candidate = redis.createSentinel(sentinelOptions);
      // Some node-redis Sentinel error events are emitted as plain strings.
      candidate.on("error", (error) =>
        client.emit(
          "error",
          error instanceof Error ? error : new Error(String(error)),
        ),
      );
      candidate.on("topology-change", (event) =>
        client.emit("topology-change", event),
      );

      try {
        await candidate.connect();
        sentinel = candidate;
      } catch (error) {
        client.emit("error", error);
        await candidate.destroy().catch(() => {});
        await sleep(CONNECT_RETRY_DELAY_MS);
      }
    }
    client.emit("ready");
  };

  client.quit = async () => sentinel && sentinel.close();
  client.disconnect = async () => sentinel && sentinel.destroy();

  Object.defineProperties(client, {
    isOpen: { get: () => Boolean(sentinel && sentinel.isOpen) },
    isReady: {
      get: () =>
        Boolean(sentinel && sentinel.isReady) && Date.now() >= circuitOpenUntil,
    },
  });

  return client;
};

module.exports = {
  createSentinelClient,
  COMMAND_TIMEOUT_MS,
  CIRCUIT_COOLDOWN_MS,
  CONNECT_RETRY_DELAY_MS,
};
