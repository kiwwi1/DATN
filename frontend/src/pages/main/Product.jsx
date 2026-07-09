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
import { getProductSocialProof } from "../../utils/productSocialProof";
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

const parseBold = (line) => {
  const parts = line.split(/(\*\*[^*]+\*\*)/);
  if (parts.length === 1) return line;
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
};

const renderDescription = (text) => {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks = [];
  let bulletItems = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletItems.length === 0) return;
    blocks.push(
      <ul key={key++} className="space-y-2 my-1">
        {bulletItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-pink-400" />
            <span className="leading-relaxed">{parseBold(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushBullets();
      continue;
    }

    if (/^[-•*]\s+/.test(line)) {
      bulletItems.push(line.replace(/^[-•*]\s+/, ""));
      continue;
    }

    flushBullets();

    const isFullBold = /^\*\*.+\*\*$/.test(line);
    const startsWithEmoji = /^\p{Emoji}/u.test(line);
    const isShortHeader = line.length < 70 && /[：:]\s*$/.test(line);

    if (isFullBold || startsWithEmoji || isShortHeader) {
      blocks.push(
        <p key={key++} className="font-semibold text-gray-800 mt-4 mb-0.5">
          {line.replace(/^\*\*|\*\*$/g, "")}
        </p>
      );
      continue;
    }

    blocks.push(
      <p key={key++} className="text-gray-700 leading-relaxed">
        {parseBold(line)}
      </p>
    );
  }

  flushBullets();
  return blocks.length > 0 ? blocks : null;
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

  // orderId tá»« URL (khi Ä‘iá»u hÆ°á»›ng tá»« trang Ä‘Æ¡n hÃ ng)
  const urlParams = new URLSearchParams(location.search);
  const orderIdFromUrl = urlParams.get("orderId") || null;

  // Review state â€” má»Ÿ tab reviews náº¿u URL cÃ³ ?tab=reviews
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") === "reviews" ? "reviews" : "description";
  });
  const productImages = useMemo(
    () => normalizeFirstImageLikeSecond(productData?.image),
    [productData?.image]
  );
  const displayName = productData ? localizeProductName(productData.name) : "";
  const socialProof = useMemo(() => getProductSocialProof(productData || {}), [productData]);
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

  // TÃ­nh sáºµn map: { [attrName]: { [value]: boolean } }
  // true = cÃ³ Ã­t nháº¥t 1 variant cÃ²n hÃ ng khi chá»n value Ä‘Ã³ cÃ¹ng vá»›i cÃ¡c attr Ä‘Ã£ chá»n.
  const optionAvailabilityMap = useMemo(() => {
    if (
      !productData ||
      !Array.isArray(productData.variants) ||
      productData.variants.length === 0 ||
      !Array.isArray(productData.attributes)
    ) return null;

    const result = {};
    for (const attr of productData.attributes) {
      result[attr.name] = {};
      for (const value of attr.values) {
        const hypothetical = { ...selectedAttributes, [attr.name]: value };
        result[attr.name][value] = productData.variants.some((v) => {
          const combo = v.combination || {};
          return (
            Object.entries(hypothetical).every(([k, val]) => combo[k] === val) &&
            Number(v.stock) > 0
          );
        });
      }
    }
    return result;
  }, [productData, selectedAttributes]);
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

  useEffect(() => {
    if (productData?.name) {
      document.title = `${localizeProductName(productData.name)} - Lumiere`;
    }
    return () => { document.title = "Lumiere"; };
  }, [productData?.name]);

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

  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    if (!token || !productData?._id) return;
    axios
      .get(`${backendUrl}/api/interaction/wishlist`, { headers: { token } })
      .then((res) => {
        if (res.data.success) {
          const ids = new Set(res.data.products.map((p) => p._id?.toString()));
          setWishlisted(ids.has(String(productData._id)));
        }
      })
      .catch(() => {});
  }, [token, productData?._id, backendUrl]);

  const handleToggleWishlist = async () => {
    if (!token) { navigate("/login"); return; }
    setWishlistLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/interaction/wishlist/toggle`,
        { productId: productData._id },
        { headers: { token } }
      );
      if (res.data.success) setWishlisted(res.data.wishlisted);
    } catch {
      // silent fail
    } finally {
      setWishlistLoading(false);
    }
  };
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
          <div className="flex flex-wrap items-center gap-3 mt-3 pb-4 border-b">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${
                socialProof.hasReviews ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <div className="flex items-center">
                {[...Array(5)].map((_, index) => (
                  <svg
                    key={index}
                    className={`w-4 h-4 ${
                      index < Math.round(socialProof.ratingNumber)
                        ? 'text-yellow-400 fill-current'
                        : socialProof.hasReviews
                          ? 'text-amber-200 fill-current'
                          : 'text-slate-300 fill-current'
                    }`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-medium">
                {socialProof.hasReviews ? socialProof.ratingText : socialProof.reviewCountText}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {socialProof.hasReviews ? socialProof.reviewCountText : socialProof.summaryText}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${
                socialProof.hasSales ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {socialProof.soldText}
            </span>
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
                    {attr.values.map((value, valueIndex) => {
                      const isSelected = selectedAttributes[attr.name] === value;
                      const isAvailable = optionAvailabilityMap
                        ? (optionAvailabilityMap[attr.name]?.[value] ?? true)
                        : true;
                      return (
                        <button
                          key={valueIndex}
                          onClick={() => setSelectedAttributes({ ...selectedAttributes, [attr.name]: value })}
                          disabled={!isAvailable}
                          title={!isAvailable ? "Hết hàng" : undefined}
                          className={`relative border-2 py-2 px-4 rounded-lg transition-all ${
                            isSelected && isAvailable
                              ? "border-orange-500 bg-orange-50 text-orange-600 font-medium"
                              : isSelected && !isAvailable
                              ? "border-red-300 bg-red-50 text-red-400 font-medium"
                              : isAvailable
                              ? "border-gray-300 hover:border-gray-400"
                              : "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                          }`}
                        >
                          {value}
                          {!isAvailable && (
                            <span
                              className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg"
                              aria-hidden="true"
                            >
                              <svg className="w-full h-full" preserveAspectRatio="none">
                                <line x1="0" y1="100%" x2="100%" y2="0" stroke="#d1d5db" strokeWidth="1.5" />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
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

            // Logic chá»n sáº£n pháº©m dÃ¹ng chung cho cáº£ "ThÃªm vÃ o giá»" vÃ  "Mua ngay".
            // Tráº£ vá» { ok, optionKey, message }; optionKey chÃ­nh lÃ  "size" lÆ°u trong giá»/Ä‘Æ¡n.
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
              // Mua ngay: bá» qua giá» hÃ ng, ghi Ä‘Ã¨ selectedCartItems rá»“i sang trang thanh toÃ¡n.
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
                  <button
                    onClick={handleToggleWishlist}
                    disabled={wishlistLoading}
                    title={wishlisted ? "Bỏ khỏi danh sách yêu thích" : "Thêm vào danh sách yêu thích"}
                    className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-lg border-2 transition-all active:scale-95 ${
                      wishlisted
                        ? 'border-rose-500 bg-rose-50 text-rose-500'
                        : 'border-gray-300 text-gray-400 hover:border-rose-400 hover:text-rose-400'
                    }`}
                  >
                    <svg className="w-5 h-5" fill={wishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={priceAlertEnabled}
                    disabled={priceAlertLoading}
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
            <div className="flex flex-col gap-2 text-sm text-gray-700 leading-relaxed">
              <div className="space-y-1">
                {renderDescription(productData.description)}
              </div>
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
      <RelatedProducts currentProduct={productData} />
    </div>
  ) : (
    <div className="opacity-0"></div>
  );
};

export default Product;





