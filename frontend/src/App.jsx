import React from 'react'
import { Route,Routes } from 'react-router-dom'
import Login from './pages/Login'
import PlaceOrder from './pages/PlaceOrder'
import Orders from './pages/Orders'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import Collection from './pages/Collection'
import Product from './pages/Product'
import Cart from './pages/Cart'
import Footer from './components/Footer'
import SearchBar from './components/SearchBar'
import { ToastContainer } from 'react-toastify';
import Verify from './pages/Verify'
import VendorRegis from './pages/VendorRegis'
import MyProfile from './pages/MyProfile'
import ProfileNotifications from './pages/ProfileNotifications'

import ProfileBank from './pages/ProfileBank'
import ProfileAddress from './pages/ProfileAddress'
import ProfileChangePassword from './pages/ProfileChangePassword'
import ProfileNotificationSettings from './pages/ProfileNotificationSettings'
import ProfilePrivacySettings from './pages/ProfilePrivacySettings'
import ProfilePersonalInfo from './pages/ProfilePersonalInfo'
import ProfileVouchers from './pages/ProfileVouchers'
import ProfileCoins from './pages/ProfileCoins'

const App = () => {
  return (
    <div className='px-4 sm:px-[5wh] md:px-[7vw] lg:px-[9vw]'>
    <ToastContainer />
      <Navbar />
      <SearchBar />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/about' element={<About />} />
        <Route path='/contact' element={<Contact />} />
        <Route path='/collection' element={<Collection />} />
        <Route path='/product/:productId' element={<Product />} />
        <Route path='/cart' element={<Cart />} />
        <Route path='/login' element={<Login />} />
        <Route path='/place-order' element={<PlaceOrder />} />
        <Route path='/orders' element={<Orders/>} />
        <Route path='/verify' element={<Verify/>} />
        <Route path='/vendor-register' element={<VendorRegis/>} />
        <Route path='/my-profile' element={<MyProfile/>} />
        <Route path='/profile/notifications' element={<ProfileNotifications/>} />
        <Route path='/profile/bank' element={<ProfileBank/>} />
        <Route path='/profile/address' element={<ProfileAddress/>} />
        <Route path='/profile/change-password' element={<ProfileChangePassword/>} />
        <Route path='/profile/notification-settings' element={<ProfileNotificationSettings/>} />
        <Route path='/profile/privacy-settings' element={<ProfilePrivacySettings/>} />
        <Route path='/profile/personal-info' element={<ProfilePersonalInfo/>} />
        <Route path='/profile/vouchers' element={<ProfileVouchers/>} />
        <Route path='/profile/coins' element={<ProfileCoins/>} />
        
      </Routes>
      <Footer />

    </div>
  )
}

export default App