import { jest } from "@jest/globals";

const productModel = {
  create: jest.fn(),
  findById: jest.fn(),
};

const userModel = {};
const uploadToR2 = jest.fn().mockResolvedValue("https://cdn.example.com/product.webp");
const getProductDeleteImpact = jest.fn();
const notifyPriceDrop = jest.fn();

jest.unstable_mockModule("../../models/productModel.js", () => ({
  default: productModel,
}));

jest.unstable_mockModule("../../models/userModel.js", () => ({
  default: userModel,
}));

jest.unstable_mockModule("../../utils/r2Upload.js", () => ({
  uploadToR2,
}));

jest.unstable_mockModule("../deletionGuardService.js", () => ({
  getProductDeleteImpact,
}));

jest.unstable_mockModule("../priceDropNotificationService.js", () => ({
  notifyPriceDrop,
}));

const { addProductService, updateProductService } = await import("../productService.js");

beforeEach(() => {
  jest.clearAllMocks();
  uploadToR2.mockResolvedValue("https://cdn.example.com/product.webp");
});

const createProductDoc = (overrides = {}) => ({
  _id: "product-1",
  vendorId: { toString: () => "vendor-1" },
  name: "Old product",
  description: "Old description",
  price: 100000,
  stock: 2,
  category: "cat-1",
  subCategory: "sub-1",
  attributes: [],
  variants: [],
  tags: [],
  image: ["https://cdn.example.com/old.webp"],
  bestseller: false,
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("productService stock handling", () => {
  it("stores explicit stock for products without variants", async () => {
    productModel.create.mockResolvedValue({ _id: "created-product" });

    await addProductService({
      body: {
        name: "Simple product",
        description: "Description",
        price: "120000",
        stock: "7",
        category: "cat-1",
        subCategory: "sub-1",
        attributes: "[]",
        sizes: "[]",
        variants: "[]",
        bestseller: "false",
        tags: "[]",
      },
      files: {
        image1: [{ originalname: "product.webp" }],
      },
      vendorId: "vendor-1",
      vendorShopName: "Shop 1",
    });

    expect(productModel.create).toHaveBeenCalledWith(expect.objectContaining({
      price: 120000,
      stock: 7,
      variants: [],
    }));
  });

  it("uses summed variant stock when variants exist", async () => {
    productModel.create.mockResolvedValue({ _id: "created-product" });

    await addProductService({
      body: {
        name: "Variant product",
        description: "Description",
        price: "120000",
        stock: "99",
        category: "cat-1",
        subCategory: "sub-1",
        attributes: JSON.stringify([{ name: "Màu", values: ["Đỏ", "Xanh"] }]),
        sizes: "[]",
        variants: JSON.stringify([
          { combination: { "Màu": "Đỏ" }, price: 150000, stock: 3 },
          { combination: { "Màu": "Xanh" }, price: 130000, stock: 5 },
        ]),
        bestseller: "false",
        tags: "[]",
      },
      files: {
        image1: [{ originalname: "product.webp" }],
      },
      vendorId: "vendor-1",
      vendorShopName: "Shop 1",
    });

    expect(productModel.create).toHaveBeenCalledWith(expect.objectContaining({
      price: 130000,
      stock: 8,
    }));
  });

  it("updates explicit stock for products without variants", async () => {
    const product = createProductDoc();
    productModel.findById.mockResolvedValue(product);

    await updateProductService("product-1", "vendor-1", {
      name: "Updated product",
      description: "Updated description",
      price: "220000",
      stock: "15",
      category: "cat-2",
      subCategory: "sub-2",
      bestseller: "true",
      attributes: "[]",
      variants: "[]",
      tags: "[]",
    }, {});

    expect(product.price).toBe(220000);
    expect(product.stock).toBe(15);
    expect(product.save).toHaveBeenCalledTimes(1);
  });

  it("keeps stock synced from variants on update", async () => {
    const product = createProductDoc({ stock: 4, price: 90000 });
    productModel.findById.mockResolvedValue(product);

    await updateProductService("product-1", "vendor-1", {
      name: "Updated product",
      description: "Updated description",
      price: "220000",
      stock: "15",
      category: "cat-2",
      subCategory: "sub-2",
      bestseller: "false",
      attributes: JSON.stringify([{ name: "Size", values: ["M", "L"] }]),
      variants: JSON.stringify([
        { combination: { Size: "M" }, price: 300000, stock: 2 },
        { combination: { Size: "L" }, price: 280000, stock: 6 },
      ]),
      tags: "[]",
    }, {});

    expect(product.price).toBe(280000);
    expect(product.stock).toBe(8);
  });
});
