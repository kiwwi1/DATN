import React from 'react';
import { useNavigate } from 'react-router-dom';

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      {/* Hero */}
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Về chúng tôi</h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          Nền tảng thương mại điện tử đa người bán, kết nối người mua và người bán toàn quốc với trải nghiệm mua sắm hiện đại, an toàn và tiện lợi.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-14">
        {[
          { value: '10K+', label: 'Sản phẩm' },
          { value: '500+', label: 'Người bán' },
          { value: '50K+', label: 'Đơn hàng' },
          { value: '99%', label: 'Hài lòng' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-6 text-center border border-gray-100">
            <p className="text-3xl font-bold text-black">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid sm:grid-cols-3 gap-6 mb-14">
        {[
          { icon: '🛡️', title: 'Thanh toán an toàn', desc: 'Hỗ trợ Stripe, VNPay và thanh toán khi nhận hàng (COD). Mọi giao dịch đều được bảo mật.' },
          { icon: '🚀', title: 'Giao hàng nhanh', desc: 'Theo dõi đơn hàng thời gian thực từ lúc đặt đến khi nhận hàng.' },
          { icon: '💬', title: 'Hỗ trợ trực tiếp', desc: 'Chat trực tiếp với người bán để được tư vấn sản phẩm nhanh nhất.' },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <span className="text-3xl">{f.icon}</span>
            <h3 className="font-semibold text-gray-900 mt-3 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-black rounded-2xl p-10 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">Bắt đầu mua sắm ngay</h2>
        <p className="text-gray-400 mb-6 text-sm">Khám phá hàng nghìn sản phẩm từ các người bán uy tín trên toàn quốc.</p>
        <button
          onClick={() => navigate('/collection')}
          className="bg-white text-black font-semibold px-8 py-3 rounded-full hover:bg-gray-100 transition-colors text-sm"
        >
          Khám phá ngay
        </button>
      </div>
    </div>
  );
};

export default About;
