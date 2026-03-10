import IORedis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: IORedis | undefined;
}

function createRedisClient(): IORedis {
  const client = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 500, 5000);
      return delay;
    },
  });

  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected");
  });

  return client;
}

export const redis: IORedis =
  globalThis.__redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
