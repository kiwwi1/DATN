import React, { useEffect, useRef } from 'react'
import { formatPrice } from '../utils/priceFormat'

// Tạo tích Descartes từ mảng các mảng giá trị
function cartesian(arrays) {
    if (arrays.length === 0) return [[]]
    const [first, ...rest] = arrays
    const restProduct = cartesian(rest)
    return first.flatMap(val => restProduct.map(combo => [val, ...combo]))
}

// Tạo key duy nhất từ combination object (để dedup)
function comboKey(combination) {
    return Object.entries(combination)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}:${v}`)
        .join('|')
}

// Tạo label hiển thị cho một combination
function comboLabel(combination) {
    return Object.entries(combination).map(([k, v]) => `${k}: ${v}`).join(' / ')
}

const VariantsManager = ({ attributes, variants, onChange }) => {
    // Dùng ref để tránh stale closure trong useEffect
    const variantsRef = useRef(variants)
    useEffect(() => { variantsRef.current = variants }, [variants])

    // Tái tạo danh sách variant khi attributes thay đổi
    useEffect(() => {
        if (!attributes || attributes.length === 0) {
            onChange([])
            return
        }

        const validAttrs = attributes.filter(a => a.values && a.values.length > 0)
        if (validAttrs.length === 0) {
            onChange([])
            return
        }

        const attrValues = validAttrs.map(a =>
            a.values.map(v => ({ name: a.name, value: v }))
        )
        const combos = cartesian(attrValues)

        // Lookup từ variants hiện tại để giữ lại price/stock
        const existingMap = {}
        ;(variantsRef.current || []).forEach(v => {
            if (v.combination) existingMap[comboKey(v.combination)] = v
        })

        const newVariants = combos.map(combo => {
            const combination = {}
            combo.forEach(({ name, value }) => { combination[name] = value })
            const key = comboKey(combination)
            const existing = existingMap[key]
            return {
                combination,
                price: existing ? existing.price : 0,
                stock: existing ? existing.stock : 0,
            }
        })

        onChange(newVariants)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attributes])

    const handleChange = (index, field, value) => {
        const updated = [...variants]
        updated[index] = { ...updated[index], [field]: Number(value) || 0 }
        onChange(updated)
    }

    // Điền nhanh cùng giá cho tất cả biến thể
    const fillAllPrice = (price) => {
        onChange(variants.map(v => ({ ...v, price: Number(price) || 0 })))
    }

    // Điền nhanh cùng stock cho tất cả biến thể
    const fillAllStock = (stock) => {
        onChange(variants.map(v => ({ ...v, stock: Number(stock) || 0 })))
    }

    if (!variants || variants.length === 0) {
        return (
            <div className="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 text-center">
                Thêm thuộc tính ở trên để tự động tạo bảng biến thể (SKU).
            </div>
        )
    }

    const minPrice = Math.min(...variants.map(v => v.price || 0).filter(p => p > 0))
    const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0)

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                    Giá &amp; Tồn kho theo biến thể
                    <span className="ml-2 text-xs font-normal text-gray-500">({variants.length} tổ hợp)</span>
                </p>
                <div className="flex gap-2 text-xs">
                    <span className="text-gray-500">
                        Điền nhanh — Giá:
                        <input
                            type="number"
                            min="0"
                            placeholder="0"
                            onBlur={e => { if (e.target.value) fillAllPrice(e.target.value) }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fillAllPrice(e.target.value); e.target.value = '' } }}
                            className="ml-1 w-24 border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </span>
                    <span className="text-gray-500">
                        Tồn:
                        <input
                            type="number"
                            min="0"
                            placeholder="0"
                            onBlur={e => { if (e.target.value) fillAllStock(e.target.value) }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fillAllStock(e.target.value); e.target.value = '' } }}
                            className="ml-1 w-16 border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </span>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Phân loại</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 w-40">Giá (VNĐ) *</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 w-32">Tồn kho</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {variants.map((variant, idx) => (
                            <tr key={idx} className={variant.stock === 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                <td className="px-3 py-2 text-gray-700 font-medium">
                                    {comboLabel(variant.combination)}
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        type="number"
                                        value={variant.price}
                                        onChange={e => handleChange(idx, 'price', e.target.value)}
                                        min="0"
                                        className="w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="0"
                                        required
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        type="number"
                                        value={variant.stock}
                                        onChange={e => handleChange(idx, 'stock', e.target.value)}
                                        min="0"
                                        className="w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="0"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                {minPrice > 0 && (
                    <span>Giá hiển thị: từ <strong className="text-orange-600">{formatPrice(minPrice)}</strong></span>
                )}
                <span>Tổng tồn kho: <strong>{totalStock}</strong></span>
            </div>
        </div>
    )
}

export default VariantsManager
