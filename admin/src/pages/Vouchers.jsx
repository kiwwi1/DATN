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
      badgeClass: "bg-rose-100 text-rose-700",
    };
  }

  if (!voucher.isActive) {
    return {
      key: "inactive",
      label: "Đang tắt",
      badgeClass: "bg-slate-100 text-slate-600",
    };
  }

  if (startAt && startAt > nowTimestamp) {
    return {
      key: "upcoming",
      label: "Sắp diễn ra",
      badgeClass: "bg-amber-100 text-amber-700",
    };
  }

  return {
    key: "running",
    label: "Đang áp dụng",
    badgeClass: "bg-emerald-100 text-emerald-700",
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
    notes.push(`Giảm: ${discountText}`);
    notes.push(`Đơn tối thiểu: ${formatPrice(minOrder)}`);
    notes.push(`Giảm tối đa: ${maxDiscount > 0 ? formatPrice(maxDiscount) : "Không giới hạn"}`);
    notes.push(`Lượt dùng: ${usageLimit > 0 ? usageLimit : "Không giới hạn"}`);

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
    <section className="space-y-5">
      <div>
        <h1 className="admin-page-title">Quản lý voucher</h1>
        <p className="admin-page-subtitle">
          Tạo voucher mới, theo dõi trạng thái áp dụng và chỉnh sửa nhanh theo từng mã.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="admin-card p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tổng voucher</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{summary.all}</p>
        </div>
        <div className="admin-card p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Đang áp dụng</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.running}</p>
        </div>
        <div className="admin-card p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sắp diễn ra</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{summary.upcoming}</p>
        </div>
        <div className="admin-card p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Đang tắt</p>
          <p className="mt-1 text-2xl font-bold text-slate-600">{summary.inactive}</p>
        </div>
        <div className="admin-card p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Đã hết hạn</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{summary.expired}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="admin-card p-4">
          <h2 className="text-lg font-semibold text-slate-800">{isEditing ? "Cập nhật voucher" : "Tạo voucher SHOP"}</h2>
          <p className="mt-1 text-sm text-slate-500">Các trường có giá trị 0 sẽ được hiểu là không giới hạn.</p>

          <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Mã voucher</label>
              <input
                className="admin-input"
                placeholder="VD: GIAM10"
                value={form.code}
                disabled={isEditing}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Loại giảm</label>
              <select
                className="admin-input"
                value={form.discountType}
                onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
              >
                <option value="PERCENT">Giảm theo phần trăm</option>
                <option value="FIXED">Giảm theo số tiền</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Giá trị giảm</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                placeholder="VD: 10 hoặc 50000"
                value={form.discountValue}
                onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Giảm tối đa</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                placeholder="0 = không giới hạn"
                value={form.maxDiscount}
                onChange={(event) => setForm((prev) => ({ ...prev, maxDiscount: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Đơn tối thiểu</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                placeholder="0 = không yêu cầu"
                value={form.minOrderValue}
                onChange={(event) => setForm((prev) => ({ ...prev, minOrderValue: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Giới hạn lượt dùng</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                placeholder="0 = không giới hạn"
                value={form.usageLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, usageLimit: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Bắt đầu</label>
              <input
                className="admin-input"
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Kết thúc</label>
              <input
                className="admin-input"
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Mô tả</label>
              <textarea
                className="admin-input"
                rows={3}
                placeholder="Mô tả ngắn điều kiện/đối tượng áp dụng"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <label className="md:col-span-2 inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.isActive)}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="h-4 w-4 accent-pink-500"
              />
              Kích hoạt voucher ngay sau khi lưu
            </label>

            <div className="md:col-span-2 flex gap-2">
              <button className="admin-btn bg-pink-500 text-white hover:bg-pink-600" type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : isEditing ? "Cập nhật" : "Tạo mới"}
              </button>
              {isEditing && (
                <button className="admin-btn" type="button" onClick={resetForm}>
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
          </form>
        </div>

        <aside className="admin-card p-4">
          <h3 className="text-base font-semibold text-slate-800">Xem trước nhanh</h3>
          <p className="mt-1 text-sm text-slate-500">Tóm tắt voucher theo dữ liệu bạn đang nhập.</p>
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">{form.code || "MÃ_GIẢM_GIÁ"}</p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {previewText.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>Hiệu lực: {form.startAt ? form.startAt.replace("T", " ") : "Chưa chọn"} - {form.endAt ? form.endAt.replace("T", " ") : "Chưa chọn"}</p>
              <p>Trạng thái: {form.isActive ? "Bật" : "Tắt"}</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="admin-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Danh sách voucher</h2>
          <input
            className="admin-input w-full lg:w-72"
            placeholder="Tìm theo mã voucher"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: "all", label: "Tất cả" },
            { key: "running", label: "Đang áp dụng" },
            { key: "upcoming", label: "Sắp diễn ra" },
            { key: "inactive", label: "Đang tắt" },
            { key: "expired", label: "Đã hết hạn" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setListFilter(item.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                listFilter === item.key
                  ? "border-pink-200 bg-pink-50 text-pink-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-500">Đang tải...</div>
        ) : filteredList.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            Không tìm thấy voucher phù hợp bộ lọc hiện tại.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredList.map((voucher) => {
              const phase = getVoucherPhase(voucher, currentTimestamp);
              return (
                <div key={voucher._id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-800">{voucher.code}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${phase.badgeClass}`}>
                          {phase.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {DISCOUNT_TYPE_LABEL[voucher.discountType] || voucher.discountType}:{" "}
                        <span className="font-semibold text-slate-800">
                          {voucher.discountType === "PERCENT" ? `${voucher.discountValue}%` : formatPrice(voucher.discountValue)}
                        </span>
                      </p>
                      <p className="text-sm text-slate-600">
                        Đơn tối thiểu {formatPrice(voucher.minOrderValue || 0)} | Giảm tối đa{" "}
                        {Number(voucher.maxDiscount || 0) > 0 ? formatPrice(voucher.maxDiscount) : "Không giới hạn"}
                      </p>
                      <p className="text-sm text-slate-600">
                        Đã dùng {voucher.usedCount || 0}/{voucher.usageLimit || "∞"}
                      </p>
                      <p className="text-sm text-slate-600">Hiệu lực: {formatDateTime(voucher.startAt)} - {formatDateTime(voucher.endAt)}</p>
                      {voucher.description ? <p className="text-sm text-slate-500">Mô tả: {voucher.description}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="admin-btn" type="button" onClick={() => startEdit(voucher)}>
                        Sửa
                      </button>
                      <button className="admin-btn" type="button" onClick={() => toggleActive(voucher)}>
                        {voucher.isActive ? "Tắt" : "Bật"}
                      </button>
                      <button
                        className="admin-btn border-rose-200 text-rose-600 hover:bg-rose-50"
                        type="button"
                        onClick={() => removeVoucher(voucher._id)}
                      >
                        Xóa
                      </button>
                    </div>
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
