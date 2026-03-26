import React, { useState, useEffect } from 'react'
import { assets } from '../../assets/assets'

const Hero = () => {
  const heroImages = [
    assets.hero_img,
    assets.hero_img,
    assets.hero_img,
    assets.hero_img
  ];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState('right');
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setSlideDirection('right');
      setCurrentIndex(prevIndex => 
        prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);
    
    return () => clearInterval(interval);
  }, [heroImages.length]);
  
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
    <div className='relative bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden'>
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent animate-pulse"></div>
      </div>

      <div className='flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12'>
        <div className={`w-full sm:w-1/2 text-white transform transition-all duration-1000 ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
          <div className='space-y-4'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-[2px] bg-gradient-to-r from-white to-transparent'></div>
              <p className='font-medium tracking-wider text-xs md:text-sm text-gray-300'>OUR BESTSELLER</p>
            </div>
            <h1 className='text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight'>
              <span className='block'>Latest</span>
              <span className='block text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400'>Arrival</span>
            </h1>
            <p className='text-gray-300 text-xs md:text-sm max-w-md'>
              Discover our newest collection of premium fashion items, crafted with the finest materials and attention to detail.
            </p>
            <div className='flex items-center gap-3'>
              <button className='px-6 py-2.5 bg-white text-gray-900 rounded-full text-sm font-medium hover:bg-gray-100 transition-all duration-300 transform hover:scale-105'>
                SHOP NOW
              </button>
              <button className='px-6 py-2.5 border border-white text-white rounded-full text-sm font-medium hover:bg-white/10 transition-all duration-300'>
                LEARN MORE
              </button>
            </div>
          </div>
        </div>
        
        <div className='w-full sm:w-1/2 relative mt-8 sm:mt-0'>
          <div className={`relative overflow-hidden rounded-2xl shadow-2xl transform transition-all duration-1000 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
            <div 
              className={`
                transition-transform duration-700 ease-in-out 
                ${slideDirection === 'right' ? 'slide-right' : 'slide-left'}
              `} 
              style={{ width: '100%', height: '100%' }}
            >
              <img 
                className='w-full h-[320px] sm:h-[360px] object-cover rounded-2xl' 
                src={heroImages[currentIndex]} 
                alt="Hero image"
              />
            </div>
            
            {/* Navigation Arrows with glass effect */}
            <div className='absolute inset-0 flex items-center justify-between px-4'>
              <button 
                onClick={prevSlide}
                className='backdrop-blur-md bg-white/10 hover:bg-white/20 rounded-full p-4 text-white z-10 transition-all duration-300 transform hover:scale-110'
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                onClick={nextSlide}
                className='backdrop-blur-md bg-white/10 hover:bg-white/20 rounded-full p-4 text-white z-10 transition-all duration-300 transform hover:scale-110'
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            {/* Slide Indicators with glass effect */}
            <div className='absolute bottom-6 left-0 right-0 flex justify-center gap-3'>
              {heroImages.map((_, index) => (
                <button 
                  key={index}
                  onClick={() => {
                    setSlideDirection(index > currentIndex ? 'right' : 'left');
                    setCurrentIndex(index);
                  }}
                  className={`
                    h-2.5 w-2.5 rounded-full transition-all duration-300 backdrop-blur-md
                    ${index === currentIndex 
                      ? 'bg-white scale-125' 
                      : 'bg-white/50 hover:bg-white/75'
                    }
                  `}
                />
              ))}
            </div>
          </div>
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