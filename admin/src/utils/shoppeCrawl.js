const SHOPEE_ITEM_API =
  "https://shopee.vn/api/v4/item/get?itemid={ITEM_ID}&shopid={SHOP_ID}";

const SHOPEE_IMAGE_PREFIX = "https://cf.shopee.vn/file/";

const parseShopeeUrl = (productUrl) => {
  if (!productUrl) return null;
  // Shopee product URLs end with ...-i.<shopId>.<itemId>
  const match = productUrl.match(/-i\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { shopId: match[1], itemId: match[2] };
};

const buildImageUrl = (imageId) =>
  imageId?.startsWith("http") ? imageId : `${SHOPEE_IMAGE_PREFIX}${imageId}`;

/**
 * Tự crawl dữ liệu sản phẩm Shopee (tên + danh sách ảnh) không qua dịch vụ ngoài.
 * Chạy tốt nhất ở môi trường backend để tránh CORS trên trình duyệt.
 *
 * @param {string} productUrl URL sản phẩm Shopee (vd: https://shopee.vn/ao-thun-nam-i.12345678.87654321)
 * @returns {Promise<{ name: string, images: string[] }>}
 */
export async function crawlShopeeProduct(productUrl) {
  const ids = parseShopeeUrl(productUrl);
  if (!ids) {
    throw new Error("Không lấy được shopId/itemId từ URL Shopee");
  }

  const endpoint = SHOPEE_ITEM_API.replace("{ITEM_ID}", ids.itemId).replace(
    "{SHOP_ID}",
    ids.shopId
  );

  const res = await fetch(endpoint, {
    headers: {
      // Giả lập user-agent thật để hạn chế bị chặn
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Shopee API trả về lỗi ${res.status}: ${res.statusText} ${text}`.trim()
    );
  }

  const data = await res.json();
  const item = data?.data;
  if (!item) {
    throw new Error("Không tìm thấy dữ liệu sản phẩm trong phản hồi Shopee");
  }

  const images =
    item.images?.map((img) => buildImageUrl(img)).filter(Boolean) || [];

  return {
    name: item.name || "",
    images,
  };
}

export default crawlShopeeProduct;
