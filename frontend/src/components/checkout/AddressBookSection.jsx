import React from "react";

const AddressBookSection = ({
  navigate,
  addressesLoading,
  hasAddressBook,
  addresses,
  selectedAddressId,
  setSelectedAddressId,
  selectedAddress,
}) => (
  <div className="rounded border border-gray-200 p-4">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm font-semibold text-gray-700">{"Địa chỉ giao hàng"}</p>
      <button
        type="button"
        onClick={() => navigate("/profile/address")}
        className="text-xs text-orange-600 hover:underline"
      >
        {"Quản lý địa chỉ"}
      </button>
    </div>

    {addressesLoading ? (
      <p className="text-sm text-gray-500">{"Đang tải địa chỉ..."}</p>
    ) : hasAddressBook ? (
      <div className="space-y-3">
        <select
          value={selectedAddressId}
          onChange={(event) => setSelectedAddressId(event.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
        >
          {addresses.map((address) => (
            <option key={address._id} value={address._id}>
              {address.isDefault ? "[Mặc định] " : ""}
              {address.receiverName} - {address.fullAddress}
            </option>
          ))}
        </select>

        {selectedAddress && (
          <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">
            <p className="font-medium">
              {selectedAddress.receiverName} - {selectedAddress.phone}
            </p>
            <p className="mt-1">{selectedAddress.fullAddress}</p>
            <p className="mt-1 text-xs text-gray-500">
              {"Loại"}: {selectedAddress.addressType === "office" ? "Văn phòng" : "Nhà riêng"}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500">
          {"Hệ thống tự động dùng địa chỉ mặc định. Bạn có thể đổi trước khi đặt đơn."}
        </p>
      </div>
    ) : (
      <p className="text-sm text-gray-500">
        {"Bạn chưa có địa chỉ lưu sẵn. Hãy nhập tay bên dưới hoặc thêm trong trang Sổ địa chỉ."}
      </p>
    )}
  </div>
);

export default AddressBookSection;
