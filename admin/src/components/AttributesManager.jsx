import React, { useState } from 'react'
import { ATTRIBUTE_PRESETS } from '../utils/categoryHelper'

const AttributesManager = ({ attributes, setAttributes }) => {
  const [newValue, setNewValue] = useState('')
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState(0)

  // Add new attribute
  const addAttribute = () => {
    setAttributes([...attributes, { name: 'Phân loại', values: [] }])
  }

  // Remove attribute
  const removeAttribute = (index) => {
    setAttributes(attributes.filter((_, i) => i !== index))
  }

  // Update attribute name
  const updateAttributeName = (index, newName) => {
    const updated = [...attributes]
    updated[index].name = newName
    setAttributes(updated)
  }

  // Add value to attribute
  const addValue = (index, value) => {
    if (!value.trim()) return
    const updated = [...attributes]
    if (!updated[index].values.includes(value.trim())) {
      updated[index].values.push(value.trim())
      setAttributes(updated)
    }
  }

  // Remove value from attribute
  const removeValue = (attrIndex, valueIndex) => {
    const updated = [...attributes]
    updated[attrIndex].values = updated[attrIndex].values.filter((_, i) => i !== valueIndex)
    setAttributes(updated)
  }

  // Apply preset
  const applyPreset = (index, presetKey) => {
    const preset = ATTRIBUTE_PRESETS[presetKey]
    if (preset) {
      const updated = [...attributes]
      updated[index].name = preset.name
      updated[index].values = [...preset.suggestions]
      setAttributes(updated)
    }
  }

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium text-gray-700'>
          Product Attributes <span className="text-red-500">*</span>
        </p>
        <button
          type='button'
          onClick={addAttribute}
          className='text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors'
        >
          + Add Attribute
        </button>
      </div>

      {attributes.length === 0 ? (
        <div className='border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500'>
          <p>No attributes yet. Click "Add Attribute" to create one.</p>
          <p className='text-xs mt-2'>Ví dụ: Size (S, M, L), Màu sắc (Đen, Trắng), v.v.</p>
        </div>
      ) : (
        attributes.map((attr, attrIndex) => (
          <div key={attrIndex} className='border-2 border-gray-300 rounded-lg p-4 space-y-3'>
            {/* Attribute Header */}
            <div className='flex items-center justify-between gap-3'>
              <div className='flex-1 flex items-center gap-3'>
                <input
                  type='text'
                  value={attr.name}
                  onChange={(e) => updateAttributeName(attrIndex, e.target.value)}
                  placeholder='Attribute Name (e.g., Size, Color)'
                  className='flex-1 border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                />
                
                {/* Preset Selector */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      applyPreset(attrIndex, e.target.value)
                      e.target.value = '' // Reset
                    }
                  }}
                  className='border-2 border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none'
                >
                  <option value=''>Quick Add...</option>
                  {Object.keys(ATTRIBUTE_PRESETS).map((key) => (
                    <option key={key} value={key}>
                      {ATTRIBUTE_PRESETS[key].name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type='button'
                onClick={() => removeAttribute(attrIndex)}
                className='px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                title='Remove attribute'
              >
                ✕
              </button>
            </div>

            {/* Add Value Input */}
            <div className='flex gap-2'>
              <input
                type='text'
                value={selectedAttributeIndex === attrIndex ? newValue : ''}
                onChange={(e) => {
                  setSelectedAttributeIndex(attrIndex)
                  setNewValue(e.target.value)
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addValue(attrIndex, newValue)
                    setNewValue('')
                  }
                }}
                placeholder={`Add ${attr.name} value (e.g., S, M, L)`}
                className='flex-1 border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
              />
              <button
                type='button'
                onClick={() => {
                  addValue(attrIndex, selectedAttributeIndex === attrIndex ? newValue : '')
                  if (selectedAttributeIndex === attrIndex) setNewValue('')
                }}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
              >
                Add
              </button>
            </div>

            {/* Values Display */}
            {attr.values.length > 0 ? (
              <div className='flex gap-2 flex-wrap'>
                {attr.values.map((value, valueIndex) => (
                  <div
                    key={valueIndex}
                    className='flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg'
                  >
                    <span>{value}</span>
                    <button
                      type='button'
                      onClick={() => removeValue(attrIndex, valueIndex)}
                      className='text-blue-700 hover:text-red-600 font-bold'
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-xs text-gray-500 italic'>
                No values yet. Add at least one value for this attribute.
              </p>
            )}
          </div>
        ))
      )}

      {/* Info Box */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-gray-700'>
        <p className='font-medium text-blue-800 mb-1'>💡 Tips:</p>
        <ul className='space-y-1 ml-4'>
          <li>• Quần áo: Sử dụng "Size" (S, M, L, XL)</li>
          <li>• Điện tử: Sử dụng "Màu sắc" hoặc "Dung lượng"</li>
          <li>• Pad chuột: Sử dụng "Màu sắc" hoặc "Kích thước"</li>
          <li>• Press Enter to quickly add values</li>
        </ul>
      </div>
    </div>
  )
}

export default AttributesManager















