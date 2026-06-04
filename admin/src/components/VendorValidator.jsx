import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

const VendorValidator = ({ token, onLogout, user, children }) => {
  const [isValidating, setIsValidating] = useState(true)
  const [isValidVendor, setIsValidVendor] = useState(false)

  useEffect(() => {
    if (!token) {
      setIsValidVendor(false)
      setIsValidating(false)
      return
    }

    if (!user) {
      setIsValidating(true)
      return
    }

    if (user.role === 'vendor') {
      setIsValidVendor(true)
    } else {
      setIsValidVendor(false)
      toast.error('Truy cập bị từ chối: yêu cầu tài khoản nhà bán')
      onLogout?.()
    }

    setIsValidating(false)
  }, [token, user, onLogout])

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-600">Đang xác thực tài khoản nhà bán...</p>
        </div>
      </div>
    )
  }

  if (!token || !isValidVendor) return null

  return children
}

export default VendorValidator
