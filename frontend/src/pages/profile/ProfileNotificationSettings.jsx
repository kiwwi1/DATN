import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import ProfileSidebar from '../../components/profile/ProfileSidebar';
import { ShopContext } from '../../context/ShopContext';

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
      checked ? 'bg-black' : 'bg-gray-200'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const ProfileNotificationSettings = () => {
  const { backendUrl, token } = useContext(ShopContext);
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${backendUrl}/api/user/notification-prefs`, { headers: { token } })
      .then((res) => {
        if (res.data.success) setPrefs(res.data.prefs);
      })
      .catch(() => toast.error('Không thể tải cài đặt thông báo'));
  }, [backendUrl, token]);

  const handleToggle = async (key, value) => {
    setSaving(true);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const res = await axios.patch(
        `${backendUrl}/api/user/notification-prefs`,
        { [key]: value },
        { headers: { token } }
      );
      if (res.data.success) {
        setPrefs(res.data.prefs);
        toast.success('Đã lưu cài đặt');
      }
    } catch {
      setPrefs({ ...prefs });
      toast.error('Lưu thất bại, thử lại sau');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Cài đặt thông báo</h1>

          <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
            {/* Section: Email */}
            <div className="px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Email
              </h2>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Thông báo giảm giá qua email</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Nhận email khi sản phẩm trong giỏ hàng giảm giá (yêu cầu bật thông báo cho từng sản phẩm)
                  </p>
                </div>
                {prefs === null ? (
                  <div className="h-6 w-11 bg-gray-200 rounded-full animate-pulse" />
                ) : (
                  <Toggle
                    checked={prefs.emailPriceDrop !== false}
                    onChange={(val) => handleToggle('emailPriceDrop', val)}
                    disabled={saving}
                  />
                )}
              </div>
            </div>

            {/* Section: In-app */}
            <div className="px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Thông báo trong ứng dụng
              </h2>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Thông báo giảm giá</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Luôn bật — hiển thị trong chuông thông báo khi giá giảm
                  </p>
                </div>
                <Toggle checked={true} onChange={() => {}} disabled={true} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Cập nhật đơn hàng</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Luôn bật — nhận thông báo khi trạng thái đơn hàng thay đổi
                  </p>
                </div>
                <Toggle checked={true} onChange={() => {}} disabled={true} />
              </div>
            </div>

            {/* Info footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
              <p className="text-xs text-gray-400">
                Để bật/tắt thông báo cho một sản phẩm cụ thể, truy cập trang sản phẩm và nhấn vào biểu tượng chuông.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileNotificationSettings;
