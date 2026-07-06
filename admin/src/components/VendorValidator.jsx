import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import LoadingScreen from './LoadingScreen'

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
    return <LoadingScreen message="Đang xác thực tài khoản nhà bán..." />
  }

  if (!token || !isValidVendor) return null

  return children
}

export default VendorValidator
