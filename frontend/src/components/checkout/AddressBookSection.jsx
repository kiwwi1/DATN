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
      <p className="text-sm font-semibold text-gray-700">{"\u0110\u1ecba ch\u1ec9 giao h\u00e0ng"}</p>
      <button
        type="button"
        onClick={() => navigate("/profile/address")}
        className="text-xs text-orange-600 hover:underline"
      >
        {"Qu\u1ea3n l\u00fd \u0111\u1ecba ch\u1ec9"}
      </button>
    </div>

    {addressesLoading ? (
      <p className="text-sm text-gray-500">{"\u0110ang t\u1ea3i \u0111\u1ecba ch\u1ec9..."}</p>
    ) : hasAddressBook ? (
      <div className="space-y-3">
        <select
          value={selectedAddressId}
          onChange={(event) => setSelectedAddressId(event.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
        >
          {addresses.map((address) => (
            <option key={address._id} value={address._id}>
              {address.isDefault ? "[M\u1eb7c \u0111\u1ecbnh] " : ""}
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
              {"Lo\u1ea1i"}: {selectedAddress.addressType === "office" ? "V\u0103n ph\u00f2ng" : "Nh\u00e0 ri\u00eang"}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500">
          {"H\u1ec7 th\u1ed1ng t\u1ef1 \u0111\u1ed9ng d\u00f9ng \u0111\u1ecba ch\u1ec9 m\u1eb7c \u0111\u1ecbnh. B\u1ea1n c\u00f3 th\u1ec3 \u0111\u1ed5i tr\u01b0\u1edbc khi \u0111\u1eb7t \u0111\u01a1n."}
        </p>
      </div>
    ) : (
      <p className="text-sm text-gray-500">
        {"B\u1ea1n ch\u01b0a c\u00f3 \u0111\u1ecba ch\u1ec9 l\u01b0u s\u1eb5n. H\u00e3y nh\u1eadp tay b\u00ean d\u01b0\u1edbi ho\u1eb7c th\u00eam trong trang S\u1ed5 \u0111\u1ecba ch\u1ec9."}
      </p>
    )}
  </div>
);

export default AddressBookSection;
