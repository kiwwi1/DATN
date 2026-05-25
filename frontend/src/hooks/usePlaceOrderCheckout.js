import { useEffect, useMemo, useRef, useState } from "react";
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
  const inFlightRef = useRef(false);
  const checkoutKeyRef = useRef("");

  const selectedAddress = useMemo(
    () => addresses.find((address) => address._id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  );

  const hasAddressBook = addresses.length > 0;

  useEffect(() => {
    const selectedCartItems = readSelectedCartItems();
    if (!selectedCartItems?.length) {
      setSelectedTotal(0);
      return;
    }

    const total = selectedCartItems.reduce((sum, item) => {
      const productData = products.find((product) => product._id === item._id);
      if (!productData) return sum;
      return sum + productData.price * item.quantity;
    }, 0);
    setSelectedTotal(total);
  }, [products]);

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
      const selectedCartItems = readSelectedCartItems();
      const orderItems =
        selectedCartItems && selectedCartItems.length > 0
          ? buildOrderItemsFromSelection(selectedCartItems, products)
          : buildOrderItemsFromCart(cartItems, products);

      const itemsTotal = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
      const shippingFee = itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : deliveryFee;
      const totalAmount = itemsTotal + shippingFee;

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
        items: orderItems,
        amount: totalAmount,
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
  };
};
