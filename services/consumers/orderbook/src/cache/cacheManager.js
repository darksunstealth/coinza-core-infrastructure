const Redis = require("ioredis");

class RedisCache {
  constructor(options = {}) {
    this.redis = new Redis({
      host: options.host || "127.0.0.1",
      port: options.port || 6379,
      password: options.password || null,
      db: options.db || 0,
    });
  }

  async set(key, value, ttl = 60) {
    try {
      const data = typeof value === "object" ? JSON.stringify(value) : value;
      await this.redis.set(key, data, "EX", ttl);
      console.log(`Cache set: ${key}`);
    } catch (error) {
      console.error("Redis SET error:", error);
    }
  }

  async get(key) {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Redis GET error:", error);
      return null;
    }
  }

  async delete(key) {
    try {
      await this.redis.del(key);
      console.log(`Cache deleted: ${key}`);
    } catch (error) {
      console.error("Redis DELETE error:", error);
    }
  }

  async flush() {
    try {
      await this.redis.flushall();
      console.log("Redis cache cleared.");
    } catch (error) {
      console.error("Redis FLUSH error:", error);
    }
  }

  close() {
    this.redis.quit();
  }
}

// Exemplo de uso
(async () => {
  const cache = new RedisCache();

  await cache.set("user:1", { id: 1, name: "Samir" }, 120);
  
  const user = await cache.get("user:1");
  console.log("User from cache:", user);

  await cache.delete("user:1");
  cache.close();
})();
