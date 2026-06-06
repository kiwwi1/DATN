import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { backendUrl } from "../App";
import { formatPrice } from "../utils/priceFormat";

const toDatetimeLocal = (timestamp) => {
  const value = Number(timestamp || 0);
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const toTimestamp = (datetimeLocal) => {
  if (!datetimeLocal) return 0;
  return new Date(datetimeLocal).getTime();
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return "Không có";
  const parsed = Number(timestamp);
  if (!parsed) return "Không có";
  return new Date(parsed).toLocaleString("vi-VN");
};

const DISCOUNT_TYPE_LABEL = {
  PERCENT: "Phần trăm",
  FIXED: "Số tiền cố định",
};

const getVoucherPhase = (voucher, nowTimestamp = Date.now()) => {
  const startAt = Number(voucher.startAt || 0);
  const endAt = Number(voucher.endAt || 0);

  if (endAt && endAt < nowTimestamp) {
    return {
      key: "expired",
      label: "Đã hết hạn",
      badgeClass: "bg-rose-50 text-rose-700 border border-rose-100",
    };
  }

  if (!voucher.isActive) {
    return {
      key: "inactive",
      label: "Đang tắt",
      badgeClass: "bg-slate-100 text-slate-500 border border-slate-200",
    };
  }

  if (startAt && startAt > nowTimestamp) {
    return {
      key: "upcoming",
      label: "Sắp diễn ra",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-100",
    };
  }

  return {
    key: "running",
    label: "Đang hoạt động",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  };
};

const EMPTY_FORM = {
  code: "",
  discountType: "PERCENT",
  discountValue: 10,
  maxDiscount: 0,
  minOrderValue: 0,
  usageLimit: 0,
  startAt: "",
  endAt: "",
  description: "",
  isActive: true,
};

const Vouchers = ({ token }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [listFilter, setListFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);
  const currentTimestamp = Date.now();

  const filteredList = useMemo(() => {
    const normalizedSearch = String(searchText || "").trim().toUpperCase();
    return list.filter((voucher) => {
      if (normalizedSearch && !String(voucher.code || "").toUpperCase().includes(normalizedSearch)) {
        return false;
      }
      if (listFilter === "all") return true;
      return getVoucherPhase(voucher, currentTimestamp).key === listFilter;
    });
  }, [list, listFilter, searchText, currentTimestamp]);

  const summary = useMemo(() => {
    const initial = {
      all: list.length,
      running: 0,
      upcoming: 0,
      inactive: 0,
      expired: 0,
    };
    return list.reduce((acc, voucher) => {
      const key = getVoucherPhase(voucher, currentTimestamp).key;
      acc[key] += 1;
      return acc;
    }, initial);
  }, [list, currentTimestamp]);

  const previewText = useMemo(() => {
    const value = Number(form.discountValue || 0);
    const minOrder = Number(form.minOrderValue || 0);
    const maxDiscount = Number(form.maxDiscount || 0);
    const usageLimit = Number(form.usageLimit || 0);
    const discountText = form.discountType === "PERCENT" ? `${value}%` : formatPrice(value);

    const notes = [];
    notes.push(`Giảm giá: ${discountText}`);
    notes.push(`Đơn tối thiểu: ${formatPrice(minOrder)}`);
    notes.push(`Giảm tối đa: ${maxDiscount > 0 ? formatPrice(maxDiscount) : "Không giới hạn"}`);
    notes.push(`Lượt sử dụng: ${usageLimit > 0 ? `${usageLimit} lượt` : "Không giới hạn"}`);

    return notes;
  }, [form]);

  const loadVouchers = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await axios.post(
        `${backendUrl}/api/voucher/list`,
        {},
        { headers: { token } }
      );
      if (!response.data.success) {
        toast.error(response.data.message || "Không thể tải danh sách voucher");
        return;
      }
      setList(response.data.vouchers || []);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, [token]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!token) return;

    const payload = {
      code: form.code,
      type: "SHOP",
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscount: Number(form.maxDiscount),
      minOrderValue: Number(form.minOrderValue),
      usageLimit: Number(form.usageLimit),
      startAt: toTimestamp(form.startAt),
      endAt: toTimestamp(form.endAt),
      description: form.description,
      isActive: Boolean(form.isActive),
    };

    if (!payload.code) {
      toast.error("Vui lòng nhập mã voucher");
      return;
    }
    if (!payload.startAt || !payload.endAt || payload.endAt <= payload.startAt) {
      toast.error("Thời gian bắt đầu/kết thúc không hợp lệ");
      return;
    }

    try {
      setSaving(true);
      if (isEditing) {
        const response = await axios.post(
          `${backendUrl}/api/voucher/update`,
          { voucherId: editingId, ...payload },
          { headers: { token } }
        );
        if (!response.data.success) {
          toast.error(response.data.message || "Cập nhật voucher thất bại");
          return;
        }
        toast.success("Đã cập nhật voucher");
      } else {
        const response = await axios.post(`${backendUrl}/api/voucher/create`, payload, {
          headers: { token },
        });
        if (!response.data.success) {
          toast.error(response.data.message || "Tạo voucher thất bại");
          return;
        }
        toast.success("Đã tạo voucher");
      }
      resetForm();
      await loadVouchers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (voucher) => {
    setEditingId(voucher._id);
    setForm({
      code: voucher.code || "",
      discountType: voucher.discountType || "PERCENT",
      discountValue: Number(voucher.discountValue || 0),
      maxDiscount: Number(voucher.maxDiscount || 0),
      minOrderValue: Number(voucher.minOrderValue || 0),
      usageLimit: Number(voucher.usageLimit || 0),
      startAt: toDatetimeLocal(voucher.startAt),
      endAt: toDatetimeLocal(voucher.endAt),
      description: voucher.description || "",
      isActive: Boolean(voucher.isActive),
    });
  };

  const toggleActive = async (voucher) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/voucher/toggle-active`,
        { voucherId: voucher._id, isActive: !voucher.isActive },
        { headers: { token } }
      );
      if (!response.data.success) {
        toast.error(response.data.message || "Cập nhật trạng thái thất bại");
        return;
      }
      toast.success(voucher.isActive ? "Đã tắt voucher" : "Đã bật voucher");
      await loadVouchers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const removeVoucher = async (voucherId) => {
    if (!window.confirm("Bạn có chắc muốn xóa voucher này?")) return;
    try {
      const response = await axios.post(
        `${backendUrl}/api/voucher/delete`,
        { voucherId },
        { headers: { token } }
      );
      if (!response.data.success) {
        toast.error(response.data.message || "Xóa voucher thất bại");
        return;
      }
      toast.success("Đã xóa voucher");
      await loadVouchers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="admin-page-title text-2xl font-bold tracking-tight text-slate-800">Quản lý Voucher khuyến mãi</h1>
        <p className="admin-page-subtitle text-xs text-slate-400 mt-1 font-medium">
          Thiết lập mã giảm giá, cấu hình điều kiện đặt hàng tối thiểu và giới hạn lượt sử dụng cho khách hàng.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <div className="admin-card p-4 hover:shadow-md transition duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tổng số lượng</p>
          <p className="mt-1.5 text-2xl font-extrabold text-slate-800">{summary.all}</p>
        </div>
        <div className="admin-card p-4 hover:shadow-md transition duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đang áp dụng</p>
          <p className="mt-1.5 text-2xl font-extrabold text-emerald-600">{summary.running}</p>
        </div>
        <div className="admin-card p-4 hover:shadow-md transition duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sắp diễn ra</p>
          <p className="mt-1.5 text-2xl font-extrabold text-amber-600">{summary.upcoming}</p>
        </div>
        <div className="admin-card p-4 hover:shadow-md transition duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đang ẩn/tắt</p>
          <p className="mt-1.5 text-2xl font-extrabold text-slate-500">{summary.inactive}</p>
        </div>
        <div className="admin-card p-4 hover:shadow-md transition duration-200 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã hết hạn</p>
          <p className="mt-1.5 text-2xl font-extrabold text-rose-600">{summary.expired}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Creation/Edit Form Card */}
        <div className="admin-card p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-800 tracking-tight">{isEditing ? "Cập nhật Voucher" : "Tạo Voucher mới cho Cửa hàng"}</h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">Cấu hình các điều kiện áp dụng cho mã voucher. Nhập giá trị 0 đối với các trường không giới hạn.</p>

          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mã voucher</label>
              <input
                className="admin-input py-2.5 font-bold uppercase tracking-wider focus:border-pink-500 text-slate-800"
                placeholder="VD: LUONGVE10"
                value={form.code}
                disabled={isEditing}
                required
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Hình thức giảm giá</label>
              <select
                className="admin-select py-2.5 focus:border-pink-500"
                value={form.discountType}
                onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
              >
                <option value="PERCENT">Giảm theo tỷ lệ phần trăm (%)</option>
                <option value="FIXED">Giảm theo số tiền cố định (đ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Giá trị giảm</label>
              <input
                className="admin-input py-2.5 font-semibold focus:border-pink-500"
                type="number"
                min={1}
                placeholder="VD: 10 (phần trăm) hoặc 50000 (tiền)"
                value={form.discountValue}
                required
                onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Giảm tối đa (₫)</label>
              <input
                className="admin-input py-2.5 focus:border-pink-500"
                type="number"
                min={0}
                placeholder="0 = Không giới hạn số tiền"
                value={form.maxDiscount}
                onChange={(event) => setForm((prev) => ({ ...prev, maxDiscount: event.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Giá trị đơn tối thiểu (₫)</label>
              <input
                className="admin-input py-2.5 focus:border-pink-500"
                type="number"
                min={0}
                placeholder="0 = Không yêu cầu đơn hàng tối thiểu"
                value={form.minOrderValue}
                onChange={(event) => setForm((prev) => ({ ...prev, minOrderValue: event.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Tổng lượt sử dụng giới hạn</label>
              <input
                className="admin-input py-2.5 focus:border-pink-500"
                type="number"
                min={0}
                placeholder="0 = Không giới hạn số lượt sử dụng"
                value={form.usageLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, usageLimit: event.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ngày bắt đầu áp dụng</label>
              <input
                className="admin-input py-2.5 focus:border-pink-500 text-slate-700"
                type="datetime-local"
                value={form.startAt}
                required
                onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ngày kết thúc hiệu lực</label>
              <input
                className="admin-input py-2.5 focus:border-pink-500 text-slate-700"
                type="datetime-local"
                value={form.endAt}
                required
                onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mô tả điều kiện voucher</label>
              <textarea
                className="admin-input py-2 h-20 text-xs"
                placeholder="Mô tả chi tiết thể lệ/đối tượng áp dụng (Hiển thị cho khách hàng)..."
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <label className="inline-flex items-center gap-3 cursor-pointer select-none text-xs font-bold text-slate-750">
                <input
                  type="checkbox"
                  checked={Boolean(form.isActive)}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  className="h-4.5 w-4.5 rounded-md text-pink-600 accent-pink-500 focus:ring-pink-500/20"
                />
                Kích hoạt phát hành Voucher ngay sau khi lưu cấu hình
              </label>
            </div>

            <div className="md:col-span-2 flex gap-2.5 pt-2">
              <button
                className="flex-1 py-3 text-xs font-bold text-white bg-pink-500 hover:bg-pink-600 rounded-xl transition duration-200 shadow-md shadow-pink-500/10 disabled:opacity-60"
                type="submit"
                disabled={saving}
              >
                {saving ? "Đang lưu..." : isEditing ? "Cập nhật voucher" : "Tạo mã voucher mới"}
              </button>
              {isEditing && (
                <button
                  className="px-4 py-3 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition duration-200"
                  type="button"
                  onClick={resetForm}
                >
                  Hủy sửa
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Live Preview Box Card */}
        <aside className="admin-card p-5 space-y-4 self-start">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Xem trước nhanh</h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium">Bố cục hiển thị voucher trên ứng dụng của khách hàng.</p>
          </div>
          
          <div className="relative rounded-2xl border-2 border-dashed border-pink-200 bg-gradient-to-br from-pink-50/50 to-orange-50/30 p-5 overflow-hidden">
            {/* Notch circles */}
            <div className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white border-r border-dashed border-pink-200"></div>
            <div className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white border-l border-dashed border-pink-200"></div>
            
            <div className="flex items-center justify-between border-b border-dashed border-pink-100 pb-3 mb-3.5">
              <span className="font-mono font-bold text-sm tracking-wider text-pink-650 bg-pink-100/50 border border-pink-200/50 px-2.5 py-1 rounded-lg">
                {form.code || "MÃ_GIẢM_GIÁ"}
              </span>
              <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                {form.discountType === "PERCENT" ? "% GIẢM" : "TIỀN MẶT"}
              </span>
            </div>
            
            <div className="space-y-1.5 text-xs">
              {previewText.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-600 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-400 shrink-0"></span>
                  <span>{line}</span>
                </div>
              ))}
              <div className="mt-4 border-t border-pink-100/60 pt-3 text-[10px] text-slate-400 font-bold leading-relaxed space-y-0.5">
                <p>Hiệu lực: {form.startAt ? form.startAt.replace("T", " ") : "Chưa đặt"} → {form.endAt ? form.endAt.replace("T", " ") : "Chưa đặt"}</p>
                <p className="flex items-center gap-1.5">
                  Trạng thái: 
                  <span className={form.isActive ? "text-emerald-600 font-bold" : "text-slate-400 font-bold"}>
                    {form.isActive ? "ĐANG BẬT" : "TẠM TẮT"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Vouchers List Area */}
      <div className="admin-card p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight font-bold">Danh sách Voucher đã phát hành</h2>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Hiển thị toàn bộ lịch sử phát hành voucher của cửa hàng.</p>
          </div>
          <div className="relative w-full lg:w-72">
            <input
              className="admin-input pl-9 py-2 rounded-xl focus:border-pink-500 text-xs font-semibold"
              placeholder="Nhập mã voucher cần tìm..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { key: "all", label: "Tất cả" },
            { key: "running", label: "Đang hoạt động" },
            { key: "upcoming", label: "Sắp diễn ra" },
            { key: "inactive", label: "Đang tắt" },
            { key: "expired", label: "Đã hết hạn" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setListFilter(item.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all duration-150 ${
                listFilter === item.key
                  ? "border-pink-200 bg-pink-50 text-pink-700 shadow-xs"
                  : "border-slate-200 bg-white text-slate-650 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
            <p className="mt-3 text-xs font-semibold text-slate-400 animate-pulse">Đang tải danh sách voucher...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-center p-4">
            <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <p className="text-xs font-bold text-slate-500">Không tìm thấy mã voucher khuyến mãi nào phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {filteredList.map((voucher) => {
              const phase = getVoucherPhase(voucher, currentTimestamp);
              return (
                <div 
                  key={voucher._id} 
                  className="rounded-2xl border border-slate-200 p-4 bg-white/50 hover:bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <p className="text-base font-bold text-slate-800 tracking-tight font-mono uppercase bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/50">{voucher.code}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${phase.badgeClass}`}>
                        {phase.label}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs font-semibold text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <span className="text-slate-400">Ưu đãi:</span>
                        <span className="text-slate-800 font-bold">
                          {voucher.discountType === "PERCENT" ? `Giảm ${voucher.discountValue}%` : `Giảm ${formatPrice(voucher.discountValue)}`}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="text-slate-400">Điều kiện:</span>
                        <span className="text-slate-700">
                          Đơn tối thiểu {formatPrice(voucher.minOrderValue || 0)}
                          {Number(voucher.maxDiscount || 0) > 0 && ` (Tối đa ${formatPrice(voucher.maxDiscount)})`}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="text-slate-400">Hiệu lực:</span>
                        <span className="text-slate-700 text-[11px] font-medium">{formatDateTime(voucher.startAt)} → {formatDateTime(voucher.endAt)}</span>
                      </p>
                      {voucher.description && (
                        <p className="text-[11px] text-slate-450 italic font-medium leading-normal bg-slate-50 p-2 rounded-lg border border-slate-100">
                          Thể lệ: {voucher.description}
                        </p>
                      )}
                    </div>

                    {/* Progress limit bar */}
                    {voucher.usageLimit > 0 && (
                      <div className="pt-1 w-full space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          <span>Tiến độ lượt dùng:</span>
                          <span>{voucher.usedCount || 0} / {voucher.usageLimit} lượt ({Math.round(((voucher.usedCount || 0) / voucher.usageLimit) * 100)}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full" 
                            style={{ width: `${Math.min(100, ((voucher.usedCount || 0) / voucher.usageLimit) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-1.5 border-t border-slate-100 pt-3 mt-3.5">
                    <button 
                      className="inline-flex rounded-lg bg-sky-50 text-sky-700 border border-sky-200/50 px-2.5 py-1.5 text-xs font-bold transition hover:bg-sky-100/60" 
                      type="button" 
                      onClick={() => startEdit(voucher)}
                    >
                      Chỉnh sửa
                    </button>
                    <button 
                      className="inline-flex rounded-lg bg-slate-50 text-slate-650 border border-slate-200/50 px-2.5 py-1.5 text-xs font-bold transition hover:bg-slate-100/60" 
                      type="button" 
                      onClick={() => toggleActive(voucher)}
                    >
                      {voucher.isActive ? "Tạm tắt" : "Bật lại"}
                    </button>
                    <button
                      className="inline-flex rounded-lg bg-rose-50 text-rose-700 border border-rose-200/50 px-2.5 py-1.5 text-xs font-bold transition hover:bg-rose-100/60"
                      type="button"
                      onClick={() => removeVoucher(voucher._id)}
                    >
                      Xóa bỏ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Vouchers;
