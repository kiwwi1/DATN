import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { ShopContext } from "../../context/ShopContext";

const ForgotPassword = () => {
  const { backendUrl } = useContext(ShopContext);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/user/forgot-password`,
        { email }
      );
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message || "Có lỗi xảy ra");
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
        <p className="prata-regular text-3xl">Quên mật khẩu</p>
        <hr className="border-none h-[1.5px] w-8 bg-gray-800" />
      </div>
      <p className="text-sm text-gray-600 text-center">
        Nhập email đăng ký. Nếu tài khoản tồn tại, bạn sẽ nhận email hướng dẫn.
      </p>
      <input
        type="email"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white font-light px-8 py-2 mt-2 disabled:opacity-60"
      >
        {loading ? "Đang gửi…" : "Gửi liên kết"}
      </button>
      <Link to="/login" className="text-sm mt-2 underline">
        Quay lại đăng nhập
      </Link>
    </form>
  );
};

export default ForgotPassword;
