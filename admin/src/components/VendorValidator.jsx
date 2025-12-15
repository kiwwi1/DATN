import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { backendUrl } from '../App';
import { toast } from 'react-toastify';

const VendorValidator = ({ token, setToken, children }) => {
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
          toast.error('Access denied - Vendor account required');
          setToken("");
          localStorage.removeItem("token");
          sessionStorage.removeItem("vendorToken");
        }
      } catch (error) {
        console.error('Error validating vendor:', error);
        toast.error('Error validating vendor status');
        setToken("");
        localStorage.removeItem("token");
        sessionStorage.removeItem("vendorToken");
      }

      setIsValidating(false);
    };

    validateVendor();
  }, [token, setToken]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating vendor access...</p>
        </div>
      </div>
    );
  }

  if (!token || !isValidVendor) {
    return null; // Will show login component
  }

  return children;
};

export default VendorValidator;
