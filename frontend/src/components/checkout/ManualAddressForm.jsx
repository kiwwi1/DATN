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
        placeholder={"T\u00ean"}
      />
      <input
        required
        onChange={onChangeHandler}
        name="lastName"
        value={formData.lastName}
        className="w-full rounded border border-gray-300 px-3.5 py-1.5"
        type="text"
        placeholder={"H\u1ecd"}
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
      placeholder={"\u0110\u1ecba ch\u1ec9 c\u1ee5 th\u1ec3 (s\u1ed1 nh\u00e0, t\u00ean \u0111\u01b0\u1eddng)"}
    />
    <div className="flex gap-3">
      <select
        required
        value={formData.provinceCode}
        onChange={onProvinceChange}
        className="w-full rounded border border-gray-300 px-3.5 py-1.5"
      >
        <option value="">
          {loadingProvinces
            ? "\u0110ang t\u1ea3i t\u1ec9nh/th\u00e0nh..."
            : "Ch\u1ecdn t\u1ec9nh/th\u00e0nh ph\u1ed1"}
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
            ? "Ch\u1ecdn t\u1ec9nh/th\u00e0nh tr\u01b0\u1edbc"
            : loadingWards
              ? "\u0110ang t\u1ea3i ph\u01b0\u1eddng/x\u00e3..."
              : "Ch\u1ecdn ph\u01b0\u1eddng/x\u00e3"}
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
      placeholder={"S\u1ed1 \u0111i\u1ec7n tho\u1ea1i"}
    />
  </>
);

export default ManualAddressForm;
