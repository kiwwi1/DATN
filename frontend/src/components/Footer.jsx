import React from 'react'
import { assets } from '../assets/assets'

const Footer = () => {
  return (
    <div>
        <div className='flex flex-col sm:grid grid-cols-[3fr_1fr_1fr] gap-14 my-10 mt-40 text-sm'>
        <div>
            <img src={assets.logo} className='w-32 mb-5'/>
            <p className='text-gray-500 w-full '>Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus.</p>
        </div>
        <div>
            <p className='text-xl font-medium mb-5'>COMPANY</p>
            <ul className='flex flex-col gap-1 text-gray-600'> 
                <li>Home</li>
                <li>About Us</li>
                <li>Delivery</li>
                <li>Privacy Policy</li>
            </ul>
        </div>

        <div>
            <p className='text-xl font-medium mb-5'>GET IN TOUCH</p>
            <ul className='flex flex-col gap-1 text-gray-600'> 
                <li>+841111111</li>
                <li>dquanghuy@gmail.com</li>
            </ul>
        </div>

        </div>
        <div>
            <hr/>
            <p className='py-5 text-sm text-center'>
                Copyright © 2025 <span className='font-semibold'>Quang Huy</span>. All rights reserved.
            </p>
        </div>
    </div>
  )
}

export default Footer