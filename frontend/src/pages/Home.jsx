import React from 'react'
import Hero from '../components/Hero'
import LatestCollection from '../components/LatestCollection'
import BestSeller from '../components/BestSeller'
import OurPolicy from '../components/OurPolicy'
import NewsletterBox from '../components/NewsletterBox'
import CategorySelection from '../components/CategorySelection'
import HomeSearchBar from '../components/HomeSearchBar'

const Home = () => {
  return (
    <div>
      <Hero />
      <HomeSearchBar />
      <CategorySelection/>
      <LatestCollection />
      <BestSeller />
      <OurPolicy/>
      <NewsletterBox/>
    </div>
  )
}

export default Home