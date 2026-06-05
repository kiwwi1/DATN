import React, { useContext } from "react";
import { ShopContext } from "../../context/ShopContext";
import { formatPrice } from "../../utils/priceFormat";

const CartTotal = ({ selectedTotal, pricing, compact = false }) => {
  const { delivery_fee, getCartAmount } = useContext(ShopContext);

  const hasPricing = pricing && typeof pricing.finalTotal === "number";

  const subtotal = hasPricing
    ? Number(pricing.subtotal || 0)
    : selectedTotal !== undefined
      ? selectedTotal
      : getCartAmount();

  const shopDiscount = hasPricing ? Number(pricing.shopDiscount || 0) : 0;
  const platformDiscount = hasPricing ? Number(pricing.platformDiscount || 0) : 0;
  const shippingFee = hasPricing
    ? Number(pricing.shippingFee || 0)
    : subtotal === 0
      ? 0
      : subtotal >= 500000
        ? 0
        : delivery_fee;
  const shippingDiscount = hasPricing ? Number(pricing.shippingDiscount || 0) : 0;

  const total = hasPricing ? Number(pricing.finalTotal || 0) : subtotal + shippingFee;

  const rowClass = compact
    ? "flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
    : "flex items-center justify-between rounded-md border border-slate-100 px-3 py-2";

  return (
    <section className="w-full">
      <h2 className="mb-4 border-b border-slate-200 pb-3 text-lg font-semibold text-slate-800">
        {"Tổng đơn hàng"}
      </h2>

      <div className="space-y-2.5">
        <div className={rowClass}>
          <span className="text-sm text-slate-600">{"Tạm tính"}</span>
          <span className="text-sm font-semibold text-slate-800">{formatPrice(subtotal)}</span>
        </div>

        {shopDiscount > 0 && (
          <div className={rowClass}>
            <span className="text-sm text-slate-600">{"Giảm giá shop"}</span>
            <span className="text-sm font-semibold text-emerald-600">- {formatPrice(shopDiscount)}</span>
          </div>
        )}

        {platformDiscount > 0 && (
          <div className={rowClass}>
            <span className="text-sm text-slate-600">{"Giảm giá sàn"}</span>
            <span className="text-sm font-semibold text-emerald-600">- {formatPrice(platformDiscount)}</span>
          </div>
        )}

        <div className={rowClass}>
          <span className="text-sm text-slate-600">{"Phí vận chuyển"}</span>
          <span className="text-sm font-semibold text-slate-800">
            {shippingFee === 0 ? <span className="text-emerald-600">{"Miễn phí"}</span> : formatPrice(shippingFee)}
          </span>
        </div>

        {shippingDiscount > 0 && (
          <div className={rowClass}>
            <span className="text-sm text-slate-600">{"Giảm phí vận chuyển"}</span>
            <span className="text-sm font-semibold text-emerald-600">- {formatPrice(shippingDiscount)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-orange-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{"Tổng cộng"}</span>
          <span className="text-xl font-bold text-orange-600">{formatPrice(total)}</span>
        </div>
      </div>
    </section>
  );
};

export default CartTotal;
