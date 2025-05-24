import React, { useState } from 'react'
import { assets } from '../assets/assets'
import axios from 'axios'
import { backendUrl } from '../App'
import { toast } from 'react-toastify'


const Login = ({setToken}) => {
  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")


  
  const handleSubmit = async(e) => {
    try {
        e.preventDefault()
        const response = await axios.post(backendUrl+'/api/user/admin',{email,password})
        if(response.data.success){
            setToken(response.data.token)
        }
        else{
            toast.error(response.data.message)
        }
    } catch (error) {
        console.log(error)
        toast.error(error.response.data.message)
    }
  }



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] bg-[length:20px_20px]"></div>
      
      <div className="relative w-full max-w-md p-8 transform hover:scale-[1.01] transition-transform duration-300">
        {/* Card Container */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Logo Section */}
          <div className="flex justify-center mb-8">
            <img src={assets.logo} alt="logo" className="w-32 h-auto" />
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Welcome Back
            </h2>
            <p className="text-gray-500 mt-2">Please sign in to continue</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div className="relative group">
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-300"
                placeholder="Email address"
                required
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm"></div>
            </div>

            {/* Password Input */}
            <div className="relative group">
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-300"
                placeholder="Password"
                required
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm"></div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-purple-600 hover:text-purple-700 font-medium">
                Forgot password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full relative group overflow-hidden px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
            >
              <div className="absolute inset-0 w-full h-full transition-all duration-300 ease-out transform translate-x-0 -skew-x-12 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500"></div>
              <span className="relative">Sign In</span>
            </button>
          </form>

          
        </div>
      </div>
    </div>
  )
}

export default Login