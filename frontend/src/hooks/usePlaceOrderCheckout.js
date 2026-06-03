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

const groupOrderItemsByVendor = (items = []) => {
  const vendorsMap = new Map();

  for (const item of items) {
    const vendorId = String(item.vendorId || "");
    if (!vendorId) continue;
    if (!vendorsMap.has(vendorId)) {
      vendorsMap.set(vendorId, {
        vendorId,
        vendorShopName: item.vendorShopName || "Shop",
        items: [],
        subtotal: 0,
      });
    }
    const vendor = vendorsMap.get(vendorId);
    vendor.items.push(item);
    vendor.subtotal += Number(item.price || 0) * Number(item.quantity || 0);
  }

  return Array.from(vendorsMap.values());
};

const filterByVendorIds = (source = {}, validVendorIds) => {
  const next = {};
  Object.entries(source || {}).forEach(([vendorId, value]) => {
    if (validVendorIds.has(vendorId)) {
      next[vendorId] = value;
    }
  });
  return next;
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
  const [shopVoucherInputs, setShopVoucherInputs] = useState({});
  const [shopVoucherCodesByVendor, setShopVoucherCodesByVendor] = useState({});
  const [platformVoucherInput, setPlatformVoucherInput] = useState("");
  const [platformVoucherCodes, setPlatformVoucherCodes] = useState([]);
  const [shopVoucherSuggestionsByVendor, setShopVoucherSuggestionsByVendor] = useState({});
  const [platformVoucherSuggestions, setPlatformVoucherSuggestions] = useState([]);
  const [voucherSuggestionLoading, setVoucherSuggestionLoading] = useState(false);
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

  const groupedOrderItems = useMemo(
    () => groupOrderItemsByVendor(currentOrderItems),
    [currentOrderItems]
  );

  useEffect(() => {
    const validVendorIds = new Set(groupedOrderItems.map((vendor) => vendor.vendorId));
    setShopVoucherInputs((previous) => filterByVendorIds(previous, validVendorIds));
    setShopVoucherCodesByVendor((previous) => filterByVendorIds(previous, validVendorIds));
    setShopVoucherSuggestionsByVendor((previous) => filterByVendorIds(previous, validVendorIds));
  }, [groupedOrderItems]);

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

  const shopVoucherCodes = useMemo(
    () => uniqueVoucherCodes(Object.values(shopVoucherCodesByVendor).flat()),
    [shopVoucherCodesByVendor]
  );

  const voucherCodes = useMemo(
    () => uniqueVoucherCodes([...shopVoucherCodes, ...platformVoucherCodes]),
    [shopVoucherCodes, platformVoucherCodes]
  );

  const appliedShopVouchers = useMemo(
    () => appliedVouchers.filter((voucher) => voucher.type === "SHOP"),
    [appliedVouchers]
  );

  const appliedShopVouchersByVendor = useMemo(() => {
    const grouped = {};
    appliedShopVouchers.forEach((voucher) => {
      const vendorId = String(voucher.vendorId || "");
      if (!vendorId) return;
      if (!grouped[vendorId]) grouped[vendorId] = [];
      grouped[vendorId].push(voucher);
    });
    return grouped;
  }, [appliedShopVouchers]);

  const appliedPlatformVouchers = useMemo(
    () => appliedVouchers.filter((voucher) => voucher.type === "PLATFORM" || voucher.type === "SHIPPING"),
    [appliedVouchers]
  );

  const rejectedShopVouchersByVendor = useMemo(() => {
    const normalizedByVendor = {};
    Object.entries(shopVoucherCodesByVendor).forEach(([vendorId, codes]) => {
      normalizedByVendor[vendorId] = new Set((codes || []).map(normalizeVoucherCode));
    });

    const grouped = {};
    rejectedVouchers.forEach((voucher) => {
      const normalizedCode = normalizeVoucherCode(voucher.code);
      Object.entries(normalizedByVendor).forEach(([vendorId, codeSet]) => {
        if (!codeSet.has(normalizedCode)) return;
        if (!grouped[vendorId]) grouped[vendorId] = [];
        grouped[vendorId].push(voucher);
      });
    });

    return grouped;
  }, [rejectedVouchers, shopVoucherCodesByVendor]);

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
          toast.error(rejected[0].reason || "Voucher kh\u00f4ng h\u1ee3p l\u1ec7");
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

  const fetchVoucherSuggestions = useCallback(
    async (orderItems) => {
      if (!token || !Array.isArray(orderItems) || orderItems.length === 0) {
        setShopVoucherSuggestionsByVendor({});
        setPlatformVoucherSuggestions([]);
        return;
      }

      try {
        setVoucherSuggestionLoading(true);
        const response = await axios.post(
          `${backendUrl}/api/order/voucher-suggestions`,
          { items: orderItems },
          { headers: { token } }
        );

        if (!response.data.success) {
          throw new Error(response.data.message || "Failed to load voucher suggestions");
        }

        const nextShopSuggestions = {};
        (response.data.shopSuggestions || []).forEach((shop) => {
          const vendorId = String(shop.vendorId || "");
          if (!vendorId) return;
          nextShopSuggestions[vendorId] = shop.vouchers || [];
        });

        setShopVoucherSuggestionsByVendor(nextShopSuggestions);
        setPlatformVoucherSuggestions(response.data.platformSuggestions || []);
      } catch {
        // Suggestions are optional, keep checkout flow running.
      } finally {
        setVoucherSuggestionLoading(false);
      }
    },
    [backendUrl, token]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPricingPreview({ orderItems: currentOrderItems, codes: voucherCodes }).catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [currentOrderItems, voucherCodes, fetchPricingPreview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVoucherSuggestions(currentOrderItems).catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [currentOrderItems, fetchVoucherSuggestions]);

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
      toast.error("Vui l\u00f2ng nh\u1eadp \u0111\u1ea7y \u0111\u1ee7 th\u00f4ng tin giao h\u00e0ng.");
      return false;
    }
    return true;
  };

  const setShopVoucherInput = (vendorId, value) => {
    const key = String(vendorId || "");
    if (!key) return;
    setShopVoucherInputs((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const applyShopVoucherInput = (vendorId) => {
    const key = String(vendorId || "");
    const code = normalizeVoucherCode(shopVoucherInputs[key]);
    if (!code) {
      toast.error("Nh\u1eadp m\u00e3 voucher shop tr\u01b0\u1edbc khi \u00e1p d\u1ee5ng");
      return;
    }
    if (voucherCodes.includes(code)) {
      toast.info("M\u00e3 voucher \u0111\u00e3 \u0111\u01b0\u1ee3c th\u00eam");
      return;
    }
    setShopVoucherCodesByVendor((previous) => ({
      ...previous,
      [key]: uniqueVoucherCodes([...(previous[key] || []), code]),
    }));
    setShopVoucherInputs((previous) => ({
      ...previous,
      [key]: "",
    }));
  };

  const applySuggestedShopVoucher = (vendorId, code) => {
    const key = String(vendorId || "");
    const normalized = normalizeVoucherCode(code);
    if (!key || !normalized) return;
    if (voucherCodes.includes(normalized)) {
      toast.info("M\u00e3 voucher \u0111\u00e3 \u0111\u01b0\u1ee3c th\u00eam");
      return;
    }
    setShopVoucherCodesByVendor((previous) => ({
      ...previous,
      [key]: uniqueVoucherCodes([...(previous[key] || []), normalized]),
    }));
  };

  const applyPlatformVoucherInput = () => {
    const code = normalizeVoucherCode(platformVoucherInput);
    if (!code) {
      toast.error("Nh\u1eadp m\u00e3 voucher s\u00e0n tr\u01b0\u1edbc khi \u00e1p d\u1ee5ng");
      return;
    }
    if (voucherCodes.includes(code)) {
      toast.info("M\u00e3 voucher \u0111\u00e3 \u0111\u01b0\u1ee3c th\u00eam");
      return;
    }
    setPlatformVoucherCodes((previous) => uniqueVoucherCodes([...previous, code]));
    setPlatformVoucherInput("");
  };

  const applySuggestedPlatformVoucher = (code) => {
    const normalized = normalizeVoucherCode(code);
    if (!normalized) return;
    if (voucherCodes.includes(normalized)) {
      toast.info("M\u00e3 voucher \u0111\u00e3 \u0111\u01b0\u1ee3c th\u00eam");
      return;
    }
    setPlatformVoucherCodes((previous) => uniqueVoucherCodes([...previous, normalized]));
  };

  const removeShopVoucherCode = (vendorId, code) => {
    const key = String(vendorId || "");
    const normalized = normalizeVoucherCode(code);
    setShopVoucherCodesByVendor((previous) => ({
      ...previous,
      [key]: (previous[key] || []).filter((item) => item !== normalized),
    }));
  };

  const removePlatformVoucherCode = (code) => {
    const normalized = normalizeVoucherCode(code);
    setPlatformVoucherCodes((previous) => previous.filter((item) => item !== normalized));
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

      toast.success("\u0110\u1eb7t h\u00e0ng th\u00e0nh c\u00f4ng!");
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
      toast.error("Vui l\u00f2ng \u0111\u0103ng nh\u1eadp \u0111\u1ec3 \u0111\u1eb7t h\u00e0ng.");
      navigate("/login");
      return;
    }

    if (!validateAddressBeforeSubmit()) return;

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      if (!currentOrderItems.length) {
        toast.error("Kh\u00f4ng c\u00f3 s\u1ea3n ph\u1ea9m \u0111\u1ec3 \u0111\u1eb7t h\u00e0ng");
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
        toast.error("T\u1ed5ng \u0111\u01a1n h\u00e0ng v\u01b0\u1ee3t gi\u1edbi h\u1ea1n Stripe. Vui l\u00f2ng ch\u1ecdn COD.");
        return;
      }
      if (method === "vnpay" && totalAmount > VNPAY_LIMIT) {
        toast.error("T\u1ed5ng \u0111\u01a1n h\u00e0ng v\u01b0\u1ee3t gi\u1edbi h\u1ea1n VNPay.");
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
    groupedOrderItems,
    shopVoucherInputs,
    setShopVoucherInput,
    platformVoucherInput,
    setPlatformVoucherInput,
    shopVoucherCodesByVendor,
    platformVoucherCodes,
    voucherCodes,
    applyShopVoucherInput,
    applySuggestedShopVoucher,
    applyPlatformVoucherInput,
    applySuggestedPlatformVoucher,
    removeShopVoucherCode,
    removePlatformVoucherCode,
    pricingSummary,
    appliedVouchers,
    appliedShopVouchers,
    appliedShopVouchersByVendor,
    appliedPlatformVouchers,
    rejectedVouchers,
    rejectedShopVouchersByVendor,
    rejectedPlatformVouchers,
    previewLoading,
    shopVoucherSuggestionsByVendor,
    platformVoucherSuggestions,
    voucherSuggestionLoading,
  };
};
