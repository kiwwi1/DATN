import { jest } from "@jest/globals";

const notificationFind = jest.fn();
const notificationBulkWrite = jest.fn().mockResolvedValue(true);
const orderFind = jest.fn();

const notificationModel = {
  find: notificationFind,
  bulkWrite: notificationBulkWrite,
};

const orderModel = {
  find: orderFind,
  findById: jest.fn(),
};

jest.unstable_mockModule("../../models/notificationModel.js", () => ({
  default: notificationModel,
}));

jest.unstable_mockModule("../../models/orderModel.js", () => ({
  default: orderModel,
}));

const { getNotificationsService } = await import("../notificationService.js");

beforeEach(() => {
  jest.clearAllMocks();
});

const mockNotificationChain = (items) => {
  notificationFind.mockReturnValue({
    sort: () => ({
      limit: () => ({
        lean: async () => items,
      }),
    }),
  });
};

const mockOrderChain = (orders) => {
  orderFind.mockReturnValue({
    select: () => ({
      lean: async () => orders,
    }),
  });
};

describe("notificationService text normalization", () => {
  it("rebuilds corrupted order notifications with clean Vietnamese text", async () => {
    const createdAt = new Date("2026-07-09T10:00:00.000Z");
    const orderId = "507f1f77bcf86cd799439011";

    mockNotificationChain([
      {
        _id: "notif-1",
        userId: "vendor-1",
        audience: "vendor",
        type: "order_placed",
        title: "\u0001broken",
        message: "\u0001broken",
        orderId,
        productId: null,
        read: false,
        createdAt,
      },
    ]);

    mockOrderChain([
      {
        _id: orderId,
        status: "Order Placed",
        cancelReason: "",
        items: [{ name: "Laneige Lip Sleeping Mask Berry 20g" }],
      },
    ]);

    const notifications = await getNotificationsService("vendor-1", "vendor");

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Đơn hàng mới #439011");
    expect(notifications[0].message).toBe(
      "Bạn có đơn hàng mới #439011 [Laneige Lip Sleeping Mask Berry 20g]."
    );
    expect(notificationBulkWrite).toHaveBeenCalledTimes(1);
  });

  it("rebuilds English order status notifications into Vietnamese", async () => {
    const createdAt = new Date("2026-07-09T11:00:00.000Z");
    const orderId = "507f1f77bcf86cd799441234";

    mockNotificationChain([
      {
        _id: "notif-2",
        userId: "user-1",
        audience: "user",
        type: "order_status",
        title: "Order update #41234",
        message: "Your order #41234 [Olaplex No.3 Hair Perfector 100ml] is now: In transit",
        orderId,
        productId: null,
        read: false,
        createdAt,
      },
    ]);

    mockOrderChain([
      {
        _id: orderId,
        status: "Shipped",
        cancelReason: "",
        items: [{ name: "Olaplex No.3 Hair Perfector 100ml" }],
      },
    ]);

    const notifications = await getNotificationsService("user-1", "user");

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Cập nhật đơn hàng #441234");
    expect(notifications[0].message).toBe(
      "Đơn hàng #441234 [Olaplex No.3 Hair Perfector 100ml] của bạn đã chuyển sang trạng thái: Đang vận chuyển"
    );
    expect(notificationBulkWrite).toHaveBeenCalledTimes(1);
  });

  it("rebuilds English vendor receipt confirmation notifications into Vietnamese", async () => {
    const createdAt = new Date("2026-07-09T12:00:00.000Z");
    const orderId = "507f1f77bcf86cd799441235";

    mockNotificationChain([
      {
        _id: "notif-3",
        userId: "vendor-2",
        audience: "vendor",
        type: "order_status",
        title: "Buyer confirmed receipt #41235",
        message: "The buyer confirmed receipt for order #41235.",
        orderId,
        productId: null,
        read: false,
        createdAt,
      },
    ]);

    mockOrderChain([
      {
        _id: orderId,
        status: "Delivered",
        cancelReason: "",
        items: [{ name: "Olaplex No.3 Hair Perfector 100ml" }],
      },
    ]);

    const notifications = await getNotificationsService("vendor-2", "vendor");

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Khách đã xác nhận nhận hàng #441235");
    expect(notifications[0].message).toBe(
      "Khách hàng đã xác nhận nhận hàng cho đơn #441235."
    );
    expect(notificationBulkWrite).toHaveBeenCalledTimes(1);
  });
});
