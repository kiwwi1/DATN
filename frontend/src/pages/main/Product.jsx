import React, { useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { ShopContext } from "../../context/ShopContext";
import { useState } from "react";
import axios from "axios";
import RelatedProducts from "../../components/product/RelatedProducts";
import { formatPrice } from "../../utils/priceFormat";
import { toast } from "react-toastify";
import { formatImageUrl, asImageArray } from "../../utils/imageUtils";
import { localizeProductName } from "../../utils/productNameUtils";

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
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") === "reviews" ? "reviews" : "description";
  });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState("");
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [filterStar, setFilterStar] = useState(0); // 0 = tất cả
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [vendorFollowerCount, setVendorFollowerCount] = useState(null);
  const [priceAlertEnabled, setPriceAlertEnabled] = useState(false);
  const [priceAlertLoading, setPriceAlertLoading] = useState(false);
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

  useEffect(() => {
    const loadFollowerCount = async () => {
      if (!productData?.vendorId) {
        setVendorFollowerCount(null);
        return;
      }
      try {
        const res = await axios.get(
          `${backendUrl}/api/shop-follow/count/${productData.vendorId}`
        );
        if (res.data.success) {
          setVendorFollowerCount(res.data.followerCount ?? null);
        }
      } catch {
        setVendorFollowerCount(null);
      }
    };
    loadFollowerCount();
  }, [backendUrl, productData?.vendorId]);
  const [starCounts, setStarCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const REVIEWS_PER_PAGE = 5;
  const isInCart = useMemo(() => {
    const row = cartItems?.[productId];
    if (!row || typeof row !== "object") return false;
    return Object.values(row).some((qty) => Number(qty) > 0);
  }, [cartItems, productId]);
  // Ảnh đính kèm
  const [newImages, setNewImages] = useState([]);       // File[] chờ upload
  const [previewUrls, setPreviewUrls] = useState([]);   // blob URL để preview
  const [keepImages, setKeepImages] = useState([]);     // URL ảnh cũ giữ lại khi edit

  const handleStartChat = async () => {
    if (!token) {
      toast.info("Vui lòng đăng nhập để nhắn tin với shop.");
      navigate("/login");
      return;
    }
    const vendorId = productData?.vendorId;
    if (!vendorId) {
      toast.error("Không tìm thấy thông tin shop.");
      return;
    }
    try {
      const res = await axios.post(
        `${backendUrl}/api/chat/init`,
        { vendorId },
        { headers: { token } }
      );
      if (!res.data.success) {
        throw new Error(res.data.message || "Không thể tạo cuộc hội thoại");
      }
      const conversationId = res.data.conversation?._id;
      if (!conversationId) throw new Error("Không lấy được cuộc hội thoại");
      const quickOptions = [
        "Sản phẩm này còn hàng không shop?",
        "Mình có thể được tư vấn phiên bản phù hợp không?",
        "Shop hỗ trợ freeship/giảm giá cho sản phẩm này không?",
        "Sản phẩm này có bảo hành/đổi trả như thế nào?",
      ];
      window.dispatchEvent(
        new CustomEvent("open-chat-conversation", {
          detail: {
            conversationId,
            productContext: {
              id: productData._id,
              name: localizeProductName(productData.name),
              price: productData.price,
              image: asImageArray(productData.image)[0] || "",
              vendorId: productData.vendorId,
            },
            quickOptions,
          },
        })
      );
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // Track viewed khi mở trang; track tổng timeSpent khi rời trang
  useEffect(() => {
    if (!productId || !token) return;
    trackInteraction(productId, 'viewed');
    const startTime = Date.now();

    return () => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      if (seconds < 3) return; // bỏ qua nếu chỉ thoáng qua
      // fetch keepalive đảm bảo request hoàn thành kể cả khi unmount/đóng tab
      fetch(`${backendUrl}/api/interaction/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify({ productId, interactionType: 'timeSpent', value: seconds }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [productId, token, trackInteraction, backendUrl]);

  const fetchProductData = useCallback(() => {
    products.map((item) => {
      if (item._id == productId) {
        setProductData(item);
        setImage(formatImageUrl(item.image));
        setSize("");
        setSelectedAttributes({});
        return null;
      }
    });
  }, [productId, products]);

  const fetchReviews = useCallback(async (page = 1, star = 0) => {
    if (!productId) return;
    setLoadingReviews(true);
    try {
      const res = await axios.get(
        `${backendUrl}/api/review/product/${productId}?page=${page}&limit=${REVIEWS_PER_PAGE}&star=${star}`
      );
      if (res.data.success) {
        setReviews(res.data.reviews || []);
        setReviewPage(res.data.page || 1);
        setReviewTotalPages(res.data.totalPages || 1);
        setReviewTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error("fetchReviews:", err);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [productId, backendUrl, REVIEWS_PER_PAGE]);

  // Lấy phân bố sao (chạy 1 lần khi mở product)
  const fetchStarDistribution = useCallback(async () => {
    if (!productId) return;
    try {
      const res = await axios.get(
        `${backendUrl}/api/review/product/${productId}?page=1&limit=200&star=0`
      );
      if (res.data.success) {
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        (res.data.reviews || []).forEach(r => {
          if (r.rating >= 1 && r.rating <= 5) counts[r.rating]++;
        });
        setStarCounts(counts);
      }
    } catch (err) {
      console.error("fetchStarDistribution:", err);
    }
  }, [productId, backendUrl]);

  const refetchProduct = useCallback(async () => {
    if (!productId) return;
    try {
      const res = await axios.post(backendUrl + "/api/product/single", { productId });
      if (res.data.success && res.data.product) setProductData(res.data.product);
    } catch (err) {
      console.error("refetchProduct:", err);
    }
  }, [productId, backendUrl]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  useEffect(() => {
    const fetchPriceAlertStatus = async () => {
      if (!token || !productId || !isInCart) {
        setPriceAlertEnabled(false);
        return;
      }
      try {
        const res = await axios.get(
          `${backendUrl}/api/notification/price-alert/status?productId=${productId}`,
          { headers: { token } }
        );
        if (res.data.success) {
          setPriceAlertEnabled(!!res.data.enabled);
        }
      } catch {
        setPriceAlertEnabled(false);
      }
    };
    fetchPriceAlertStatus();
  }, [backendUrl, token, productId, isInCart]);

  const handleTogglePriceAlert = async (enabled) => {
    if (!token) {
      toast.info("Vui lòng đăng nhập để bật thông báo giảm giá.");
      return;
    }
    if (!isInCart) {
      toast.info("Hãy thêm sản phẩm vào giỏ hàng trước khi bật thông báo.");
      return;
    }
    setPriceAlertLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/notification/price-alert/subscribe`,
        { productId, enabled },
        { headers: { token } }
      );
      if (res.data.success) {
        setPriceAlertEnabled(!!res.data.enabled);
        toast.success(enabled ? "Đã bật thông báo giảm giá." : "Đã tắt thông báo giảm giá.");
      } else {
        toast.error(res.data.message || "Không thể cập nhật thông báo.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật thông báo.");
    } finally {
      setPriceAlertLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchReviews(1);
      fetchStarDistribution();
    }
  }, [productId, fetchReviews, fetchStarDistribution]);

  useEffect(() => {
    const checkPurchase = async () => {
      if (!token || !productId || !orderIdFromUrl) { setHasPurchased(false); return; }
      try {
        const res = await axios.post(
          `${backendUrl}/api/review/can-review/${productId}`,
          { orderId: orderIdFromUrl },
          { headers: { token } }
        );
        setHasPurchased(res.data.canReview === true);
      } catch {
        setHasPurchased(false);
      }
    };
    checkPurchase();
  }, [token, productId, orderIdFromUrl, backendUrl]);

  // Review của user cho đơn hàng hiện tại (nếu có orderId trên URL)
  const myReview = orderIdFromUrl
    ? reviews.find((r) => r.user && (r.user._id === userId || r.user === userId) && r.orderId === orderIdFromUrl)
    : null;

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.info("Vui lòng đăng nhập để đánh giá.");
      return;
    }
    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        const fd = new FormData();
        fd.append("rating", formRating);
        fd.append("comment", formComment);
        keepImages.forEach((url) => fd.append("keepImages", url));
        newImages.forEach((file) => fd.append("images", file));

        const res = await axios.put(
          `${backendUrl}/api/review/${editingReviewId}`,
          fd,
          { headers: { token } }
        );
        if (res.data.success) {
          toast.success("Đã cập nhật đánh giá.");
          handleCancelEdit();
          await fetchReviews(reviewPage);
          await refetchProduct();
        } else toast.error(res.data.message || "Có lỗi.");
      } else {
        const fd = new FormData();
        fd.append("productId", productId);
        fd.append("orderId", orderIdFromUrl || "");
        fd.append("rating", formRating);
        fd.append("comment", formComment);
        newImages.forEach((file) => fd.append("images", file));

        const res = await axios.post(
          `${backendUrl}/api/review`,
          fd,
          { headers: { token } }
        );
        if (res.data.success) {
          toast.success("Đã gửi đánh giá.");
          handleCancelEdit();
          await fetchReviews(1);
          await refetchProduct();
        } else toast.error(res.data.message || "Có lỗi.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Có lỗi khi gửi đánh giá.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const totalAfter = keepImages.length + newImages.length + files.length;
    if (totalAfter > 5) {
      toast.error("Tối đa 5 ảnh mỗi đánh giá");
      return;
    }
    setNewImages((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeNewImage = (index) => {
    URL.revokeObjectURL(previewUrls[index]);
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const removeKeepImage = (url) => {
    setKeepImages((prev) => prev.filter((u) => u !== url));
  };

  const handleEditReview = (review) => {
    setEditingReviewId(review._id);
    setFormRating(review.rating);
    setFormComment(review.comment || "");
    setKeepImages(review.images || []);
    setNewImages([]);
    setPreviewUrls([]);
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setFormRating(5);
    setFormComment("");
    setKeepImages([]);
    setNewImages([]);
    setPreviewUrls([]);
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá?")) return;
    try {
      const res = await axios.delete(`${backendUrl}/api/review/${reviewId}`, {
        headers: { token },
      });
      if (res.data.success) {
        toast.success("Đã xóa đánh giá.");
        setEditingReviewId(null);
        setFormRating(5);
        setFormComment("");
        await fetchReviews(1);
        await refetchProduct();
      } else toast.error(res.data.message || "Có lỗi.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Có lỗi khi xóa.");
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
            {asImageArray(productData.image).map((item, index) => (
              <img
                key={index}
                onClick={() => setImage(formatImageUrl(item))}
                className={`w-[24%] sm:w-full cursor-pointer sm:mb-3 flex-shrink-0 `}
                src={formatImageUrl(item)}
                alt={productData.name}
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
          <div className="w-full sm:w-[80%]">
            <img className="w-full h-auto" src={image} alt="" referrerPolicy="no-referrer" />
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
            const hasVariants = productData.variants && productData.variants.length > 0;
            const allAttrsSelected = productData.attributes && productData.attributes.length > 0
              && productData.attributes.every(a => selectedAttributes[a.name]);
            const selectedVariant = hasVariants && allAttrsSelected
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
                    {!selectedVariant && hasVariants && (
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
                      : hasVariants && allAttrsSelected
                        ? <span className="text-red-500 font-medium">Hết hàng</span>
                        : displayStock === 0 && !hasVariants
                          ? <span className="text-red-500 font-medium">Hết hàng</span>
                          : null
                  )}
                </div>
              </>
            );
          })()}

          <p className="mt-5 text-gray-700 md:w-4/5 leading-relaxed">
            {productData.description}
          </p>

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
            const hasVariants = productData.variants && productData.variants.length > 0;
            const allAttrsSelected = productData.attributes && productData.attributes.length > 0
              && productData.attributes.every(a => selectedAttributes[a.name]);
            const selectedVariant = hasVariants && allAttrsSelected
              ? productData.variants.find(v => {
                  const combo = v.combination || {};
                  return productData.attributes.every(a => combo[a.name] === selectedAttributes[a.name]);
                })
              : null;
            const isOutOfStock = selectedVariant
              ? selectedVariant.stock === 0
              : !hasVariants && productData.stock === 0;

            return (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (productData.attributes && productData.attributes.length > 0) {
                      if (!allAttrsSelected) {
                        toast.error(`Vui lòng chọn ${productData.attributes.map(a => a.name).join(', ')}`);
                        return;
                      }
                      if (isOutOfStock) {
                        toast.error("Biến thể này đã hết hàng");
                        return;
                      }
                      const attributeString = Object.entries(selectedAttributes)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ');
                      addToCart(productData._id, attributeString);
                    } else {
                      if (isOutOfStock) {
                        toast.error("Sản phẩm đã hết hàng");
                        return;
                      }
                      addToCart(productData._id, size);
                    }
                  }}
                  disabled={isOutOfStock}
                  className={`w-full sm:w-auto px-12 py-4 text-base font-medium rounded-lg active:scale-95 transition-all shadow-lg ${
                    isOutOfStock
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {isOutOfStock ? 'HẾT HÀNG' : 'THÊM VÀO GIỎ HÀNG'}
                </button>
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
                {productData.tags && productData.tags.length > 0 && (
                  <div className="flex justify-between border-b pb-2 sm:col-span-2">
                    <span className="text-gray-600">Tags:</span>
                    <div className="flex gap-2 flex-wrap">
                      {productData.tags.map((tag, index) => (
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
            <div className="space-y-6">
              {/* Tóm tắt đánh giá + bộ lọc sao */}
              <div className="pb-4 border-b">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <span className="text-4xl font-bold text-orange-600">
                      {productData.rating?.toFixed(1) || "0"}
                    </span>
                    <div className="flex justify-center text-xl mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={star <= Math.round(productData.rating || 0) ? "text-yellow-400" : "text-gray-300"}>★</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{productData.reviewCount ?? 0} đánh giá</p>
                  </div>
                  {/* Thanh phân bố sao */}
                  <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const count = starCounts[s] || 0;
                      const total = Object.values(starCounts).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={s} className="flex items-center gap-2 text-xs">
                          <span className="w-4 text-right text-gray-600">{s}</span>
                          <span className="text-yellow-400">★</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-yellow-400 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-gray-500">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Nút lọc theo sao */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setFilterStar(0); fetchReviews(1, 0); }}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      filterStar === 0
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                    }`}
                  >
                    Tất cả ({productData.reviewCount ?? 0})
                  </button>
                  {[5, 4, 3, 2, 1].map((s) => {
                    const count = starCounts[s] || 0;
                    if (count === 0) return null;
                    return (
                      <button
                        key={s}
                        onClick={() => { setFilterStar(s); fetchReviews(1, s); }}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          filterStar === s
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                        }`}
                      >
                        {s} ★ ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form gửi / sửa đánh giá */}
              {!token && (
                <p className="text-gray-500 text-sm">Đăng nhập để viết đánh giá.</p>
              )}
              {token && !hasPurchased && !myReview && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                  <span className="text-yellow-500 text-lg">🛍️</span>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Chỉ có thể đánh giá sau khi nhận hàng</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {orderIdFromUrl
                        ? "Đơn hàng này chưa được giao hoặc bạn đã đánh giá sản phẩm này cho đơn hàng đó rồi."
                        : "Vào trang Đơn mua và bấm \"Đánh Giá\" sau khi đơn hàng được giao thành công."}
                    </p>
                  </div>
                </div>
              )}
              {/* Đã có review nhưng không đang chỉnh sửa → hiện thông báo */}
              {token && myReview && !editingReviewId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <p className="text-sm font-medium text-green-800">Bạn đã đánh giá sản phẩm này</p>
                  </div>
                  <button
                    onClick={() => handleEditReview(myReview)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Chỉnh sửa
                  </button>
                </div>
              )}
              {/* Form viết mới hoặc chỉnh sửa */}
              {token && (hasPurchased || myReview) && (!myReview || editingReviewId) && (
                <div className="bg-white p-4 rounded-lg border">
                  <p className="font-medium text-gray-800 mb-3">
                    {editingReviewId ? "Chỉnh sửa đánh giá" : "Viết đánh giá"}
                  </p>
                  <form onSubmit={handleSubmitReview} className="space-y-3">
                    {/* Sao */}
                    <div>
                      <span className="text-sm text-gray-600 mr-2">Điểm:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormRating(star)}
                          className="text-2xl focus:outline-none"
                        >
                          <span className={formRating >= star ? "text-yellow-400" : "text-gray-300"}>★</span>
                        </button>
                      ))}
                      <span className="ml-2 text-sm font-medium">{formRating}/5</span>
                    </div>
                    {/* Nội dung */}
                    <div>
                      <textarea
                        value={formComment}
                        onChange={(e) => setFormComment(e.target.value)}
                        placeholder="Chia sẻ trải nghiệm của bạn (tùy chọn)"
                        className="w-full border rounded-lg p-3 text-sm min-h-[80px]"
                        maxLength={500}
                      />
                    </div>
                    {/* Upload ảnh */}
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Ảnh đánh giá (tối đa 5):</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {/* Ảnh cũ giữ lại (khi edit) */}
                        {keepImages.map((url) => (
                          <div key={url} className="relative w-20 h-20">
                            <img src={url} className="w-full h-full object-cover rounded-lg border" alt="review" />
                            <button
                              type="button"
                              onClick={() => removeKeepImage(url)}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none"
                            >×</button>
                          </div>
                        ))}
                        {/* Ảnh mới preview */}
                        {previewUrls.map((url, i) => (
                          <div key={url} className="relative w-20 h-20">
                            <img src={url} className="w-full h-full object-cover rounded-lg border" alt="preview" />
                            <button
                              type="button"
                              onClick={() => removeNewImage(i)}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none"
                            >×</button>
                          </div>
                        ))}
                        {/* Nút thêm ảnh */}
                        {keepImages.length + newImages.length < 5 && (
                          <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 transition-colors">
                            <span className="text-2xl text-gray-400">+</span>
                            <span className="text-xs text-gray-400">Thêm ảnh</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleImageChange}
                            />
                          </label>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Đã chọn: {keepImages.length + newImages.length}/5 ảnh</p>
                    </div>
                    {/* Nút gửi */}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {submittingReview ? "Đang gửi..." : editingReviewId ? "Cập nhật" : "Gửi đánh giá"}
                      </button>
                      {editingReviewId && (
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="border border-gray-300 px-4 py-2 rounded-lg text-sm"
                        >
                          Hủy
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* Danh sách đánh giá */}
              <div>
                <p className="font-medium text-gray-800 mb-3">
                  {filterStar === 0
                    ? `Tất cả đánh giá (${reviewTotal})`
                    : `Đánh giá ${filterStar} sao (${reviewTotal})`}
                </p>
                {loadingReviews ? (
                  <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Đang tải...
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-gray-500 py-4">
                    {filterStar === 0 ? "Chưa có đánh giá nào." : `Không có đánh giá ${filterStar} sao nào.`}
                  </p>
                ) : (
                  <>
                  <ul className="space-y-4">
                    {reviews.map((review) => (
                      <li key={review._id} className="border-b pb-4 last:border-0">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800">
                              {review.user?.name ?? "Ẩn danh"}
                            </span>
                            <span className="flex text-yellow-400 text-sm">
                              {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {review.createdAt
                                ? new Date(review.createdAt).toLocaleDateString("vi-VN")
                                : ""}
                            </span>
                          </div>
                          {review.user && (review.user._id === userId || review.user === userId) && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditReview(review)}
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteReview(review._id)}
                                className="text-sm text-red-600 hover:underline"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                        {review.comment && (
                          <p className="text-gray-700 text-sm mt-1">{review.comment}</p>
                        )}
                        {review.images && review.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {review.images.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt={`review-img-${i}`}
                                  className="w-16 h-16 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Phân trang */}
                  {reviewTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button
                        onClick={() => { const p = reviewPage - 1; setReviewPage(p); fetchReviews(p, filterStar); }}
                        disabled={reviewPage <= 1}
                        className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                      >
                        ← Trước
                      </button>

                      {/* Số trang */}
                      {Array.from({ length: reviewTotalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === reviewTotalPages || Math.abs(p - reviewPage) <= 2)
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === '...' ? (
                            <span key={`dots-${idx}`} className="px-2 text-gray-400 text-sm">…</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => { setReviewPage(item); fetchReviews(item, filterStar); }}
                              className={`w-8 h-8 rounded text-sm transition-colors ${
                                reviewPage === item
                                  ? 'bg-orange-500 text-white font-medium'
                                  : 'border hover:bg-gray-100 text-gray-700'
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )
                      }

                      <button
                        onClick={() => { const p = reviewPage + 1; setReviewPage(p); fetchReviews(p, filterStar); }}
                        disabled={reviewPage >= reviewTotalPages}
                        className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                      >
                        Sau →
                      </button>
                    </div>
                  )}
                  <p className="text-center text-xs text-gray-400 mt-2">
                    Trang {reviewPage} / {reviewTotalPages}
                  </p>
                  </>
                )}
              </div>
            </div>
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
