import React, { useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { ShopContext } from "../../context/ShopContext";
import { useState } from "react";
import axios from "axios";
import RelatedProducts from "../../components/product/RelatedProducts";
import ProductReviewsSection from "../../components/product/ProductReviewsSection";
import { formatPrice } from "../../utils/priceFormat";
import { toast } from "react-toastify";
import { formatImageUrl, asImageArray } from "../../utils/imageUtils";
import { localizeProductName } from "../../utils/productNameUtils";
import { normalizeCartOptionKey } from "../../constants/cartOption";
import { useProductReviews } from "../../hooks/product/useProductReviews";
import { useProductEngagement } from "../../hooks/product/useProductEngagement";

const unwrapProxyImageUrl = (value) => {
  if (!value || typeof value !== "string") return value;
  if (!value.includes("/api/image-proxy")) return value;

  try {
    const parsed = new URL(value, window.location.origin);
    const original = parsed.searchParams.get("url");
    if (!original) return value;
    return decodeURIComponent(original);
  } catch {
    return value;
  }
};

const normalizeFirstImageLikeSecond = (imageInput) => {
  const images = asImageArray(imageInput);
  if (images.length < 2) return images;

  const first = images[0];
  const second = images[1];

  if (typeof first === "string" && first.trim() && typeof second === "object" && second !== null) {
    const source = unwrapProxyImageUrl(first.trim());
    return [
      {
        ...second,
        main: source,
        thumb: source,
        original: source,
      },
      ...images.slice(1),
    ];
  }

  return images;
};

const Product = () => {
  const getCategoryId = (categoryLike) =>
    typeof categoryLike === "object" ? categoryLike?._id : categoryLike;

  const { productId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { products, addToCart, backendUrl, token, userId, trackInteraction, cartItems, homepageCategories } = useContext(ShopContext);
  const [productData, setProductData] = useState(false);
  const [image, setImage] = useState("");
  const [size, setSize] = useState(""); // Deprecated: for backward compatibility with old products
  const [selectedAttributes, setSelectedAttributes] = useState({}); // New: {Size: "M", Color: "Red"}

  // orderId từ URL (khi điều hướng từ trang đơn hàng)
  const urlParams = new URLSearchParams(location.search);
  const orderIdFromUrl = urlParams.get("orderId") || null;

  // Review state — mở tab reviews nếu URL có ?tab=reviews
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") === "reviews" ? "reviews" : "description";
  });
  const productImages = useMemo(
    () => normalizeFirstImageLikeSecond(productData?.image),
    [productData?.image]
  );
  const displayName = productData ? localizeProductName(productData.name) : "";
  const breadcrumbSegments = useMemo(() => {
    if (!productData) return [];

    const categories = homepageCategories?.categories || [];
    const categoriesById = new Map(categories.map((cat) => [String(cat._id), cat]));
    const productCategoryId = getCategoryId(productData.subSubCategory) || getCategoryId(productData.subCategory) || getCategoryId(productData.category);

    const categoryTrail = [];
    if (productCategoryId && categoriesById.size > 0) {
      let cursor = categoriesById.get(String(productCategoryId));
      while (cursor) {
        categoryTrail.unshift(cursor);
        const parentId =
          typeof cursor.parentCategory === "object"
            ? cursor.parentCategory?._id
            : cursor.parentCategory;
        if (!parentId) break;
        cursor = categoriesById.get(String(parentId));
      }
    } else if (typeof productData.category === "object" && productData.category?.name) {
      categoryTrail.push({
        _id: productData.category?._id || "",
        name: productData.category.name,
      });
    }

    return categoryTrail
      .filter((cat) => cat?.name)
      .map((cat) => ({
        label: cat.name,
        to: cat?._id ? `/collection?category=${cat._id}` : "/collection",
      }));
  }, [productData, homepageCategories]);

  const vendorStats = useMemo(() => {
    if (!productData) return null;
    const vendorId = productData.vendorId?.toString?.() || productData.vendorId;
    const shopName = productData.vendorShopName || "";
    const vendorProducts = products.filter((p) => {
      const pid = p.vendorId?.toString?.() || p.vendorId;
      if (vendorId && pid) return String(pid) === String(vendorId);
      if (shopName) return String(p.vendorShopName || "").toLowerCase() === String(shopName).toLowerCase();
      return false;
    });
    const productCount = vendorProducts.length;
    const sold = vendorProducts.reduce((s, p) => s + (Number(p.sold) || 0), 0);
    return { productCount, sold };
  }, [productData, products]);

  const isInCart = useMemo(() => {
    const row = cartItems?.[productId];
    if (!row || typeof row !== "object") return false;
    return Object.values(row).some((qty) => Number(qty) > 0);
  }, [cartItems, productId]);
  const fetchProductData = useCallback(() => {
    products.map((item) => {
      if (item._id == productId) {
        const normalizedImages = normalizeFirstImageLikeSecond(item.image);
        setProductData({ ...item, image: normalizedImages });
        setImage(
          formatImageUrl(normalizedImages[0] || "", {
            variant: "main",
            width: 1200,
            fit: "contain",
            quality: 84,
            format: "webp",
          })
        );
        setSize("");
        setSelectedAttributes({});
        return null;
      }
    });
  }, [productId, products]);

  const refetchProduct = useCallback(async () => {
    if (!productId) return;
    try {
      const response = await axios.get(`${backendUrl}/api/product/single`, { params: { productId } });
      if (response.data.success && response.data.product) {
        setProductData(response.data.product);
      }
    } catch (error) {
      console.error("refetchProduct:", error);
    }
  }, [backendUrl, productId]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [productId]);

  const {
    reviews,
    loadingReviews,
    submittingReview,
    formRating,
    setFormRating,
    formComment,
    setFormComment,
    editingReviewId,
    hasPurchased,
    filterStar,
    setFilterStar,
    reviewPage,
    setReviewPage,
    reviewTotalPages,
    reviewTotal,
    starCounts,
    fetchReviews,
    myReview,
    newImages,
    previewUrls,
    keepImages,
    handleSubmitReview,
    handleImageChange,
    removeNewImage,
    removeKeepImage,
    handleEditReview,
    handleCancelEdit,
    handleDeleteReview,
  } = useProductReviews({
    backendUrl,
    productId,
    token,
    userId,
    orderIdFromUrl,
    onProductRefresh: refetchProduct,
  });

  const {
    vendorFollowerCount,
    priceAlertEnabled,
    priceAlertLoading,
    handleTogglePriceAlert,
    handleStartChat,
  } = useProductEngagement({
    backendUrl,
    token,
    productId,
    productData,
    navigate,
    trackInteraction,
    isInCart,
  });
  return productData ? (
    // neu productData ton tai thi render ra
    <div className="border-t-2 pt-10 transition-opacity ease-in duration-500 opacity-100">
      {/* Breadcrumb */}
      <div className="bg-gray-100 rounded px-4 py-3 mb-4 text-sm text-gray-700 overflow-x-auto">
        <div className="whitespace-nowrap">
          <Link to="/" className="text-blue-600 hover:underline">
            Trang chủ
          </Link>
          {breadcrumbSegments.map((item) => (
            <React.Fragment key={item.to}>
              <span className="mx-2 text-gray-400">›</span>
              <Link to={item.to} className="text-blue-600 hover:underline">
                {item.label}
              </Link>
            </React.Fragment>
          ))}
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-800">{displayName}</span>
        </div>
      </div>

      {/* ------------product data---------------- */}
      <div className="flex gap-12 sm:gap-12 flex-col sm:flex-row">
        {/* ------------product image--------------- */}
        <div className="flex-1 flex flex-col-reverse sm:flex-row gap-3">
          <div className="flex sm:flex-col overflow-x-auto sm:overflow-y-scroll justify-between gap-3 w-full sm:justify-normal sm:w-[18.7%]">
            {productImages.map((item, index) => (
              <img
                key={index}
                onClick={() =>
                  setImage(
                    formatImageUrl(item, {
                      variant: "main",
                      width: 1200,
                      fit: "contain",
                      quality: 84,
                      format: "webp",
                    })
                  )
                }
                className={`w-[24%] sm:w-full aspect-square object-cover cursor-pointer sm:mb-3 flex-shrink-0 rounded border border-gray-100`}
                src={formatImageUrl(item, {
                  variant: "thumb",
                  width: 240,
                  height: 240,
                  fit: "cover",
                  quality: 76,
                  format: "webp",
                })}
                alt={productData.name}
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
          <div className="w-full sm:w-[80%]">
            <img className="w-full max-w-[760px] mx-auto h-auto object-contain" src={image} alt={displayName} referrerPolicy="no-referrer" />
          </div>
        </div>
        {/* ------product info------------ */}
        <div className="flex-1">
          <h1 className="font-medium text-2xl mt-2">{displayName}</h1>
          
          {/* Brand and Shop Info */}
          <div className="flex items-center gap-3 mt-3">
            {productData.brand && (
              <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium">
                {productData.brand}
              </span>
            )}
            {productData.vendorShopName && (
              <span className="text-sm text-gray-600">
                Bán bởi: <span className="font-medium">{productData.vendorShopName}</span>
              </span>
            )}
          </div>

          {/* Rating and Sold */}
          <div className="flex items-center gap-4 mt-3 pb-3 border-b">
            {productData.rating && (
              <div className="flex items-center gap-1">
                <div className="flex items-center">
                  {[...Array(5)].map((_, index) => (
                    <svg
                      key={index}
                      className={`w-4 h-4 ${
                        index < Math.floor(productData.rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300 fill-current'
                      }`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {Number(productData.rating).toFixed(1)}
                </span>
                {productData.reviewCount > 0 && (
                  <span className="text-sm text-gray-500">
                    ({productData.reviewCount} đánh giá)
                  </span>
                )}
              </div>
            )}
            {productData.sold > 0 && (
              <span className="text-sm text-gray-600">
                Đã bán: <span className="font-medium">{productData.sold >= 1000 ? `${(productData.sold/1000).toFixed(1)}k` : productData.sold}</span>
              </span>
            )}
          </div>

          {/* Price Section */}
          {(() => {
            // Find the matching SKU variant based on current selection
            const hasSkuVariants = Array.isArray(productData.variants) && productData.variants.length > 0;
            const hasAttributes = Array.isArray(productData.attributes) && productData.attributes.length > 0;
            const allAttrsSelected = hasAttributes && productData.attributes.every(a => selectedAttributes[a.name]);
            const selectedVariant = hasSkuVariants && allAttrsSelected
              ? productData.variants.find(v => {
                  const combo = v.combination || {};
                  return productData.attributes.every(a => combo[a.name] === selectedAttributes[a.name]);
                })
              : null;

            const displayPrice = selectedVariant ? selectedVariant.price : productData.price;
            const displayStock = selectedVariant ? selectedVariant.stock : productData.stock;

            return (
              <>
                <div className="mt-5 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-baseline gap-3">
                    <p className="text-3xl font-bold text-orange-600">
                      {formatPrice(displayPrice)}
                    </p>
                    {!selectedVariant && hasSkuVariants && (
                      <span className="text-sm text-gray-400">Từ</span>
                    )}
                    {productData.discount > 0 && productData.originalPrice && !selectedVariant && (
                      <>
                        <p className="text-xl text-gray-400 line-through">
                          {formatPrice(productData.originalPrice)}
                        </p>
                        <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded">
                          -{productData.discount}%
                        </span>
                      </>
                    )}
                  </div>
                  {productData.discount > 0 && !selectedVariant && (
                    <p className="text-sm text-green-600 mt-2">
                      Tiết kiệm {formatPrice(productData.originalPrice - productData.price)}
                    </p>
                  )}
                </div>

                {/* Stock Info */}
                <div className="mt-4 flex items-center gap-2 text-sm">
                  {displayStock > 0 ? (
                    <>
                      <span className="text-green-600 font-medium">✓ Còn hàng</span>
                      <span className="text-gray-500">({displayStock} sản phẩm)</span>
                    </>
                  ) : (
                    selectedVariant
                      ? <span className="text-red-500 font-medium">Hết hàng</span>
                      : hasSkuVariants && allAttrsSelected
                        ? <span className="text-red-500 font-medium">Hết hàng</span>
                        : displayStock === 0 && !hasSkuVariants
                          ? <span className="text-red-500 font-medium">Hết hàng</span>
                          : null
                  )}
                </div>
              </>
            );
          })()}



          {/* Product Attributes */}
          {productData.attributes && productData.attributes.length > 0 && (
            <div className="flex flex-col gap-4 my-6">
              {productData.attributes.map((attr, attrIndex) => (
                <div key={attrIndex}>
                  <p className="font-medium mb-2">
                    {attr.name}:
                    {selectedAttributes[attr.name] && (
                      <span className="ml-2 text-orange-600 font-semibold">
                        {selectedAttributes[attr.name]}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {attr.values.map((value, valueIndex) => (
                      <button
                        onClick={() => setSelectedAttributes({
                          ...selectedAttributes,
                          [attr.name]: value
                        })}
                        className={`border-2 py-2 px-4 rounded-lg transition-all ${
                          selectedAttributes[attr.name] === value
                            ? "border-orange-500 bg-orange-50 text-orange-600 font-medium" 
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                        key={valueIndex}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fallback to old sizes if attributes don't exist */}
          {(!productData.attributes || productData.attributes.length === 0) && productData.sizes && productData.sizes.length > 0 && (
            <div className="flex flex-col gap-4 my-6">
              <p className="font-medium">Chọn kích thước:</p>
              <div className="flex gap-2 flex-wrap">
                {productData.sizes.map((item, index) => (
                  <button
                    onClick={() => setSize(item)}
                    className={`border-2 py-2 px-4 rounded-lg transition-all ${
                      item === size 
                        ? "border-orange-500 bg-orange-50 text-orange-600 font-medium" 
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    key={index}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selection Summary */}
          {productData.attributes && productData.attributes.length > 0 && Object.keys(selectedAttributes).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
              <p className="text-sm font-medium text-blue-800 mb-2">✓ Bạn đã chọn:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedAttributes).map(([key, value]) => (
                  <span key={key} className="bg-white text-blue-700 text-sm px-3 py-1 rounded-full border border-blue-300 font-medium">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const hasSkuVariants = Array.isArray(productData.variants) && productData.variants.length > 0;
            const hasAttributes = Array.isArray(productData.attributes) && productData.attributes.length > 0;
            const allAttrsSelected = hasAttributes && productData.attributes.every(a => selectedAttributes[a.name]);
            const hasLegacySizes = !hasAttributes && Array.isArray(productData.sizes) && productData.sizes.length > 0;
            const selectedVariant = hasSkuVariants && allAttrsSelected
              ? productData.variants.find(v => {
                  const combo = v.combination || {};
                  return productData.attributes.every(a => combo[a.name] === selectedAttributes[a.name]);
                })
              : null;
            const isOutOfStock = selectedVariant
              ? selectedVariant.stock === 0
              : !hasSkuVariants && productData.stock === 0;

            // Logic chọn sản phẩm dùng chung cho cả "Thêm vào giỏ" và "Mua ngay".
            // Trả về { ok, optionKey, message }; optionKey chính là "size" lưu trong giỏ/đơn.
            const resolveSelection = () => {
              if (hasSkuVariants && hasAttributes) {
                if (!allAttrsSelected) {
                  return { ok: false, message: `Vui lòng chọn ${productData.attributes.map(a => a.name).join(', ')}` };
                }
                if (isOutOfStock) {
                  return { ok: false, message: "Biến thể này đã hết hàng" };
                }
                const optionKey = Object.entries(selectedAttributes)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ');
                return { ok: true, optionKey };
              }
              if (hasLegacySizes && !size) {
                return { ok: false, message: "Vui lòng chọn kích thước sản phẩm!" };
              }
              if (isOutOfStock) {
                return { ok: false, message: "Sản phẩm đã hết hàng" };
              }
              return { ok: true, optionKey: size || normalizeCartOptionKey("") };
            };

            const handleAddToCart = () => {
              if (!token) {
                toast.info("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.");
                navigate("/login");
                return;
              }
              const sel = resolveSelection();
              if (!sel.ok) {
                toast.error(sel.message);
                return;
              }
              addToCart(productData._id, sel.optionKey);
            };

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
              // Mua ngay: bỏ qua giỏ hàng, ghi đè selectedCartItems rồi sang trang thanh toán.
              const buyNowItem = [{ _id: productData._id, size: sel.optionKey, quantity: 1 }];
              sessionStorage.setItem("selectedCartItems", JSON.stringify(buyNowItem));
              navigate("/place-order");
            };

            return (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleBuyNow}
                    disabled={isOutOfStock}
                    className={`w-full sm:flex-1 px-12 py-4 text-base font-semibold rounded-lg active:scale-95 transition-all shadow-lg ${
                      isOutOfStock
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isOutOfStock ? 'HẾT HÀNG' : 'MUA NGAY'}
                  </button>
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className={`w-full sm:flex-1 px-12 py-4 text-base font-medium rounded-lg active:scale-95 transition-all border-2 ${
                      isOutOfStock
                        ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                        : 'border-orange-600 text-orange-600 hover:bg-orange-50'
                    }`}
                  >
                    THÊM VÀO GIỎ HÀNG
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={priceAlertEnabled}
                    disabled={!isInCart || priceAlertLoading}
                    onChange={(e) => handleTogglePriceAlert(e.target.checked)}
                  />
                  Nhận thông báo khi sản phẩm này giảm giá
                  {!isInCart && (
                    <span className="text-xs text-gray-400">(cần thêm vào giỏ trước)</span>
                  )}
                </label>
              </div>
            );
          })()}
          
          <hr className="mt-8 sm:w-4/5"></hr>
          
          <div className="text-sm text-gray-700 mt-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>Sản phẩm chính hãng 100%</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
              <span>Miễn phí vận chuyển cho đơn hàng trên 500.000₫</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
              </svg>
              <span>Đổi trả miễn phí trong 7 ngày</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span>Hỗ trợ thanh toán khi nhận hàng (COD)</span>
            </div>
          </div>
        </div>
      </div>
      {/* Vendor / Shop card */}
      {productData?.vendorShopName && (
        <div className="mt-10 sm:mt-14 border rounded-lg bg-white shadow-sm">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                {String(productData.vendorShopName).trim().slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 truncate">
                    {productData.vendorShopName}
                  </span>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    Online
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Shop</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartChat}
                className="px-4 py-2 text-sm border border-orange-500 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
              >
                Chat ngay
              </button>
              <Link
                to={productData.vendorId ? `/shop/${productData.vendorId}` : `/collection?search=${encodeURIComponent(productData.vendorShopName)}`}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                Xem shop
              </Link>
            </div>
          </div>

          <div className="border-t px-4 sm:px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-gray-500">Sản phẩm</span>
              <span className="font-semibold text-orange-600">
                {vendorStats?.productCount ?? "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Đã bán</span>
              <span className="font-semibold text-orange-600">
                {vendorStats?.sold ?? "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Đánh giá</span>
              <span className="font-semibold text-gray-800">—</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Tỉ lệ phản hồi</span>
              <span className="font-semibold text-gray-800">—</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Thời gian phản hồi</span>
              <span className="font-semibold text-gray-800">—</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Người theo dõi</span>
              <span className="font-semibold text-gray-800">
                {vendorFollowerCount !== null ? vendorFollowerCount : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Description and Review Section */}
      <div className="mt-20">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("description")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "description"
                ? "border-b-2 border-orange-600 text-orange-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Mô tả sản phẩm
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "reviews"
                ? "border-b-2 border-orange-600 text-orange-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Đánh giá ({productData.reviewCount ?? 0})
          </button>
        </div>
        <div className="py-6 px-6 border border-t-0 rounded-b-lg bg-gray-50">
          {activeTab === "description" && (
            <div className="flex flex-col gap-4 text-sm text-gray-700 leading-relaxed">
              <p className="font-medium text-base text-gray-800">Chi tiết sản phẩm:</p>
              <p>{productData.description}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productData.brand && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-600">Thương hiệu:</span>
                    <span className="font-medium">{productData.brand}</span>
                  </div>
                )}
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Tình trạng:</span>
                  <span className="font-medium text-green-600">
                    {productData.stock > 0 ? "Còn hàng" : "Hết hàng"}
                  </span>
                </div>
                {productData.tags && productData.tags.filter(tag => !tag.includes(':') && tag !== 'marketplace').length > 0 && (
                  <div className="flex justify-between border-b pb-2 sm:col-span-2">
                    <span className="text-gray-600">Tags:</span>
                    <div className="flex gap-2 flex-wrap">
                      {productData.tags.filter(tag => !tag.includes(':') && tag !== 'marketplace').map((tag, index) => (
                        <span key={index} className="text-xs bg-gray-200 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "reviews" && (
            <ProductReviewsSection
              productData={productData}
              starCounts={starCounts}
              filterStar={filterStar}
              setFilterStar={setFilterStar}
              fetchReviews={fetchReviews}
              token={token}
              hasPurchased={hasPurchased}
              myReview={myReview}
              editingReviewId={editingReviewId}
              handleEditReview={handleEditReview}
              orderIdFromUrl={orderIdFromUrl}
              handleSubmitReview={handleSubmitReview}
              formRating={formRating}
              setFormRating={setFormRating}
              formComment={formComment}
              setFormComment={setFormComment}
              keepImages={keepImages}
              newImages={newImages}
              previewUrls={previewUrls}
              removeKeepImage={removeKeepImage}
              removeNewImage={removeNewImage}
              handleImageChange={handleImageChange}
              submittingReview={submittingReview}
              handleCancelEdit={handleCancelEdit}
              reviewTotal={reviewTotal}
              loadingReviews={loadingReviews}
              reviews={reviews}
              userId={userId}
              handleDeleteReview={handleDeleteReview}
              reviewTotalPages={reviewTotalPages}
              reviewPage={reviewPage}
              setReviewPage={setReviewPage}
            />
          )}
        </div>
      </div>
      {/* Display related products */}
      <RelatedProducts
        category={productData.category}
        subCategory={productData.subCategory}
      />
    </div>
  ) : (
    <div className="opacity-0"></div>
  );
};

export default Product;
