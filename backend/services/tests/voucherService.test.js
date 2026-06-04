import {
  assertVoucherValid,
  calcVoucherDiscount,
  computeOrderPricing,
} from "../voucherService.js";

describe("calcVoucherDiscount", () => {
  it("applies percent with max cap", () => {
    const discount = calcVoucherDiscount(500000, {
      discountType: "PERCENT",
      discountValue: 20,
      maxDiscount: 50000,
      minOrderValue: 0,
    });
    expect(discount).toBe(50000);
  });

  it("applies fixed and clamps to base amount", () => {
    const discount = calcVoucherDiscount(10000, {
      discountType: "FIXED",
      discountValue: 15000,
      minOrderValue: 0,
    });
    expect(discount).toBe(10000);
  });

  it("returns 0 when below min order", () => {
    const discount = calcVoucherDiscount(90000, {
      discountType: "FIXED",
      discountValue: 10000,
      minOrderValue: 100000,
    });
    expect(discount).toBe(0);
  });
});

describe("computeOrderPricing", () => {
  it("matches sample: subtotal 400k -> final 355k", () => {
    const items = [
      { price: 200000, quantity: 1, vendorId: "shop-a" },
      { price: 200000, quantity: 1, vendorId: "shop-b" },
    ];
    const vouchers = [
      {
        _id: "v1",
        code: "SHOP15",
        type: "SHOP",
        vendorId: "shop-a",
        discountType: "PERCENT",
        discountValue: 15,
        maxDiscount: 0,
        minOrderValue: 0,
      },
      {
        _id: "v2",
        code: "SALE20",
        type: "PLATFORM",
        discountType: "FIXED",
        discountValue: 20000,
        maxDiscount: 0,
        minOrderValue: 0,
      },
      {
        _id: "v3",
        code: "FREESHIP",
        type: "SHIPPING",
        discountType: "FIXED",
        discountValue: 25000,
        maxDiscount: 0,
        minOrderValue: 0,
      },
    ];

    const pricing = computeOrderPricing({ items, vouchers, shippingFee: 30000 });

    expect(pricing.subtotal).toBe(400000);
    expect(pricing.shopDiscount).toBe(30000);
    expect(pricing.platformDiscount).toBe(20000);
    expect(pricing.shippingDiscount).toBe(25000);
    expect(pricing.finalTotal).toBe(355000);
  });

  it("never returns negative final total", () => {
    const items = [{ price: 10000, quantity: 1, vendorId: "shop-a" }];
    const vouchers = [
      {
        _id: "v1",
        code: "ALL",
        type: "PLATFORM",
        discountType: "FIXED",
        discountValue: 1000000,
        minOrderValue: 0,
      },
      {
        _id: "v2",
        code: "SHIP",
        type: "SHIPPING",
        discountType: "FIXED",
        discountValue: 1000000,
        minOrderValue: 0,
      },
    ];
    const pricing = computeOrderPricing({ items, vouchers, shippingFee: 30000 });
    expect(pricing.finalTotal).toBe(0);
  });

  it("rejects shop voucher when vendor not in order", () => {
    const items = [{ price: 100000, quantity: 1, vendorId: "shop-a" }];
    const vouchers = [
      {
        _id: "v1",
        code: "SHOPX",
        type: "SHOP",
        vendorId: "shop-b",
        discountType: "FIXED",
        discountValue: 10000,
        minOrderValue: 0,
      },
    ];
    const pricing = computeOrderPricing({ items, vouchers, shippingFee: 30000 });
    expect(pricing.shopDiscount).toBe(0);
    expect(pricing.rejectedVouchers.length).toBe(1);
  });
});

describe("assertVoucherValid", () => {
  const now = Date.now();

  it("throws when voucher is expired", () => {
    expect(() =>
      assertVoucherValid(
        {
          isActive: true,
          startAt: now - 2000,
          endAt: now - 1000,
          usageLimit: 0,
          usedCount: 0,
        },
        "SALE20",
        now
      )
    ).toThrow();
  });

  it("throws when usage limit reached", () => {
    expect(() =>
      assertVoucherValid(
        {
          isActive: true,
          startAt: now - 1000,
          endAt: now + 1000,
          usageLimit: 10,
          usedCount: 10,
        },
        "SALE20",
        now
      )
    ).toThrow();
  });
});
