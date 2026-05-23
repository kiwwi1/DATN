import React from 'react'
import { assets } from '../assets/assets'

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'

const Login = ({ isCheckingSession = false }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-center mb-6">
            <img src={assets.logo} alt="logo" className="w-32 h-auto" />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Vendor Dashboard</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in on the main storefront with the same buyer/seller account.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Sign in on storefront</p>
                <p className="text-xs text-gray-500 mt-0.5">Use your existing account. No separate admin login flow.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Open Vendor Dashboard</p>
                <p className="text-xs text-gray-500 mt-0.5">Click "VENDOR'S PAGE" in the storefront navbar.</p>
              </div>
            </div>
            <a
              href={FRONTEND_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Go to storefront
            </a>
          </div>

          {isCheckingSession && (
            <p className="text-center text-sm text-gray-500">Checking login session...</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
