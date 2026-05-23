import {
    listUserAddressesService,
    getDefaultAddressService,
    createAddressService,
    updateAddressService,
    deleteAddressService,
    setDefaultAddressService,
} from "../services/addressService.js";

const listAddresses = async (req, res) => {
    try {
        const addresses = await listUserAddressesService(req.body.userId);
        res.json({ success: true, addresses });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getDefaultAddress = async (req, res) => {
    try {
        const address = await getDefaultAddressService(req.body.userId);
        res.json({ success: true, address });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const createAddress = async (req, res) => {
    try {
        const address = await createAddressService(req.body.userId, req.body);
        res.json({ success: true, address, message: "Thêm địa chỉ thành công" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateAddress = async (req, res) => {
    try {
        const address = await updateAddressService(req.body.userId, req.params.id, req.body);
        res.json({ success: true, address, message: "Cập nhật địa chỉ thành công" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const deleteAddress = async (req, res) => {
    try {
        await deleteAddressService(req.body.userId, req.params.id);
        res.json({ success: true, message: "Xóa địa chỉ thành công" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const setDefaultAddress = async (req, res) => {
    try {
        const address = await setDefaultAddressService(req.body.userId, req.params.id);
        res.json({ success: true, address, message: "Đã cập nhật địa chỉ mặc định" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export {
    listAddresses,
    getDefaultAddress,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
};
