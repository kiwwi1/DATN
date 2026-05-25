import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { asImageArray } from "../../utils/imageUtils";
import { localizeProductName } from "../../utils/productNameUtils";

export const useProductEngagement = ({
  backendUrl,
  token,
  productId,
  productData,
  navigate,
  trackInteraction,
  isInCart,
}) => {
  const [vendorFollowerCount, setVendorFollowerCount] = useState(null);
  const [priceAlertEnabled, setPriceAlertEnabled] = useState(false);
  const [priceAlertLoading, setPriceAlertLoading] = useState(false);

  useEffect(() => {
    const loadFollowerCount = async () => {
      if (!productData?.vendorId) {
        setVendorFollowerCount(null);
        return;
      }
      try {
        const response = await axios.get(`${backendUrl}/api/shop-follow/count/${productData.vendorId}`);
        if (response.data.success) {
          setVendorFollowerCount(response.data.followerCount ?? null);
        }
      } catch {
        setVendorFollowerCount(null);
      }
    };

    loadFollowerCount();
  }, [backendUrl, productData?.vendorId]);

  useEffect(() => {
    if (!productId || !token) return;
    trackInteraction(productId, "viewed");
    const startTime = Date.now();

    return () => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      if (seconds < 3) return;
      fetch(`${backendUrl}/api/interaction/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({ productId, interactionType: "timeSpent", value: seconds }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [backendUrl, productId, token, trackInteraction]);

  useEffect(() => {
    const fetchPriceAlertStatus = async () => {
      if (!token || !productId || !isInCart) {
        setPriceAlertEnabled(false);
        return;
      }
      try {
        const response = await axios.get(
          `${backendUrl}/api/notification/price-alert/status?productId=${productId}`,
          { headers: { token } }
        );
        if (response.data.success) {
          setPriceAlertEnabled(!!response.data.enabled);
        }
      } catch {
        setPriceAlertEnabled(false);
      }
    };

    fetchPriceAlertStatus();
  }, [backendUrl, isInCart, productId, token]);

  const handleTogglePriceAlert = useCallback(
    async (enabled) => {
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
        const response = await axios.post(
          `${backendUrl}/api/notification/price-alert/subscribe`,
          { productId, enabled },
          { headers: { token } }
        );
        if (response.data.success) {
          setPriceAlertEnabled(!!response.data.enabled);
          toast.success(enabled ? "Đã bật thông báo giảm giá." : "Đã tắt thông báo giảm giá.");
        } else {
          toast.error(response.data.message || "Không thể cập nhật thông báo.");
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Không thể cập nhật thông báo.");
      } finally {
        setPriceAlertLoading(false);
      }
    },
    [backendUrl, isInCart, productId, token]
  );

  const handleStartChat = useCallback(async () => {
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
      const response = await axios.post(
        `${backendUrl}/api/chat/init`,
        { vendorId },
        { headers: { token } }
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Không thể tạo cuộc hội thoại");
      }

      const conversationId = response.data.conversation?._id;
      if (!conversationId) {
        throw new Error("Không lấy được cuộc hội thoại");
      }

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
  }, [backendUrl, navigate, productData, token]);

  return {
    vendorFollowerCount,
    priceAlertEnabled,
    priceAlertLoading,
    handleTogglePriceAlert,
    handleStartChat,
  };
};
