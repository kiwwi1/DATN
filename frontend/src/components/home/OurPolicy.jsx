import React from 'react'
import { assets } from '../../assets/assets'

const OurPolicy = () => {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-12 text-center'>
        <div className='group p-8 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-300'>
            <div className='bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-gray-100 transition-colors'>
                <img src={assets.exchange_icon} className='w-8 h-8' alt="Chính sách đổi hàng"/>
            </div>
            <h3 className='font-semibold text-lg mb-2'>Đổi hàng dễ dàng</h3>
            <p className='text-gray-500'>Hỗ trợ đổi hàng nhanh chóng theo chính sách của cửa hàng.</p>
        </div>

        <div className='group p-8 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-300'>
            <div className='bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-gray-100 transition-colors'>
                <img src={assets.quality_icon} className='w-8 h-8' alt="Chính sách hoàn trả"/>
            </div>
            <h3 className='font-semibold text-lg mb-2'>Trả hàng trong 7 ngày</h3>
            <p className='text-gray-500'>Bạn có thể yêu cầu trả hàng trong 7 ngày theo điều kiện áp dụng.</p>
        </div>

        <div className='group p-8 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-300'>
            <div className='bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-gray-100 transition-colors'>
                <img src={assets.support_img} className='w-8 h-8' alt="Hỗ trợ khách hàng"/>
            </div>
            <h3 className='font-semibold text-lg mb-2'>Hỗ trợ tận tâm</h3>
            <p className='text-gray-500'>Đội ngũ chăm sóc khách hàng luôn sẵn sàng hỗ trợ khi bạn cần.</p>
        </div>
    </div>
  )
}

export default OurPolicy
