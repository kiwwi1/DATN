import React, { useContext } from "react";
import Title from "../../components/ui/Title";
import CartTotal from "../../components/cart/CartTotal";
import { assets } from "../../assets/assets";
import { ShopContext } from "../../context/ShopContext";
import { usePlaceOrderCheckout } from "../../hooks/usePlaceOrderCheckout";
import AddressBookSection from "../../components/checkout/AddressBookSection";
import ManualAddressForm from "../../components/checkout/ManualAddressForm";
import PaymentMethodSelector from "../../components/checkout/PaymentMethodSelector";
import { formatPrice } from "../../utils/priceFormat";
import { formatImageUrl } from "../../utils/imageUtils";

const pickImageUrl = (imageLike) => formatImageUrl(imageLike, { variant: "thumb" });

const formatSelectedAttributes = (item) => {
  if (Array.isArray(item.selectedAttributes) && item.selectedAttributes.length > 0) {
    return item.selectedAttributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(", ");
  }
  return item.size || "";
};

const VoucherInputGroup = ({
  title,
  inputValue,
  onInputChange,
  onApply,
  appliedCodes,
  onRemoveCode,
  suggestions,
  onChooseSuggestion,
  rejectedReason,
}) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    <div className="mt-2 flex gap-2">
      <input
        value={inputValue}
        onChange={onInputChange}
        placeholder={"Nhập mã voucher"}
        className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={onApply}
        className="rounded bg-black px-3 py-2 text-xs text-white hover:bg-slate-800"
      >
        {"Áp dụng"}
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
            {code} {"×"}
          </button>
        ))}
      </div>
    )}

    {suggestions.length > 0 && (
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-600">{"Gợi ý đang hiệu lực"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((voucher) => (
            <button
              key={voucher.code}
              type="button"
              onClick={() => onChooseSuggestion(voucher.code)}
              className="rounded border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs text-orange-700 hover:bg-orange-100"
            >
              {voucher.code} (-{formatPrice(voucher.estimatedDiscount || 0)})
            </button>
          ))}
        </div>
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
    groupedOrderItems,
    shopVoucherInputs,
    setShopVoucherInput,
    platformVoucherInput,
    setPlatformVoucherInput,
    shopVoucherCodesByVendor,
    platformVoucherCodes,
    voucherCodes,
    applyShopVoucherInput,
    applySuggestedShopVoucher,
    applyPlatformVoucherInput,
    applySuggestedPlatformVoucher,
    removeShopVoucherCode,
    removePlatformVoucherCode,
    pricingSummary,
    appliedShopVouchersByVendor,
    appliedPlatformVouchers,
    rejectedShopVouchersByVendor,
    rejectedPlatformVouchers,
    previewLoading,
    shopVoucherSuggestionsByVendor,
    platformVoucherSuggestions,
    voucherSuggestionLoading,
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
    <form onSubmit={onSubmitHandler} className="relative flex min-h-[80vh] flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:pt-14">
      {isSubmitting && (
        <div className="absolute inset-0 z-20 cursor-wait rounded bg-white/60" />
      )}
      <section className="flex w-full flex-col gap-4 sm:max-w-[520px]">
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

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">{"Sản phẩm đã chọn"}</h3>
            {groupedOrderItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{"Không có sản phẩm nào trong đơn hàng."}</p>
            ) : (
              <div className="mt-3 space-y-4">
                {groupedOrderItems.map((vendorGroup) => {
                  const vendorCodes = shopVoucherCodesByVendor[vendorGroup.vendorId] || [];
                  const appliedCount = (appliedShopVouchersByVendor[vendorGroup.vendorId] || []).length;
                  const rejectedReason = rejectedShopVouchersByVendor[vendorGroup.vendorId]?.[0]?.reason;
                  const suggestions = shopVoucherSuggestionsByVendor[vendorGroup.vendorId] || [];

                  return (
                    <div key={vendorGroup.vendorId} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {vendorGroup.vendorShopName || "Cửa hàng"}
                          </p>
                          <p className="text-xs text-slate-500">{"Tạm tính shop"}: {formatPrice(vendorGroup.subtotal)}</p>
                        </div>
                        {appliedCount > 0 && (
                          <span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                            {"Đã áp dụng"} {appliedCount} voucher
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {vendorGroup.items.map((item, index) => (
                          <div key={`${item._id}-${item.size || item.variantKey || index}`} className="flex gap-3">
                            <img
                              src={pickImageUrl(item.image) || assets.placeholder_image}
                              alt={item.name}
                              className="h-16 w-16 rounded border border-slate-200 object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-medium text-slate-800">{item.name}</p>
                              {formatSelectedAttributes(item) ? (
                                <p className="mt-0.5 text-xs text-slate-500">{formatSelectedAttributes(item)}</p>
                              ) : null}
                              <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                                <span>SL: {item.quantity}</span>
                                <span className="font-semibold text-slate-800">
                                  {formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3">
                        <VoucherInputGroup
                          title={"Voucher của shop"}
                          inputValue={shopVoucherInputs[vendorGroup.vendorId] || ""}
                          onInputChange={(event) =>
                            setShopVoucherInput(vendorGroup.vendorId, event.target.value)
                          }
                          onApply={() => applyShopVoucherInput(vendorGroup.vendorId)}
                          appliedCodes={vendorCodes}
                          onRemoveCode={(code) => removeShopVoucherCode(vendorGroup.vendorId, code)}
                          suggestions={suggestions}
                          onChooseSuggestion={(code) => applySuggestedShopVoucher(vendorGroup.vendorId, code)}
                          rejectedReason={rejectedReason}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <CartTotal selectedTotal={selectedTotal > 0 ? selectedTotal : undefined} pricing={pricingSummary} compact />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">{"Voucher của sàn"}</h3>
            <div className="mt-3 space-y-3">
              <VoucherInputGroup
                title={"Voucher sàn và vận chuyển"}
                inputValue={platformVoucherInput}
                onInputChange={(event) => setPlatformVoucherInput(event.target.value)}
                onApply={applyPlatformVoucherInput}
                appliedCodes={platformVoucherCodes}
                onRemoveCode={removePlatformVoucherCode}
                suggestions={platformVoucherSuggestions}
                onChooseSuggestion={applySuggestedPlatformVoucher}
                rejectedReason={rejectedPlatformVouchers[0]?.reason}
              />

              {voucherCodes.length > 0 && (
                <p className="text-xs text-slate-500">
                  {"Tổng voucher đã thêm"}: {voucherCodes.length} | {"Sàn đã áp dụng"}: {appliedPlatformVouchers.length}
                </p>
              )}

              {(previewLoading || voucherSuggestionLoading) && (
                <p className="text-xs text-slate-500">{"Đang cập nhật thông tin voucher..."}</p>
              )}
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
    </form>
  );
};

export default PlaceOrder;
