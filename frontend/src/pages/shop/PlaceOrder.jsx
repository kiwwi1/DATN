import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Title from "../../components/ui/Title";
import CartTotal from "../../components/cart/CartTotal";
import { assets } from "../../assets/assets";
import { ShopContext } from "../../context/ShopContext";
import { isDefaultCartOptionKey } from "../../constants/cartOption";

const PlaceOrder = () => {
  const { navigate, cartItems, setCartItems, token, backendUrl, delivery_fee, products } = useContext(ShopContext);
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

  const createCheckoutIdempotencyKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `checkout-${crypto.randomUUID()}`;
    }
    return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  useEffect(() => {
    const selectedCartItemsStr = sessionStorage.getItem("selectedCartItems");
    if (selectedCartItemsStr) {
      const selectedCartItems = JSON.parse(selectedCartItemsStr);
      const total = selectedCartItems.reduce((sum, item) => {
        const productData = products.find((p) => p._id === item._id);
        if (productData) return sum + productData.price * item.quantity;
        return sum;
      }, 0);
      setSelectedTotal(total);
    }
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
        const res = await axios.get(`${backendUrl}/api/address/list`, {
          headers: { token },
        });
        if (!res.data.success) {
          toast.error(res.data.message);
          return;
        }
        const list = res.data.addresses || [];
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
        const res = await axios.get(`${backendUrl}/api/location/provinces`);
        if (res.data.success) {
          setProvinces(res.data.provinces || []);
        }
      } catch {
        // non-critical for fallback manual form
      } finally {
        setLoadingProvinces(false);
      }
    };

    loadProvinces();
  }, [backendUrl]);

  const onChangeHandler = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onProvinceChange = async (event) => {
    const provinceCode = event.target.value;
    const province = provinces.find((item) => String(item.code) === provinceCode);
    setFormData((prev) => ({
      ...prev,
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
      const res = await axios.get(`${backendUrl}/api/location/wards`, {
        params: { provinceCode },
      });
      if (res.data.success) {
        setWards(res.data.wards || []);
      } else {
        setWards([]);
      }
    } catch {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  };

  const buildOrderItemsFromSelection = (selectedCartItems) => {
    const orderItems = [];

    for (const selectedItem of selectedCartItems) {
      const productData = products.find((product) => product._id === selectedItem._id);
      if (!productData) continue;

      const orderItem = {
        _id: productData._id,
        name: productData.name,
        price: productData.price,
        originalPrice: productData.originalPrice || productData.price,
        discount: productData.discount || 0,
        quantity: selectedItem.quantity,
        image: productData.image || [],
        brand: productData.brand || "",
        vendorId: productData.vendorId,
        vendorShopName: productData.vendorShopName || "",
      };

      const optionKey = String(selectedItem.size || "");
      if (isDefaultCartOptionKey(optionKey)) {
        orderItem.selectedAttributes = [];
      } else if (optionKey.includes(":")) {
        const attributes = selectedItem.size.split(",").map((attr) => {
          const [name, value] = attr.split(":").map((s) => s.trim());
          return { name, value };
        });
        orderItem.selectedAttributes = attributes;
        orderItem.size = selectedItem.size;
      } else {
        orderItem.size = selectedItem.size;
        orderItem.selectedAttributes = [{ name: "Size", value: selectedItem.size }];
      }

      orderItems.push(orderItem);
    }

    return orderItems;
  };

  const buildOrderItemsFromCart = () => {
    const orderItems = [];

    for (const productId in cartItems) {
      for (const optionKey in cartItems[productId]) {
        if (cartItems[productId][optionKey] <= 0) continue;

        const productData = products.find((product) => product._id === productId);
        if (!productData) continue;

        const orderItem = {
          _id: productData._id,
          name: productData.name,
          price: productData.price,
          originalPrice: productData.originalPrice || productData.price,
          discount: productData.discount || 0,
          quantity: cartItems[productId][optionKey],
          image: productData.image || [],
          brand: productData.brand || "",
          vendorId: productData.vendorId,
          vendorShopName: productData.vendorShopName || "",
        };

        if (isDefaultCartOptionKey(optionKey)) {
          orderItem.selectedAttributes = [];
        } else if (optionKey.includes(":")) {
          const attributes = optionKey.split(",").map((attr) => {
            const [name, value] = attr.split(":").map((s) => s.trim());
            return { name, value };
          });
          orderItem.selectedAttributes = attributes;
          orderItem.size = optionKey;
        } else {
          orderItem.size = optionKey;
          orderItem.selectedAttributes = [{ name: "Size", value: optionKey }];
        }

        orderItems.push(orderItem);
      }
    }

    return orderItems;
  };

  const splitName = (fullName) => {
    const normalized = String(fullName || "").trim();
    if (!normalized) return { firstName: "", lastName: "" };
    const parts = normalized.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  };

  const buildAddressPayload = () => {
    if (selectedAddress) {
      const name = splitName(selectedAddress.receiverName);
      return {
        firstName: name.firstName,
        lastName: name.lastName,
        email: formData.email || "",
        street: selectedAddress.addressLine,
        city: selectedAddress.city,
        state: selectedAddress.ward,
        phone: selectedAddress.phone,
        receiverName: selectedAddress.receiverName,
        ward: selectedAddress.ward,
        addressLine: selectedAddress.addressLine,
        addressType: selectedAddress.addressType,
        fullAddress: selectedAddress.fullAddress,
      };
    }

    return {
      ...formData,
      receiverName: `${formData.firstName} ${formData.lastName}`.trim(),
      ward: formData.state,
      addressLine: formData.street,
      addressType: "home",
      fullAddress: `${formData.street}, ${formData.state}, ${formData.city}`,
    };
  };

  const validateAddressBeforeSubmit = () => {
    if (selectedAddress) return true;
    if (!formData.firstName || !formData.lastName || !formData.street || !formData.city || !formData.state || !formData.phone) {
      toast.error("Vui lòng nhập đầy đủ thông tin giao hàng.");
      return false;
    }
    return true;
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
      const selectedCartItemsStr = sessionStorage.getItem("selectedCartItems");
      const selectedCartItems = selectedCartItemsStr ? JSON.parse(selectedCartItemsStr) : null;

      const orderItems =
        selectedCartItems && selectedCartItems.length > 0
          ? buildOrderItemsFromSelection(selectedCartItems)
          : buildOrderItemsFromCart();

      const itemsTotal = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
      const shippingFee = itemsTotal >= 500000 ? 0 : delivery_fee;
      const totalAmount = itemsTotal + shippingFee;

      const STRIPE_VND_LIMIT = 99999999;
      if (method === "stripe" && totalAmount > STRIPE_VND_LIMIT) {
        toast.error("Tổng đơn hàng vượt giới hạn Stripe. Vui lòng chọn COD.");
        return;
      }

      const VNPAY_LIMIT = 1_000_000_000;
      if (method === "vnpay" && totalAmount > VNPAY_LIMIT) {
        toast.error("Tổng đơn hàng vượt giới hạn VNPay.");
        return;
      }

      if (!checkoutKeyRef.current) {
        checkoutKeyRef.current = createCheckoutIdempotencyKey();
      }

      const orderData = {
        address: buildAddressPayload(),
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

      switch (method) {
        case "cod": {
          const response = await axios.post(`${backendUrl}/api/order/place-order`, orderData, requestConfig);
          if (response.data.success) {
            sessionStorage.removeItem("selectedCartItems");
            checkoutKeyRef.current = "";

            try {
              const cartResponse = await axios.post(`${backendUrl}/api/cart/get`, {}, { headers: { token } });
              if (cartResponse.data.success) {
                setCartItems(cartResponse.data.cartData);
              }
            } catch (err) {
              console.error("Error fetching cart:", err);
            }

            toast.success("Đặt hàng thành công!");
            navigate("/orders");
          } else {
            toast.error(response.data.message);
          }
          break;
        }

        case "stripe": {
          const response = await axios.post(`${backendUrl}/api/order/place-order-stripe`, orderData, requestConfig);
          if (response.data.success) {
            sessionStorage.removeItem("selectedCartItems");
            window.location.href = response.data.sessionUrl;
          } else {
            toast.error(response.data.message);
          }
          break;
        }

        case "vnpay": {
          const response = await axios.post(`${backendUrl}/api/order/place-order-vnpay`, orderData, requestConfig);
          if (response.data.success) {
            sessionStorage.removeItem("selectedCartItems");
            window.location.href = response.data.paymentUrl;
          } else {
            toast.error(response.data.message);
          }
          break;
        }

        default:
          break;
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message);
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmitHandler} className="flex min-h-[80vh] flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:pt-14">
      <div className="flex w-full flex-col gap-4 sm:max-w-[520px]">
        <div className="my-3 text-xl sm:text-2xl">
          <Title text1={"THÔNG TIN "} text2={"GIAO HÀNG"} />
        </div>

        <div className="rounded border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Địa chỉ giao hàng</p>
            <button
              type="button"
              onClick={() => navigate("/profile/address")}
              className="text-xs text-orange-600 hover:underline"
            >
              Quản lý địa chỉ
            </button>
          </div>

          {addressesLoading ? (
            <p className="text-sm text-gray-500">Đang tải địa chỉ...</p>
          ) : hasAddressBook ? (
            <div className="space-y-3">
              <select
                value={selectedAddressId}
                onChange={(event) => setSelectedAddressId(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              >
                {addresses.map((address) => (
                  <option key={address._id} value={address._id}>
                    {address.isDefault ? "[Mặc định] " : ""}
                    {address.receiverName} - {address.fullAddress}
                  </option>
                ))}
              </select>

              {selectedAddress && (
                <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="font-medium">
                    {selectedAddress.receiverName} - {selectedAddress.phone}
                  </p>
                  <p className="mt-1">{selectedAddress.fullAddress}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Loại: {selectedAddress.addressType === "office" ? "Văn phòng" : "Nhà riêng"}
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500">Hệ thống tự động dùng địa chỉ mặc định, bạn có thể đổi tại đây trước khi đặt đơn.</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Bạn chưa có địa chỉ lưu sẵn. Hãy nhập tay bên dưới hoặc thêm trong trang Sổ địa chỉ.</p>
          )}
        </div>

        {!selectedAddress && (
          <>
            <div className="flex gap-3">
              <input
                required
                onChange={onChangeHandler}
                name="firstName"
                value={formData.firstName}
                className="w-full rounded border border-gray-300 px-3.5 py-1.5"
                type="text"
                placeholder="Tên"
              />
              <input
                required
                onChange={onChangeHandler}
                name="lastName"
                value={formData.lastName}
                className="w-full rounded border border-gray-300 px-3.5 py-1.5"
                type="text"
                placeholder="Họ"
              />
            </div>
            <input
              required
              onChange={onChangeHandler}
              name="email"
              value={formData.email}
              className="w-full rounded border border-gray-300 px-3.5 py-1.5"
              type="email"
              placeholder="Email"
            />
            <input
              required
              onChange={onChangeHandler}
              name="street"
              value={formData.street}
              className="w-full rounded border border-gray-300 px-3.5 py-1.5"
              type="text"
              placeholder="Địa chỉ cụ thể (số nhà, tên đường)"
            />
            <div className="flex gap-3">
              <select
                required
                value={formData.provinceCode}
                onChange={onProvinceChange}
                className="w-full rounded border border-gray-300 px-3.5 py-1.5"
              >
                <option value="">{loadingProvinces ? "Đang tải tỉnh/thành..." : "Chọn tỉnh/thành phố"}</option>
                {provinces.map((province) => (
                  <option key={province.code} value={String(province.code)}>
                    {province.name}
                  </option>
                ))}
              </select>
              <select
                required
                onChange={(event) => setFormData((prev) => ({ ...prev, state: event.target.value }))}
                name="state"
                value={formData.state}
                disabled={!formData.provinceCode || loadingWards}
                className="w-full rounded border border-gray-300 px-3.5 py-1.5 disabled:bg-gray-100"
              >
                <option value="">
                  {!formData.provinceCode ? "Chọn tỉnh/thành trước" : loadingWards ? "Đang tải phường/xã..." : "Chọn phường/xã"}
                </option>
                {wards.map((ward) => (
                  <option key={`${ward.code}-${ward.displayName}`} value={ward.displayName}>
                    {ward.displayName}
                  </option>
                ))}
              </select>
            </div>
            <input
              required
              onChange={onChangeHandler}
              name="phone"
              value={formData.phone}
              className="w-full rounded border border-gray-300 px-3.5 py-1.5"
              type="text"
              placeholder="Số điện thoại"
            />
          </>
        )}
      </div>

      <div className="mt-8">
        <div className="mt-8 min-w-80">
          <CartTotal selectedTotal={selectedTotal > 0 ? selectedTotal : undefined} />
        </div>

        <div className="mt-12">
          <Title text1={"PHƯƠNG THỨC "} text2={"THANH TOÁN"} />
          <div className="flex flex-col gap-3 lg-flex-row">
            <div
              onClick={() => !isSubmitting && setMethod("stripe")}
              className={`flex items-center gap-3 border p-2 px-3 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <p className={`min-h-3.5 min-w-3.5 rounded-full border ${method === "stripe" ? "bg-green-400" : ""}`} />
              <img className="mx-4 h-5" src={assets.stripe_logo} />
            </div>
            <div
              onClick={() => !isSubmitting && setMethod("vnpay")}
              className={`flex items-center gap-3 border p-2 px-3 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <p className={`min-h-3.5 min-w-3.5 rounded-full border ${method === "vnpay" ? "bg-green-400" : ""}`} />
              <span className="mx-4 text-sm font-bold tracking-wide text-[#005BAA]">VNPay</span>
            </div>
            <div
              onClick={() => !isSubmitting && setMethod("cod")}
              className={`flex items-center gap-3 border p-2 px-3 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <p className={`min-h-3.5 min-w-3.5 rounded-full border ${method === "cod" ? "bg-green-400" : ""}`} />
              <p className="mx-4 text-sm font-medium text-gray-500">THANH TOÁN KHI NHẬN HÀNG</p>
            </div>
          </div>
          <div className="mt-8 w-full text-end">
            <button
              disabled={isSubmitting}
              type="submit"
              className={`bg-black px-16 py-2 text-sm text-white ${isSubmitting ? "cursor-not-allowed opacity-70" : ""}`}
            >
              {isSubmitting ? "ĐANG XỬ LÝ..." : "ĐẶT HÀNG"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default PlaceOrder;
