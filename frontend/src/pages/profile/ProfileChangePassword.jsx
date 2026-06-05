import React, { useContext, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import ProfileSidebar from '../../components/profile/ProfileSidebar';
import { ShopContext } from '../../context/ShopContext';

const Field = ({ label, id, value, onChange, show, onToggle, placeholder }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black pr-20"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
      >
        {show ? 'Ẩn' : 'Hiện'}
      </button>
    </div>
  </div>
);

const ProfileChangePassword = () => {
  const { backendUrl, token } = useContext(ShopContext);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (key) => () => setShow((s) => ({ ...s, [key]: !s[key] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/user/change-password`,
        { currentPassword: form.currentPassword, newPassword: form.newPassword },
        { headers: { token } }
      );
      if (res.data.success) {
        toast.success('Đổi mật khẩu thành công');
        setForm({ currentPassword: '', newPassword: '', confirm: '' });
      } else {
        toast.error(res.data.message || 'Đổi mật khẩu thất bại');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Đổi mật khẩu</h1>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-5">
            <Field
              label="Mật khẩu hiện tại"
              id="currentPassword"
              value={form.currentPassword}
              onChange={set('currentPassword')}
              show={show.current}
              onToggle={toggle('current')}
              placeholder="Nhập mật khẩu hiện tại"
            />
            <Field
              label="Mật khẩu mới"
              id="newPassword"
              value={form.newPassword}
              onChange={set('newPassword')}
              show={show.new}
              onToggle={toggle('new')}
              placeholder="Tối thiểu 8 ký tự, gồm chữ và số"
            />
            <Field
              label="Xác nhận mật khẩu mới"
              id="confirm"
              value={form.confirm}
              onChange={set('confirm')}
              show={show.confirm}
              onToggle={toggle('confirm')}
              placeholder="Nhập lại mật khẩu mới"
            />

            <button
              type="submit"
              disabled={loading || !form.currentPassword || !form.newPassword || !form.confirm}
              className="w-full bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileChangePassword;
