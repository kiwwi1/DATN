import addressModel from "../models/addressModel.js";

const normalizePhone = (phone) => {
    const raw = String(phone || "").trim();
    const digits = raw.replace(/[^\d+]/g, "");

    if (digits.startsWith("+84")) return `+84${digits.slice(3).replace(/\D/g, "")}`;
    if (digits.startsWith("84")) return `+84${digits.slice(2).replace(/\D/g, "")}`;
    if (digits.startsWith("0")) return `+84${digits.slice(1).replace(/\D/g, "")}`;
    return digits.startsWith("+") ? digits : `+${digits}`;
};

const splitReceiverName = (name) => {
    const normalized = String(name || "").trim();
    if (!normalized) return { firstName: "", lastName: "" };
    const parts = normalized.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
        firstName: parts.slice(0, -1).join(" "),
        lastName: parts[parts.length - 1],
    };
};

const toAddressResponse = (doc) => {
    const address = doc.toObject ? doc.toObject() : doc;
    const { firstName, lastName } = splitReceiverName(address.receiverName);
    return {
        _id: address._id,
        userId: address.userId,
        receiverName: address.receiverName,
        phone: address.phone,
        city: address.city,
        ward: address.ward,
        addressLine: address.addressLine,
        addressType: address.addressType,
        isDefault: !!address.isDefault,
        lastUsedAt: address.lastUsedAt || null,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt,
        fullAddress: `${address.addressLine}, ${address.ward}, ${address.city}`,
        firstName,
        lastName,
    };
};

const validateAddressInput = (payload) => {
    const receiverName = String(payload.receiverName || "").trim();
    const phone = normalizePhone(payload.phone);
    const city = String(payload.city || "").trim();
    const ward = String(payload.ward || "").trim();
    const addressLine = String(payload.addressLine || "").trim();
    const addressType = payload.addressType === "office" ? "office" : "home";

    if (!receiverName) throw Object.assign(new Error("Vui lòng nhập họ và tên người nhận"), { status: 400 });
    if (!phone || phone.length < 10) throw Object.assign(new Error("Số điện thoại không hợp lệ"), { status: 400 });
    if (!city) throw Object.assign(new Error("Vui lòng chọn tỉnh/thành phố"), { status: 400 });
    if (!ward) throw Object.assign(new Error("Vui lòng chọn phường/xã"), { status: 400 });
    if (!addressLine) throw Object.assign(new Error("Vui lòng nhập địa chỉ cụ thể"), { status: 400 });

    return {
        receiverName,
        phone,
        city,
        ward,
        addressLine,
        addressType,
        isDefault: !!payload.isDefault,
    };
};

const ensureAddressOwnedByUser = async (addressId, userId) => {
    const address = await addressModel.findOne({ _id: addressId, userId });
    if (!address) throw Object.assign(new Error("Không tìm thấy địa chỉ"), { status: 404 });
    return address;
};

export const listUserAddressesService = async (userId) => {
    const addresses = await addressModel.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });
    return addresses.map(toAddressResponse);
};

export const getDefaultAddressService = async (userId) => {
    const address = await addressModel.findOne({ userId, isDefault: true }).sort({ updatedAt: -1 });
    return address ? toAddressResponse(address) : null;
};

export const createAddressService = async (userId, payload) => {
    const normalized = validateAddressInput(payload);
    const existingCount = await addressModel.countDocuments({ userId });
    const shouldDefault = normalized.isDefault || existingCount === 0;

    if (shouldDefault) {
        await addressModel.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } });
    }

    const created = await addressModel.create({
        userId,
        ...normalized,
        isDefault: shouldDefault,
    });

    return toAddressResponse(created);
};

export const updateAddressService = async (userId, addressId, payload) => {
    const address = await ensureAddressOwnedByUser(addressId, userId);
    const normalized = validateAddressInput(payload);

    if (normalized.isDefault) {
        await addressModel.updateMany(
            { userId, isDefault: true, _id: { $ne: address._id } },
            { $set: { isDefault: false } }
        );
    }

    address.receiverName = normalized.receiverName;
    address.phone = normalized.phone;
    address.city = normalized.city;
    address.ward = normalized.ward;
    address.addressLine = normalized.addressLine;
    address.addressType = normalized.addressType;
    address.isDefault = normalized.isDefault || address.isDefault;
    await address.save();

    return toAddressResponse(address);
};

export const deleteAddressService = async (userId, addressId) => {
    const address = await ensureAddressOwnedByUser(addressId, userId);
    const wasDefault = !!address.isDefault;
    await addressModel.deleteOne({ _id: address._id });

    if (wasDefault) {
        const replacement = await addressModel.findOne({ userId }).sort({ updatedAt: -1 });
        if (replacement) {
            replacement.isDefault = true;
            await replacement.save();
        }
    }
};

export const setDefaultAddressService = async (userId, addressId) => {
    const address = await ensureAddressOwnedByUser(addressId, userId);
    await addressModel.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();
    return toAddressResponse(address);
};

export const markAddressUsedService = async (userId, addressId) => {
    const address = await ensureAddressOwnedByUser(addressId, userId);
    address.lastUsedAt = new Date();
    await address.save();
    return toAddressResponse(address);
};
