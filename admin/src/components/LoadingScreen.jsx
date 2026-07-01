import React from 'react'

const LoadingScreen = ({ message = 'Đang tải dữ liệu...' }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50">
      <div className="relative flex flex-col items-center">
        {/* Glow background effect */}
        <div className="absolute -inset-10 animate-pulse rounded-full bg-pink-500/10 blur-2xl" />
        
        {/* Brand Text */}
        <div className="relative mb-6 text-center">
          <span className="prata-regular text-5xl text-slate-900 tracking-wider">Lumière</span>
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-pink-600">Kênh Người Bán</p>
        </div>

        {/* Spinner */}
        <div className="relative flex items-center justify-center">
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500" />
          <div className="absolute h-6 w-6 animate-ping rounded-full bg-pink-500/10" />
        </div>

        {/* Message */}
        <p className="mt-6 text-xs font-semibold text-slate-500 tracking-wide">
          {message}
        </p>
      </div>
    </div>
  )
}

export default LoadingScreen
