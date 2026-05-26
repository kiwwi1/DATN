import React, { useContext } from "react";
import Title from "../../components/ui/Title";
import CartTotal from "../../components/cart/CartTotal";
import { assets } from "../../assets/assets";
import { ShopContext } from "../../context/ShopContext";
import { usePlaceOrderCheckout } from "../../hooks/usePlaceOrderCheckout";
import AddressBookSection from "../../components/checkout/AddressBookSection";
import ManualAddressForm from "../../components/checkout/ManualAddressForm";
import PaymentMethodSelector from "../../components/checkout/PaymentMethodSelector";

const PlaceOrder = () => {
  const { navigate, cartItems, setCartItems, token, backendUrl, delivery_fee, products } = useContext(ShopContext);

  const {
    method,
    setMethod,
    addresses,
    addressesLoading,
    selectedAddressId,
    setSelectedAddressId,
    selectedAddress,
    hasAddressBook,
    provinces,
    wards,
    loadingProvinces,
    loadingWards,
    formData,
    setFormData,
    selectedTotal,
    isSubmitting,
    onChangeHandler,
    onProvinceChange,
    onSubmitHandler,
    voucherInput,
    setVoucherInput,
    voucherCodes,
    applyVoucherInput,
    removeVoucherCode,
    pricingSummary,
    rejectedVouchers,
    previewLoading,
  } = usePlaceOrderCheckout({
    navigate,
    cartItems,
    setCartItems,
    token,
    backendUrl,
    deliveryFee: delivery_fee,
    products,
  });

  return (
    <form onSubmit={onSubmitHandler} className="flex min-h-[80vh] flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:pt-14">
      <div className="flex w-full flex-col gap-4 sm:max-w-[520px]">
        <div className="my-3 text-xl sm:text-2xl">
          <Title text1={"THÔNG TIN "} text2={"GIAO HÀNG"} />
        </div>

        <AddressBookSection
          navigate={navigate}
          addressesLoading={addressesLoading}
          hasAddressBook={hasAddressBook}
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          setSelectedAddressId={setSelectedAddressId}
          selectedAddress={selectedAddress}
        />

        {!selectedAddress && (
          <ManualAddressForm
            formData={formData}
            provinces={provinces}
            wards={wards}
            loadingProvinces={loadingProvinces}
            loadingWards={loadingWards}
            onChangeHandler={onChangeHandler}
            onProvinceChange={onProvinceChange}
            setFormData={setFormData}
          />
        )}
      </div>

      <div className="mt-8">
        <div className="mt-8 min-w-80">
          <CartTotal
            selectedTotal={selectedTotal > 0 ? selectedTotal : undefined}
            pricing={pricingSummary}
          />
          <div className="mt-4 rounded border border-gray-200 p-3">
            <p className="mb-2 text-sm font-medium text-gray-700">Voucher</p>
            <div className="flex gap-2">
              <input
                value={voucherInput}
                onChange={(event) => setVoucherInput(event.target.value)}
                placeholder="Nhap ma voucher"
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={applyVoucherInput}
                className="rounded bg-black px-3 py-2 text-xs text-white"
              >
                Ap dung
              </button>
            </div>
            {voucherCodes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {voucherCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => removeVoucherCode(code)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                  >
                    {code} x
                  </button>
                ))}
              </div>
            )}
            {rejectedVouchers.length > 0 && (
              <p className="mt-2 text-xs text-red-500">{rejectedVouchers[0]?.reason}</p>
            )}
            {previewLoading && <p className="mt-2 text-xs text-gray-500">Dang cap nhat gia...</p>}
          </div>
        </div>

        <div className="mt-12">
          <Title text1={"PHƯƠNG THỨC "} text2={"THANH TOÁN"} />
          <PaymentMethodSelector
            method={method}
            setMethod={setMethod}
            isSubmitting={isSubmitting}
            assets={assets}
          />
          <div className="mt-8 w-full text-end">
            <button
              disabled={isSubmitting}
              type="submit"
              className={`bg-black px-16 py-2 text-sm text-white ${isSubmitting ? "cursor-not-allowed opacity-70" : ""}`}
            >
              {isSubmitting ? "ĐANG XỬ LÝ..." : "ĐẶT HÀNG"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default PlaceOrder;
