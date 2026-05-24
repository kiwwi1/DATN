import { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { backendUrl } from '../App'

const VendorValidator = ({ token, onLogout, children }) => {
  const [isValidating, setIsValidating] = useState(true)
  const [isValidVendor, setIsValidVendor] = useState(false)

  useEffect(() => {
    const validateVendor = async () => {
      if (!token) {
        setIsValidating(false)
        return
      }

      try {
        const response = await axios.post(`${backendUrl}/api/user/profile`, {}, { headers: { token } })

        if (response.data.success && response.data.user.role === 'vendor') {
          setIsValidVendor(true)
        } else {
          toast.error('Truy cập bị từ chối: yêu cầu tài khoản nhà bán')
          onLogout?.()
        }
      } catch (error) {
        toast.error('Không thể xác thực tài khoản nhà bán')
        onLogout?.()
      } finally {
        setIsValidating(false)
      }
    }

    validateVendor()
  }, [token, onLogout])

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
