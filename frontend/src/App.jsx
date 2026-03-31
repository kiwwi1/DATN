import React from 'react'
import { Route,Routes } from 'react-router-dom'
import Login from './pages/auth/Login'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import PlaceOrder from './pages/shop/PlaceOrder'
import Orders from './pages/shop/Orders'
import Navbar from './components/layout/Navbar'
import Home from './pages/main/Home'
import About from './pages/main/About'
import Contact from './pages/main/Contact'
import VendorShop from './pages/main/VendorShop'
import Collection from './pages/main/Collection'
import Product from './pages/main/Product'
import Cart from './pages/shop/Cart'
import Footer from './components/layout/Footer'
import SearchBar from './components/layout/SearchBar'
import { ToastContainer } from 'react-toastify';
import Verify from './pages/shop/Verify'
import VendorRegis from './pages/auth/VendorRegis'
import MyProfile from './pages/profile/MyProfile'
import ProfileNotifications from './pages/profile/ProfileNotifications'

import ProfileBank from './pages/profile/ProfileBank'
import ProfileAddress from './pages/profile/ProfileAddress'
import ProfileChangePassword from './pages/profile/ProfileChangePassword'
import ProfileNotificationSettings from './pages/profile/ProfileNotificationSettings'
import ProfilePrivacySettings from './pages/profile/ProfilePrivacySettings'
import ProfilePersonalInfo from './pages/profile/ProfilePersonalInfo'
import ProfileVouchers from './pages/profile/ProfileVouchers'
import ProfileCoins from './pages/profile/ProfileCoins'

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
        <Route path='/shop/:vendorId' element={<VendorShop />} />
        <Route path='/collection' element={<Collection />} />
        <Route path='/product/:productId' element={<Product />} />
        <Route path='/cart' element={<Cart />} />
        <Route path='/login' element={<Login />} />
        <Route path='/forgot-password' element={<ForgotPassword />} />
        <Route path='/reset-password' element={<ResetPassword />} />
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
