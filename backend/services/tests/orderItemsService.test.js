import { jest } from "@jest/globals";

const productModel = {
  updateOne: jest.fn(),
  find: jest.fn(),
};

const userModel = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

jest.unstable_mockModule("../../models/productModel.js", () => ({
  default: productModel,
}));

jest.unstable_mockModule("../../models/userModel.js", () => ({
  default: userModel,
}));

jest.unstable_mockModule("../order/stockReservationService.js", () => ({
  buildReservationUnits: jest.fn(),
  reserveStockByUnits: jest.fn(),
}));

const { clearOrderedItemsFromCart } = await import("../order/orderItemsService.js");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("orderItemsService cart cleanup", () => {
  it("removes cart entries stored under the default option key", async () => {
    userModel.findById.mockResolvedValue({
      cartData: {
        "product-1": {
          __default__: 2,
        },
      },
    });

    await clearOrderedItemsFromCart("user-1", [
      {
        _id: "product-1",
        size: "__default__",
        variantKey: "",
      },
    ]);

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith("user-1", {
      cartData: {},
    });
  });

  it("falls back to the default option key when legacy order items lost their size", async () => {
    userModel.findById.mockResolvedValue({
      cartData: {
        "product-2": {
          __default__: 1,
        },
      },
    });

    await clearOrderedItemsFromCart("user-2", [
      {
        _id: "product-2",
        size: "",
        variantKey: "",
      },
    ]);

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith("user-2", {
      cartData: {},
    });
  });
});
