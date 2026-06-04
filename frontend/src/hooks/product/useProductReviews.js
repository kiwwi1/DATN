import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const REVIEWS_PER_PAGE = 5;

export const useProductReviews = ({
  backendUrl,
  productId,
  token,
  userId,
  orderIdFromUrl,
  onProductRefresh,
}) => {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState("");
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [filterStar, setFilterStar] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [starCounts, setStarCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [newImages, setNewImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [keepImages, setKeepImages] = useState([]);

  const fetchReviews = useCallback(
    async (page = 1, star = 0) => {
      if (!productId) return;
      setLoadingReviews(true);
      try {
        const response = await axios.get(
          `${backendUrl}/api/review/product/${productId}?page=${page}&limit=${REVIEWS_PER_PAGE}&star=${star}`
        );
        if (response.data.success) {
          setReviews(response.data.reviews || []);
          setReviewPage(response.data.page || 1);
          setReviewTotalPages(response.data.totalPages || 1);
          setReviewTotal(response.data.total || 0);
        }
      } catch (error) {
        console.error("fetchReviews:", error);
        setReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    },
    [backendUrl, productId]
  );

  const fetchStarDistribution = useCallback(async () => {
    if (!productId) return;
    try {
      const response = await axios.get(
        `${backendUrl}/api/review/product/${productId}?page=1&limit=200&star=0`
      );
      if (!response.data.success) return;

      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      (response.data.reviews || []).forEach((review) => {
        if (review.rating >= 1 && review.rating <= 5) {
          counts[review.rating] += 1;
        }
      });
      setStarCounts(counts);
    } catch (error) {
      console.error("fetchStarDistribution:", error);
    }
  }, [backendUrl, productId]);

  useEffect(() => {
    if (!productId) return;
    fetchReviews(1);
    fetchStarDistribution();
  }, [productId, fetchReviews, fetchStarDistribution]);

  useEffect(() => {
    const checkPurchase = async () => {
      if (!token || !productId || !orderIdFromUrl) {
        setHasPurchased(false);
        return;
      }

      try {
        const response = await axios.post(
          `${backendUrl}/api/review/can-review/${productId}`,
          { orderId: orderIdFromUrl },
          { headers: { token } }
        );
        setHasPurchased(response.data.canReview === true);
      } catch {
        setHasPurchased(false);
      }
    };

    checkPurchase();
  }, [backendUrl, orderIdFromUrl, productId, token]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const myReview = useMemo(() => {
    if (!orderIdFromUrl) return null;
    return (
      reviews.find(
        (review) =>
          review.user &&
          (review.user._id === userId || review.user === userId) &&
          review.orderId === orderIdFromUrl
      ) || null
    );
  }, [orderIdFromUrl, reviews, userId]);

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setFormRating(5);
    setFormComment("");
    setKeepImages([]);
    setNewImages([]);
    setPreviewUrls([]);
  };

  const handleEditReview = (review) => {
    setEditingReviewId(review._id);
    setFormRating(review.rating);
    setFormComment(review.comment || "");
    setKeepImages(review.images || []);
    setNewImages([]);
    setPreviewUrls([]);
  };

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files);
    const totalAfter = keepImages.length + newImages.length + files.length;
    if (totalAfter > 5) {
      toast.error("Tối đa 5 ảnh mỗi đánh giá");
      return;
    }

    setNewImages((previous) => [...previous, ...files]);
    setPreviewUrls((previous) => [...previous, ...files.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const removeNewImage = (index) => {
    URL.revokeObjectURL(previewUrls[index]);
    setNewImages((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setPreviewUrls((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const removeKeepImage = (url) => {
    setKeepImages((previous) => previous.filter((imageUrl) => imageUrl !== url));
  };

  const runAfterReviewMutation = async (page) => {
    await fetchReviews(page);
    await fetchStarDistribution();
    if (onProductRefresh) {
      await onProductRefresh();
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!token) {
      toast.info("Vui lòng đăng nhập để đánh giá.");
      return;
    }

    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        const formData = new FormData();
        formData.append("rating", formRating);
        formData.append("comment", formComment);
        keepImages.forEach((url) => formData.append("keepImages", url));
        newImages.forEach((file) => formData.append("images", file));

        const response = await axios.put(`${backendUrl}/api/review/${editingReviewId}`, formData, {
          headers: { token },
        });

        if (response.data.success) {
          toast.success("Đã cập nhật đánh giá.");
          handleCancelEdit();
          await runAfterReviewMutation(reviewPage);
        } else {
          toast.error(response.data.message || "Có lỗi.");
        }
      } else {
        const formData = new FormData();
        formData.append("productId", productId);
        formData.append("orderId", orderIdFromUrl || "");
        formData.append("rating", formRating);
        formData.append("comment", formComment);
        newImages.forEach((file) => formData.append("images", file));

        const response = await axios.post(`${backendUrl}/api/review`, formData, {
          headers: { token },
        });

        if (response.data.success) {
          toast.success("Đã gửi đánh giá.");
          handleCancelEdit();
          await runAfterReviewMutation(1);
        } else {
          toast.error(response.data.message || "Có lỗi.");
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Có lỗi khi gửi đánh giá.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá?")) return;

    try {
      const response = await axios.delete(`${backendUrl}/api/review/${reviewId}`, {
        headers: { token },
      });
      if (response.data.success) {
        toast.success("Đã xóa đánh giá.");
        handleCancelEdit();
        await runAfterReviewMutation(1);
      } else {
        toast.error(response.data.message || "Có lỗi.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Có lỗi khi xóa.");
    }
  };

  return {
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
  };
};
