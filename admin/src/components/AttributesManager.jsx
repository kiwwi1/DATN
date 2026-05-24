import { useState } from 'react'
import { ATTRIBUTE_PRESETS } from '../utils/categoryHelper'

const AttributesManager = ({ attributes, setAttributes }) => {
  const [newValue, setNewValue] = useState('')
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState(0)

  const addAttribute = () => {
    setAttributes([...attributes, { name: 'Phân loại', values: [] }])
  }

  const removeAttribute = (index) => {
    setAttributes(attributes.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateAttributeName = (index, newName) => {
    const updated = [...attributes]
    updated[index].name = newName
    setAttributes(updated)
  }

  const addValue = (index, value) => {
    if (!value.trim()) return
    const updated = [...attributes]
    if (!updated[index].values.includes(value.trim())) {
      updated[index].values.push(value.trim())
      setAttributes(updated)
    }
  }

  const removeValue = (attributeIndex, valueIndex) => {
    const updated = [...attributes]
    updated[attributeIndex].values = updated[attributeIndex].values.filter(
      (_, currentValueIndex) => currentValueIndex !== valueIndex
    )
    setAttributes(updated)
  }

  const applyPreset = (index, presetKey) => {
    const preset = ATTRIBUTE_PRESETS[presetKey]
    if (!preset) return
    const updated = [...attributes]
    updated[index].name = preset.name
    updated[index].values = [...preset.suggestions]
    setAttributes(updated)
  }

  return (
    <section className="admin-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">
          Thuộc tính sản phẩm <span className="text-rose-500">*</span>
        </p>
        <button
          type="button"
          onClick={addAttribute}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          + Thêm thuộc tính
        </button>
      </div>

      {attributes.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
          <p>Chưa có thuộc tính nào. Hãy bấm "Thêm thuộc tính".</p>
          <p className="mt-1 text-xs text-slate-400">Ví dụ: Kích cỡ (S, M, L), Màu sắc (Đen, Trắng)</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attributes.map((attribute, attributeIndex) => (
            <div key={attributeIndex} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="text"
                  value={attribute.name}
                  onChange={(event) => updateAttributeName(attributeIndex, event.target.value)}
                  placeholder="Tên thuộc tính (ví dụ: Màu sắc)"
                  className="admin-input"
                />

                <select
                  onChange={(event) => {
                    if (!event.target.value) return
                    applyPreset(attributeIndex, event.target.value)
                    event.target.value = ''
                  }}
                  className="admin-select max-w-[170px]"
                >
                  <option value="">Mẫu nhanh...</option>
                  {Object.keys(ATTRIBUTE_PRESETS).map((key) => (
                    <option key={key} value={key}>
                      {ATTRIBUTE_PRESETS[key].name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => removeAttribute(attributeIndex)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-base font-semibold text-rose-600 transition hover:bg-rose-100"
                  aria-label="Xóa thuộc tính"
                >
                  ×
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedAttributeIndex === attributeIndex ? newValue : ''}
                  onChange={(event) => {
                    setSelectedAttributeIndex(attributeIndex)
                    setNewValue(event.target.value)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addValue(attributeIndex, newValue)
                    setNewValue('')
                  }}
                  placeholder={`Thêm giá trị cho ${attribute.name}`}
                  className="admin-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    addValue(attributeIndex, selectedAttributeIndex === attributeIndex ? newValue : '')
                    if (selectedAttributeIndex === attributeIndex) setNewValue('')
                  }}
                  className="admin-btn-primary px-3"
                >
                  Thêm
                </button>
              </div>

              {attribute.values.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attribute.values.map((value, valueIndex) => (
                    <div
                      key={`${value}-${valueIndex}`}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                    >
                      <span>{value}</span>
                      <button
                        type="button"
                        onClick={() => removeValue(attributeIndex, valueIndex)}
                        className="font-bold text-sky-700 transition hover:text-rose-600"
                        aria-label={`Xóa giá trị ${value}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs italic text-slate-500">Chưa có giá trị. Cần ít nhất một giá trị cho mỗi thuộc tính.</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-slate-700">
        <p className="mb-1 font-semibold text-sky-800">Gợi ý nhanh</p>
        <ul className="space-y-1">
          <li>Quần áo: Kích cỡ (S, M, L, XL)</li>
          <li>Điện tử: Màu sắc, dung lượng</li>
          <li>Phụ kiện: Kích thước, màu sắc</li>
          <li>Nhấn Enter để thêm giá trị nhanh</li>
        </ul>
      </div>
    </section>
  )
}

export default AttributesManager
