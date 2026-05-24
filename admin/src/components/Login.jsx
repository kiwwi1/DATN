import { assets } from '../assets/assets'

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'

const Login = ({ isCheckingSession = false }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div className="w-full max-w-md">
      <div className="admin-card overflow-hidden p-8">
        <div className="mb-6 flex justify-center">
          <img src={assets.logo} alt="logo" className="h-auto w-32" />
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Cổng quản trị nhà bán</h2>
          <p className="mt-1 text-sm text-slate-500">Đăng nhập tại storefront bằng cùng tài khoản người bán trước khi vào admin.</p>
        </div>

        <div className="rounded-xl border border-sky-100 bg-sky-50 p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
              1
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Đăng nhập ở storefront</p>
              <p className="mt-0.5 text-xs text-slate-500">Sử dụng tài khoản hiện có, không có luồng đăng nhập admin riêng.</p>
            </div>
          </div>

          <div className="mb-5 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
              2
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Mở trang nhà bán</p>
              <p className="mt-0.5 text-xs text-slate-500">Nhấn nút vào trang nhà bán trong thanh điều hướng storefront.</p>
            </div>
          </div>

          <a
            href={FRONTEND_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Mở storefront
          </a>
        </div>

        {isCheckingSession && (
          <p className="mt-4 text-center text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</p>
        )}
      </div>
    </div>
  </div>
)

export default Login
