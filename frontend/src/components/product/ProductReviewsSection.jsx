import React from "react";

const ProductReviewsSection = ({
  productData,
  starCounts,
  filterStar,
  setFilterStar,
  fetchReviews,
  token,
  hasPurchased,
  myReview,
  editingReviewId,
  handleEditReview,
  orderIdFromUrl,
  handleSubmitReview,
  formRating,
  setFormRating,
  formComment,
  setFormComment,
  keepImages,
  newImages,
  previewUrls,
  removeKeepImage,
  removeNewImage,
  handleImageChange,
  submittingReview,
  handleCancelEdit,
  reviewTotal,
  loadingReviews,
  reviews,
  userId,
  handleDeleteReview,
  reviewTotalPages,
  reviewPage,
  setReviewPage,
}) => {
  return (
    <div className="space-y-6">
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
      {token && (hasPurchased || myReview) && (!myReview || editingReviewId) && (
        <div className="bg-white p-4 rounded-lg border">
          <p className="font-medium text-gray-800 mb-3">
            {editingReviewId ? "Chỉnh sửa đánh giá" : "Viết đánh giá"}
          </p>
          <form onSubmit={handleSubmitReview} className="space-y-3">
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
            <div>
              <textarea
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn (tùy chọn)"
                className="w-full border rounded-lg p-3 text-sm min-h-[80px]"
                maxLength={500}
              />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Ảnh đánh giá (tối đa 5):</p>
              <div className="flex flex-wrap gap-2 mb-2">
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

            {reviewTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => { const p = reviewPage - 1; setReviewPage(p); fetchReviews(p, filterStar); }}
                  disabled={reviewPage <= 1}
                  className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  ← Trước
                </button>

                {Array.from({ length: reviewTotalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === reviewTotalPages || Math.abs(p - reviewPage) <= 2)
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
                  )}

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
  );
};

export default ProductReviewsSection;
