import React, { useState } from 'react';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Liên hệ</h1>
        <p className="text-gray-500">Chúng tôi luôn sẵn sàng hỗ trợ bạn</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-10">
        {/* Info */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Thông tin liên hệ</h2>

          {[
            { icon: '📧', label: 'Email', value: 'support@shop.vn' },
            { icon: '📞', label: 'Điện thoại', value: '1800 1234 (miễn phí)' },
            { icon: '🕐', label: 'Giờ làm việc', value: 'T2 – T7, 8:00 – 17:30' },
            { icon: '📍', label: 'Địa chỉ', value: 'Hà Nội, Việt Nam' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{item.icon}</span>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{item.label}</p>
                <p className="text-sm text-gray-800 mt-0.5">{item.value}</p>
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Theo dõi chúng tôi</p>
            <div className="flex gap-3">
              {['Facebook', 'Zalo', 'YouTube'].map((s) => (
                <span key={s} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {sent ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <span className="text-5xl mb-4">✅</span>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Đã gửi thành công!</h3>
              <p className="text-sm text-gray-500">Chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.</p>
              <button
                onClick={() => { setSent(false); setForm({ name: '', email: '', message: '' }); }}
                className="mt-6 text-sm text-black underline"
              >
                Gửi tin nhắn khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Gửi tin nhắn</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  required
                  placeholder="Nguyễn Văn A"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
                <textarea
                  value={form.message}
                  onChange={set('message')}
                  required
                  rows={4}
                  placeholder="Mô tả vấn đề hoặc câu hỏi của bạn..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Gửi tin nhắn
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contact;
