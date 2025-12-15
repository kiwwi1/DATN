import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{ 
    _id: { type: String, required: true }, // Product ID
    name: { type: String, required: true },
    price: { type: Number, required: true }, // Current price (after discount)
    originalPrice: { type: Number }, // Price before discount
    discount: { type: Number, default: 0 }, // Discount percentage
    quantity: { type: Number, required: true },
    image: { type: Array, default: [] }, // Product images
    brand: { type: String, default: '' },
    
    // Product attributes selected (e.g., Size: M, Color: Red)
    selectedAttributes: [{ 
      name: { type: String }, // e.g., "Size", "Color"
      value: { type: String }  // e.g., "M", "Red"
    }],
    
    // Deprecated: Keep for backward compatibility
    size: { type: String },
    
    // Vendor information (for filtering orders)
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    vendorShopName: { type: String }
  }],
  amount: { type: Number, required: true },
  address: { type: Object, required: true },
  status: { type: String, default: "Order Placed" },
  paymentMethod: { type: String, required: true },
  payment: { type: Boolean, default: false, required: true },
  date: { type: Number, required: true },
  
  // Vendor tracking for multi-vendor orders
  vendors: [{
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    vendorShopName: { type: String },
    items: [{ 
      productId: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      originalPrice: { type: Number },
      discount: { type: Number, default: 0 },
      quantity: { type: Number, required: true },
      image: { type: Array, default: [] },
      brand: { type: String, default: '' },
      selectedAttributes: [{ 
        name: { type: String },
        value: { type: String }
      }],
      size: { type: String } // Deprecated
    }],
    subtotal: { type: Number, required: true },
    vendorStatus: { type: String, enum: ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    commission: { type: Number, default: 10 }
  }]
});

const orderModel = mongoose.model.order || mongoose.model("order", orderSchema);
export default orderModel;
