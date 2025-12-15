import React, { useEffect } from 'react'
import { ShopContext } from '../context/ShopContext'
import { useContext } from 'react'
import { useState } from 'react'
import ProfileSidebar from '../components/ProfileSidebar'
import axios from 'axios'

// Utility functions để mask email và phone
const maskEmail = (email) => {
  if (!email) return 'N/A';
  const [username, domain] = email.split('@');
  if (username.length <= 2) return email;
  const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 1);
  return `${maskedUsername}@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone) return 'N/A';
  if (phone.length <= 4) return phone;
  const lastTwo = phone.slice(-2);
  const masked = '*'.repeat(phone.length - 2);
  return `${masked}${lastTwo}`;
};
const MyProfile = () => {
  const {getUserProfile, token, userProfile, backendUrl} = useContext(ShopContext)
 
  
  const [loading, setLoading] = useState(true)
  const [showFullEmail, setShowFullEmail] = useState(false)
  const [showFullPhone, setShowFullPhone] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [saving, setSaving] = useState(false)
  
  useEffect(()=>{
    if(token && !userProfile){
      getUserProfile(token)
    }
    if(userProfile){
      setLoading(false)
      setNewEmail(userProfile.email || '')
      setNewPhone(userProfile.phone || '')
    }
  },[token, userProfile, getUserProfile])

  // Function to update user profile
  const updateProfile = async (email, phone) => {
    try {
      const response = await axios.post(backendUrl+'/api/user/update-profile', {
        userId: userProfile._id,
        email: email,
        phone: phone

      })
      
    }
    catch (error) {
      console.log(error)
      setSaving(false)
      
    }
  }

  const handleSaveEmail = () => {
    if(newEmail && newEmail !== userProfile.email) {
      updateProfile('email', newEmail)
    } else {
      setEditingEmail(false)
    }
  }

  const handleSavePhone = () => {
    if(newPhone && newPhone !== userProfile.phone) {
      updateProfile('phone', newPhone)
    } else {
      setEditingPhone(false)
    }
  }
  
  if(loading){
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }
  
  if(!userProfile){
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-lg text-red-500">Please login to view your profile</div>
      </div>
    )
  }
  
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <ProfileSidebar />
      
      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className='text-3xl font-bold mb-6 text-gray-800'>Hồ Sơ Cá Nhân</h1>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tên</label>
                <p className="text-lg text-gray-900">{userProfile.name || 'N/A'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                {editingEmail ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập email mới"
                    />
                    <button
                      onClick={handleSaveEmail}
                      disabled={saving}
                      className="bg-green-500 text-white px-4 py-2 rounded-md text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingEmail(false)
                        setNewEmail(userProfile.email || '')
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-600 transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-lg text-gray-900">
                      {showFullEmail ? userProfile.email : maskEmail(userProfile.email)}
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowFullEmail(!showFullEmail)}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        {showFullEmail ? 'Ẩn' : 'Xem'}
                      </button>
                      <button 
                        onClick={() => setEditingEmail(true)}
                        className="text-green-600 hover:text-green-800 text-sm underline"
                      >
                        Thay đổi
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại</label>
                {editingPhone ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập số điện thoại mới"
                    />
                    <button
                      onClick={handleSavePhone}
                      disabled={saving}
                      className="bg-green-500 text-white px-4 py-2 rounded-md text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPhone(false)
                        setNewPhone(userProfile.phone || '')
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-600 transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-lg text-gray-900">
                      {showFullPhone ? userProfile.phone : maskPhone(userProfile.phone)}
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowFullPhone(!showFullPhone)}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        {showFullPhone ? 'Ẩn' : 'Xem'}
                      </button>
                      <button 
                        onClick={() => setEditingPhone(true)}
                        className="text-green-600 hover:text-green-800 text-sm underline"
                      >
                        Thay đổi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MyProfile