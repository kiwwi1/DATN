import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {type: String, required: true},
    description: {type: String, required: true},
    price: {type: Number, required: true},
    image: {type: Array, required: true},
    
    // Category references - hierarchical structure like Shopee
    category: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'category', 
        required: true
    }, // Main category (level 1)
    subCategory: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'category'
    }, // Sub-category (level 2)
    subSubCategory: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'category'
    }, // Sub-sub-category (level 3)
    
    bestseller: {type: Boolean, default: false},
    date: {type: Number, required: true},
    sold: {type: Number, default: 0},
    
    // Vendor information
    vendorId: {type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true},
    vendorShopName: {type: String}, // Cached shop name for better performance
    
    // Additional Shopee-like features
    stock: {type: Number, default: 0},
    rating: {type: Number, default: 0, min: 0, max: 5},
    reviewCount: {type: Number, default: 0},
    brand: {type: String, default: ''},
    tags: {type: Array, default: []},
    
    // Flexible product attributes (variants)
    // For clothes: Size (S, M, L, XL)
    // For electronics: Color (Red, Blue, Black)
    // For accessories: Material, Color, etc.
    attributes: [{
        name: {type: String, required: true}, // e.g., "Size", "Color", "Material"
        values: [{type: String}] // e.g., ["S", "M", "L"] or ["Red", "Blue"]
    }],

    // SKU-based variants: each combination of attribute values has its own price & stock
    variants: [{
        combination: { type: mongoose.Schema.Types.Mixed, required: true }, // e.g. { "Size": "S", "Màu sắc": "Đỏ" }
        price:       { type: Number, required: true, min: 0 },
        stock:       { type: Number, default: 0, min: 0 }
    }],
    
    // Deprecated: Keep for backward compatibility, but use attributes instead
    sizes: {type: Array, default: []},
    
    // Discount and promotion
    discount: {type: Number, default: 0, min: 0, max: 100}, // Percentage
    originalPrice: {type: Number}, // Price before discount
    
    isActive: {type: Boolean, default: true}
}, {
    timestamps: true
})

// Index for better query performance
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ vendorId: 1 });
productSchema.index({ bestseller: 1 });
productSchema.index({ price: 1 });
productSchema.index({ sold: -1 });

const productModel = mongoose.models.product || mongoose.model('product', productSchema)
export default productModel;