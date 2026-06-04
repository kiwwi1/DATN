import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import ProfileSidebar from "../../components/profile/ProfileSidebar";
import { ShopContext } from "../../context/ShopContext";

const EMPTY_FORM = {
  receiverName: "",
  phone: "",
  provinceCode: "",
  city: "",
  ward: "",
  addressLine: "",
  addressType: "home",
  isDefault: false,
};

const ProfileAddress = () => {
  const { backendUrl, token } = useContext(ShopContext);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingDefaultId, setSubmittingDefaultId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const hasAddresses = addresses.length > 0;
  const modalTitle = useMemo(() => (editingAddress ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"), [editingAddress]);

  const fetchProvinces = useCallback(async () => {
    if (provinces.length > 0) return provinces;
    try {
      setLoadingProvinces(true);
      const res = await axios.get(`${backendUrl}/api/location/provinces`);
      if (!res.data.success) {
        toast.error(res.data.message);
        return [];
      }
      const list = res.data.provinces || [];
      setProvinces(list);
      return list;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return [];
    } finally {
      setLoadingProvinces(false);
    }
  }, [backendUrl, provinces]);

  const fetchWards = useCallback(
    async (provinceCode) => {
      if (!provinceCode) {
        setWards([]);
        return [];
      }
      try {
        setLoadingWards(true);
        const res = await axios.get(`${backendUrl}/api/location/wards`, {
          params: { provinceCode },
        });
        if (!res.data.success) {
          toast.error(res.data.message);
          return [];
        }
        const list = res.data.wards || [];
        setWards(list);
        return list;
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
        return [];
      } finally {
        setLoadingWards(false);
      }
    },
    [backendUrl]
  );

  const fetchAddresses = useCallback(async () => {
    if (!token) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${backendUrl}/api/address/list`, {
        headers: { token },
      });
      if (res.data.success) {
        setAddresses(res.data.addresses || []);
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, token]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    if (isModalOpen) {
      fetchProvinces();
    }
  }, [isModalOpen, fetchProvinces]);

  const openCreateModal = () => {
    setEditingAddress(null);
    setWards([]);
    setFormData({ ...EMPTY_FORM, isDefault: !hasAddresses });
    setIsModalOpen(true);
  };

  const openEditModal = async (address) => {
    setEditingAddress(address);
    setIsModalOpen(true);

    const provinceList = provinces.length > 0 ? provinces : await fetchProvinces();
    const matchedProvince = provinceList.find((item) => item.name === (address.city || ""));
    const provinceCode = matchedProvince ? String(matchedProvince.code) : "";

    setFormData({
      receiverName: address.receiverName || "",
      phone: address.phone || "",
      provinceCode,
      city: address.city || "",
      ward: address.ward || "",
      addressLine: address.addressLine || "",
      addressType: address.addressType || "home",
      isDefault: !!address.isDefault,
    });

    if (provinceCode) {
      await fetchWards(provinceCode);
    } else {
      setWards([]);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAddress(null);
    setWards([]);
    setFormData(EMPTY_FORM);
  };

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const onProvinceChange = async (event) => {
    const provinceCode = event.target.value;
    const province = provinces.find((item) => String(item.code) === provinceCode);
    setFormData((prev) => ({
      ...prev,
      provinceCode,
      city: province?.name || "",
      ward: "",
    }));
    await fetchWards(provinceCode);
  };

  const submitAddress = async (event) => {
    event.preventDefault();
    if (!token || saving) return;

    if (!formData.city || !formData.ward) {
      toast.error("Vui lòng chọn tỉnh/thành phố và phường/xã.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        receiverName: formData.receiverName,
        phone: formData.phone,
        city: formData.city,
        ward: formData.ward,
        addressLine: formData.addressLine,
        addressType: formData.addressType,
        isDefault: formData.isDefault,
      };

      const request = editingAddress
        ? axios.put(`${backendUrl}/api/address/${editingAddress._id}`, payload, { headers: { token } })
        : axios.post(`${backendUrl}/api/address`, payload, { headers: { token } });

      const res = await request;
      if (!res.data.success) {
        toast.error(res.data.message);
        return;
      }

      toast.success(editingAddress ? "Cập nhật địa chỉ thành công" : "Thêm địa chỉ thành công");
      closeModal();
      await fetchAddresses();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (addressId) => {
    if (!token || deletingId) return;
    if (!window.confirm("Bạn có chắc muốn xóa địa chỉ này?")) return;

    try {
      setDeletingId(addressId);
      const res = await axios.delete(`${backendUrl}/api/address/${addressId}`, {
        headers: { token },
      });
      if (!res.data.success) {
        toast.error(res.data.message);
        return;
      }
      toast.success("Xóa địa chỉ thành công");
      await fetchAddresses();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setDeletingId("");
    }
  };

  const onSetDefault = async (addressId) => {
    if (!token || submittingDefaultId) return;
    try {
      setSubmittingDefaultId(addressId);
      const res = await axios.post(`${backendUrl}/api/address/${addressId}/set-default`, {}, { headers: { token } });
      if (!res.data.success) {
        toast.error(res.data.message);
        return;
      }
      toast.success("Đã đặt địa chỉ mặc định");
      await fetchAddresses();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSubmittingDefaultId("");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">Sổ địa chỉ</h1>
            <button onClick={openCreateModal} className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
              + Thêm địa chỉ
            </button>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Đang tải địa chỉ...</p>
            ) : !hasAddresses ? (
              <p className="py-8 text-center text-sm text-gray-500">Bạn chưa có địa chỉ nào.</p>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div key={address._id} className="rounded border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {address.receiverName}
                          <span className="ml-2 text-xs text-gray-500">{address.phone}</span>
                        </p>
                        <p className="mt-1 text-sm text-gray-600">{address.fullAddress}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{address.addressType === "office" ? "Văn phòng" : "Nhà riêng"}</span>
                          {address.isDefault && <span className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-600">Mặc định</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!address.isDefault && (
                          <button
                            onClick={() => onSetDefault(address._id)}
                            disabled={submittingDefaultId === address._id}
                            className="rounded border border-orange-400 px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-50 disabled:opacity-60"
                          >
                            Đặt mặc định
                          </button>
                        )}
                        <button onClick={() => openEditModal(address)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                          Sửa
                        </button>
                        <button
                          onClick={() => onDelete(address._id)}
                          disabled={deletingId === address._id}
                          className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">{modalTitle}</h2>
            <form onSubmit={submitAddress} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  name="receiverName"
                  value={formData.receiverName}
                  onChange={onChange}
                  placeholder="Họ và tên"
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
                <input
                  required
                  name="phone"
                  value={formData.phone}
                  onChange={onChange}
                  placeholder="Số điện thoại"
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  required
                  value={formData.provinceCode}
                  onChange={onProvinceChange}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                >
                  <option value="">{loadingProvinces ? "Đang tải tỉnh/thành..." : "Chọn tỉnh/thành phố"}</option>
                  {provinces.map((province) => (
                    <option key={province.code} value={String(province.code)}>
                      {province.name}
                    </option>
                  ))}
                </select>

                <select
                  required
                  value={formData.ward}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ward: e.target.value }))}
                  disabled={!formData.provinceCode || loadingWards}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none disabled:bg-gray-100"
                >
                  <option value="">
                    {!formData.provinceCode ? "Chọn tỉnh/thành trước" : loadingWards ? "Đang tải phường/xã..." : "Chọn phường/xã"}
                  </option>
                  {wards.map((ward) => (
                    <option key={`${ward.code}-${ward.displayName}`} value={ward.displayName}>
                      {ward.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <input
                required
                name="addressLine"
                value={formData.addressLine}
                onChange={onChange}
                placeholder="Địa chỉ cụ thể (số nhà, tên đường)"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              />

              <div>
                <p className="mb-2 text-sm text-gray-700">Loại địa chỉ</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, addressType: "home" }))}
                    className={`rounded border px-4 py-2 text-sm ${formData.addressType === "home" ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-300 text-gray-600"}`}
                  >
                    Nhà riêng
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, addressType: "office" }))}
                    className={`rounded border px-4 py-2 text-sm ${formData.addressType === "office" ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-300 text-gray-600"}`}
                  >
                    Văn phòng
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={onChange}
                  className="h-4 w-4 accent-orange-500"
                />
                Đặt làm địa chỉ mặc định
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Trở lại
                </button>
                <button disabled={saving} type="submit" className="rounded bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-70">
                  {saving ? "Đang lưu..." : "Hoàn thành"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileAddress;
