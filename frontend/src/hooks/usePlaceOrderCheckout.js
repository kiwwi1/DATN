import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  buildAddressPayload,
  buildOrderItemsFromCart,
  buildOrderItemsFromSelection,
} from "../utils/checkoutOrderUtils";

const FREE_SHIPPING_THRESHOLD = 500000;
const STRIPE_VND_LIMIT = 99999999;
const VNPAY_LIMIT = 1000000000;

const createCheckoutIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `checkout-${crypto.randomUUID()}`;
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const readSelectedCartItems = () => {
  const selectedCartItemsRaw = sessionStorage.getItem("selectedCartItems");
  if (!selectedCartItemsRaw) return null;
  try {
    return JSON.parse(selectedCartItemsRaw);
  } catch {
    return null;
  }
};

const normalizeVoucherCode = (value) => String(value || "").trim().toUpperCase();

const uniqueVoucherCodes = (codes = []) => {
  const seen = new Set();
  return (codes || []).filter((code) => {
    const normalized = normalizeVoucherCode(code);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const computeFallbackPricing = (orderItems, deliveryFee) => {
  const subtotal = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : deliveryFee;
  const finalTotal = subtotal + shippingFee;
  return {
    subtotal,
    shopDiscount: 0,
    platformDiscount: 0,
    shippingFee,
    shippingDiscount: 0,
    finalTotal,
  };
};

export const usePlaceOrderCheckout = ({
  navigate,
  cartItems,
  setCartItems,
  token,
  backendUrl,
  deliveryFee,
  products,
}) => {
  const [method, setMethod] = useState("cod");
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    provinceCode: "",
    street: "",
    city: "",
    state: "",
    phone: "",
  });
  const [selectedTotal, setSelectedTotal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shopVoucherInput, setShopVoucherInput] = useState("");
  const [platformVoucherInput, setPlatformVoucherInput] = useState("");
  const [shopVoucherCodes, setShopVoucherCodes] = useState([]);
  const [platformVoucherCodes, setPlatformVoucherCodes] = useState([]);
  const [appliedVouchers, setAppliedVouchers] = useState([]);
  const [rejectedVouchers, setRejectedVouchers] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inFlightRef = useRef(false);
  const checkoutKeyRef = useRef("");

  const selectedCartItems = useMemo(() => readSelectedCartItems(), []);

  const currentOrderItems = useMemo(() => {
    if (selectedCartItems && selectedCartItems.length > 0) {
      return buildOrderItemsFromSelection(selectedCartItems, products);
    }
    return buildOrderItemsFromCart(cartItems, products);
  }, [selectedCartItems, cartItems, products]);

  const fallbackPricing = useMemo(
    () => computeFallbackPricing(currentOrderItems, deliveryFee),
    [currentOrderItems, deliveryFee]
  );

  const [pricingSummary, setPricingSummary] = useState(fallbackPricing);

  useEffect(() => {
    setSelectedTotal(fallbackPricing.subtotal);
  }, [fallbackPricing.subtotal]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address._id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  );

  const hasAddressBook = addresses.length > 0;

  const voucherCodes = useMemo(
    () =>
      uniqueVoucherCodes([
        ...shopVoucherCodes,
        ...platformVoucherCodes,
      ]),
    [shopVoucherCodes, platformVoucherCodes]
  );

  const appliedShopVouchers = useMemo(
    () => appliedVouchers.filter((voucher) => voucher.type === "SHOP"),
    [appliedVouchers]
  );

  const appliedPlatformVouchers = useMemo(
    () => appliedVouchers.filter((voucher) => voucher.type === "PLATFORM" || voucher.type === "SHIPPING"),
    [appliedVouchers]
  );

  const rejectedShopVouchers = useMemo(() => {
    const shopCodeSet = new Set(shopVoucherCodes.map(normalizeVoucherCode));
    return rejectedVouchers.filter((voucher) => shopCodeSet.has(normalizeVoucherCode(voucher.code)));
  }, [rejectedVouchers, shopVoucherCodes]);

  const rejectedPlatformVouchers = useMemo(() => {
    const platformCodeSet = new Set(platformVoucherCodes.map(normalizeVoucherCode));
    return rejectedVouchers.filter((voucher) => platformCodeSet.has(normalizeVoucherCode(voucher.code)));
  }, [rejectedVouchers, platformVoucherCodes]);

  const fetchPricingPreview = useCallback(
    async ({ orderItems, codes, showErrors = false }) => {
      const normalizedCodes = (codes || []).map(normalizeVoucherCode).filter(Boolean);
      if (!token || !Array.isArray(orderItems) || orderItems.length === 0) {
        const fallback = computeFallbackPricing(orderItems || [], deliveryFee);
        setPricingSummary(fallback);
        setAppliedVouchers([]);
        setRejectedVouchers([]);
        return { pricing: fallback, appliedVouchers: [], rejectedVouchers: [] };
      }

      try {
        setPreviewLoading(true);
        const response = await axios.post(
          `${backendUrl}/api/order/preview`,
          { items: orderItems, voucherCodes: normalizedCodes },
          { headers: { token } }
        );

        if (!response.data.success) {
          throw new Error(response.data.message || "Preview failed");
        }

        const pricing = response.data.pricing || computeFallbackPricing(orderItems, deliveryFee);
        const applied = response.data.appliedVouchers || [];
        const rejected = response.data.rejectedVouchers || [];
        setPricingSummary(pricing);
        setAppliedVouchers(applied);
        setRejectedVouchers(rejected);

        if (showErrors && rejected.length > 0) {
          toast.error(rejected[0].reason || "Voucher không hợp lệ");
        }

        return { pricing, appliedVouchers: applied, rejectedVouchers: rejected };
      } catch (error) {
        const fallback = computeFallbackPricing(orderItems, deliveryFee);
        setPricingSummary(fallback);
        setAppliedVouchers([]);
        if (showErrors) {
          toast.error(error.response?.data?.message || error.message);
        }
        return { pricing: fallback, appliedVouchers: [], rejectedVouchers: [] };
      } finally {
        setPreviewLoading(false);
      }
    },
    [backendUrl, deliveryFee, token]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPricingPreview({ orderItems: currentOrderItems, codes: voucherCodes }).catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [currentOrderItems, voucherCodes, fetchPricingPreview]);

  useEffect(() => {
    const loadAddresses = async () => {
      if (!token) {
        setAddresses([]);
        setSelectedAddressId("");
        return;
      }

      try {
        setAddressesLoading(true);
        const response = await axios.get(`${backendUrl}/api/address/list`, {
          headers: { token },
        });
        if (!response.data.success) {
          toast.error(response.data.message);
          return;
        }

        const list = response.data.addresses || [];
        setAddresses(list);
        const defaultAddress = list.find((item) => item.isDefault) || list[0] || null;
        setSelectedAddressId(defaultAddress?._id || "");
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
      } finally {
        setAddressesLoading(false);
      }
    };

    loadAddresses();
  }, [token, backendUrl]);

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        setLoadingProvinces(true);
        const response = await axios.get(`${backendUrl}/api/location/provinces`);
        if (response.data.success) {
          setProvinces(response.data.provinces || []);
        }
      } catch {
        // non-critical for manual fallback
      } finally {
        setLoadingProvinces(false);
      }
    };

    loadProvinces();
  }, [backendUrl]);

  const onChangeHandler = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const onProvinceChange = async (event) => {
    const provinceCode = event.target.value;
    const province = provinces.find((item) => String(item.code) === provinceCode);
    setFormData((previous) => ({
      ...previous,
      provinceCode,
      city: province?.name || "",
      state: "",
    }));

    if (!provinceCode) {
      setWards([]);
      return;
    }

    try {
      setLoadingWards(true);
      const response = await axios.get(`${backendUrl}/api/location/wards`, {
        params: { provinceCode },
      });
      if (response.data.success) {
        setWards(response.data.wards || []);
      } else {
        setWards([]);
      }
    } catch {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  };

  const validateAddressBeforeSubmit = () => {
    if (selectedAddress) return true;
    if (!formData.firstName || !formData.lastName || !formData.street || !formData.city || !formData.state || !formData.phone) {
      toast.error("Vui lòng nhập đầy đủ thông tin giao hàng.");
      return false;
    }
    return true;
  };

  const applyShopVoucherInput = () => {
    const code = normalizeVoucherCode(shopVoucherInput);
    if (!code) {
      toast.error("Nhập mã voucher shop trước khi áp dụng");
      return;
    }
    if (voucherCodes.includes(code)) {
      toast.info("Mã voucher đã được thêm");
      return;
    }
    setShopVoucherCodes((prev) => [...prev, code]);
    setShopVoucherInput("");
  };

  const applyPlatformVoucherInput = () => {
    const code = normalizeVoucherCode(platformVoucherInput);
    if (!code) {
      toast.error("Nhập mã voucher sàn trước khi áp dụng");
      return;
    }
    if (voucherCodes.includes(code)) {
      toast.info("Mã voucher đã được thêm");
      return;
    }
    setPlatformVoucherCodes((prev) => [...prev, code]);
    setPlatformVoucherInput("");
  };

  const removeShopVoucherCode = (code) => {
    const normalized = normalizeVoucherCode(code);
    setShopVoucherCodes((prev) => prev.filter((item) => item !== normalized));
  };

  const removePlatformVoucherCode = (code) => {
    const normalized = normalizeVoucherCode(code);
    setPlatformVoucherCodes((prev) => prev.filter((item) => item !== normalized));
  };

  const submitOrderByMethod = async ({ orderData, requestConfig }) => {
    if (method === "cod") {
      const response = await axios.post(`${backendUrl}/api/order/place-order`, orderData, requestConfig);
      if (!response.data.success) {
        toast.error(response.data.message);
        return;
      }

      sessionStorage.removeItem("selectedCartItems");
      checkoutKeyRef.current = "";

      try {
        const cartResponse = await axios.post(`${backendUrl}/api/cart/get`, {}, { headers: { token } });
        if (cartResponse.data.success) {
          setCartItems(cartResponse.data.cartData);
        }
      } catch (error) {
        console.error("Error fetching cart:", error);
      }

      toast.success("Đặt hàng thành công!");
      navigate("/orders");
      return;
    }

    if (method === "stripe") {
      const response = await axios.post(`${backendUrl}/api/order/place-order-stripe`, orderData, requestConfig);
      if (!response.data.success) {
        toast.error(response.data.message);
        return;
      }
      sessionStorage.removeItem("selectedCartItems");
      window.location.href = response.data.sessionUrl;
      return;
    }

    if (method === "vnpay") {
      const response = await axios.post(`${backendUrl}/api/order/place-order-vnpay`, orderData, requestConfig);
      if (!response.data.success) {
        toast.error(response.data.message);
        return;
      }
      sessionStorage.removeItem("selectedCartItems");
      window.location.href = response.data.paymentUrl;
    }
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (inFlightRef.current) return;

    if (!token) {
      toast.error("Vui lòng đăng nhập để đặt hàng.");
      navigate("/login");
      return;
    }

    if (!validateAddressBeforeSubmit()) return;

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      if (!currentOrderItems.length) {
        toast.error("Không có sản phẩm để đặt hàng");
        return;
      }

      const latestPreview = await fetchPricingPreview({
        orderItems: currentOrderItems,
        codes: voucherCodes,
        showErrors: true,
      });

      if (latestPreview.rejectedVouchers?.length) {
        return;
      }

      const totalAmount = Number(latestPreview.pricing?.finalTotal || 0);
      if (method === "stripe" && totalAmount > STRIPE_VND_LIMIT) {
        toast.error("Tổng đơn hàng vượt giới hạn Stripe. Vui lòng chọn COD.");
        return;
      }
      if (method === "vnpay" && totalAmount > VNPAY_LIMIT) {
        toast.error("Tổng đơn hàng vượt giới hạn VNPay.");
        return;
      }

      if (!checkoutKeyRef.current) {
        checkoutKeyRef.current = createCheckoutIdempotencyKey();
      }

      const orderData = {
        address: buildAddressPayload({ selectedAddress, formData }),
        addressId: selectedAddress?._id || undefined,
        items: currentOrderItems,
        amount: totalAmount,
        voucherCodes,
        idempotencyKey: checkoutKeyRef.current,
      };

      const requestConfig = {
        headers: {
          token,
          "x-idempotency-key": checkoutKeyRef.current,
        },
      };

      await submitOrderByMethod({ orderData, requestConfig });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message);
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    method,
    setMethod,
    addresses,
    addressesLoading,
    selectedAddressId,
    setSelectedAddressId,
    selectedAddress,
    hasAddressBook,
    provinces,
    wards,
    loadingProvinces,
    loadingWards,
    formData,
    setFormData,
    selectedTotal,
    isSubmitting,
    onChangeHandler,
    onProvinceChange,
    onSubmitHandler,
    shopVoucherInput,
    setShopVoucherInput,
    platformVoucherInput,
    setPlatformVoucherInput,
    shopVoucherCodes,
    platformVoucherCodes,
    voucherCodes,
    applyShopVoucherInput,
    applyPlatformVoucherInput,
    removeShopVoucherCode,
    removePlatformVoucherCode,
    pricingSummary,
    appliedVouchers,
    appliedShopVouchers,
    appliedPlatformVouchers,
    rejectedVouchers,
    rejectedShopVouchers,
    rejectedPlatformVouchers,
    previewLoading,
  };
};
