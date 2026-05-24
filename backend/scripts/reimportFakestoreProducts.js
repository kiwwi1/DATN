/**
 * Gỡ sản phẩm trùng tên (giữ 1 bản / name) → xóa toàn bộ import Fakestore cũ
 * → import lại từ https://fakestoreapiserver.reactbd.org/api/products (mọi trang).
 *
 * Chạy từ thư mục backend: npm run reimport-fakestore
 */

import { reimportFakestoreProducts } from "./importExternalProducts.js";

reimportFakestoreProducts()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
