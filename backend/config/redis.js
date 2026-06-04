import { createClient } from "redis";

let redisClient = null;
let redisReady = false;

const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX || "datn";

const buildKey = (key) => `${REDIS_PREFIX}:${key}`;

export const getRedisClient = () => redisReady ? redisClient : null;

export const initRedis = async () => {
    if (!REDIS_URL) {
        console.warn("[redis] REDIS_URL is not set. Auth rate-limit will run in fallback mode.");
        return null;
    }

    if (redisClient && redisReady) return redisClient;

    redisClient = createClient({ url: REDIS_URL });

    redisClient.on("error", (error) => {
        redisReady = false;
        console.error("[redis] Client error:", error.message);
    });

    redisClient.on("reconnecting", () => {
        redisReady = false;
        console.warn("[redis] Reconnecting...");
    });

    redisClient.on("ready", () => {
        redisReady = true;
        console.log("[redis] Connected");
    });

    try {
        await redisClient.connect();
        redisReady = true;
        return redisClient;
    } catch (error) {
        redisReady = false;
        console.error("[redis] Connect failed:", error.message);
        return null;
    }
};

export const incrWithWindow = async (key, windowSec) => {
    const client = getRedisClient();
    if (!client) return null;

    const redisKey = buildKey(key);
    const count = await client.incr(redisKey);

    if (count === 1) {
        await client.expire(redisKey, windowSec);
    }

    let ttl = await client.ttl(redisKey);
    if (ttl < 0) {
        await client.expire(redisKey, windowSec);
        ttl = windowSec;
    }

    return { count, ttl };
};

