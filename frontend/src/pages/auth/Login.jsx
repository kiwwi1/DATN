import React from "react";
import { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShopContext } from "../../context/ShopContext";
import axios from 'axios'
import { toast } from 'react-toastify'
import { GoogleLogin } from '@react-oauth/google'

const Login = () => {
  const [currentState, setCurrentState] = useState("Login");
  const { token, setToken, navigate, backendUrl } = useContext(ShopContext)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const EyeIcon = ({ open }) => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  )

  // OTP verification step
  const [pendingEmail, setPendingEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      if (currentState === "Sign Up") {
        if (password !== confirmPassword) {
          toast.error('Mật khẩu xác nhận chưa khớp.')
          return
        }
        const response = await axios.post(backendUrl + '/api/user/register', { name, email, password })
        if (response.data.success) {
          if (response.data.requiresVerification) {
            setPendingEmail(email)
            setIsVerifying(true)
            toast.success('Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.')
          } else {
            setToken(response.data.accessToken || '')
          }
        } else {
          toast.error(response.data.message || 'Đăng ký thất bại')
        }
      } else {
        const response = await axios.post(backendUrl + '/api/user/login', { email, password })
        if (response.data.success) {
          toast.success(response.data.message || 'Đăng nhập thành công!')
          setToken(response.data.accessToken || '')
          navigate('/')
        } else {
          toast.error(response.data.message || 'Đăng nhập thất bại')
        }
      }
    } catch (error) {
      console.log(error)
      toast.error(error.response?.data?.message || error.message)
    }
  };

  const onVerifyOtpHandler = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(backendUrl + '/api/user/verify-email', { email: pendingEmail, otp })
      if (response.data.success) {
        toast.success('Xác minh email thành công! Chào mừng bạn.')
        setToken(response.data.accessToken || '')
        navigate('/')
      } else {
        toast.error(response.data.message || 'Xác minh thất bại')
      }
    } catch (error) {
      console.log(error)
      toast.error(error.response?.data?.message || error.message)
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      const res = await axios.post(`${backendUrl}/api/user/google`, {
        credential: credentialResponse.credential
      });
      if (res.data.success) {
        setToken(res.data.accessToken || '');
        navigate('/');
      } else {
        toast.error(res.data.message || 'Đăng nhập Google thất bại');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    if (token) {
      navigate('/')
    }
  }, [token, navigate])

  if (isVerifying) {
    return (
      <form
        onSubmit={onVerifyOtpHandler}
        className="flex flex-col items-center w-[90%] sm:max-w-96 m-auto mt-14 gap-4 text-gray-800"
      >
        <div className="inline-flex gap-2 items-center mb-2 mt-10">
          <p className="prata-regular text-3xl">Xác minh Email</p>
          <hr className="border-none h-[1.5px] w-8 bg-gray-800" />
        </div>
        <p className="text-sm text-gray-500 text-center">
          Mã OTP đã được gửi đến <span className="font-medium text-gray-800">{pendingEmail}</span>.<br />
          Vui lòng kiểm tra hộp thư (kể cả thư mục spam).
        </p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          className="w-full px-3 py-2 border border-gray-800 text-center text-2xl tracking-[0.5em] font-mono"
          placeholder="● ● ● ● ● ●"
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" className="bg-black text-white font-light px-8 py-2 mt-2 w-full">
          Xác minh
        </button>
        <p
          onClick={() => { setIsVerifying(false); setOtp('') }}
          className="text-sm text-gray-500 cursor-pointer underline"
        >
          Quay lại đăng ký
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmitHandler}
      className="flex flex-col items-center w-[90%] sm:max-w-96 m-auto mt-14 gap-4 text-gray-800"
    >
      <div className="inline-flex gap-2 items-center mb-2 mt-10">
        <p className="prata-regular text-3xl">{currentState}</p>
        <hr className="border-none h-[1.5px] w-8 bg-gray-800"></hr>
      </div>
      {currentState === "Login" ? (
        ""
      ) : (
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-800"
          placeholder="Name"
          required={currentState === "Sign Up"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        ></input>
      )}
      <input
        type="email"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      ></input>
      <div className="w-full relative">
        <input
          type={showPassword ? "text" : "password"}
          className="w-full px-3 py-2 border border-gray-800 pr-16"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <EyeIcon open={showPassword} />
        </button>
      </div>
      {currentState === "Sign Up" && (
        <div className="w-full relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            className="w-full px-3 py-2 border border-gray-800 pr-16"
            placeholder="Confirm password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
          >
            <EyeIcon open={showConfirmPassword} />
          </button>
        </div>
      )}
      <div className="w-full flex justify-between text-sm mt-[-8px]">
        {currentState === "Login" ? (
          <Link to="/forgot-password" className="cursor-pointer underline">
            Quên mật khẩu
          </Link>
        ) : (
          <span />
        )}
        {currentState === "Login" ? (
          <p
            onClick={() => {
              setCurrentState("Sign Up")
              setConfirmPassword('')
            }}
            className="cursor-pointer"
          >
            Create Account
          </p>
        ) : (
          <p
            onClick={() => {
              setCurrentState("Login")
              setConfirmPassword('')
            }}
            className="cursor-pointer"
          >
            Login Here
          </p>
        )}
      </div>
      <button type="submit" className="bg-black text-white font-light px-8 py-2 mt-5">
        {currentState === "Login" ? "Login" : "Sign Up"}
      </button>

      <div className="w-full flex items-center gap-3 my-1">
        <hr className="flex-1 border-gray-300" />
        <span className="text-xs text-gray-400">hoặc</span>
        <hr className="flex-1 border-gray-300" />
      </div>

      <GoogleLogin
        onSuccess={handleGoogleLogin}
        onError={() => toast.error('Đăng nhập Google thất bại')}
        width="384"
        text={currentState === "Login" ? "signin_with" : "signup_with"}
        shape="rectangular"
        logo_alignment="left"
      />
    </form>
  );
};

export default Login;
