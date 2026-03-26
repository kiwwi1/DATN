import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { backendUrl } from '../App';
import { toast } from 'react-toastify';

const VendorValidator = ({ token, onLogout, children }) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isValidVendor, setIsValidVendor] = useState(false);

  useEffect(() => {
    const validateVendor = async () => {
      if (!token) {
        setIsValidating(false);
        return;
      }

      try {
        const response = await axios.post(backendUrl + '/api/user/profile', {}, {
          headers: { token }
        });

        if (response.data.success && response.data.user.role === 'vendor') {
          setIsValidVendor(true);
        } else {
          toast.error('Truy cập bị từ chối - Yêu cầu tài khoản vendor');
          onLogout?.();
        }
      } catch (error) {
        console.error('Error validating vendor:', error);
        toast.error('Lỗi xác thực tài khoản vendor');
        onLogout?.();
      }

      setIsValidating(false);
    };

    validateVendor();
  }, [token]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang xác thực tài khoản...</p>
        </div>
      </div>
    );
  }

  if (!token || !isValidVendor) {
    return null;
  }

  return children;
};

export default VendorValidator;
