import React from 'react';
import ProfileSidebar from '../../components/profile/ProfileSidebar';

const ProfileVouchers = () => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Kho mã giảm giá</h1>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">Chưa có mã giảm giá nào</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileVouchers;
