import React from 'react'
import Hero from '../../components/home/Hero'
import LatestCollection from '../../components/home/LatestCollection'
import BestSeller from '../../components/home/BestSeller'
import OurPolicy from '../../components/home/OurPolicy'
import NewsletterBox from '../../components/home/NewsletterBox'
import CategorySelection from '../../components/home/CategorySelection'
import Recommendations from '../../components/home/Recommendations'

const Home = () => {
  return (
    <div className='mt-3'>
      <Hero />
      <BestSeller />
      <CategorySelection/>
      <LatestCollection />
      <Recommendations />
      <OurPolicy/>
      <NewsletterBox/>
    </div>
  )
}

export default Home
