import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { ShopContext } from '../../context/ShopContext'
import ProfileSidebar from '../../components/profile/ProfileSidebar'
import { assets } from '../../assets/assets'
import { formatImageUrl } from '../../utils/imageUtils'

const maskEmail = (email) => {
  if (!email) return 'N/A'
  const [username, domain] = email.split('@')
  if (!username || !domain || username.length <= 2) return email
  const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 1)
  return `${maskedUsername}@${domain}`
}

const maskPhone = (phone) => {
  if (!phone) return 'N/A'
  const normalized = String(phone)
  if (normalized.length <= 4) return normalized
  return `${'*'.repeat(normalized.length - 2)}${normalized.slice(-2)}`
}

const MyProfile = () => {
  const { getUserProfile, token, userProfile, backendUrl } = useContext(ShopContext)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showFullEmail, setShowFullEmail] = useState(false)
  const [showFullPhone, setShowFullPhone] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (token && !userProfile) {
      getUserProfile(token)
    }
    if (userProfile) {
      setLoading(false)
      setNewEmail(userProfile.email || '')
      setNewPhone(userProfile.phone || '')
    }
  }, [token, userProfile, getUserProfile])

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview)
      }
    }
  }, [avatarPreview])

  const avatarSrc = useMemo(() => {
    if (avatarPreview) return avatarPreview
    const formatted = formatImageUrl(userProfile?.avatar, {
      variant: 'thumb',
      width: 160,
      height: 160,
      fit: 'cover',
      quality: 80,
      format: 'webp',
    })
    return formatted || assets.profile_icon
  }, [avatarPreview, userProfile?.avatar])

  const submitProfile = async ({ email, phone, avatar } = {}) => {
    if (!token || !userProfile?._id) return

    setSaving(true)
    try {
      const formData = new FormData()
      if (email !== undefined) formData.append('email', email)
      if (phone !== undefined) formData.append('phone', phone)
      if (avatar) formData.append('avatar', avatar)

      const response = await axios.post(`${backendUrl}/api/user/update-profile`, formData, {
        headers: { token },
      })

      if (response.data.success) {
        toast.success('Cập nhật hồ sơ thành công')
        await getUserProfile(token)
        return true
      }

      toast.error(response.data.message || 'Cập nhật hồ sơ thất bại')
      return false
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Cập nhật hồ sơ thất bại')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEmail = async () => {
    if (!newEmail || newEmail === userProfile?.email) {
      setEditingEmail(false)
      return
    }

    const ok = await submitProfile({ email: newEmail })
    if (ok) setEditingEmail(false)
  }

  const handleSavePhone = async () => {
    if (!newPhone || newPhone === userProfile?.phone) {
      setEditingPhone(false)
      return
    }

    const ok = await submitProfile({ phone: newPhone })
    if (ok) setEditingPhone(false)
  }

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (avatarPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview)
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveAvatar = async () => {
    if (!avatarFile) return
    const ok = await submitProfile({ avatar: avatarFile })
    if (ok) {
      setAvatarFile(null)
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview)
      }
      setAvatarPreview('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-lg">Đang tải...</div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-lg text-red-500">Vui lòng đăng nhập để xem hồ sơ</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Hồ sơ cá nhân</h1>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-5 pb-6 border-b border-gray-100">
              <img
                src={avatarSrc}
                alt="avatar"
                className="w-20 h-20 rounded-full object-cover border border-gray-200"
                referrerPolicy="no-referrer"
              />

              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarSelect}
                  className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {avatarFile && (
                  <button
                    onClick={handleSaveAvatar}
                    disabled={saving}
                    className="bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu avatar'}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6 pt-6">
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
                      className="bg-green-500 text-white px-4 py-2 rounded-md text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingEmail(false)
                        setNewEmail(userProfile.email || '')
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-600"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-lg text-gray-900">{showFullEmail ? userProfile.email : maskEmail(userProfile.email)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowFullEmail((v) => !v)} className="text-blue-600 hover:text-blue-800 text-sm underline">
                        {showFullEmail ? 'Ẩn' : 'Xem'}
                      </button>
                      <button onClick={() => setEditingEmail(true)} className="text-green-600 hover:text-green-800 text-sm underline">
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
                      className="bg-green-500 text-white px-4 py-2 rounded-md text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPhone(false)
                        setNewPhone(userProfile.phone || '')
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-600"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-lg text-gray-900">{showFullPhone ? userProfile.phone : maskPhone(userProfile.phone)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowFullPhone((v) => !v)} className="text-blue-600 hover:text-blue-800 text-sm underline">
                        {showFullPhone ? 'Ẩn' : 'Xem'}
                      </button>
                      <button onClick={() => setEditingPhone(true)} className="text-green-600 hover:text-green-800 text-sm underline">
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
