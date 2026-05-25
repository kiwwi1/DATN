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
          <CartTotal selectedTotal={selectedTotal > 0 ? selectedTotal : undefined} />
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
