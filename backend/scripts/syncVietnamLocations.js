import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const API_BASE = "https://provinces.open-api.vn/api";
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
    const districts = Array.isArray(provinceDetail?.districts) ? provinceDetail.districts : [];
    const wards = [];
    for (const district of districts) {
        const districtName = String(district?.name || "").trim();
        const districtWards = Array.isArray(district?.wards) ? district.wards : [];
        for (const ward of districtWards) {
            const wardName = String(ward?.name || "").trim();
            if (!wardName) continue;
            const wardCode = Number(ward.code);
            wards.push({
                code: Number.isFinite(wardCode) ? wardCode : null,
                name: wardName,
                districtName,
                displayName: districtName ? `${wardName}, ${districtName}` : wardName,
            });
        }
    }

    return wards.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
};

const run = async () => {
    console.log("[locations] Fetching provinces list...");
    const provinceRaw = await fetchJson(`${API_BASE}/p/`);
    const provinces = normalizeProvinces(provinceRaw);
    console.log(`[locations] Found ${provinces.length} provinces/cities.`);

    const wardsByProvince = {};
    for (let i = 0; i < provinces.length; i += 1) {
        const province = provinces[i];
        const index = i + 1;
        console.log(`[locations] (${index}/${provinces.length}) ${province.name}`);
        const detail = await fetchJson(`${API_BASE}/p/${province.code}?depth=3`);
        wardsByProvince[String(province.code)] = extractWards(detail);
    }

    const payload = {
        source: "https://provinces.open-api.vn/api",
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

