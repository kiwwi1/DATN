import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getRedisClient } from "../config/redis.js";

const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";
const REDIS_PREFIX = process.env.REDIS_PREFIX || "datn";
const fallbackSessions = new Map();

const buildRedisKey = (sid) => `${REDIS_PREFIX}:auth:session:${sid}`;

const parseDurationMs = (value, fallbackMs) => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;

    const raw = String(value || "").trim();
    if (!raw) return fallbackMs;
    if (/^\d+$/.test(raw)) return Number(raw);

    const match = raw.match(/^(\d+)(ms|s|m|h|d)$/i);
    if (!match) return fallbackMs;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const unitToMs = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return amount * unitToMs[unit];
};

const REFRESH_SESSION_TTL_MS = parseDurationMs(
    process.env.JWT_REFRESH_COOKIE_MAX_AGE_MS || process.env.JWT_REFRESH_EXPIRES,
    7 * 24 * 60 * 60 * 1000
);

const createSessionId = () => crypto.randomUUID();
const createTokenId = () => crypto.randomUUID();

const createAccessToken = (userId, sid) =>
    jwt.sign({ id: userId, sid, type: "access" }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

const createRefreshToken = (userId, sid, jti) =>
    jwt.sign({ id: userId, jti, sid, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });

const hashToken = (token) =>
    crypto.createHash("sha256").update(String(token || "")).digest("hex");

const buildLegacyDescriptor = (refreshToken) => {
    const tokenHash = hashToken(refreshToken);
    return {
        sid: `legacy-${tokenHash.slice(0, 32)}`,
        refreshJti: `legacy-${tokenHash.slice(32, 64)}`,
        isLegacy: true,
    };
};

const buildRefreshDescriptor = (decoded, refreshToken) => {
    if (decoded?.sid && decoded?.jti) {
        return {
            sid: String(decoded.sid),
            refreshJti: String(decoded.jti),
            isLegacy: false,
        };
    }

    return buildLegacyDescriptor(refreshToken);
};

const purgeFallbackSessionIfExpired = (sid) => {
    const session = fallbackSessions.get(sid);
    if (!session) return null;
    if (Number(session.expiresAt || 0) > Date.now()) return session;
    fallbackSessions.delete(sid);
    return null;
};

const readSession = async (sid) => {
    const client = getRedisClient();
    if (!client) {
        return purgeFallbackSessionIfExpired(sid);
    }

    const raw = await client.get(buildRedisKey(sid));
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        await client.del(buildRedisKey(sid)).catch(() => {});
        return null;
    }
};

const writeSession = async (session) => {
    const normalized = {
        sid: String(session.sid),
        userId: String(session.userId),
        currentRefreshJti: String(session.currentRefreshJti),
        expiresAt: Number(session.expiresAt || Date.now() + REFRESH_SESSION_TTL_MS),
    };
    const ttlMs = Math.max(1, normalized.expiresAt - Date.now());

    const client = getRedisClient();
    if (!client) {
        fallbackSessions.set(normalized.sid, normalized);
        return normalized;
    }

    await client.set(buildRedisKey(normalized.sid), JSON.stringify(normalized), { PX: ttlMs });
    return normalized;
};

const deleteSession = async (sid) => {
    const client = getRedisClient();
    if (!client) {
        fallbackSessions.delete(sid);
        return;
    }
    await client.del(buildRedisKey(sid));
};

const buildInvalidRefreshError = () =>
    Object.assign(new Error("Invalid refresh token"), { status: 401 });

const buildUnauthorizedError = (message = "Unauthorized") =>
    Object.assign(new Error(message), { status: 401 });

const createSessionRecord = (userId, sid, currentRefreshJti) => ({
    sid,
    userId: String(userId),
    currentRefreshJti,
    expiresAt: Date.now() + REFRESH_SESSION_TTL_MS,
});

export const issueAuthSessionTokens = async (userId, sid = createSessionId()) => {
    const refreshJti = createTokenId();
    await writeSession(createSessionRecord(userId, sid, refreshJti));

    return {
        userId: String(userId),
        sid,
        accessToken: createAccessToken(userId, sid),
        refreshToken: createRefreshToken(userId, sid, refreshJti),
    };
};

export const refreshAuthSessionTokens = async (refreshToken) => {
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
        throw buildInvalidRefreshError();
    }

    if (decoded?.type !== "refresh" || !decoded?.id) {
        throw buildInvalidRefreshError();
    }

    const descriptor = buildRefreshDescriptor(decoded, refreshToken);
    const currentSession = await readSession(descriptor.sid);

    if (currentSession) {
        const sameUser = String(currentSession.userId) === String(decoded.id);
        const sameRefreshToken = String(currentSession.currentRefreshJti) === descriptor.refreshJti;

        if (!sameUser || !sameRefreshToken) {
            await deleteSession(descriptor.sid).catch(() => {});
            throw buildInvalidRefreshError();
        }
    } else if (!descriptor.isLegacy) {
        throw buildInvalidRefreshError();
    }

    return issueAuthSessionTokens(decoded.id, descriptor.sid);
};

export const assertAccessTokenSession = async (decoded) => {
    if (decoded?.type && decoded.type !== "access") {
        throw buildUnauthorizedError("Invalid token type");
    }
    if (!decoded?.id) {
        throw buildUnauthorizedError("Unauthorized");
    }
    if (!decoded?.sid) {
        return decoded;
    }

    const session = await readSession(String(decoded.sid));
    if (!session || String(session.userId) !== String(decoded.id)) {
        throw buildUnauthorizedError("Session has expired");
    }

    return decoded;
};

export const verifyAccessToken = async (token) => {
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw buildUnauthorizedError(error.message);
    }

    return assertAccessTokenSession(decoded);
};

const extractSessionIdFromToken = (token, expectedType) => {
    if (!token) return "";

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.id) return "";
        if (expectedType && decoded?.type !== expectedType) return "";
        return String(decoded.sid || "");
    } catch {
        return "";
    }
};

export const revokeAuthSession = async ({ accessToken, refreshToken } = {}) => {
    const sid =
        extractSessionIdFromToken(refreshToken, "refresh") ||
        extractSessionIdFromToken(accessToken, "access");

    if (!sid) return false;

    await deleteSession(sid).catch(() => {});
    return true;
};
