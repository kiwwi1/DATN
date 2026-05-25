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
      <p className="text-sm font-semibold text-gray-700">Dia chi giao hang</p>
      <button
        type="button"
        onClick={() => navigate("/profile/address")}
        className="text-xs text-orange-600 hover:underline"
      >
        Quan ly dia chi
      </button>
    </div>

    {addressesLoading ? (
      <p className="text-sm text-gray-500">Dang tai dia chi...</p>
    ) : hasAddressBook ? (
      <div className="space-y-3">
        <select
          value={selectedAddressId}
          onChange={(event) => setSelectedAddressId(event.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
        >
          {addresses.map((address) => (
            <option key={address._id} value={address._id}>
              {address.isDefault ? "[Mac dinh] " : ""}
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
              Loai: {selectedAddress.addressType === "office" ? "Van phong" : "Nha rieng"}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500">
          He thong tu dong dung dia chi mac dinh. Ban co the doi truoc khi dat don.
        </p>
      </div>
    ) : (
      <p className="text-sm text-gray-500">
        Ban chua co dia chi luu san. Hay nhap tay ben duoi hoac them trong trang So dia chi.
      </p>
    )}
  </div>
);

export default AddressBookSection;
