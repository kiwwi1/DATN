import React from "react";

const PaymentMethodSelector = ({ method, setMethod, isSubmitting, assets }) => (
  <div className="flex flex-col gap-3 lg-flex-row">
    <div
      onClick={() => !isSubmitting && setMethod("stripe")}
      className={`flex items-center gap-3 border p-2 px-3 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <p className={`min-h-3.5 min-w-3.5 rounded-full border ${method === "stripe" ? "bg-green-400" : ""}`} />
      <img className="mx-4 h-5" src={assets.stripe_logo} />
    </div>
    <div
      onClick={() => !isSubmitting && setMethod("vnpay")}
      className={`flex items-center gap-3 border p-2 px-3 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <p className={`min-h-3.5 min-w-3.5 rounded-full border ${method === "vnpay" ? "bg-green-400" : ""}`} />
      <span className="mx-4 text-sm font-bold tracking-wide text-[#005BAA]">VNPay</span>
    </div>
    <div
      onClick={() => !isSubmitting && setMethod("cod")}
      className={`flex items-center gap-3 border p-2 px-3 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <p className={`min-h-3.5 min-w-3.5 rounded-full border ${method === "cod" ? "bg-green-400" : ""}`} />
      <p className="mx-4 text-sm font-medium text-gray-500">{"THANH TOÁN KHI NHẬN HÀNG"}</p>
    </div>
  </div>
);

export default PaymentMethodSelector;
