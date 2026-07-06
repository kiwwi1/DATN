import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { normalizeCartOptionKey } from "../constants/cartOption";
import { decodeUserIdFromToken } from "./shop/authUtils";
import {
  addItemToCartLocal,
  getCartAmountFromItems,
  getCartCountFromItems,
  setCartItemQuantityLocal,
} from "./shop/cartUtils";
import { useNotifications } from "./shop/useNotifications";
import { useRecommendations } from "./shop/useRecommendations";
import { useAuthBootstrap } from "./shop/useAuthBootstrap";
import { configureAuthSession } from "../utils/authSession";

export const ShopContext = createContext();

const ShopContextProvider = (props) => {
  const currency = ".000 VND";
  const delivery_fee = 30000;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const [cartItems, setCartItems] = useState({});
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("user");
  const [userProfile, setUserProfile] = useState(null);
  const [homepageCategories, setHomepageCategories] = useState([]);
  const navigate = useNavigate();

  useEffect(() => configureAuthSession({ backendUrl, setToken }), [backendUrl, setToken]);

  useEffect(() => {
    if (!token) {
      setUserId("");
      return;
    }
    const id = decodeUserIdFromToken(token);
    if (id) setUserId(id);
  }, [token]);

  const addToCart = async (itemId, size) => {
    if (!token) {
      toast.info("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.");
      navigate("/login");
      return;
    }

    const optionKey = normalizeCartOptionKey(size);
    const nextCartData = addItemToCartLocal(cartItems, itemId, optionKey);
    setCartItems(nextCartData);

    toast.success("Đã thêm vào giỏ hàng!");

    try {
      await axios.post(
        `${backendUrl}/api/cart/add`,
        { itemId, size: optionKey },
        { headers: { token } }
      );
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const getCartCount = () => getCartCountFromItems(cartItems);

  const getCartAmount = () => getCartAmountFromItems(cartItems, products);

  const updateQuantity = async (itemId, size, quantity) => {
    const optionKey = normalizeCartOptionKey(size);
    const nextCartData = setCartItemQuantityLocal(cartItems, itemId, optionKey, quantity);
    setCartItems(nextCartData);

    if (token) {
      try {
        await axios.post(
          `${backendUrl}/api/cart/update`,
          { itemId, size: optionKey, quantity },
          { headers: { token } }
        );
      } catch (error) {
        console.log(error);
        toast.error(error.response?.data?.message || error.message);
      }
    }
  };

  const getProductsData = useCallback(async () => {
    setProductsLoading(true);
    try {
      const response = await axios.get(`${backendUrl}/api/product/list`);
      if (response.data.success) {
        setProducts(response.data.products);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setProductsLoading(false);
    }
  }, [backendUrl]);

  const getUserCart = useCallback(
    async (accessToken) => {
      try {
        const response = await axios.post(
          `${backendUrl}/api/cart/get`,
          {},
          { headers: { token: accessToken } }
        );
        if (response.data.success) {
          setCartItems(response.data.cartData);
        } else {
          toast.error(response.data.message);
        }
      } catch (error) {
        console.log(error);
        toast.error(error.message);
      }
    },
    [backendUrl]
  );

  const getUserProfile = useCallback(
    async (accessToken) => {
      try {
        const response = await axios.post(
          `${backendUrl}/api/user/profile`,
          {},
          { headers: { token: accessToken } }
        );
        if (response.data.success) {
          setUserRole(response.data.user.role || "user");
          setUserProfile(response.data.user);
        }
      } catch (error) {
        console.log(error);
      }
    },
    [backendUrl]
  );

  const getAllCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/category/list`);
      if (response.data.success) {
        setHomepageCategories(response.data);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    }
  }, [backendUrl]);

  const {
    notifications,
    unreadCount,
    loadNotifications,
    markAllNotificationsRead,
  } = useNotifications({ backendUrl, token });

  const activeProductCount = useMemo(
    () => products.filter((item) => item?.isActive !== false).length,
    [products]
  );

  const { recommendations, getRecommendations, trackInteraction } = useRecommendations({
    backendUrl,
    productCount: activeProductCount,
    token,
  });

  useAuthBootstrap({ backendUrl, token, setToken });

  useEffect(() => {
    getProductsData();
  }, [getProductsData]);

  useEffect(() => {
    getAllCategories();
  }, [getAllCategories]);

  useEffect(() => {
    if (token && products.length > 0) {
      getUserCart(token);
      getUserProfile(token);
    } else if (!token) {
      setUserRole("user");
      setUserProfile(null);
    }
  }, [token, products, getUserCart, getUserProfile]);

  useEffect(() => {
    if (token) {
      getUserProfile(token);
    }
  }, [token, getUserProfile]);

  const value = {
    homepageCategories,
    getAllCategories,
    products,
    productsLoading,
    currency,
    delivery_fee,
    search,
    setSearch,
    showSearch,
    setShowSearch,
    cartItems,
    addToCart,
    getCartCount,
    updateQuantity,
    getCartAmount,
    navigate,
    backendUrl,
    getProductsData,
    token,
    setToken,
    getUserCart,
    setCartItems,
    userId,
    userRole,
    getUserProfile,
    userProfile,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    loadNotifications,
    trackInteraction,
    recommendations,
    getRecommendations,
  };

  return <ShopContext.Provider value={value}>{props.children}</ShopContext.Provider>;
};

export default ShopContextProvider;
