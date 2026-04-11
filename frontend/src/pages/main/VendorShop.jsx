import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ShopContext } from '../../context/ShopContext';
import ProductItem from '../../components/product/ProductItem';

const TAB_ITEMS = [
  { id: 'all', label: 'TẤT CẢ SẢN PHẨM' },
  { id: 'sale', label: 'Giảm giá' },
  { id: 'toy', label: 'Đồ chơi' },
  { id: 'bestsell', label: 'Sản phẩm bán chạy' },
  { id: 'new', label: 'Hàng mới về' },
];

const VendorShop = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { backendUrl, token } = useContext(ShopContext);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [vendor, setVendor] = useState(null);
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    const loadVendorShop = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${backendUrl}/api/product/vendor-shop/${vendorId}`);
        if (res.data.success) {
          setVendor(res.data.vendor);
          setStats(res.data.stats);
          setProducts(res.data.products || []);
          const initialFollowers =
            res.data?.stats?.followers ??
            res.data?.vendor?.followers ??
            0;
          setFollowerCount(initialFollowers);
        } else {
          toast.error(res.data.message || 'Không tải được thông tin shop');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
      } finally {
        setLoading(false);
      }
    };
    if (vendorId) loadVendorShop();
  }, [backendUrl, vendorId]);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/shop-follow/count/${vendorId}`);
        if (res.data.success) setFollowerCount(res.data.followerCount || 0);
      } catch (_) {}
    };
    if (vendorId) loadCount();
  }, [backendUrl, vendorId]);

  useEffect(() => {
    const loadStatus = async () => {
      if (!token || !vendorId) {
        setIsFollowing(false);
        return;
      }
      try {
        const res = await axios.get(`${backendUrl}/api/shop-follow/status/${vendorId}`, {
          headers: { token },
        });
        if (res.data.success) setIsFollowing(!!res.data.followed);
      } catch (_) {
        setIsFollowing(false);
      }
    };
    loadStatus();
  }, [backendUrl, token, vendorId]);

  const handleFollowToggle = async () => {
    if (!token) {
      toast.info('Vui lòng đăng nhập để theo dõi shop');
      navigate('/login');
      return;
    }
    setFollowLoading(true);
    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      const res = await axios.post(
        `${backendUrl}/api/shop-follow/${endpoint}`,
        { vendorId },
        { headers: { token } }
      );
      if (res.data.success) {
        const next = !isFollowing;
        setIsFollowing(next);
        const countFromApi = res.data?.result?.followerCount;
        if (typeof countFromApi === 'number') setFollowerCount(countFromApi);
        toast.success(next ? 'Đã theo dõi shop' : 'Đã bỏ theo dõi shop');
      } else {
        toast.error(res.data.message || 'Thao tác thất bại');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!token) {
      toast.info('Vui lòng đăng nhập để nhắn tin với shop');
      navigate('/login');
      return;
    }
    try {
      const res = await axios.post(
        `${backendUrl}/api/chat/init`,
        { vendorId },
        { headers: { token } }
      );
      if (res.data.success) {
        const conversationId = res.data.conversation?._id;
        if (!conversationId) throw new Error('Không lấy được cuộc hội thoại');
        window.dispatchEvent(
          new CustomEvent('open-chat-conversation', { detail: { conversationId } })
        );
      } else {
        toast.error(res.data.message || 'Không thể tạo cuộc hội thoại');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const filteredProducts = useMemo(() => {
    switch (activeTab) {
      case 'sale':
        return products.filter((p) => (p.discount || 0) > 0);
      case 'toy':
        return products.filter((p) =>
          String(p.name || '').toLowerCase().includes('đồ chơi') ||
          String(p.name || '').toLowerCase().includes('toy')
        );
      case 'bestsell':
        return [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0));
      case 'new':
        return [...products].sort((a, b) => (b.date || 0) - (a.date || 0));
      default:
        return products;
    }
  }, [products, activeTab]);

  if (loading) {
    return <div className="py-16 text-center text-gray-500">Đang tải thông tin shop...</div>;
  }

  if (!vendor) {
    return <div className="py-16 text-center text-gray-500">Không tìm thấy shop.</div>;
  }

  return (
    <div className="mt-6">
      <div className="bg-white border rounded-lg p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          <div className="rounded-lg p-4 bg-gradient-to-r from-gray-700 to-gray-500 text-white">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/90 text-gray-700 flex items-center justify-center font-bold text-xl">
                {String(vendor.shopName || vendor.name).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-lg leading-tight">{vendor.shopName || vendor.name}</p>
                <p className="text-xs text-white/85">Online</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`py-2 text-sm border rounded transition-colors ${
                  isFollowing
                    ? 'border-white/70 bg-white/15'
                    : 'border-white/50 hover:bg-white/10'
                } ${followLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {followLoading ? 'Đang xử lý...' : isFollowing ? '✓ Đang theo dõi' : '+ Theo dõi'}
              </button>
              <button
                type="button"
                onClick={handleStartChat}
                className="py-2 text-sm border border-white/50 rounded hover:bg-white/10"
              >
                Chat
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
            <p className="text-gray-600">Sản phẩm: <span className="text-orange-600">{stats?.productCount ?? 0}</span></p>
            <p className="text-gray-600">Người theo dõi: <span className="text-orange-600">{followerCount}</span></p>
            <p className="text-gray-600">Đang theo dõi: <span className="text-orange-600">13</span></p>
            <p className="text-gray-600">Đánh giá: <span className="text-orange-600">{stats?.avgRating ?? 0} ({stats?.reviewCount ?? 0} đánh giá)</span></p>
            <p className="text-gray-600">Tỉ lệ phản hồi chat: <span className="text-orange-600">{stats?.replyRate ?? 94}% ({stats?.replyTimeText ?? 'trong vài giờ'})</span></p>
            <p className="text-gray-600">Tham gia vào: <span className="text-orange-600">{vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString('vi-VN') : '—'}</span></p>
          </div>
        </div>
      </div>

      <div className="mt-5 border-b flex flex-wrap gap-4 text-sm">
        {TAB_ITEMS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-800">GỢI Ý CHO BẠN</h3>
          <Link to="/collection" className="text-sm text-orange-600 hover:underline">Xem tất cả</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredProducts.map((item) => (
            <ProductItem
              key={item._id}
              id={item._id}
              image={item.image}
              name={item.name}
              price={item.price}
              originalPrice={item.originalPrice}
              discount={item.discount}
              rating={item.rating}
              sold={item.sold}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default VendorShop;
