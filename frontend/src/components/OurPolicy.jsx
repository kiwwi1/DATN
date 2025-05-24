import React from 'react'
import { assets } from '../assets/assets'

const OurPolicy = () => {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-12 text-center'>
        <div className='group p-8 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-300'>
            <div className='bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-gray-100 transition-colors'>
                <img src={assets.exchange_icon} className='w-8 h-8' alt="Exchange Policy"/>
            </div>
            <h3 className='font-semibold text-lg mb-2'>Easy Exchange Policy</h3>
            <p className='text-gray-500'>We offer free exchange policy for all our products</p>
        </div>

        <div className='group p-8 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-300'>
            <div className='bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-gray-100 transition-colors'>
                <img src={assets.quality_icon} className='w-8 h-8' alt="Return Policy"/>
            </div>
            <h3 className='font-semibold text-lg mb-2'>7 Days Return Policy</h3>
            <p className='text-gray-500'>We provide 7 days free return policy for your convenience</p>
        </div>

        <div className='group p-8 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-300'>
            <div className='bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-gray-100 transition-colors'>
                <img src={assets.support_img} className='w-8 h-8' alt="Customer Support"/>
            </div>
            <h3 className='font-semibold text-lg mb-2'>Best Customer Support</h3>
            <p className='text-gray-500'>24/7 customer support to assist you with any queries</p>
        </div>
    </div>
  )
}

export default OurPolicy