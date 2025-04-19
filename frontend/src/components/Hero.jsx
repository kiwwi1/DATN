import React, { useState, useEffect } from 'react'
import {assets} from '../assets/assets'

const Hero = () => {
  // Assuming you have multiple hero images in your assets
  const heroImages = [
    assets.hero_img,
    assets.hero_img,
    assets.hero_img,
    assets.hero_img
  ];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState('right'); // 'right' or 'left'
  
  // Optional: Auto-rotate slides
  useEffect(() => {
    const interval = setInterval(() => {
      setSlideDirection('right');
      setCurrentIndex(prevIndex => 
        prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000); // Change slide every 5 seconds
    
    return () => clearInterval(interval);
  }, [heroImages.length]);
  
  // Navigation functions
  const nextSlide = () => {
    setSlideDirection('right');
    setCurrentIndex(prevIndex => 
      prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
    );
  };
  
  const prevSlide = () => {
    setSlideDirection('left');
    setCurrentIndex(prevIndex => 
      prevIndex === 0 ? heroImages.length - 1 : prevIndex - 1
    );
  };
  
  return (
    <div className='flex flex-col sm:flex-row border border-gray-400'>
        <div className='w-full sm:w-1/2 flex items-center justify-center py-10 sm:py-0'>
            <div className='text-[#414141]'>
                <div className='flex items-center gap-2'>
                    <p className='w-8 md:w-11 h-[2px] bg-[#414141]'></p>
                    <p className='font-medium text-sm md:text-base'>OUR BESTSELLER</p>
                </div>
                <h1 className='prata-regular text-3xl sm:py-3 lg:text-5xl leading-relaxed'>Latest Arrival</h1>
                <div className='flex items-center gap-2'>
                    <p className='font-semibold text-sm md:text-base'>SHOP NOW</p>
                    <p className='w-8 md:w-11 h-[1px] bg-[#414141]'></p>
                </div>
            </div>
        </div>
        
        {/* Image Slider with improved transitions */}
        <div className='w-full sm:w-1/2 relative overflow-hidden'>
            <div 
              className={`
                transition-transform duration-500 ease-in-out 
                ${slideDirection === 'right' ? 'slide-right' : 'slide-left'}
              `} 
              style={{ width: '100%', height: '100%' }}
            >
              <img 
                className='w-full h-full object-cover' 
                src={heroImages[currentIndex]} 
                alt="Hero image"
              />
            </div>
            
            {/* Navigation Arrows */}
            <div className='absolute inset-0 flex items-center justify-between px-4'>
              <button 
                onClick={prevSlide}
                className='bg-white/30 hover:bg-white/50 rounded-full p-2 text-gray-800 z-10 transition-colors'
              >
                &#10094;
              </button>
              <button 
                onClick={nextSlide}
                className='bg-white/30 hover:bg-white/50 rounded-full p-2 text-gray-800 z-10 transition-colors'
              >
                &#10095;
              </button>
            </div>
            
            {/* Slide Indicators */}
            <div className='absolute bottom-4 left-0 right-0 flex justify-center gap-2'>
              {heroImages.map((_, index) => (
                <button 
                  key={index}
                  onClick={() => {
                    setSlideDirection(index > currentIndex ? 'right' : 'left');
                    setCurrentIndex(index);
                  }}
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'bg-white scale-125' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
        </div>
    </div>
  )
}

// Thêm CSS này vào file CSS của bạn hoặc tạo một <style> element
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideInLeft {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .slide-right {
    animation: slideInRight 0.5s forwards;
  }

  .slide-left {
    animation: slideInLeft 0.5s forwards;
  }
`;
document.head.appendChild(styleElement);

export default Hero