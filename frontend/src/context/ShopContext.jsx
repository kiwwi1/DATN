import { createContext, useEffect, useCallback, useRef } from 'react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export const ShopContext = createContext();

const ShopContextProvider = (props) => {
    const currency = '.000 VND';
    const delivery_fee = 30000;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(true);
    const [cartItems, setCartItems] = useState({});
    const [products, setProducts] = useState([]);
    const [token, setToken] = useState('');
    const [userId, setUserId] = useState('');
    const [userRole, setUserRole] = useState('user');
    const [userProfile, setUserProfile] = useState(null);
    const [homepageCategories, setHomepageCategories] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const sseRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        axios.defaults.withCredentials = true;
    }, []);

    // Function to get userId from token
    const getUserIdFromToken = (token) => {
        try {
            if (!token) return null;
            const decoded = jwtDecode(token);
            return decoded.id || decoded.userId || decoded._id || null;
        } catch (error) {
            console.log("Error decoding token:", error);
            return null;
        }
    };
    
    // Update userId when token changes
    useEffect(() => {
        if (token) {
            const id = getUserIdFromToken(token);
            if (id) setUserId(id);
        }
    }, [token]);

    // Hàm thêm sản phẩm vào giỏ hàng
    const addToCart = async (itemId, size) => {
        if (!size) {
            toast.error('Please select a size!');
            return;
        }
        let cartData = structuredClone(cartItems);
        if (cartData[itemId]) {
            if (cartData[itemId][size]) {
                cartData[itemId][size] += 1;
            } else {
                cartData[itemId][size] = 1;
            }
        } else {
            cartData[itemId] = {};
            cartData[itemId][size] = 1;
        }
        setCartItems(cartData);

        if(token){
            try {
              await axios.post(backendUrl+"/api/cart/add", {itemId,size},{headers:{token}})
                
            } catch (error) {
                console.log(error)
                toast.error(error.response.data.message)  
            }
        }
    };

    // Hàm đếm tổng số lượng sản phẩm trong giỏ hàng
    const getCartCount = () => {
        let totalCount = 0;
        for (const items in cartItems) {
            for (const item in cartItems[items]) {
                try {
                    if (cartItems[items][item] > 0) {
                        totalCount += cartItems[items][item];
                    }
                } catch (e) {
                    console.log(e);
                }
            }
        }
        return totalCount;
    };

    // Hàm tính tổng số tiền trong giỏ hàng
    const getCartAmount = () => {
        let totalAmount = 0;
        for (const items in cartItems) {
            let itemInfo = products.find((product) => product._id === items);
            for (const item in cartItems[items]) {
                try {
                    if (cartItems[items][item] > 0) {
                        totalAmount += itemInfo.price * cartItems[items][item];
                    }
                } catch (e) {
                    console.log(e);
                }
            }
        }
        return totalAmount; // Đặt return ngoài vòng lặp
    };

    // Hàm cập nhật số lượng sản phẩm trong giỏ hàng
    const updateQuantity = async (itemId, size, quantity) => {
        let cartData = structuredClone(cartItems);
        cartData[itemId][size] = quantity;
        setCartItems(cartData);
        if(token){
            try {
                await axios.post(backendUrl+"/api/cart/update", {itemId,size,quantity},{headers:{token}}
                )
                
            } catch (error) {
                console.log(error)
                toast.error(error.response.data.message)
            }
        }
    };

    const getProductsData = useCallback(async () => {
        try {
            const response = await axios.get(backendUrl+'/api/product/list')
            if(response.data.success){
                setProducts(response.data.products)
            }
            else{
                toast.error(response.data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }, [backendUrl])

    const getUserCart = useCallback(async ( token ) => {
        try {
            const response = await axios.post(backendUrl+"/api/cart/get", {},{headers:{token}})
            if(response.data.success){
                setCartItems(response.data.cartData)
            }
            else{
                toast.error(response.data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }, [backendUrl])

    const getUserProfile = useCallback(async (token) => {
        try {
            const response = await axios.post(backendUrl+"/api/user/profile", {},{headers:{token}})
            if(response.data.success){
                setUserRole(response.data.user.role || 'user')
                setUserProfile(response.data.user)
            }
        } catch (error) {
            console.log(error)
        }
    }, [backendUrl])

    const unreadCount = notifications.filter((n) => !n.read).length;

    const loadNotifications = useCallback(async () => {
        try {
            const res = await axios.get(backendUrl + '/api/notification/list');
            if (res.data.success) setNotifications(res.data.notifications);
        } catch { /* non-critical */ }
    }, [backendUrl]);

    const markAllNotificationsRead = useCallback(async () => {
        try {
            await axios.post(backendUrl + '/api/notification/read-all', {});
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch { /* non-critical */ }
    }, [backendUrl]);

    // Kết nối SSE khi có token, ngắt khi logout
    useEffect(() => {
        if (!token) {
            if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
            setNotifications([]);
            return;
        }
        loadNotifications();
        const es = new EventSource(`${backendUrl}/api/notification/stream`, { withCredentials: true });
        sseRef.current = es;
        es.onmessage = (e) => {
            try {
                const notification = JSON.parse(e.data);
                setNotifications((prev) => [notification, ...prev]);
                toast.info(notification.title, { autoClose: 4000 });
            } catch { /* ignore parse errors */ }
        };
        es.onerror = () => { es.close(); sseRef.current = null; };
        return () => { es.close(); sseRef.current = null; };
    }, [token, backendUrl, loadNotifications]);

    const [recommendations, setRecommendations] = useState([]);

    const getRecommendations = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.post(
                backendUrl + '/api/interaction/recommendations',
                {},
                { headers: { token } }
            );
            if (res.data.success) setRecommendations(res.data.products);
        } catch { /* non-critical */ }
    }, [token, backendUrl]);

    useEffect(() => {
        if (token) getRecommendations();
        else setRecommendations([]);
    }, [token, getRecommendations]);

    const REFRESH_INTERACTIONS = new Set(['viewed', 'purchased', 'addedToCart']);

    const trackInteraction = useCallback(async (productId, interactionType, value = 1) => {
        if (!token || !productId) return;
        try {
            await axios.post(backendUrl + '/api/interaction/track',
                { productId, interactionType, value },
                { headers: { token } }
            );
            if (REFRESH_INTERACTIONS.has(interactionType)) {
                getRecommendations();
            }
        } catch { /* non-critical, don't interrupt UX */ }
    }, [token, backendUrl, getRecommendations]);

    const getAllCategories = useCallback(async () => {
        try {
            const response = await axios.get(backendUrl+'/api/category/list')
            if(response.data.success){
                setHomepageCategories(response.data)
            }
            else{
                toast.error(response.data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }, [backendUrl])

    useEffect(()=>{
        getProductsData()
    },[getProductsData])

    useEffect(()=>{
        getAllCategories()
    },[getAllCategories])

    useEffect(()=>{
        const restoreAuth = async () => {
            try {
                const response = await axios.post(backendUrl + '/api/user/refresh', {});
                if (response.data.success && response.data.accessToken) {
                    setToken(response.data.accessToken);
                }
            } catch {
                setToken('');
            }
        };
        if (!token) {
            restoreAuth();
        }
    },[token, backendUrl])

    // Load cart và user profile sau khi có token và products đã load xong
    useEffect(()=>{
        if(token && products.length > 0){
            getUserCart(token)
            getUserProfile(token)
        } else if (!token) {
            // Reset user role when logged out
            setUserRole('user')
            setUserProfile(null)
        }
    },[token, products, getUserCart, getUserProfile])

    // Load user profile ngay khi có token (không cần chờ products)
    useEffect(()=>{
        if(token){
            getUserProfile(token)
        }
    },[token, getUserProfile])

    // Giá trị được cung cấp cho các component con
    const value = {
        homepageCategories,
        getAllCategories,
        products,
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

    return (
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    );
};

export default ShopContextProvider;
