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
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherCodes, setVoucherCodes] = useState([]);
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
          toast.error(rejected[0].reason || "Voucher khong hop le");
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
      toast.error("Vui long nhap day du thong tin giao hang.");
      return false;
    }
    return true;
  };

  const applyVoucherInput = () => {
    const code = normalizeVoucherCode(voucherInput);
    if (!code) {
      toast.error("Nhap ma voucher truoc khi ap dung");
      return;
    }
    if (voucherCodes.includes(code)) {
      toast.info("Ma voucher da duoc them");
      return;
    }
    setVoucherCodes((prev) => [...prev, code]);
    setVoucherInput("");
  };

  const removeVoucherCode = (code) => {
    const normalized = normalizeVoucherCode(code);
    setVoucherCodes((prev) => prev.filter((item) => item !== normalized));
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

      toast.success("Dat hang thanh cong!");
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
      toast.error("Vui long dang nhap de dat hang.");
      navigate("/login");
      return;
    }

    if (!validateAddressBeforeSubmit()) return;

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      if (!currentOrderItems.length) {
        toast.error("Khong co san pham de dat hang");
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
        toast.error("Tong don hang vuot gioi han Stripe. Vui long chon COD.");
        return;
      }
      if (method === "vnpay" && totalAmount > VNPAY_LIMIT) {
        toast.error("Tong don hang vuot gioi han VNPay.");
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
    voucherInput,
    setVoucherInput,
    voucherCodes,
    applyVoucherInput,
    removeVoucherCode,
    pricingSummary,
    appliedVouchers,
    rejectedVouchers,
    previewLoading,
  };
};
