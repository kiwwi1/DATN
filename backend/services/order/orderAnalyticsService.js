import orderModel from "../../models/orderModel.js";
import productModel from "../../models/productModel.js";

const pickImageUrl = (imageLike, variant = "main") => {
  const pickFromObject = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    const direct = typeof obj[variant] === "string" ? obj[variant].trim() : "";
    if (direct) return direct;
    const fallback = ["main", "url", "original", "thumb", "src"];
    for (const key of fallback) {
      const value = typeof obj[key] === "string" ? obj[key].trim() : "";
      if (value) return value;
    }
    return "";
  };

  if (Array.isArray(imageLike)) {
    for (const item of imageLike) {
      if (!item) continue;
      if (typeof item === "string" && item.trim()) return item.trim();
      const picked = pickFromObject(item);
      if (picked) return picked;
    }
    return "";
  }

  if (typeof imageLike === "string") return imageLike.trim();
  return pickFromObject(imageLike);
};

export const vendorStatsService = async (vendorId) => {
  const MONTH_NAMES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(now.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [allOrders, products] = await Promise.all([
    orderModel.find({ "items.vendorId": vendorId }).sort({ date: -1 }).lean(),
    productModel
      .find({ vendorId })
      .select("stock name category image sold isActive")
      .populate("category", "name")
      .lean(),
  ]);

  let totalRevenue = 0;
  let todayRevenue = 0;
  let weekRevenue = 0;
  let monthRevenue = 0;
  const ordersByStatus = {};
  const revenueByDay = {};
  const ordersByMonth = {};
  const productSalesMap = {};

  for (const order of allOrders) {
    const isCancelled = order.status === "Cancelled";
    const vendorItems = order.items.filter((item) => item.vendorId?.toString() === vendorId.toString());
    const vendorRevenue = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderDate = new Date(order.date);

    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;

    if (!isCancelled && orderDate >= twelveMonthsAgo) {
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
      if (!ordersByMonth[monthKey]) ordersByMonth[monthKey] = { orders: 0, revenue: 0 };
      ordersByMonth[monthKey].orders += 1;
      ordersByMonth[monthKey].revenue += vendorRevenue;
    }

    if (!isCancelled) {
      totalRevenue += vendorRevenue;
      if (orderDate >= startOfToday) todayRevenue += vendorRevenue;
      if (orderDate >= startOfWeek) weekRevenue += vendorRevenue;
      if (orderDate >= startOfMonth) monthRevenue += vendorRevenue;

      if (orderDate >= thirtyDaysAgo) {
        const key = orderDate.toISOString().split("T")[0];
        revenueByDay[key] = (revenueByDay[key] || 0) + vendorRevenue;
      }

      for (const item of vendorItems) {
        const productId = item._id?.toString();
        if (!productSalesMap[productId]) {
          productSalesMap[productId] = {
            name: item.name,
            image: pickImageUrl(item.image) || null,
            sold: 0,
            revenue: 0,
          };
        }
        productSalesMap[productId].sold += item.quantity;
        productSalesMap[productId].revenue += item.price * item.quantity;
      }
    }
  }

  const revenueChart = [];
  for (let index = 29; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    const key = date.toISOString().split("T")[0];
    revenueChart.push({ date: key, revenue: revenueByDay[key] || 0 });
  }

  const ordersChart = [];
  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setMonth(now.getMonth() - index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    ordersChart.push({
      month: MONTH_NAMES[date.getMonth()],
      orders: ordersByMonth[key]?.orders || 0,
      revenue: ordersByMonth[key]?.revenue || 0,
    });
  }

  const categoryCount = {};
  for (const product of products) {
    const categoryName = product.category?.name || "Khác";
    categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
  }
  const categoryChart = Object.entries(categoryCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topSelling = Object.values(productSalesMap)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const slowSelling = products
    .filter((product) => product.isActive !== false)
    .sort((a, b) => {
      const soldA = a.sold ?? 0;
      const soldB = b.sold ?? 0;
      if (soldA !== soldB) return soldA - soldB;
      return (b.stock ?? 0) - (a.stock ?? 0);
    })
    .slice(0, 5)
    .map((product) => {
      const productId = product._id?.toString();
      const fromOrders = productId ? productSalesMap[productId] : null;
      const image = pickImageUrl(product.image);
      return {
        _id: product._id,
        name: product.name,
        image: image || null,
        sold: fromOrders?.sold ?? product.sold ?? 0,
        revenue: fromOrders?.revenue ?? 0,
        stock: product.stock ?? 0,
      };
    });

  const LOW_STOCK_THRESHOLD = 5;
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + (product.stock || 0), 0);
  const lowStock = products.filter((product) => (product.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;
  const lowStockItems = products
    .filter((product) => (product.stock ?? 0) <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 20)
    .map((product) => {
      const image = pickImageUrl(product.image);
      return {
        _id: product._id,
        name: product.name,
        image: image || null,
        stock: product.stock ?? 0,
        isActive: product.isActive !== false,
      };
    });

  const recentOrders = allOrders.slice(0, 10).map((order) => ({
    _id: order._id,
    date: order.date,
    status: order.status,
    amount: order.items
      .filter((item) => item.vendorId?.toString() === vendorId.toString())
      .reduce((sum, item) => sum + item.price * item.quantity, 0),
    itemCount: order.items.filter((item) => item.vendorId?.toString() === vendorId.toString()).length,
  }));

  return {
    revenue: {
      total: totalRevenue,
      today: todayRevenue,
      week: weekRevenue,
      month: monthRevenue,
      chart: revenueChart,
    },
    orders: {
      total: allOrders.length,
      byStatus: ordersByStatus,
      monthlyChart: ordersChart,
      recent: recentOrders,
    },
    products: {
      total: totalProducts,
      totalStock,
      lowStock,
      lowStockItems,
      topSelling,
      slowSelling,
      categoryChart,
    },
  };
};
