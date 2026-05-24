import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '../utils/priceFormat'

function cartesian(arrays) {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restProduct = cartesian(rest)
  return first.flatMap((value) => restProduct.map((combo) => [value, ...combo]))
}

function comboKey(combination) {
  return Object.entries(combination)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join('|')
}

function comboLabel(combination) {
  return Object.entries(combination)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' / ')
}

const getRawPriceValue = (value) => String(value || '').replace(/\D/g, '')
const formatPriceInput = (value) => {
  const rawValue = getRawPriceValue(value)
  if (!rawValue) return ''
  return Number(rawValue).toLocaleString('vi-VN')
}

const VariantsManager = ({ attributes, variants, onChange }) => {
  const variantsRef = useRef(variants)
  const [quickPrice, setQuickPrice] = useState('')

  useEffect(() => {
    variantsRef.current = variants
  }, [variants])

  useEffect(() => {
    if (!attributes || attributes.length === 0) {
      onChange([])
      return
    }

    const validAttributes = attributes.filter((attribute) => attribute.values && attribute.values.length > 0)
    if (validAttributes.length === 0) {
      onChange([])
      return
    }

    const attributeValues = validAttributes.map((attribute) =>
      attribute.values.map((value) => ({ name: attribute.name, value }))
    )
    const combinations = cartesian(attributeValues)

    const existingMap = {}
    ;(variantsRef.current || []).forEach((variant) => {
      if (variant.combination) existingMap[comboKey(variant.combination)] = variant
    })

    const nextVariants = combinations.map((combo) => {
      const combination = {}
      combo.forEach(({ name, value }) => {
        combination[name] = value
      })
      const existing = existingMap[comboKey(combination)]
      return {
        combination,
        price: existing ? existing.price : 0,
        stock: existing ? existing.stock : 0,
      }
    })

    onChange(nextVariants)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes])

  const handleChange = (index, field, value) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: Number(value) || 0 }
    onChange(updated)
  }

  const handlePriceChange = (index, value) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], price: Number(getRawPriceValue(value)) || 0 }
    onChange(updated)
  }

  const fillAllPrice = (price) => {
    onChange(variants.map((variant) => ({ ...variant, price: Number(price) || 0 })))
  }

  const fillAllStock = (stock) => {
    onChange(variants.map((variant) => ({ ...variant, stock: Number(stock) || 0 })))
  }

  if (!variants || variants.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
        Thêm thuộc tính ở trên để tự động tạo bảng biến thể (SKU).
      </div>
    )
  }

  const minPrice = Math.min(...variants.map((variant) => variant.price || 0).filter((price) => price > 0))
  const totalStock = variants.reduce((sum, variant) => sum + (variant.stock || 0), 0)

  return (
    <section className="admin-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          Giá và tồn kho theo biến thể
          <span className="ml-2 text-xs font-normal text-slate-500">({variants.length} tổ hợp)</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            Điền nhanh giá:
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={quickPrice}
              onChange={(event) => setQuickPrice(formatPriceInput(event.target.value))}
              onBlur={() => {
                if (quickPrice) fillAllPrice(getRawPriceValue(quickPrice))
                setQuickPrice('')
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                fillAllPrice(getRawPriceValue(quickPrice))
                setQuickPrice('')
              }}
              className="admin-input w-28 px-2 py-1 text-xs"
            />
          </span>
          <span className="inline-flex items-center gap-1">
            Điền nhanh tồn:
            <input
              type="number"
              min="0"
              onBlur={(event) => {
                if (event.target.value) fillAllStock(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                fillAllStock(event.target.value)
                event.target.value = ''
              }}
              className="admin-input w-16 px-2 py-1 text-xs"
            />
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Phân loại</th>
              <th className="w-44 px-3 py-2 text-left font-semibold">Giá (VNĐ) *</th>
              <th className="w-32 px-3 py-2 text-left font-semibold">Tồn kho</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.map((variant, index) => (
              <tr key={index} className={variant.stock === 0 ? 'bg-rose-50/50' : 'hover:bg-slate-50'}>
                <td className="px-3 py-2 font-medium text-slate-700">{comboLabel(variant.combination)}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={variant.price ? formatPriceInput(variant.price) : ''}
                    onChange={(event) => handlePriceChange(index, event.target.value)}
                    className="admin-input py-1.5"
                    placeholder="0"
                    required
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    value={variant.stock || ''}
                    onChange={(event) => handleChange(index, 'stock', event.target.value)}
                    className="admin-input py-1.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        {minPrice > 0 && (
          <span>
            Giá hiển thị từ: <strong className="text-pink-600">{formatPrice(minPrice)}</strong>
          </span>
        )}
        <span>
          Tổng tồn kho: <strong>{totalStock}</strong>
        </span>
      </div>
    </section>
  )
}

export default VariantsManager
