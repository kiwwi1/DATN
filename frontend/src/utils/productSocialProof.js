export const toDisplayNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const formatCompactCount = (value) => {
  const count = Math.max(0, Math.trunc(toDisplayNumber(value)))
  if (count >= 1000) {
    const scaled = count / 1000
    const decimals = scaled >= 10 ? 0 : 1
    return `${scaled.toFixed(decimals)}k`
  }
  return `${count}`
}

export const getProductSocialProof = ({ rating = 0, reviewCount = 0, sold = 0 } = {}) => {
  const ratingNumber = Math.max(0, toDisplayNumber(rating))
  const reviewCountNumber = Math.max(0, Math.trunc(toDisplayNumber(reviewCount)))
  const soldNumber = Math.max(0, Math.trunc(toDisplayNumber(sold)))
  const hasReviews = reviewCountNumber > 0 || ratingNumber > 0
  const hasSales = soldNumber > 0

  return {
    ratingNumber,
    reviewCountNumber,
    soldNumber,
    hasReviews,
    hasSales,
    ratingText: hasReviews ? ratingNumber.toFixed(1) : 'Mới',
    reviewCountText: reviewCountNumber > 0 ? `${reviewCountNumber} đánh giá` : hasReviews ? 'Đã có đánh giá' : 'Chưa có đánh giá',
    soldText: hasSales ? `Đã bán ${formatCompactCount(soldNumber)}` : 'Chưa có lượt bán',
    summaryText:
      !hasReviews && !hasSales
        ? 'Sản phẩm mới lên kệ'
        : hasReviews && !hasSales
          ? 'Đã có đánh giá đầu tiên'
          : !hasReviews && hasSales
            ? 'Đã có đơn mua đầu tiên'
            : 'Được nhiều khách quan tâm',
  }
}
