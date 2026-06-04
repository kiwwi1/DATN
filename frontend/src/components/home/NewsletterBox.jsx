import React from 'react'

const NewsletterBox = () => {
    const onSubmitHandler = (event) => {
        event.preventDefault();
    }
  return (
    <div className='text-center max-w-3xl mx-auto'>
        <h2 className='text-3xl md:text-4xl font-bold mb-4'>Đăng Ký Nhận Tin</h2>
        <p className='text-gray-300 mb-8 text-sm md:text-base'>
            Nhận cập nhật về sản phẩm mới, ưu đãi độc quyền và các chương trình khuyến mãi hấp dẫn.
        </p>
        <form onSubmit={onSubmitHandler} className='flex flex-col sm:flex-row items-center gap-4 max-w-xl mx-auto'> 
            <input 
                className='w-full px-6 py-4 rounded-full bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors' 
                type="email" 
                placeholder='Nhập địa chỉ email của bạn' 
                required
            />
            <button 
                type='submit' 
                className='w-full sm:w-auto px-8 py-4 bg-white text-gray-900 rounded-full font-medium hover:bg-gray-100 transition-colors duration-300'
            >
                Đăng Ký Ngay
            </button>
        </form>
    </div>
  )
}

export default NewsletterBox
