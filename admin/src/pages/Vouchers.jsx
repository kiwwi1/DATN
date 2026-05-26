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

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

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
        toast.error(response.data.message || "Load vouchers failed");
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
      toast.error("Voucher code is required");
      return;
    }
    if (!payload.startAt || !payload.endAt || payload.endAt <= payload.startAt) {
      toast.error("Invalid start/end time");
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
          toast.error(response.data.message || "Update voucher failed");
          return;
        }
        toast.success("Voucher updated");
      } else {
        const response = await axios.post(`${backendUrl}/api/voucher/create`, payload, {
          headers: { token },
        });
        if (!response.data.success) {
          toast.error(response.data.message || "Create voucher failed");
          return;
        }
        toast.success("Voucher created");
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
        toast.error(response.data.message || "Update status failed");
        return;
      }
      await loadVouchers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const removeVoucher = async (voucherId) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/voucher/delete`,
        { voucherId },
        { headers: { token } }
      );
      if (!response.data.success) {
        toast.error(response.data.message || "Delete failed");
        return;
      }
      toast.success("Voucher deleted");
      await loadVouchers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="admin-card p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          {isEditing ? "Cap nhat voucher" : "Tao voucher SHOP"}
        </h2>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <input
            className="admin-input"
            placeholder="Code"
            value={form.code}
            disabled={isEditing}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
          />
          <select
            className="admin-input"
            value={form.discountType}
            onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
          >
            <option value="PERCENT">PERCENT</option>
            <option value="FIXED">FIXED</option>
          </select>
          <input
            className="admin-input"
            type="number"
            placeholder="Discount value"
            value={form.discountValue}
            onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
          />
          <input
            className="admin-input"
            type="number"
            placeholder="Max discount (0 = no limit)"
            value={form.maxDiscount}
            onChange={(event) => setForm((prev) => ({ ...prev, maxDiscount: event.target.value }))}
          />
          <input
            className="admin-input"
            type="number"
            placeholder="Min order value"
            value={form.minOrderValue}
            onChange={(event) => setForm((prev) => ({ ...prev, minOrderValue: event.target.value }))}
          />
          <input
            className="admin-input"
            type="number"
            placeholder="Usage limit (0 = no limit)"
            value={form.usageLimit}
            onChange={(event) => setForm((prev) => ({ ...prev, usageLimit: event.target.value }))}
          />
          <input
            className="admin-input"
            type="datetime-local"
            value={form.startAt}
            onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
          />
          <input
            className="admin-input"
            type="datetime-local"
            value={form.endAt}
            onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
          />
          <textarea
            className="admin-input md:col-span-2"
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <div className="md:col-span-2 flex gap-2">
            <button className="admin-btn bg-pink-500 text-white hover:bg-pink-600" type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </button>
            {isEditing && (
              <button className="admin-btn" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Danh sach voucher</h2>
        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-slate-500">Chua co voucher nao</div>
        ) : (
          <div className="space-y-2">
            {list.map((voucher) => (
              <div key={voucher._id} className="rounded border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{voucher.code}</p>
                    <p className="text-xs text-slate-500">
                      {voucher.discountType} {voucher.discountType === "PERCENT" ? `${voucher.discountValue}%` : formatPrice(voucher.discountValue)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Min {formatPrice(voucher.minOrderValue || 0)} - Used {voucher.usedCount || 0}/{voucher.usageLimit || "INF"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="admin-btn" type="button" onClick={() => startEdit(voucher)}>Edit</button>
                    <button className="admin-btn" type="button" onClick={() => toggleActive(voucher)}>
                      {voucher.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="admin-btn border-rose-200 text-rose-600 hover:bg-rose-50"
                      type="button"
                      onClick={() => removeVoucher(voucher._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Vouchers;
