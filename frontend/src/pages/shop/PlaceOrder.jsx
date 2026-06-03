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
        placeholder={"Nh\u1eadp m\u00e3 voucher"}
        className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={onApply}
        className="rounded bg-black px-3 py-2 text-xs text-white hover:bg-slate-800"
      >
        {"\u00c1p d\u1ee5ng"}
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
            {code} {"\u00d7"}
          </button>
        ))}
      </div>
    )}

    {suggestions.length > 0 && (
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-600">{"G\u1ee3i \u00fd \u0111ang hi\u1ec7u l\u1ef1c"}</p>
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
    <form onSubmit={onSubmitHandler} className="border-t pt-5 sm:pt-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="space-y-4">
          <div className="text-xl sm:text-2xl">
            <Title text1={"TH\u00d4NG TIN "} text2={"GIAO H\u00c0NG"} />
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
            <h3 className="text-sm font-semibold text-slate-800">{"S\u1ea3n ph\u1ea9m \u0111\u00e3 ch\u1ecdn"}</h3>
            {groupedOrderItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{"Kh\u00f4ng c\u00f3 s\u1ea3n ph\u1ea9m n\u00e0o trong \u0111\u01a1n h\u00e0ng."}</p>
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
                            {vendorGroup.vendorShopName || "C\u1eeda h\u00e0ng"}
                          </p>
                          <p className="text-xs text-slate-500">{"T\u1ea1m t\u00ednh shop"}: {formatPrice(vendorGroup.subtotal)}</p>
                        </div>
                        {appliedCount > 0 && (
                          <span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                            {"\u0110\u00e3 \u00e1p d\u1ee5ng"} {appliedCount} voucher
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
                          title={"Voucher c\u1ee7a shop"}
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
            <h3 className="text-sm font-semibold text-slate-800">{"Voucher c\u1ee7a s\u00e0n"}</h3>
            <div className="mt-3 space-y-3">
              <VoucherInputGroup
                title={"Voucher s\u00e0n v\u00e0 v\u1eadn chuy\u1ec3n"}
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
                  {"T\u1ed5ng voucher \u0111\u00e3 th\u00eam"}: {voucherCodes.length} | {"S\u00e0n \u0111\u00e3 \u00e1p d\u1ee5ng"}: {appliedPlatformVouchers.length}
                </p>
              )}

              {(previewLoading || voucherSuggestionLoading) && (
                <p className="text-xs text-slate-500">{"\u0110ang c\u1eadp nh\u1eadt th\u00f4ng tin voucher..."}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Title text1={"PH\u01af\u01a0NG TH\u1ee8C "} text2={"THANH TO\u00c1N"} />
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
                {isSubmitting ? "\u0110ANG X\u1eec L\u00dd..." : "\u0110\u1eb6T H\u00c0NG"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
};

export default PlaceOrder;
