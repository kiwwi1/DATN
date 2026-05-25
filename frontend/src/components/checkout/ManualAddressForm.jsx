import React from "react";

const ManualAddressForm = ({
  formData,
  provinces,
  wards,
  loadingProvinces,
  loadingWards,
  onChangeHandler,
  onProvinceChange,
  setFormData,
}) => (
  <>
    <div className="flex gap-3">
      <input
        required
        onChange={onChangeHandler}
        name="firstName"
        value={formData.firstName}
        className="w-full rounded border border-gray-300 px-3.5 py-1.5"
        type="text"
        placeholder="Tên"
      />
      <input
        required
        onChange={onChangeHandler}
        name="lastName"
        value={formData.lastName}
        className="w-full rounded border border-gray-300 px-3.5 py-1.5"
        type="text"
        placeholder="Họ"
      />
    </div>
    <input
      required
      onChange={onChangeHandler}
      name="email"
      value={formData.email}
      className="w-full rounded border border-gray-300 px-3.5 py-1.5"
      type="email"
      placeholder="Email"
    />
    <input
      required
      onChange={onChangeHandler}
      name="street"
      value={formData.street}
      className="w-full rounded border border-gray-300 px-3.5 py-1.5"
      type="text"
      placeholder="Địa chỉ cụ thể (số nhà, tên đường)"
    />
    <div className="flex gap-3">
      <select
        required
        value={formData.provinceCode}
        onChange={onProvinceChange}
        className="w-full rounded border border-gray-300 px-3.5 py-1.5"
      >
        <option value="">
          {loadingProvinces ? "Đang tải tỉnh/thành..." : "Chọn tỉnh/thành phố"}
        </option>
        {provinces.map((province) => (
          <option key={province.code} value={String(province.code)}>
            {province.name}
          </option>
        ))}
      </select>
      <select
        required
        onChange={(event) => setFormData((prev) => ({ ...prev, state: event.target.value }))}
        name="state"
        value={formData.state}
        disabled={!formData.provinceCode || loadingWards}
        className="w-full rounded border border-gray-300 px-3.5 py-1.5 disabled:bg-gray-100"
      >
        <option value="">
          {!formData.provinceCode
            ? "Chọn tỉnh/thành trước"
            : loadingWards
              ? "Đang tải phường/xã..."
              : "Chọn phường/xã"}
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
      onChange={onChangeHandler}
      name="phone"
      value={formData.phone}
      className="w-full rounded border border-gray-300 px-3.5 py-1.5"
      type="text"
      placeholder="Số điện thoại"
    />
  </>
);

export default ManualAddressForm;
