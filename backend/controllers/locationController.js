import {
    listProvincesService,
    listWardsByProvinceService,
} from "../services/locationService.js";

const listProvinces = async (req, res) => {
    try {
        const provinces = await listProvincesService(req.query.keyword);
        res.json({ success: true, provinces });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const listWards = async (req, res) => {
    try {
        const { provinceCode, keyword } = req.query;
        const wards = await listWardsByProvinceService(provinceCode, keyword);
        res.json({ success: true, wards });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export { listProvinces, listWards };

