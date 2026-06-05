import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import ProfileSidebar from '../../components/profile/ProfileSidebar';
import { ShopContext } from '../../context/ShopContext';

const fmt = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n) || 0);

const fmtDate = (ts) =>
  new Date(Number(ts)).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const typeLabel = { PLATFORM: 'Toàn sàn', SHIPPING: 'Miễn phí vận chuyển' };
const typeBg = { PLATFORM: 'bg-red-500', SHIPPING: 'bg-blue-500' };

const VoucherCard = ({ voucher }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(voucher.code).then(() => toast.success(`Đã sao chép: ${voucher.code}`));
  };

  const discountText =
    voucher.discountType === 'PERCENT'
      ? `Giảm ${voucher.discountValue}%${voucher.maxDiscount > 0 ? ` (tối đa ${fmt(voucher.maxDiscount)})` : ''}`
      : `Giảm ${fmt(voucher.discountValue)}`;

  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Left accent */}
      <div className={`${typeBg[voucher.type] || 'bg-gray-500'} w-2 flex-shrink-0`} />

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs text-white px-2 py-0.5 rounded font-medium ${typeBg[voucher.type] || 'bg-gray-500'}`}>
                {typeLabel[voucher.type] || voucher.type}
              </span>
              <span className="font-mono font-bold text-sm text-gray-800">{voucher.code}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{discountText}</p>
            {voucher.minOrderValue > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">Đơn tối thiểu {fmt(voucher.minOrderValue)}</p>
            )}
            {voucher.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{voucher.description}</p>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="flex-shrink-0 border border-black text-black text-xs font-medium px-3 py-1.5 rounded hover:bg-black hover:text-white transition-colors"
          >
            Sao chép
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">HSD: {fmtDate(voucher.endAt)}</span>
          {voucher.usageLimit > 0 && (
            <span className="text-xs text-gray-400">
              Còn {Math.max(0, voucher.usageLimit - voucher.usedCount)} lượt
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileVouchers = () => {
  const { backendUrl } = useContext(ShopContext);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    axios
      .get(`${backendUrl}/api/voucher/public`)
      .then((res) => {
        if (res.data.success) setVouchers(res.data.vouchers || []);
      })
      .catch(() => toast.error('Không thể tải danh sách mã giảm giá'))
      .finally(() => setLoading(false));
  }, [backendUrl]);

  const tabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'PLATFORM', label: 'Toàn sàn' },
    { key: 'SHIPPING', label: 'Vận chuyển' },
  ];

  const filtered = tab === 'all' ? vouchers : vouchers.filter((v) => v.type === tab);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Kho mã giảm giá</h1>

          {/* Tabs */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm mb-5 w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-white rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-400 text-4xl mb-3">🎫</p>
              <p className="text-gray-500">Hiện chưa có mã giảm giá nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((v) => (
                <VoucherCard key={v._id} voucher={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileVouchers;
