import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const PROVINCES_API_BASE = "https://provinces.open-api.vn/api";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DATA_PATH = path.resolve(__dirname, "../data/vn-locations.json");

const cache = {
    provinces: { expiresAt: 0, data: [] },
    wardsByProvince: new Map(),
    localData: null,
};

const normalizeKeyword = (value) => String(value || "").trim().toLowerCase();

const fetchJson = async (url) => {
    if (typeof fetch !== "function") {
        throw Object.assign(new Error("Máy chủ không hỗ trợ fetch"), { status: 500 });
    }

    const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        throw Object.assign(new Error(`Lỗi nhà cung cấp địa giới: ${response.status}`), { status: 502 });
    }

    return response.json();
};

const getCached = (entry) => {
    if (entry.expiresAt > Date.now() && Array.isArray(entry.data) && entry.data.length > 0) {
        return entry.data;
    }
    return null;
};

const buildProvinceList = (raw) => {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => ({
            code: Number(item.code),
            name: String(item.name || "").trim(),
        }))
        .filter((item) => Number.isFinite(item.code) && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
};

const buildWardListFromProvince = (provinceDetail) => {
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

const loadLocalData = async () => {
    if (cache.localData) return cache.localData;
    try {
        const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
        const parsed = JSON.parse(raw);
        const provinces = Array.isArray(parsed?.provinces) ? parsed.provinces : [];
        const wardsByProvince = parsed?.wardsByProvince && typeof parsed.wardsByProvince === "object"
            ? parsed.wardsByProvince
            : {};

        cache.localData = {
            provinces: buildProvinceList(provinces),
            wardsByProvince,
        };
        return cache.localData;
    } catch {
        return null;
    }
};

export const listProvincesService = async (keyword = "") => {
    const localData = await loadLocalData();
    let provinces = localData?.provinces || null;

    if (!provinces || provinces.length === 0) {
        provinces = getCached(cache.provinces);
        if (!provinces) {
            const raw = await fetchJson(`${PROVINCES_API_BASE}/p/`);
            provinces = buildProvinceList(raw);
            cache.provinces = {
                data: provinces,
                expiresAt: Date.now() + CACHE_TTL_MS,
            };
        }
    }

    const normalizedKeyword = normalizeKeyword(keyword);
    if (!normalizedKeyword) return provinces;
    return provinces.filter((item) => normalizeKeyword(item.name).includes(normalizedKeyword));
};

export const listWardsByProvinceService = async (provinceCode, keyword = "") => {
    const parsedCode = Number(provinceCode);
    if (!Number.isFinite(parsedCode) || parsedCode <= 0) {
        throw Object.assign(new Error("Thiếu mã tỉnh/thành phố"), { status: 400 });
    }

    const localData = await loadLocalData();
    const localWards = localData?.wardsByProvince?.[String(parsedCode)];
    let wards = Array.isArray(localWards) && localWards.length > 0 ? localWards : null;

    if (!wards) {
        const cacheKey = String(parsedCode);
        const cachedEntry = cache.wardsByProvince.get(cacheKey);
        wards = getCached(cachedEntry || { expiresAt: 0, data: [] });

        if (!wards) {
            const raw = await fetchJson(`${PROVINCES_API_BASE}/p/${parsedCode}?depth=3`);
            wards = buildWardListFromProvince(raw);
            cache.wardsByProvince.set(cacheKey, {
                data: wards,
                expiresAt: Date.now() + CACHE_TTL_MS,
            });
        }
    }

    const normalizedKeyword = normalizeKeyword(keyword);
    if (!normalizedKeyword) return wards;

    return wards.filter((item) =>
        normalizeKeyword(`${item.name} ${item.districtName} ${item.displayName}`).includes(normalizedKeyword)
    );
};
