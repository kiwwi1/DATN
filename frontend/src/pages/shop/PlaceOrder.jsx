import React, { useContext } from "react";
import Title from "../../components/ui/Title";
import CartTotal from "../../components/cart/CartTotal";
import { assets } from "../../assets/assets";
import { ShopContext } from "../../context/ShopContext";
import { usePlaceOrderCheckout } from "../../hooks/usePlaceOrderCheckout";
import AddressBookSection from "../../components/checkout/AddressBookSection";
import ManualAddressForm from "../../components/checkout/ManualAddressForm";
import PaymentMethodSelector from "../../components/checkout/PaymentMethodSelector";

const VoucherGroup = ({
  title,
  subtitle,
  inputValue,
  onInputChange,
  onApply,
  appliedCodes,
  onRemoveCode,
  rejectedReason,
}) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
    <div className="mt-2 flex gap-2">
      <input
        value={inputValue}
        onChange={onInputChange}
        placeholder="Nhập mã voucher"
        className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={onApply}
        className="rounded bg-black px-3 py-2 text-xs text-white hover:bg-slate-800"
      >
        Áp dụng
      </button>
    </div>

    {appliedCodes.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-2">
        {appliedCodes.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onRemoveCode(code)}
            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
          >
            {code} ×
          </button>
        ))}
      </div>
    )}

    {rejectedReason ? <p className="mt-2 text-xs text-red-500">{rejectedReason}</p> : null}
  </div>
);

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
    shopVoucherInput,
    setShopVoucherInput,
    platformVoucherInput,
    setPlatformVoucherInput,
    shopVoucherCodes,
    platformVoucherCodes,
    voucherCodes,
    applyShopVoucherInput,
    applyPlatformVoucherInput,
    removeShopVoucherCode,
    removePlatformVoucherCode,
    pricingSummary,
    appliedShopVouchers,
    appliedPlatformVouchers,
    rejectedShopVouchers,
    rejectedPlatformVouchers,
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
    <form onSubmit={onSubmitHandler} className="border-t pt-5 sm:pt-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="space-y-4">
          <div className="text-xl sm:text-2xl">
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
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <CartTotal selectedTotal={selectedTotal > 0 ? selectedTotal : undefined} pricing={pricingSummary} compact />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Mã giảm giá</h3>
            <div className="mt-3 space-y-3">
              <VoucherGroup
                title="Voucher của shop"
                subtitle="Áp dụng cho từng shop trong đơn hàng"
                inputValue={shopVoucherInput}
                onInputChange={(event) => setShopVoucherInput(event.target.value)}
                onApply={applyShopVoucherInput}
                appliedCodes={shopVoucherCodes}
                onRemoveCode={removeShopVoucherCode}
                rejectedReason={rejectedShopVouchers[0]?.reason}
              />

              <VoucherGroup
                title="Voucher của sàn"
                subtitle="Áp dụng trên tổng giá trị đơn hàng"
                inputValue={platformVoucherInput}
                onInputChange={(event) => setPlatformVoucherInput(event.target.value)}
                onApply={applyPlatformVoucherInput}
                appliedCodes={platformVoucherCodes}
                onRemoveCode={removePlatformVoucherCode}
                rejectedReason={rejectedPlatformVouchers[0]?.reason}
              />

              {voucherCodes.length > 0 && (
                <p className="text-xs text-slate-500">
                  Đã thêm {voucherCodes.length} voucher | Shop áp dụng: {appliedShopVouchers.length} | Sàn áp dụng:{" "}
                  {appliedPlatformVouchers.length}
                </p>
              )}

              {previewLoading && <p className="text-xs text-slate-500">Đang cập nhật giá...</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Title text1={"PHƯƠNG THỨC "} text2={"THANH TOÁN"} />
            <PaymentMethodSelector
              method={method}
              setMethod={setMethod}
              isSubmitting={isSubmitting}
              assets={assets}
            />

            <div className="mt-6">
              <button
                disabled={isSubmitting}
                type="submit"
                className={`w-full rounded bg-black px-6 py-3 text-sm text-white hover:bg-slate-800 ${
                  isSubmitting ? "cursor-not-allowed opacity-70" : ""
                }`}
              >
                {isSubmitting ? "ĐANG XỬ LÝ..." : "ĐẶT HÀNG"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
};

export default PlaceOrder;
