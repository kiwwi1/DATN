import React, { useMemo, useState } from "react";
import { assets } from "../../assets/assets";
import { formatImageUrl } from "../../utils/imageUtils";

const itemKey = (item) => `${item.productId}__${item.optionKey}`;

const formatAttributes = (item) => {
  if (Array.isArray(item.selectedAttributes) && item.selectedAttributes.length > 0) {
    return item.selectedAttributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(", ");
  }
  return "";
};

const OutOfStockModal = ({ items, onConfirm, onClose }) => {
  const defaultChoices = useMemo(() => {
    const choices = {};
    for (const item of items) {
      choices[itemKey(item)] = item.available > 0 ? "adjust" : "remove";
    }
    return choices;
  }, [items]);

  const [choices, setChoices] = useState(defaultChoices);

  const setChoice = (item, action) => {
    setChoices((previous) => ({ ...previous, [itemKey(item)]: action }));
  };

  const handleConfirm = () => {
    const resolutions = items.map((item) => ({
      productId: item.productId,
      optionKey: item.optionKey,
      available: item.available,
      action: choices[itemKey(item)] || "remove",
    }));
    onConfirm(resolutions);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-800">{"Sản phẩm không đủ hàng"}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {"Tồn kho vừa thay đổi trong lúc bạn đặt hàng. Vui lòng điều chỉnh để tiếp tục."}
        </p>

        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
          {items.map((item) => {
            const key = itemKey(item);
            const choice = choices[key] || "remove";
            const attributes = formatAttributes(item);

            return (
              <div key={key} className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                <div className="flex gap-3">
                  <img
                    src={formatImageUrl(item.image, { variant: "thumb" }) || assets.placeholder_image}
                    alt={item.name}
                    className="h-14 w-14 rounded border border-slate-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-slate-800">{item.name}</p>
                    {attributes ? <p className="mt-0.5 text-xs text-slate-500">{attributes}</p> : null}
                    <p className="mt-1 text-xs text-slate-600">
                      {"Bạn đặt"}: {item.requested} {" — "}
                      <span className="font-semibold text-red-600">
                        {item.available > 0 ? `Chỉ còn ${item.available}` : "Đã hết hàng"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {item.available > 0 && (
                    <label
                      className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs ${
                        choice === "adjust"
                          ? "border-orange-400 bg-orange-50 text-orange-700"
                          : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`resolution-${key}`}
                        checked={choice === "adjust"}
                        onChange={() => setChoice(item, "adjust")}
                        className="h-3.5 w-3.5 accent-orange-500"
                      />
                      {"Giảm về"} {item.available} {"sản phẩm"}
                    </label>
                  )}
                  <label
                    className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs ${
                      choice === "remove"
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`resolution-${key}`}
                      checked={choice === "remove"}
                      onChange={() => setChoice(item, "remove")}
                      className="h-3.5 w-3.5 accent-orange-500"
                    />
                    {"Xóa khỏi đơn"}
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {"Đóng"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded bg-black px-4 py-2.5 text-sm text-white hover:bg-slate-800"
          >
            {"Cập nhật đơn hàng"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutOfStockModal;
