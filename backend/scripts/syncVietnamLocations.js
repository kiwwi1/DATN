import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const API_BASE = "https://provinces.open-api.vn/api/v2";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, "../data/vn-locations.json");

const fetchJson = async (url) => {
    const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`Request failed ${response.status}: ${url}`);
    }
    return response.json();
};

const normalizeProvinces = (raw) => {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => ({
            code: Number(item.code),
            name: String(item.name || "").trim(),
        }))
        .filter((item) => Number.isFinite(item.code) && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
};

const extractWards = (provinceDetail) => {
    const wardsRaw = Array.isArray(provinceDetail?.wards) ? provinceDetail.wards : [];
    const wards = [];

    for (const ward of wardsRaw) {
        const wardName = String(ward?.name || "").trim();
        if (!wardName) continue;
        const wardCode = Number(ward.code);
        wards.push({
            code: Number.isFinite(wardCode) ? wardCode : null,
            name: wardName,
            districtName: "",
            displayName: wardName,
        });
    }

    return wards.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
};

const run = async () => {
    console.log("[locations] Fetching provinces and wards list from V2 API...");
    const rawData = await fetchJson(`${API_BASE}/?depth=2`);
    const provinces = normalizeProvinces(rawData);
    console.log(`[locations] Found ${provinces.length} provinces/cities.`);

    const wardsByProvince = {};
    for (const item of rawData) {
        const provinceCode = Number(item.code);
        if (Number.isFinite(provinceCode)) {
            console.log(`[locations] Processing wards for: ${item.name}`);
            wardsByProvince[String(provinceCode)] = extractWards(item);
        }
    }

    const payload = {
        source: "https://provinces.open-api.vn/api/v2",
        syncedAt: new Date().toISOString(),
        totalProvinces: provinces.length,
        provinces,
        wardsByProvince,
    };

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
    console.log(`[locations] Saved to ${OUTPUT_PATH}`);
};

run().catch((error) => {
    console.error("[locations] Sync failed:", error.message);
    process.exit(1);
});
