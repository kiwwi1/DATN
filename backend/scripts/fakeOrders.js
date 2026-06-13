/**
 * Script to generate fake orders for products to simulate sales data.
 *
 * Chạy từ thư mục backend:
 *   node scripts/fakeOrders.js [số_lượng_đơn_hàng]
 * Ví dụ:
 *   node scripts/fakeOrders.js 50
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const addressTemplates = [
  { name: "Nguyễn Văn A", phone: "0912345678", street: "123 Nguyễn Trãi", city: "Hà Nội", district: "Thanh Xuân", ward: "Thượng Đình" },
  { name: "Trần Thị B", phone: "0987654321", street: "456 Lê Lợi", city: "Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
  { name: "Lê Văn C", phone: "0905123456", street: "789 Nguyễn Văn Linh", city: "Đà Nẵng", district: "Hải Châu", ward: "Nam Dương" },
  { name: "Phạm Minh D", phone: "0934567890", street: "12 Trần Hưng Đạo", city: "Cần Thơ", district: "Ninh Kiều", ward: "An Hội" },
  { name: "Hoàng Thị E", phone: "0976543210", street: "99 Quang Trung", city: "Hải Phòng", district: "Hồng Bàng", ward: "Phan Bội Châu" }
];

const paymentMethods = ["COD", "Stripe", "VNPay"];
const statuses = ["Order Placed", "Packing", "Shipped", "Delivered"];

async function main() {
  try {
    console.log("🔌 Connecting to database...");
    await connectDB();

    // 1. Lấy hoặc tạo user đóng vai trò người mua
    let buyer = await userModel.findOne({ role: "user" });
    if (!buyer) {
      console.log("👤 No user found with role 'user'. Creating a fake buyer...");
      buyer = await userModel.create({
        name: "Người mua thử nghiệm",
        email: `buyer_${Date.now()}@example.com`,
        password: "hashedpassword123", // dummy password
        role: "user",
        emailVerified: true
      });
      console.log(`✅ Fake buyer created: ${buyer.name} (${buyer.email})`);
    } else {
      console.log(`👤 Found existing user to act as buyer: ${buyer.name} (${buyer.email})`);
    }

    // 2. Lấy tất cả sản phẩm đang active
    const products = await productModel.find({ isActive: { $ne: false } });
    if (products.length === 0) {
      console.error("❌ No active products found in the database. Please add some products first!");
      process.exit(1);
    }
    console.log(`📦 Found ${products.length} active products to generate sales for.`);

    // 3. Xác định số lượng đơn hàng cần tạo từ tham số dòng lệnh (mặc định 30)
    const args = process.argv.slice(2);
    const numOrders = parseInt(args[0], 10) || 30;
    console.log(`🎲 Generating ${numOrders} fake orders...`);

    const fakeOrders = [];

    for (let i = 0; i < numOrders; i++) {
      // Chọn ngẫu nhiên số lượng sản phẩm khác nhau trong đơn (từ 1 đến 3)
      const numItems = Math.floor(Math.random() * 3) + 1;
      const selectedProducts = [];
      
      // Lấy ngẫu nhiên các sản phẩm không bị trùng lặp
      while (selectedProducts.length < Math.min(numItems, products.length)) {
        const randProduct = products[Math.floor(Math.random() * products.length)];
        if (!selectedProducts.find(p => p._id.toString() === randProduct._id.toString())) {
          selectedProducts.push(randProduct);
        }
      }

      const orderItems = [];
      const vendorsMap = new Map();

      for (const product of selectedProducts) {
        const quantity = Math.floor(Math.random() * 3) + 1; // Số lượng mua từ 1 đến 3
        const price = product.price;
        const discount = product.discount || 0;
        const originalPrice = product.originalPrice || price;

        const item = {
          _id: product._id.toString(),
          name: product.name,
          price: price,
          originalPrice: originalPrice,
          discount: discount,
          quantity: quantity,
          image: product.image || [],
          brand: product.brand || "",
          selectedAttributes: [],
          size: product.sizes && product.sizes.length > 0 ? product.sizes[0] : undefined,
          variantKey: "",
          vendorId: product.vendorId,
          vendorShopName: product.vendorShopName || "Shop Đối Tác"
        };

        orderItems.push(item);

        // Gom nhóm sản phẩm theo vendor
        const vId = product.vendorId.toString();
        if (!vendorsMap.has(vId)) {
          vendorsMap.set(vId, {
            vendorId: product.vendorId,
            vendorShopName: product.vendorShopName || "Shop Đối Tác",
            items: [],
            subtotal: 0
          });
        }
        
        const vendorData = vendorsMap.get(vId);
        // Map sang schema của vendorItem
        vendorData.items.push({
          productId: product._id.toString(),
          name: product.name,
          price: price,
          originalPrice: originalPrice,
          discount: discount,
          quantity: quantity,
          image: product.image || [],
          brand: product.brand || "",
          selectedAttributes: [],
          size: product.sizes && product.sizes.length > 0 ? product.sizes[0] : undefined,
          variantKey: ""
        });
        vendorData.subtotal += price * quantity;
      }

      // Tính tổng giá trị đơn hàng
      const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const shippingFee = 15000; // Phí ship cố định 15k
      const finalTotal = subtotal + shippingFee;

      // Chọn ngẫu nhiên địa chỉ, phương thức thanh toán và trạng thái
      const address = addressTemplates[Math.floor(Math.random() * addressTemplates.length)];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      
      // Tỷ lệ trạng thái: 75% Delivered, 15% Shipped, 10% Packing/Order Placed
      let status = "Delivered";
      const statusRand = Math.random();
      if (statusRand < 0.1) {
        status = "Order Placed";
      } else if (statusRand < 0.25) {
        status = "Shipped";
      }

      const isPaid = status === "Delivered" || status === "Shipped" || paymentMethod !== "COD";

      // Tạo ngẫu nhiên ngày mua trong vòng 30 ngày qua
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const orderDate = now - Math.floor(Math.random() * thirtyDaysMs);

      // Chuyển map vendors thành mảng tương thích schema
      const vendorsList = Array.from(vendorsMap.values()).map(v => ({
        ...v,
        vendorStatus: status === "Delivered" ? "delivered" : status === "Shipped" ? "shipped" : "pending",
        commission: 10
      }));

      const newOrderData = {
        userId: buyer._id,
        items: orderItems,
        amount: finalTotal,
        pricing: {
          subtotal: subtotal,
          shopDiscount: 0,
          platformDiscount: 0,
          shippingFee: shippingFee,
          shippingDiscount: 0,
          finalTotal: finalTotal
        },
        appliedVouchers: [],
        address: address,
        status: status,
        paymentMethod: paymentMethod,
        payment: isPaid,
        date: orderDate,
        vendors: vendorsList
      };

      fakeOrders.push(newOrderData);
    }

    console.log(`💾 Inserting orders into database...`);
    const inserted = await orderModel.insertMany(fakeOrders);
    console.log(`✅ Successfully created ${inserted.length} fake orders.`);

    // 4. Đồng bộ lại sold count của sản phẩm dựa trên tất cả đơn hàng (không bị huỷ)
    console.log("🔄 Recalculating actual product sold counts based on all orders...");
    
    // Reset toàn bộ sold count về 0 trước
    await productModel.updateMany({}, { $set: { sold: 0 } });

    // Lấy các đơn hàng không bị Cancelled
    const orders = await orderModel.find({ status: { $ne: "Cancelled" } }).lean();
    const salesMap = new Map();

    for (const order of orders) {
      if (!order.items || !Array.isArray(order.items)) continue;
      for (const item of order.items) {
        const productId = String(item._id);
        const quantity = Math.max(0, Number(item.quantity) || 0);
        if (quantity === 0) continue;
        salesMap.set(productId, (salesMap.get(productId) || 0) + quantity);
      }
    }

    let updatedProductsCount = 0;
    for (const [productId, quantity] of salesMap.entries()) {
      const updateResult = await productModel.updateOne(
        { _id: productId },
        { $set: { sold: quantity } }
      );
      if (updateResult.modifiedCount > 0) {
        updatedProductsCount++;
      }
    }

    console.log(`🎉 Recalculation completed. Updated sold counts for ${updatedProductsCount} products.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to generate fake orders:", err);
    process.exit(1);
  }
}

main();
