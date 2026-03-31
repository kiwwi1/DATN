import React, { useContext, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { ShopContext } from "../../context/ShopContext";

const ResetPassword = () => {
  const { backendUrl, navigate } = useContext(ShopContext);
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    if (!token) {
      toast.error("Thiếu token trong liên kết. Hãy mở link từ email.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${backendUrl}/api/user/reset-password`, {
        token,
        password,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        navigate("/login");
      } else {
        toast.error(res.data.message || "Đặt lại mật khẩu thất bại");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col items-center w-[90%] sm:max-w-96 m-auto mt-14 gap-4 text-gray-800"
    >
      <div className="inline-flex gap-2 items-center mb-2 mt-10">
        <p className="prata-regular text-3xl">Đặt lại mật khẩu</p>
        <hr className="border-none h-[1.5px] w-8 bg-gray-800" />
      </div>
      {!token && (
        <p className="text-sm text-red-600 text-center">
          Liên kết không hợp lệ. Hãy dùng nút trong email hoặc yêu cầu gửi lại.
        </p>
      )}
      <input
        type="password"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Xác nhận mật khẩu"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading || !token}
        className="bg-black text-white font-light px-8 py-2 mt-2 disabled:opacity-60"
      >
        {loading ? "Đang lưu…" : "Cập nhật mật khẩu"}
      </button>
      <Link to="/login" className="text-sm mt-2 underline">
        Đăng nhập
      </Link>
    </form>
  );
};

export default ResetPassword;
