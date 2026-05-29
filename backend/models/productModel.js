import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: Array, required: true },

    // Category references - hierarchical structure like Shopee
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
    },
    subSubCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
    },

    bestseller: { type: Boolean, default: false },
    date: { type: Number, required: true },
    sold: { type: Number, default: 0 },

    // Vendor information
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    vendorShopName: { type: String },

    // Additional Shopee-like features
    stock: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    brand: { type: String, default: "" },
    tags: { type: Array, default: [] },

    attributes: [
      {
        name: { type: String, required: true },
        values: [{ type: String }],
      },
    ],

    // SKU-based variants
    variants: [
      {
        combination: { type: mongoose.Schema.Types.Mixed, required: true },
        variantKey: { type: String, default: "" },
        price: { type: Number, required: true, min: 0 },
        stock: { type: Number, default: 0, min: 0 },
      },
    ],

    // Deprecated: keep for backward compatibility
    sizes: { type: Array, default: [] },

    discount: { type: Number, default: 0, min: 0, max: 100 },
    originalPrice: { type: Number },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ vendorId: 1 });
productSchema.index({ bestseller: 1 });
productSchema.index({ price: 1 });
productSchema.index({ sold: -1 });
// Text index — chuẩn bị cho server-side search (MongoDB $text / Atlas Search)
productSchema.index({ name: 'text', brand: 'text', tags: 'text' }, { weights: { name: 10, brand: 5, tags: 3 }, name: 'product_text_idx' });


const productModel = mongoose.models.product || mongoose.model("product", productSchema);
export default productModel;

