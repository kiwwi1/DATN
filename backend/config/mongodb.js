import mongoose from "mongoose";

const DB_NAME = "ecommerce";

/**
 * Resolve MongoDB SRV hostname via DNS-over-HTTPS (Google).
 * Dùng khi DNS máy (sau cài Win mới) không resolve được querySrv.
 */
async function resolveSrvViaDoH(srvHostname) {
    const name = `_mongodb._tcp.${srvHostname}`;
    const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=SRV`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DoH request failed: ${res.status}`);
    const data = await res.json();
    if (data.Status !== 0 || !data.Answer?.length) {
        throw new Error("DoH: no SRV records");
    }
    // SRV data: "priority weight port target."
    const records = data.Answer.map((a) => {
        const parts = a.data.trim().split(/\s+/);
        return {
            priority: parseInt(parts[0], 10),
            weight: parseInt(parts[1], 10),
            port: parseInt(parts[2], 10),
            target: parts[3].replace(/\.$/, ""),
        };
    });
    records.sort((a, b) => a.priority - b.priority || a.weight - b.weight);
    return records.map((r) => `${r.target}:${r.port}`).join(",");
}

/**
 * Parse mongodb+srv URI thành user, password, host, searchParams.
 */
function parseSrvUri(uri) {
    const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(\?.*)?$/);
    if (!match) return null;
    const [, user, password, host, search = ""] = match;
    return {
        user: decodeURIComponent(user),
        password: decodeURIComponent(password),
        host,
        search: search.replace(/^\?/, ""),
    };
}

/**
 * Tạo URI dạng standard (không dùng SRV) từ thông tin đã parse + danh sách host.
 */
function buildStandardUri(parsed, hosts, dbName) {
    const user = encodeURIComponent(parsed.user);
    const password = encodeURIComponent(parsed.password);
    const params = new URLSearchParams(parsed.search);
    params.set("ssl", "true");
    params.set("authSource", "admin");
    return `mongodb://${user}:${password}@${hosts}/${dbName}?${params.toString()}`;
}

const connectDB = async () => {
    mongoose.connection.on("connected", () => {
        console.log("MongoDB connected");
    });

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is not set");
    }

    const fullUri = uri.includes("/ecommerce") ? uri : `${uri.replace(/\/?$/, "")}/${DB_NAME}`;

    try {
        await mongoose.connect(fullUri);
        return;
    } catch (err) {
        const isSrvRefused =
            err.code === "ECONNREFUSED" ||
            (err.message && err.message.includes("querySrv"));
        if (!isSrvRefused || !uri.startsWith("mongodb+srv://")) {
            throw err;
        }
    }

    // Fallback: resolve SRV qua DoH rồi dùng URI standard
    const parsed = parseSrvUri(uri);
    if (!parsed) {
        throw new Error("Could not parse MONGODB_URI for DoH fallback");
    }
    const hosts = await resolveSrvViaDoH(parsed.host);
    const standardUri = buildStandardUri(parsed, hosts, DB_NAME);
    await mongoose.connect(standardUri);
};

export default connectDB;
