# Kế hoạch tính năng "Mua ngay" cho từng sản phẩm

## 1. Mục tiêu

Cho phép người dùng đặt mua **một sản phẩm duy nhất** ngay tại trang chi tiết sản phẩm
(`Product.jsx`) mà không cần thông qua giỏ hàng. Bấm "Mua ngay" sẽ đưa thẳng người dùng
tới trang thanh toán (`/place-order`) với đúng sản phẩm + thuộc tính (size/màu...) +
số lượng họ đang chọn.

## 2. Hiện trạng luồng đặt hàng (đã khảo sát)

Luồng checkout hiện tại đã có sẵn cơ chế "đặt theo lựa chọn", ta sẽ tái sử dụng:

- [frontend/src/pages/shop/Cart.jsx](../frontend/src/pages/shop/Cart.jsx#L302-L312):
  khi bấm "Thanh toán", trang lưu mảng item đã chọn vào
  `sessionStorage["selectedCartItems"]` rồi `navigate("/place-order")`.
  Format mỗi phần tử: `{ _id, size, quantity }` (trong đó `size` là `optionKey`,
  ví dụ `"Size: M, Color: Red"` hoặc giá trị mặc định khi không có thuộc tính).
- [frontend/src/hooks/usePlaceOrderCheckout.js](../frontend/src/hooks/usePlaceOrderCheckout.js#L70-L83):
  đọc `selectedCartItems` từ sessionStorage để tính `selectedTotal`.
- [usePlaceOrderCheckout.js:244-248](../frontend/src/hooks/usePlaceOrderCheckout.js#L244-L248):
  khi submit, nếu có `selectedCartItems` thì dùng `buildOrderItemsFromSelection`,
  ngược lại dùng toàn bộ giỏ hàng.
- [frontend/src/utils/checkoutOrderUtils.js](../frontend/src/utils/checkoutOrderUtils.js#L48-L61):
  `buildOrderItemsFromSelection` tra cứu sản phẩm trong mảng `products` **toàn cục**
  (context), KHÔNG phụ thuộc vào việc item có nằm trong giỏ hàng hay không.

➡️ **Kết luận quan trọng:** "Mua ngay" chỉ cần ghi `selectedCartItems` với đúng 1 phần tử
rồi điều hướng sang `/place-order`. **Không cần** gọi API thêm vào giỏ, không cần đụng
tới backend. Đây là thay đổi gọn, rủi ro thấp.

Logic validate đã có sẵn ở nút "THÊM VÀO GIỎ HÀNG"
([Product.jsx:496-536](../frontend/src/pages/main/Product.jsx#L496-L536)): kiểm tra đăng nhập,
bắt buộc chọn đủ thuộc tính/size, chặn khi hết hàng, dựng `attributeString` từ
`selectedAttributes`. Nút "Mua ngay" sẽ dùng lại đúng logic này.

## 3. Phạm vi thay đổi

Chỉ ở **frontend**. Không thay đổi backend, model, route.

| File | Thay đổi |
|------|----------|
| [frontend/src/pages/main/Product.jsx](../frontend/src/pages/main/Product.jsx) | Thêm hàm `handleBuyNow` + nút "MUA NGAY" cạnh nút thêm vào giỏ. (Bắt buộc) |
| [frontend/src/components/product/ProductItem.jsx](../frontend/src/components/product/ProductItem.jsx) | (Tùy chọn) Thêm nút "Mua ngay" nhanh trên card sản phẩm ở danh sách. |

## 4. Thiết kế chi tiết

### 4.1. Tách logic chọn sản phẩm dùng chung

Trong `Product.jsx`, hiện phần tính `selectedVariant`, `allAttrsSelected`, `isOutOfStock`,
`attributeString` đang nằm trong IIFE của nút thêm vào giỏ. Tách thành một helper để cả
2 nút (Thêm vào giỏ + Mua ngay) dùng chung, tránh lặp:

```js
// Trả về { ok, optionKey, message } — optionKey chính là "size" để lưu selectedCartItems
const resolveSelection = () => {
  const hasSkuVariants = Array.isArray(productData.variants) && productData.variants.length > 0;
  const hasAttributes = Array.isArray(productData.attributes) && productData.attributes.length > 0;
  const allAttrsSelected = hasAttributes && productData.attributes.every(a => selectedAttributes[a.name]);
  const hasLegacySizes = !hasAttributes && Array.isArray(productData.sizes) && productData.sizes.length > 0;
  const selectedVariant = hasSkuVariants && allAttrsSelected
    ? productData.variants.find(v => productData.attributes.every(a => (v.combination || {})[a.name] === selectedAttributes[a.name]))
    : null;
  const isOutOfStock = selectedVariant ? selectedVariant.stock === 0 : (!hasSkuVariants && productData.stock === 0);

  if (hasSkuVariants && hasAttributes) {
    if (!allAttrsSelected) return { ok: false, message: `Vui lòng chọn ${productData.attributes.map(a => a.name).join(', ')}` };
    if (isOutOfStock) return { ok: false, message: "Biến thể này đã hết hàng" };
    const optionKey = Object.entries(selectedAttributes).map(([k, v]) => `${k}: ${v}`).join(', ');
    return { ok: true, optionKey };
  }
  if (hasLegacySizes && !size) return { ok: false, message: "Vui lòng chọn kích thước sản phẩm!" };
  if (isOutOfStock) return { ok: false, message: "Sản phẩm đã hết hàng" };
  return { ok: true, optionKey: size || normalizeCartOptionKey("") };
};
```

> Lưu ý: `normalizeCartOptionKey` đã được import sẵn trong `Product.jsx`.

### 4.2. Hàm `handleBuyNow`

```js
const handleBuyNow = () => {
  if (!token) {
    toast.info("Vui lòng đăng nhập để mua hàng.");
    navigate("/login");
    return;
  }
  const sel = resolveSelection();
  if (!sel.ok) {
    toast.error(sel.message);
    return;
  }
  const buyNowItem = [{ _id: productData._id, size: sel.optionKey, quantity: 1 }];
  sessionStorage.setItem("selectedCartItems", JSON.stringify(buyNowItem));
  navigate("/place-order");
};
```

Hành vi:
- Bỏ qua giỏ hàng hoàn toàn (không gọi API `cart/add`).
- Ghi đè `selectedCartItems` → trang `/place-order` tự tính tổng và dựng order item.
- `quantity` cố định = 1 ở bản đầu. (Mở rộng: xem mục 6.)

### 4.3. Nút trên giao diện

Đặt nút "MUA NGAY" ngay phía trên/cạnh nút "THÊM VÀO GIỎ HÀNG" trong khối
[Product.jsx:494-536](../frontend/src/pages/main/Product.jsx#L494-L536). Gợi ý style theo
hệ màu cam hiện có (nút mua ngay nhấn mạnh hơn — nền cam đậm, viền; nút giỏ hàng outline):

```jsx
<div className="flex flex-col sm:flex-row gap-3">
  <button
    onClick={handleBuyNow}
    disabled={isOutOfStock}
    className={`w-full sm:flex-1 px-12 py-4 text-base font-semibold rounded-lg active:scale-95 transition-all shadow-lg ${
      isOutOfStock ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
    }`}
  >
    {isOutOfStock ? 'HẾT HÀNG' : 'MUA NGAY'}
  </button>
  <button onClick={/* logic addToCart hiện tại */} disabled={isOutOfStock}
    className="... (giữ nguyên, đổi sang outline cam) ...">
    THÊM VÀO GIỎ HÀNG
  </button>
</div>
```

## 5. Các bước triển khai (theo thứ tự)

1. Trong `Product.jsx`, đưa biến `isOutOfStock` (và `resolveSelection`) ra ngoài IIFE để
   tái sử dụng cho cả 2 nút.
2. Thêm hàm `handleBuyNow` (mục 4.2).
3. Refactor onClick của nút "THÊM VÀO GIỎ HÀNG" để gọi `resolveSelection()` thay vì lặp
   logic (giữ nguyên hành vi).
4. Thêm nút "MUA NGAY" (mục 4.3).
5. (Tùy chọn) Thêm nút Mua ngay trên `ProductItem.jsx` — cần truyền/đọc `optionKey` mặc
   định; với sản phẩm có thuộc tính bắt buộc thì điều hướng về trang chi tiết thay vì mua
   thẳng.

## 6. Mở rộng tương lai (không bắt buộc cho bản đầu)

- **Chọn số lượng**: thêm input số lượng trên trang sản phẩm, truyền vào `buyNowItem.quantity`.
- **Kiểm tra tồn kho realtime**: gọi `GET /api/product/single` trước khi điều hướng để tránh
  mua sản phẩm vừa hết hàng (backend đã có chống oversell + idempotency, xem
  [concurrent-purchase-stock-plan-vi.md](concurrent-purchase-stock-plan-vi.md)).
- **Nút Mua ngay ở card danh sách** và trang `VendorShop`.

## 7. Kiểm thử (checklist thủ công)

- [ ] Sản phẩm KHÔNG có thuộc tính: bấm Mua ngay → tới `/place-order`, hiện đúng 1 sản phẩm,
      tổng tiền đúng (giá × 1 + phí ship theo ngưỡng 500.000₫).
- [ ] Sản phẩm CÓ thuộc tính nhưng chưa chọn đủ: bấm Mua ngay → toast yêu cầu chọn thuộc tính,
      KHÔNG điều hướng.
- [ ] Sản phẩm hết hàng / biến thể hết hàng: nút bị disable hoặc chặn bằng toast.
- [ ] Chưa đăng nhập: bấm Mua ngay → chuyển tới `/login`.
- [ ] Đặt hàng COD thành công từ Mua ngay → về `/orders`, `selectedCartItems` được xóa
      ([usePlaceOrderCheckout.js:189](../frontend/src/hooks/usePlaceOrderCheckout.js#L189)).
- [ ] Mua ngay KHÔNG làm thay đổi số lượng trong giỏ hàng hiện có.
- [ ] Thanh toán Stripe/VNPay từ Mua ngay điều hướng đúng sang trang cổng thanh toán.

## 8. Rủi ro & lưu ý

- `selectedCartItems` là **chung** cho cả luồng giỏ hàng và Mua ngay. Vì Mua ngay luôn ghi
  đè trước khi điều hướng nên không xung đột; tuy nhiên cần đảm bảo nó được xóa sau khi đặt
  hàng (đã có sẵn trong hook).
- Vì order item được dựng từ mảng `products` toàn cục, sản phẩm phải đã nằm trong `products`
  của context (luôn đúng vì đang ở trang chi tiết của chính nó).
- Giữ nguyên giá trị `optionKey` đúng định dạng để `buildOrderItemsFromSelection` ánh xạ
  `selectedAttributes` chuẩn (xem `applyOptionToOrderItem`).
