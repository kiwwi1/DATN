# Kế hoạch: Hệ thống Voucher & Giảm giá nhiều lớp

> Tài liệu thiết kế cho tính năng giảm giá 4 lớp (Product Sale → Shop Voucher → Platform Voucher → Shipping Discount) cho đồ án tốt nghiệp.
> Stack thực tế: **Node.js + Express + MongoDB (Mongoose) + React (frontend & admin)**. Marketplace **đa nhà bán** (multi-vendor).

---

## 1. Mục tiêu & phạm vi

Xây dựng cơ chế tính tiền đơn hàng minh bạch theo 4 lớp giảm giá:

```
Tổng giá sale (Product Sale)
  → trừ Shop Voucher   (áp theo từng shop)
  → trừ Platform Voucher (áp trên toàn đơn sau shop voucher)
  + Phí ship
  → trừ Shipping Discount
  = Final Total  (>= 0)
```

**Ràng buộc bắt buộc (giữ đúng nguyên tắc bảo mật đã có trong dự án):**
- Backend **luôn tính lại** giá & giảm giá từ DB. Frontend chỉ gửi `items` + `voucherCodes`, **không gửi số tiền**.
- `finalTotal >= 0`; mỗi khoản giảm không vượt quá số tiền nền của lớp đó.
- Voucher phải qua kiểm tra: tồn tại, `isActive`, trong khoảng `startAt`–`endAt`, chưa hết `usageLimit`, đạt `minOrderValue`.

---

## 2. Hiện trạng codebase (đã có sẵn)

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| Lớp **Product Sale** | ✅ Đã có | `productModel`: `price` (giá sau sale), `originalPrice`, `discount` (%). Không cần thêm. |
| Tính lại giá ở backend | ✅ Đã có | `orderService.js` → `enrichItemsWithVariantKey()` lấy giá thật từ DB, bỏ qua `amount` client gửi. |
| Phí ship | ✅ Đã có | `deliveryFee = 30000`, `FREE_SHIPPING_THRESHOLD` (mặc định 500.000). Hàm `sanitizeOrderAmount()`. |
| Đa nhà bán | ✅ Đã có | `order.vendors[]` mỗi phần tử có `vendorId`, `items[]`, `subtotal`. Hàm `buildVendorsMap()`. |
| Đặt hàng COD / Stripe / VNPay | ✅ Đã có | 3 service `placeOrder*Service` trong `orderService.js`. |
| **Voucher** | ❌ Chưa có | Cần xây mới. |
| **Endpoint preview** | ❌ Chưa có | Cần xây mới. |

> **Hệ quả thiết kế:** Vì là multi-vendor, **Shop Voucher gắn với 1 `vendorId`** và áp trên subtotal của riêng shop đó (`order.vendors[].subtotal`). Platform & Shipping voucher áp trên toàn đơn.

---

## 3. Mô hình dữ liệu (Mongoose)

### 3.1. `models/voucherModel.js` (mới)

```js
import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["SHOP", "PLATFORM", "SHIPPING"], required: true },
    discountType: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discountValue: { type: Number, required: true, min: 0 },

    maxDiscount: { type: Number, default: 0 },     // 0 = không giới hạn (chỉ dùng cho PERCENT)
    minOrderValue: { type: Number, default: 0 },

    // Chỉ dùng khi type === "SHOP": voucher của nhà bán nào
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },

    startAt: { type: Number, required: true },     // epoch ms (đồng bộ với order.date)
    endAt: { type: Number, required: true },

    usageLimit: { type: Number, default: 0 },      // 0 = không giới hạn
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 0 },    // (tuỳ chọn) số lần / user

    isActive: { type: Boolean, default: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

voucherSchema.index({ code: 1 }, { unique: true });
voucherSchema.index({ type: 1, isActive: 1 });
voucherSchema.index({ vendorId: 1 });

const voucherModel = mongoose.models.voucher || mongoose.model("voucher", voucherSchema);
export default voucherModel;
```

### 3.2. Mở rộng `orderModel.js` — lưu vết minh bạch các lớp giảm

Thêm vào `orderSchema` (không phá field cũ; `amount` vẫn là final total để tương thích code hiện tại):

```js
// Bảng kê tính tiền (snapshot tại thời điểm đặt)
pricing: {
  subtotal:          { type: Number, default: 0 }, // tổng sale_price * qty
  shopDiscount:      { type: Number, default: 0 }, // tổng giảm của tất cả shop voucher
  platformDiscount:  { type: Number, default: 0 },
  shippingFee:       { type: Number, default: 0 },
  shippingDiscount:  { type: Number, default: 0 },
  finalTotal:        { type: Number, default: 0 }, // = amount
},
appliedVouchers: [
  {
    code:      { type: String },
    type:      { type: String, enum: ["SHOP", "PLATFORM", "SHIPPING"] },
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: "user" }, // shop voucher
    discount:  { type: Number },
  },
],
```

> `order.amount` tiếp tục = `pricing.finalTotal` để Stripe/VNPay/UI cũ không vỡ.
> Mỗi phần tử `order.vendors[]` có thể thêm `voucherDiscount` để hiển thị giảm theo shop (tuỳ chọn).

---

## 4. Logic tính toán (service)

### 4.1. `services/voucherService.js` (mới) — hàm thuần, dễ unit-test

```js
// Tính số tiền giảm của 1 voucher trên 1 "amount" nền.
export const calcVoucherDiscount = (amount, voucher) => {
  if (!voucher || amount <= 0) return 0;
  if (amount < (voucher.minOrderValue || 0)) return 0;

  let discount = voucher.discountType === "PERCENT"
    ? (amount * voucher.discountValue) / 100
    : voucher.discountValue;

  if (voucher.maxDiscount > 0) discount = Math.min(discount, voucher.maxDiscount);
  return Math.round(Math.min(discount, amount)); // không vượt quá nền
};

// Kiểm tra hiệu lực voucher; trả về voucher hoặc ném lỗi có status.
export const assertVoucherValid = (voucher, code, now = Date.now()) => {
  if (!voucher || !voucher.isActive)
    throw Object.assign(new Error(`Voucher "${code}" không hợp lệ`), { status: 400 });
  if (now < voucher.startAt || now > voucher.endAt)
    throw Object.assign(new Error(`Voucher "${code}" không trong thời gian áp dụng`), { status: 400 });
  if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit)
    throw Object.assign(new Error(`Voucher "${code}" đã hết lượt`), { status: 400 });
  return voucher;
};
```

### 4.2. Hàm tổng `computeOrderPricing()` — trái tim của tính năng

Nhận `normalizedItems` (đã enrich giá thật từ DB qua hàm có sẵn) + danh sách voucher đã validate:

```js
export const computeOrderPricing = ({ items, vouchers, shippingFee }) => {
  // 1. Subtotal toàn đơn + subtotal theo từng shop (vendorId)
  const perShop = new Map();           // vendorId -> subtotal
  let subtotal = 0;
  for (const it of items) {
    const line = it.price * it.quantity;
    subtotal += line;
    const k = String(it.vendorId);
    perShop.set(k, (perShop.get(k) || 0) + line);
  }

  const applied = [];

  // 2. SHOP voucher: áp trên subtotal của đúng shop
  let shopDiscount = 0;
  for (const v of vouchers.filter(v => v.type === "SHOP")) {
    const base = perShop.get(String(v.vendorId)) || 0;
    const d = calcVoucherDiscount(base, v);
    if (d > 0) { shopDiscount += d; applied.push({ code: v.code, type: "SHOP", vendorId: v.vendorId, discount: d }); }
  }

  // 3. PLATFORM voucher: áp trên (subtotal - shopDiscount)
  let platformDiscount = 0;
  const afterShop = Math.max(0, subtotal - shopDiscount);
  for (const v of vouchers.filter(v => v.type === "PLATFORM")) {
    const d = calcVoucherDiscount(afterShop - platformDiscount, v);
    if (d > 0) { platformDiscount += d; applied.push({ code: v.code, type: "PLATFORM", discount: d }); }
  }

  // 4. SHIPPING voucher: áp trên phí ship
  let shippingDiscount = 0;
  for (const v of vouchers.filter(v => v.type === "SHIPPING")) {
    const d = calcVoucherDiscount(shippingFee, v);
    if (d > 0) { shippingDiscount += d; applied.push({ code: v.code, type: "SHIPPING", discount: d }); }
  }
  shippingDiscount = Math.min(shippingDiscount, shippingFee);

  const finalTotal = Math.max(0,
    subtotal - shopDiscount - platformDiscount + shippingFee - shippingDiscount);

  return { subtotal, shopDiscount, platformDiscount, shippingFee, shippingDiscount,
           finalTotal: Math.round(finalTotal), appliedVouchers: applied };
};
```

> **Quyết định thiết kế cần ghi vào báo cáo:** thứ tự áp lớp (shop trước platform) ảnh hưởng số tiền cuối. Ở đây platform tính trên phần đã trừ shop — hợp lý vì sàn không nên gánh phần shop đã giảm.

---

## 5. Tích hợp vào luồng đặt hàng hiện có

Trong `orderService.js`, các hàm `placeOrderService` / `placeOrderStripeService` / `placeOrderVNPayService` hiện gọi:

```js
const { normalizedItems } = await prepareItemsAndReserveStock(items);
const { totalAmount } = sanitizeOrderAmount(normalizedItems);
```

**Thay đổi:** thêm tham số `voucherCodes`, rồi:

1. Load voucher theo `voucherCodes`, `assertVoucherValid` từng cái. Với SHOP voucher: kiểm tra `vendorId` của voucher **thực sự có mặt** trong đơn.
2. Lấy `shippingFee` từ `sanitizeOrderAmount` (giữ logic free-ship).
3. Gọi `computeOrderPricing({ items: normalizedItems, vouchers, shippingFee })`.
4. Lưu `order.amount = pricing.finalTotal`, `order.pricing = pricing`, `order.appliedVouchers`.
5. Sau khi tạo order thành công → `$inc usedCount` cho từng voucher (giống cách `updateProductSold` đã làm).
6. Stripe `line_items`: thêm dòng "Giảm giá" âm hoặc điều chỉnh `unit_amount` để khớp `finalTotal` (Stripe không cho line âm → dùng Coupon API hoặc gộp giảm vào tổng; ghi rõ cách chọn trong báo cáo).

> Nếu hủy đơn (`cancelOrderService`): cân nhắc hoàn `usedCount` (`$inc -1`) cho voucher — thêm vào logic restore đã có.

---

## 6. API

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/order/preview` | `authUser` | Tính trước bảng kê (subtotal, các lớp giảm, finalTotal) — **không tạo order**. |
| POST | `/api/order/place-order` | `authUser` | COD; nhận thêm `voucherCodes`. |
| POST | `/api/order/place-order-stripe` | `authUser` | Stripe; nhận thêm `voucherCodes`. |
| POST | `/api/order/place-order-vnpay` | `authUser` | VNPay; nhận thêm `voucherCodes`. |
| GET/POST/PUT/DELETE | `/api/voucher/...` | `adminAuth`/`vendorAuth` | CRUD voucher (admin tạo PLATFORM/SHIPPING, vendor tạo SHOP của mình). |

**Request body chuẩn (preview & place):**
```json
{
  "items": [{ "_id": "<productId>", "quantity": 2, "variantKey": "Size:M" }],
  "voucherCodes": ["SHOP10", "SALE20", "FREESHIP"],
  "address": { "...": "..." }
}
```

**Response `/preview`:**
```json
{
  "success": true,
  "pricing": {
    "subtotal": 400000, "shopDiscount": 30000, "platformDiscount": 20000,
    "shippingFee": 30000, "shippingDiscount": 25000, "finalTotal": 355000
  },
  "appliedVouchers": [ ... ],
  "rejectedVouchers": [{ "code": "SALE20", "reason": "Chưa đạt đơn tối thiểu 300.000" }]
}
```

> Endpoint `preview` nên trả về **cả voucher bị từ chối + lý do** thay vì ném lỗi, để UI hiển thị thân thiện.

---

## 7. Frontend (tóm tắt)

- **Trang giỏ hàng / thanh toán:** ô nhập mã + nút "Áp dụng" → gọi `/order/preview` (debounce). Hiển thị bảng kê 4 lớp giống Shopee.
- Gửi `voucherCodes` khi bấm đặt hàng; **hiển thị `finalTotal` do backend trả**, không tự cộng ở client.
- **Admin (`admin/`):** trang quản lý voucher (list/add/toggle). Vendor chỉ thấy & tạo voucher SHOP của mình.

---

## 8. Test & kiểm chứng (cho phần "đánh giá" của đồ án)

`backend/services/tests/` đã tồn tại → viết unit test cho:
- `calcVoucherDiscount`: PERCENT có/không `maxDiscount`, FIXED, dưới `minOrderValue`, giảm > amount.
- `computeOrderPricing`: tái hiện **đúng ví dụ trong đề** (subtotal 400k → finalTotal **355.000**) làm test mẫu.
- Edge: finalTotal không âm; shop voucher của shop không có trong đơn bị bỏ; voucher hết hạn/hết lượt.

---

## 9. Thứ tự triển khai (checklist)

1. [ ] `models/voucherModel.js` + mở rộng `orderModel.js` (`pricing`, `appliedVouchers`).
2. [ ] `services/voucherService.js`: `calcVoucherDiscount`, `assertVoucherValid`, `computeOrderPricing`, `loadAndValidateVouchers`.
3. [ ] Unit test cho voucherService (gồm test ví dụ mẫu 355.000).
4. [ ] Sửa 3 hàm `placeOrder*Service` nhận `voucherCodes`, ghi `pricing`, `$inc usedCount`.
5. [ ] `orderController` + `orderRoute`: thêm `previewOrder` + `/preview`; truyền `voucherCodes` vào các hàm place.
6. [ ] `voucherController` + `voucherRoute`: CRUD (admin + vendor).
7. [ ] Frontend: ô nhập mã + bảng kê + gọi `/preview`.
8. [ ] Admin: trang quản lý voucher.
9. [ ] Xử lý hoàn `usedCount` khi hủy đơn (`cancelOrderService`).
10. [ ] Seed vài voucher mẫu (SHOP10, SALE20, FREESHIP) để demo.

---

## 10. Rủi ro & lưu ý

- **Stripe không cho line item âm** → chọn 1 trong: (a) dùng Stripe Coupon, (b) gộp tổng giảm rồi truyền `unit_amount` đã điều chỉnh. Ghi rõ lựa chọn vào báo cáo.
- **Đồng thời (race) trên `usedCount`** → dùng update có điều kiện `{ usedCount: { $lt: usageLimit } }` + `$inc`, giống pattern reserve stock đã có trong `reserveStockByUnits`.
- **Đơn vị tiền là VND (số nguyên)** → luôn `Math.round`, tránh số thập phân.
- Mọi giá trị tiền hiển thị ở client chỉ để xem; nguồn sự thật là `order.pricing` ở backend.
```