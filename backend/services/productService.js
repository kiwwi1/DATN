import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
import { uploadToR2 } from "../utils/r2Upload.js";
import { getProductDeleteImpact } from "./deletionGuardService.js";

export const syncFromVariants = (variants) => {
    const prices = variants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p >= 0);
    const price = prices.length > 0 ? Math.min(...prices) : 0;
    const stock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    return { price, stock };
};

export const addProductService = async ({ body, files, vendorId, vendorShopName }) => {
    const { name, description, price, category, subCategory, attributes, sizes, variants, bestseller } = body;

    if (!name || !description || !category) {
        throw Object.assign(new Error("Missing required fields: name, description, category"), { status: 400 });
    }

    const parsedAttributes = attributes ? JSON.parse(attributes) : [];
    const parsedSizes = sizes ? JSON.parse(sizes) : [];
    const parsedVariants = variants ? JSON.parse(variants) : [];

    const imageFiles = [files?.image1?.[0], files?.image2?.[0], files?.image3?.[0], files?.image4?.[0]].filter(Boolean);

    if (imageFiles.length === 0) {
        throw Object.assign(new Error("At least one image is required"), { status: 400 });
    }

    const imagesUrl = await Promise.all(imageFiles.map((item) => uploadToR2(item, "products")));

    const variantSync = parsedVariants.length > 0 ? syncFromVariants(parsedVariants) : null;

    const product = await productModel.create({
        name,
        description,
        price: variantSync ? variantSync.price : Number(price),
        stock: variantSync ? variantSync.stock : 0,
        category,
        subCategory: subCategory || null,
        attributes: parsedAttributes,
        variants: parsedVariants,
        sizes: parsedSizes,
        bestseller: bestseller === "true",
        image: imagesUrl,
        date: Date.now(),
        vendorId,
        vendorShopName,
    });

    return product;
};

export const listProductsService = async () => productModel.find({});

export const listProductsByCategoryService = async (category) =>
    productModel.find({ category });

export const removeProductService = async (productId, vendorId) => {
    const product = await productModel.findById(productId);
    if (!product) throw new Error("Product not found");
    if (product.vendorId.toString() !== vendorId.toString()) {
        throw Object.assign(new Error("Unauthorized - You can only delete your own products"), { status: 403 });
    }

    const impact = await getProductDeleteImpact(productId);
    const hasReferences =
        impact.hasOrders || impact.hasReviews || impact.hasInteractions;

    // Có tham chiếu lịch sử thì chỉ ẩn sản phẩm để tránh vỡ dữ liệu.
    if (hasReferences) {
        product.isActive = false;
        await product.save();
        return {
            mode: "soft_deleted",
            message: "Product has related orders/reviews/interactions, switched to inactive instead of hard delete",
        };
    }

    await productModel.findByIdAndDelete(productId);
    return { mode: "hard_deleted" };
};

export const singleProductService = async (productId) => productModel.findById(productId);

export const updateProductService = async (productId, vendorId, body, files) => {
    const { name, description, price, category, subCategory, bestseller, attributes, variants, imageSlots } = body;

    const product = await productModel.findById(productId);
    if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
    if (product.vendorId.toString() !== vendorId.toString()) {
        throw Object.assign(new Error("Unauthorized - You can only update your own products"), { status: 403 });
    }

    const parsedAttributes = attributes
        ? typeof attributes === "string" ? JSON.parse(attributes) : attributes
        : product.attributes;
    const parsedVariants = variants
        ? typeof variants === "string" ? JSON.parse(variants) : variants
        : product.variants;

    const variantSync = parsedVariants?.length > 0 ? syncFromVariants(parsedVariants) : null;

    // Handle image updates: imageSlots is a JSON array of 4 items (existing URL | null)
    // New file uploads are passed as image0..image3 in files
    if (imageSlots !== undefined) {
        const slots = typeof imageSlots === "string" ? JSON.parse(imageSlots) : imageSlots;
        const newImages = await Promise.all(
            slots.map(async (slotUrl, idx) => {
                const file = files?.[`image${idx}`]?.[0];
                if (file) return uploadToR2(file, "products");
                return slotUrl || null;
            })
        );
        product.image = newImages.filter(Boolean);
    }

    product.name = name;
    product.description = description;
    product.price = variantSync ? variantSync.price : Number(price);
    product.stock = variantSync ? variantSync.stock : product.stock;
    product.category = category;
    product.subCategory = subCategory || null;
    product.attributes = parsedAttributes;
    product.variants = parsedVariants;
    product.bestseller = bestseller === true || bestseller === "true";
    product.markModified("variants");
    await product.save();

    return product;
};

export const listVendorProductsService = async (vendorId) =>
    productModel.find({ vendorId });

export const getVendorShopPublicService = async (vendorId) => {
    const vendor = await userModel
        .findOne({ _id: vendorId, role: "vendor" })
        .select("name shopName followers createdAt");
    if (!vendor) throw Object.assign(new Error("Vendor not found"), { status: 404 });

    const products = await productModel
        .find({ vendorId, isActive: true })
        .sort({ date: -1 })
        .lean();

    const productCount = products.length;
    const soldCount = products.reduce((s, p) => s + (Number(p.sold) || 0), 0);
    const avgRating =
        productCount > 0
            ? Number(
                  (
                      products.reduce((s, p) => s + (Number(p.rating) || 0), 0) /
                      productCount
                  ).toFixed(1)
              )
            : 0;
    const reviewCount = products.reduce((s, p) => s + (Number(p.reviewCount) || 0), 0);

    const joinedAt =
        vendor.createdAt ||
        (typeof vendor._id?.getTimestamp === "function"
            ? vendor._id.getTimestamp()
            : null);

    return {
        vendor: {
            _id: vendor._id,
            name: vendor.name,
            shopName: vendor.shopName || vendor.name,
            followers: Number(vendor.followers) || 0,
            createdAt: joinedAt,
        },
        stats: {
            productCount,
            soldCount,
            avgRating,
            reviewCount,
            replyRate: 94,
            replyTimeText: "trong vài giờ",
        },
        products,
    };
};
