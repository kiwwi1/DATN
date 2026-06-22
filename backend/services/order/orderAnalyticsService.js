import orderModel from "../../models/orderModel.js";
import productModel from "../../models/productModel.js";
import { getRedisClient } from "../../config/redis.js";

const VENDOR_STATS_CACHE_TTL_SEC = 60;

const buildVendorStatsCacheKey = (vendorId, startDate, endDate) =>
  `vendor-stats:${vendorId}:start:${startDate || "all"}:end:${endDate || "all"}`;

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

export const vendorStatsService = async (vendorId, { startDate, endDate } = {}) => {
  const vendorKey = vendorId?.toString?.() || String(vendorId);
  const cacheKey = buildVendorStatsCacheKey(vendorKey, startDate, endDate);
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Cache read failure should not block stats generation.
    }
  }

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

  const orderQuery = { "vendors.vendorId": vendorId };
  if (startDate && endDate) {
    orderQuery.date = { $gte: Number(startDate), $lte: Number(endDate) };
  }

  const [allOrders, products] = await Promise.all([
    orderModel
      .find(orderQuery)
      .select("items vendors status date")
      .sort({ date: -1 })
      .lean(),
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

  let totalNetRevenue = 0;
  let todayNetRevenue = 0;
  let weekNetRevenue = 0;
  let monthNetRevenue = 0;

  const ordersByStatus = {};
  const revenueByDay = {};
  const netRevenueByDay = {};
  const ordersByMonth = {};
  const productSalesMap = {};

  for (const order of allOrders) {
    const isCancelled = order.status === "Cancelled";
    const vendorItems = order.items.filter((item) => item.vendorId?.toString() === vendorId.toString());
    const vendorRevenue = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderDate = new Date(order.date);

    // Get vendor-specific record from order
    const vendorRecord = order.vendors?.find((v) => v.vendorId?.toString() === vendorId.toString());
    const commissionRate = vendorRecord?.commission ?? 10;
    const voucherDiscount = vendorRecord?.voucherDiscount ?? 0;
    const vendorNetRevenue = Math.max(0, (vendorRevenue - voucherDiscount) * (1 - commissionRate / 100));

    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;

    if (!isCancelled && orderDate >= twelveMonthsAgo) {
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
      if (!ordersByMonth[monthKey]) ordersByMonth[monthKey] = { orders: 0, revenue: 0, netRevenue: 0 };
      ordersByMonth[monthKey].orders += 1;
      ordersByMonth[monthKey].revenue += vendorRevenue;
      ordersByMonth[monthKey].netRevenue += vendorNetRevenue;
    }

    if (!isCancelled) {
      totalRevenue += vendorRevenue;
      totalNetRevenue += vendorNetRevenue;

      if (orderDate >= startOfToday) {
        todayRevenue += vendorRevenue;
        todayNetRevenue += vendorNetRevenue;
      }
      if (orderDate >= startOfWeek) {
        weekRevenue += vendorRevenue;
        weekNetRevenue += vendorNetRevenue;
      }
      if (orderDate >= startOfMonth) {
        monthRevenue += vendorRevenue;
        monthNetRevenue += vendorNetRevenue;
      }

      const key = orderDate.toISOString().split("T")[0];
      revenueByDay[key] = (revenueByDay[key] || 0) + vendorRevenue;
      netRevenueByDay[key] = (netRevenueByDay[key] || 0) + vendorNetRevenue;

      for (const item of vendorItems) {
        const productId = item._id?.toString();
        if (!productSalesMap[productId]) {
          productSalesMap[productId] = {
            name: item.name,
            image: pickImageUrl(item.image) || null,
            sold: 0,
            revenue: 0,
            netRevenue: 0,
          };
        }
        productSalesMap[productId].sold += item.quantity;
        productSalesMap[productId].revenue += item.price * item.quantity;
        productSalesMap[productId].netRevenue += Math.max(0, (item.price * item.quantity) * (1 - commissionRate / 100));
      }
    }
  }

  // Build daily chart based on parameters or fallback
  let filterStartDate = thirtyDaysAgo.getTime();
  let filterEndDate = now.getTime();
  if (startDate && endDate) {
    filterStartDate = Number(startDate);
    filterEndDate = Number(endDate);
  }
  const diffTime = Math.abs(filterEndDate - filterStartDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const revenueChart = [];
  const start = new Date(filterStartDate);
  for (let i = 0; i <= Math.min(diffDays, 90); i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = date.toISOString().split("T")[0];
    revenueChart.push({
      date: key,
      revenue: revenueByDay[key] || 0,
      netRevenue: netRevenueByDay[key] || 0,
    });
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
      netRevenue: ordersByMonth[key]?.netRevenue || 0,
    });
  }

  const categoryCount = {};
  const categoryIdMap = {};
  for (const product of products) {
    const categoryName = product.category?.name || "Khác";
    const categoryId = product.category?._id?.toString() || "other";
    categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
    categoryIdMap[categoryName] = categoryId;
  }
  const categoryChart = Object.entries(categoryCount)
    .map(([name, value]) => ({ name, value, id: categoryIdMap[name] }))
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
        netRevenue: fromOrders?.netRevenue ?? 0,
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

  const recentOrders = allOrders.slice(0, 10).map((order) => {
    const vRecord = order.vendors?.find((v) => v.vendorId?.toString() === vendorId.toString());
    const commRate = vRecord?.commission ?? 10;
    const vItems = order.items.filter((item) => item.vendorId?.toString() === vendorId.toString());
    const gross = vItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const disc = vRecord?.voucherDiscount ?? 0;
    const net = Math.max(0, (gross - disc) * (1 - commRate / 100));

    return {
      _id: order._id,
      date: order.date,
      status: order.status,
      amount: gross,
      netAmount: net,
      itemCount: vItems.length,
    };
  });

  const result = {
    revenue: {
      total: totalRevenue,
      today: todayRevenue,
      week: weekRevenue,
      month: monthRevenue,
      totalNet: totalNetRevenue,
      todayNet: todayNetRevenue,
      weekNet: weekNetRevenue,
      monthNet: monthNetRevenue,
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

  if (redis) {
    try {
      await redis.setEx(cacheKey, VENDOR_STATS_CACHE_TTL_SEC, JSON.stringify(result));
    } catch {
      // Cache write failure should not block the response.
    }
  }

  return result;
};
