import { jest } from "@jest/globals";

const createNotification = jest.fn().mockResolvedValue(true);
const ensureOrderDeletable = jest.fn();
const orderModel = {
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

jest.unstable_mockModule("../../models/orderModel.js", () => ({
  default: orderModel,
}));

jest.unstable_mockModule("../notificationService.js", () => ({
  createNotification,
}));

jest.unstable_mockModule("../deletionGuardService.js", () => ({
  ensureOrderDeletable,
}));

const { updateOrderStatusService, updateVendorOrderStatusService } = await import("../order/orderStatusService.js");

beforeEach(() => {
  jest.clearAllMocks();
});

const createOrder = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439012",
  items: [
    {
      _id: "product-1",
      name: "COD Test Product",
      price: 100000,
      quantity: 1,
      image: [],
      vendorId: "vendor-1",
      vendorShopName: "Shop Test",
    },
  ],
  paymentMethod: "COD",
  payment: false,
  status: "Order Placed",
  trackingNumber: "",
  trackingUpdatedAt: undefined,
  vendors: [],
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("orderStatusService COD payment sync", () => {
  it("marks COD as paid when an order is manually updated to Delivered", async () => {
    const order = createOrder();
    orderModel.findById.mockResolvedValue(order);

    const updated = await updateOrderStatusService(order._id, "Delivered", "TRACK123");

    expect(updated.status).toBe("Delivered");
    expect(updated.payment).toBe(true);
    expect(updated.trackingNumber).toBe("TRACK123");
    expect(order.save).toHaveBeenCalledTimes(1);
  });

  it("does not mark COD as paid when only one vendor has delivered", async () => {
    const order = createOrder({
      items: [
        {
          _id: "product-a",
          name: "Item A",
          price: 50000,
          quantity: 1,
          image: [],
          vendorId: "vendor-a",
          vendorShopName: "Shop A",
        },
        {
          _id: "product-b",
          name: "Item B",
          price: 50000,
          quantity: 1,
          image: [],
          vendorId: "vendor-b",
          vendorShopName: "Shop B",
        },
      ],
      vendors: [
        {
          vendorId: "vendor-a",
          vendorShopName: "Shop A",
          items: [{ productId: "a", name: "Item A", price: 50000, quantity: 1, image: [] }],
          subtotal: 50000,
          vendorStatus: "shipped",
        },
        {
          vendorId: "vendor-b",
          vendorShopName: "Shop B",
          items: [{ productId: "b", name: "Item B", price: 50000, quantity: 1, image: [] }],
          subtotal: 50000,
          vendorStatus: "pending",
        },
      ],
    });
    orderModel.findById.mockResolvedValue(order);

    const updated = await updateVendorOrderStatusService(order._id, "delivered", "vendor-a", "TRACK-A");

    expect(updated.status).toBe("Shipped");
    expect(updated.payment).toBe(false);
    expect(order.markModified).toHaveBeenCalledWith("vendors");
  });

  it("marks COD as paid when the final vendor updates to delivered", async () => {
    const order = createOrder({
      items: [
        {
          _id: "product-a",
          name: "Item A",
          price: 50000,
          quantity: 1,
          image: [],
          vendorId: "vendor-a",
          vendorShopName: "Shop A",
        },
        {
          _id: "product-b",
          name: "Item B",
          price: 50000,
          quantity: 1,
          image: [],
          vendorId: "vendor-b",
          vendorShopName: "Shop B",
        },
      ],
      vendors: [
        {
          vendorId: "vendor-a",
          vendorShopName: "Shop A",
          items: [{ productId: "a", name: "Item A", price: 50000, quantity: 1, image: [] }],
          subtotal: 50000,
          vendorStatus: "delivered",
        },
        {
          vendorId: "vendor-b",
          vendorShopName: "Shop B",
          items: [{ productId: "b", name: "Item B", price: 50000, quantity: 1, image: [] }],
          subtotal: 50000,
          vendorStatus: "shipped",
        },
      ],
    });
    orderModel.findById.mockResolvedValue(order);

    const updated = await updateVendorOrderStatusService(order._id, "delivered", "vendor-b", "TRACK-B");

    expect(updated.status).toBe("Delivered");
    expect(updated.payment).toBe(true);
    expect(order.save).toHaveBeenCalledTimes(1);
  });
});
