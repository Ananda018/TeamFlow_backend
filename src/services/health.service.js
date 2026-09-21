export async function probe(check, timeoutMs = 1500) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Probe timed out")),
          timeoutMs
        );
      }),
    ]);
    return "up";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

export function createHealthChecks(database, redis) {
  return {
    database: async () => {
      if (database.readyState !== 1) throw new Error("Database unavailable");
      await database.db.admin().ping({ timeoutMS: 1500 });
    },
    redis: async () => {
      if (!redis.isReady) throw new Error("Redis unavailable");
      if ((await redis.ping()) !== "PONG") throw new Error("Redis ping failed");
    },
  };
}
