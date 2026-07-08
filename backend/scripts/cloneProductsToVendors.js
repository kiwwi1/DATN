import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const DEFAULT_PRICE_STEP = 3;
const DEFAULT_ROUND_TO = 1000;

const HELP_TEXT = `
Clone products from one vendor to multiple vendors with different prices.

Usage:
  node scripts/cloneProductsToVendors.js --source "Apple Official Store" --targets "shop-a@demo.com=-5,shop-b@demo.com=0,shop-c@demo.com=6"
  node scripts/cloneProductsToVendors.js --source vendor.apple@shop.com --targets "Vendor A,Vendor B,Vendor C" --price-step 2 --limit 10 --dry-run

Options:
  --source <identifier>          Vendor source: email, Mongo ObjectId, shopName, or name
  --targets <list>               Comma-separated target vendors. Each item can be:
                                 vendorIdentifier
                                 vendorIdentifier=adjustment
  --price-step <number>          Auto price spread per target when adjustment is omitted. Default: 3
  --pricing-mode <percent|fixed> Price adjustment mode. Default: percent
  --round-to <number>            Round price to nearest unit. Default: 1000
  --limit <number>               Limit number of source products
  --product-ids <id,id,...>      Clone only selected products
  --name-contains <text>         Filter source products by name
  --include-inactive             Include inactive source products
  --replace-existing             Update existing clones instead of skipping
  --dry-run                      Show plan only, do not write to DB
  --help                         Show this help
`;

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundPrice(value, roundTo) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(roundTo) || roundTo <= 0) return Math.round(value);
  return Math.max(roundTo, Math.round(value / roundTo) * roundTo);
}

function buildAutoAdjustments(targetCount, step) {
  if (targetCount <= 0) return [];
  if (targetCount === 1) return [0];

  const adjustments = [];
  const isEven = targetCount % 2 === 0;

  if (isEven) {
    for (let i = targetCount / 2; i >= 1; i -= 1) adjustments.push(-i * step);
    for (let i = 1; i <= targetCount / 2; i += 1) adjustments.push(i * step);
    return adjustments;
  }

  const half = Math.floor(targetCount / 2);
  for (let i = half; i >= 1; i -= 1) adjustments.push(-i * step);
  adjustments.push(0);
  for (let i = 1; i <= half; i += 1) adjustments.push(i * step);
  return adjustments;
}

function parseTargets(rawTargets, priceStep) {
  const tokens = String(rawTargets || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!tokens.length) {
    throw new Error("Missing --targets");
  }

  const autoAdjustments = buildAutoAdjustments(tokens.length, priceStep);
  return tokens.map((token, index) => {
    const eqIndex = token.lastIndexOf("=");
    if (eqIndex === -1) {
      return {
        identifier: token,
        adjustment: autoAdjustments[index],
      };
    }

    const identifier = token.slice(0, eqIndex).trim();
    const adjustmentRaw = token.slice(eqIndex + 1).trim();
    if (!identifier) {
      throw new Error(`Invalid target entry: "${token}"`);
    }

    const adjustment = Number(adjustmentRaw);
    if (!Number.isFinite(adjustment)) {
      throw new Error(`Invalid adjustment for target "${identifier}": "${adjustmentRaw}"`);
    }

    return {
      identifier,
      adjustment,
    };
  });
}

async function resolveVendor(identifier) {
  const trimmed = String(identifier || "").trim();
  if (!trimmed) return null;

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const byId = await userModel.findOne({ _id: trimmed, role: "vendor" }).lean();
    if (byId) return byId;
  }

  const byText = await userModel.findOne({
    role: "vendor",
    $or: [{ email: trimmed }, { shopName: trimmed }, { name: trimmed }],
  }).lean();

  return byText;
}

function applyAdjustment(price, adjustment, pricingMode, roundTo) {
  if (!Number.isFinite(price) || price <= 0) return 0;

  const next =
    pricingMode === "fixed"
      ? price + adjustment
      : price * (1 + adjustment / 100);

  return roundPrice(next, roundTo);
}

function cloneAttributes(attributes) {
  if (!Array.isArray(attributes)) return [];
  return attributes.map((attr) => ({
    name: attr?.name || "",
    values: Array.isArray(attr?.values) ? [...attr.values] : [],
  }));
}

function cloneImages(images) {
  return Array.isArray(images) ? [...images] : [];
}

function cloneVariants(variants, adjustment, pricingMode, roundTo) {
  if (!Array.isArray(variants)) return [];

  return variants.map((variant) => ({
    combination: variant?.combination ? { ...variant.combination } : {},
    variantKey: variant?.variantKey || "",
    price: applyAdjustment(Number(variant?.price || 0), adjustment, pricingMode, roundTo),
    stock: Number.isFinite(Number(variant?.stock)) ? Number(variant.stock) : 0,
  }));
}

function buildOriginalPrice(price, sourceOriginalPrice, sourceDiscount, roundTo) {
  const hasOriginalPrice = Number.isFinite(Number(sourceOriginalPrice)) && Number(sourceOriginalPrice) > 0;
  const hasDiscount = Number.isFinite(Number(sourceDiscount)) && Number(sourceDiscount) > 0;

  if (!hasOriginalPrice && !hasDiscount) return undefined;

  if (hasDiscount && sourceDiscount < 100) {
    const computed = price / (1 - Number(sourceDiscount) / 100);
    return roundPrice(computed, roundTo);
  }

  return roundPrice(Number(sourceOriginalPrice), roundTo);
}

function buildCloneDoc({ sourceProduct, targetVendor, sourceVendor, adjustment, pricingMode, roundTo, cloneBatchTag }) {
  const price = applyAdjustment(Number(sourceProduct.price || 0), adjustment, pricingMode, roundTo);
  const variants = cloneVariants(sourceProduct.variants, adjustment, pricingMode, roundTo);
  const originalPrice = buildOriginalPrice(price, sourceProduct.originalPrice, sourceProduct.discount, roundTo);
  const baseTags = Array.isArray(sourceProduct.tags) ? [...new Set(sourceProduct.tags)] : [];
  const cloneTags = [
    `cloned-from:${sourceProduct._id}`,
    `cloned-source-vendor:${sourceVendor._id}`,
    `cloned-to-vendor:${targetVendor._id}`,
    cloneBatchTag,
  ];

  return {
    name: sourceProduct.name,
    description: sourceProduct.description,
    price,
    image: cloneImages(sourceProduct.image),
    category: sourceProduct.category,
    subCategory: sourceProduct.subCategory || undefined,
    subSubCategory: sourceProduct.subSubCategory || undefined,
    bestseller: false,
    date: Date.now(),
    sold: 0,
    vendorId: targetVendor._id,
    vendorShopName: targetVendor.shopName || targetVendor.name,
    stock: Number.isFinite(Number(sourceProduct.stock)) ? Number(sourceProduct.stock) : 0,
    rating: 0,
    reviewCount: 0,
    brand: sourceProduct.brand || "",
    tags: [...new Set([...baseTags, ...cloneTags])],
    attributes: cloneAttributes(sourceProduct.attributes),
    variants,
    sizes: Array.isArray(sourceProduct.sizes) ? [...sourceProduct.sizes] : [],
    discount: Number.isFinite(Number(sourceProduct.discount)) ? Number(sourceProduct.discount) : 0,
    originalPrice,
    isActive: sourceProduct.isActive !== false,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(HELP_TEXT.trim());
    process.exit(0);
  }

  if (!args.source) {
    console.error("Missing required option: --source");
    console.log(HELP_TEXT.trim());
    process.exit(1);
  }

  const pricingMode = args["pricing-mode"] === "fixed" ? "fixed" : "percent";
  const priceStep = parseNumber(args["price-step"], DEFAULT_PRICE_STEP);
  const roundTo = parseNumber(args["round-to"], DEFAULT_ROUND_TO);
  const limit = args.limit ? Math.max(1, Math.floor(parseNumber(args.limit, 0))) : undefined;
  const includeInactive = Boolean(args["include-inactive"]);
  const replaceExisting = Boolean(args["replace-existing"]);
  const dryRun = Boolean(args["dry-run"]);
  const nameContains = typeof args["name-contains"] === "string" ? args["name-contains"].trim() : "";
  const targetSpecs = parseTargets(args.targets, priceStep);

  await connectDB();

  const sourceVendor = await resolveVendor(args.source);
  if (!sourceVendor) {
    throw new Error(`Source vendor not found: ${args.source}`);
  }

  const targetVendors = [];
  for (const spec of targetSpecs) {
    const vendor = await resolveVendor(spec.identifier);
    if (!vendor) {
      throw new Error(`Target vendor not found: ${spec.identifier}`);
    }
    if (String(vendor._id) === String(sourceVendor._id)) {
      throw new Error(`Target vendor must be different from source vendor: ${spec.identifier}`);
    }
    targetVendors.push({ ...spec, vendor });
  }

  const dedupedTargetIds = new Set();
  targetVendors.forEach(({ vendor }) => {
    const key = String(vendor._id);
    if (dedupedTargetIds.has(key)) {
      throw new Error(`Duplicate target vendor detected: ${vendor.shopName || vendor.email}`);
    }
    dedupedTargetIds.add(key);
  });

  const productQuery = { vendorId: sourceVendor._id };
  if (!includeInactive) {
    productQuery.isActive = true;
  }

  if (nameContains) {
    productQuery.name = { $regex: nameContains, $options: "i" };
  }

  if (args["product-ids"]) {
    const productIds = String(args["product-ids"])
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!productIds.length || productIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new Error("Invalid --product-ids list");
    }

    productQuery._id = { $in: productIds };
  }

  let sourceProductsQuery = productModel.find(productQuery).sort({ _id: 1 }).lean();
  if (limit) {
    sourceProductsQuery = sourceProductsQuery.limit(limit);
  }

  const sourceProducts = await sourceProductsQuery;
  if (!sourceProducts.length) {
    throw new Error("No source products matched the provided filters");
  }

  const sourceProductIds = sourceProducts.map((product) => product._id);
  const targetVendorIds = targetVendors.map((item) => item.vendor._id);
  const existingClones = await productModel
    .find(
      {
        vendorId: { $in: targetVendorIds },
        tags: { $in: sourceProductIds.map((id) => `cloned-from:${id}`) },
      },
      { _id: 1, vendorId: 1, tags: 1 }
    )
    .lean();

  const existingCloneMap = new Map();
  existingClones.forEach((cloneDoc) => {
    const sourceTag = Array.isArray(cloneDoc.tags)
      ? cloneDoc.tags.find((tag) => String(tag).startsWith("cloned-from:"))
      : null;
    if (!sourceTag) return;
    const key = `${String(cloneDoc.vendorId)}::${sourceTag.replace("cloned-from:", "")}`;
    existingCloneMap.set(key, cloneDoc._id);
  });

  const cloneBatchTag = `clone-batch:${Date.now()}`;
  const operations = [];
  let skipped = 0;

  for (const sourceProduct of sourceProducts) {
    for (const targetSpec of targetVendors) {
      const key = `${String(targetSpec.vendor._id)}::${String(sourceProduct._id)}`;
      const existingCloneId = existingCloneMap.get(key);

      if (existingCloneId && !replaceExisting) {
        skipped += 1;
        continue;
      }

      const payload = buildCloneDoc({
        sourceProduct,
        targetVendor: targetSpec.vendor,
        sourceVendor,
        adjustment: targetSpec.adjustment,
        pricingMode,
        roundTo,
        cloneBatchTag,
      });

      if (existingCloneId) {
        operations.push({
          updateOne: {
            filter: { _id: existingCloneId },
            update: { $set: payload },
          },
        });
        continue;
      }

      operations.push({
        insertOne: {
          document: payload,
        },
      });
    }
  }

  const planSummary = {
    sourceVendor: sourceVendor.shopName || sourceVendor.name || sourceVendor.email,
    sourceProducts: sourceProducts.length,
    targetVendors: targetVendors.length,
    plannedWrites: operations.length,
    skippedExisting: skipped,
    pricingMode,
    roundTo,
    dryRun,
  };

  console.log("Clone plan:", JSON.stringify(planSummary, null, 2));
  targetVendors.forEach((targetSpec) => {
    const label = targetSpec.vendor.shopName || targetSpec.vendor.name || targetSpec.vendor.email;
    const unit = pricingMode === "fixed" ? "VND" : "%";
    console.log(`- ${label}: ${targetSpec.adjustment >= 0 ? "+" : ""}${targetSpec.adjustment}${unit}`);
  });

  if (dryRun) {
    console.log("Dry run only. No data was written.");
    process.exit(0);
  }

  if (!operations.length) {
    console.log("No writes needed. Existing clones were skipped.");
    process.exit(0);
  }

  const result = await productModel.bulkWrite(operations, { ordered: false });
  console.log(
    `Done. Inserted: ${result.insertedCount || 0}, Updated: ${result.modifiedCount || 0}, Skipped: ${skipped}`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Clone products failed:", error.message);
  process.exit(1);
});
