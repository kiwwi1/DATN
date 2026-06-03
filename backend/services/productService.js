import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
import { uploadToR2 } from "../utils/r2Upload.js";
import { getProductDeleteImpact } from "./deletionGuardService.js";
import { notifyPriceDrop } from "./priceDropNotificationService.js";

export const syncFromVariants = (variants) => {
    const prices = variants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p >= 0);
    const price = prices.length > 0 ? Math.min(...prices) : 0;
    const stock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    return { price, stock };
};

export const buildVariantKey = (combination = {}) => {
    const entries = Object.entries(combination || {})
        .map(([name, value]) => [String(name || "").trim(), String(value || "").trim()])
        .filter(([name, value]) => name && value)
        .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) return "";
    return entries.map(([name, value]) => `${name}:${value}`).join("|");
};

export const normalizeVariantsWithKeys = (variants = []) => {
    return (Array.isArray(variants) ? variants : []).map((variant) => {
        const combination = variant?.combination && typeof variant.combination === "object"
            ? variant.combination
            : {};
        const variantKey = buildVariantKey(combination);
        return {
            ...variant,
            combination,
            variantKey,
        };
    });
};

export const addProductService = async ({ body, files, vendorId, vendorShopName }) => {
    const { name, description, price, category, subCategory, attributes, sizes, variants, bestseller } = body;

    if (!name || !description || !category) {
        throw Object.assign(new Error("Missing required fields: name, description, category"), { status: 400 });
    }

    const parsedAttributes = attributes ? JSON.parse(attributes) : [];
    const parsedSizes = sizes ? JSON.parse(sizes) : [];
    const parsedVariants = normalizeVariantsWithKeys(variants ? JSON.parse(variants) : []);

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

export const listProductsService = async () =>
    productModel
        .find({ isActive: true })
        .sort({ date: -1 });

export const listProductsByCategoryService = async (category) =>
    productModel.find({ category, isActive: true });

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

export const toggleProductActiveService = async (productId, vendorId, isActive) => {
    const product = await productModel.findById(productId);
    if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
    if (product.vendorId.toString() !== vendorId.toString()) {
        throw Object.assign(new Error("Unauthorized - You can only update your own products"), { status: 403 });
    }

    product.isActive = Boolean(isActive);
    await product.save();
    return product;
};

export const updateProductService = async (productId, vendorId, body, files) => {
    const { name, description, price, category, subCategory, bestseller, attributes, variants, imageSlots } = body;

    const product = await productModel.findById(productId);
    if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
    if (product.vendorId.toString() !== vendorId.toString()) {
        throw Object.assign(new Error("Unauthorized - You can only update your own products"), { status: 403 });
    }
    const oldPrice = Number(product.price) || 0;

    const parsedAttributes = attributes
        ? typeof attributes === "string" ? JSON.parse(attributes) : attributes
        : product.attributes;
    const parsedVariants = normalizeVariantsWithKeys(
        variants
            ? (typeof variants === "string" ? JSON.parse(variants) : variants)
            : product.variants
    );

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
    const newPrice = Number(product.price) || 0;
    if (oldPrice > 0 && newPrice > 0 && newPrice < oldPrice) {
        notifyPriceDrop({
            productBefore: { _id: product._id, name: product.name, price: oldPrice },
            productAfter: { _id: product._id, name: product.name, price: newPrice },
        }).catch((err) => {
            console.error("⚠ price-drop notify failed:", err.message);
        });
    }

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

const toCategoryLabel = (categoryLike) => {
    if (!categoryLike) return "";
    if (typeof categoryLike === "string") return categoryLike;
    if (typeof categoryLike === "object") {
        return categoryLike.name || categoryLike.label || "";
    }
    return String(categoryLike);
};

const normalizeAttributes = (attributes) =>
    (Array.isArray(attributes) ? attributes : [])
        .filter((a) => a?.name && Array.isArray(a?.values) && a.values.length > 0)
        .map((a) => ({
            name: String(a.name).trim(),
            values: a.values
                .map((v) => String(v).trim())
                .filter(Boolean)
                .slice(0, 8),
        }))
        .filter((a) => a.name && a.values.length > 0);

const normalizeAiDescription = (rawText) => {
    if (!rawText || typeof rawText !== "string") return "";
    return rawText
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const STYLE_PROFILES = [
    {
        id: "problem-solution",
        opening: "Mở đầu bằng nỗi đau người dùng rồi dẫn sang giải pháp sản phẩm.",
        emphasis: "Nhấn mạnh tính tiện dụng trong đời sống hằng ngày.",
        cta: "Kết đoạn bằng lời kêu gọi mua ngắn, tự nhiên.",
    },
    {
        id: "premium-trust",
        opening: "Mở đầu theo hướng chất lượng và độ tin cậy.",
        emphasis: "Nhấn mạnh cảm giác yên tâm khi sử dụng lâu dài.",
        cta: "Kết đoạn bằng thông điệp phù hợp phân khúc chất lượng cao.",
    },
    {
        id: "value-deal",
        opening: "Mở đầu theo hướng giá trị trên chi phí.",
        emphasis: "Nhấn mạnh lợi ích nhận được so với mức giá.",
        cta: "Kết đoạn theo hướng chốt đơn ưu đãi hợp lý.",
    },
    {
        id: "lifestyle",
        opening: "Mở đầu bằng bối cảnh sử dụng thực tế theo lifestyle.",
        emphasis: "Nhấn mạnh trải nghiệm thoải mái và linh hoạt.",
        cta: "Kết đoạn bằng lời mời trải nghiệm sản phẩm.",
    },
];

const pickStyleProfile = (seedText) => {
    const key = String(seedText || "").trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return STYLE_PROFILES[hash % STYLE_PROFILES.length];
};

const buildPrompt = ({
    name,
    categoryName,
    subCategoryName,
    attributes,
    target,
    price,
    usp,
    specs,
    benefits,
    material,
    variants,
}) => {
    const normalizedAttrs = normalizeAttributes(attributes);
    const attrText = normalizedAttrs.map((a) => `${a.name}: ${a.values.join(", ")}`).join("; ");
    const variantsText = Array.isArray(variants) && variants.length
        ? variants.join("; ")
        : (variants || attrText || "chưa cung cấp");
    const specsText = Array.isArray(specs) ? specs.join("; ") : specs;
    const benefitsText = Array.isArray(benefits) ? benefits.join("; ") : benefits;
    const uspText = Array.isArray(usp) ? usp.join("; ") : usp;
    const styleProfile = pickStyleProfile(`${name}|${categoryName}|${subCategoryName}|${variantsText}`);
    const seoKeywords = [name, categoryName, subCategoryName]
        .filter(Boolean)
        .map((x) => String(x).trim())
        .slice(0, 3);

    return [
        "Vai trò:",
        "Bạn là chuyên gia viết content thương mại điện tử, tối ưu chuyển đổi cao trên Shopee.",
        "",
        "Yêu cầu:",
        "Viết mô tả sản phẩm bằng tiếng Việt, rõ ràng, dễ đọc, tối ưu SEO và thuyết phục mua hàng.",
        "",
        "Thông tin sản phẩm:",
        `Tên sản phẩm: ${name}`,
        `Ngành hàng: ${[categoryName, subCategoryName].filter(Boolean).join(" - ") || "chưa cung cấp"}`,
        `Đối tượng khách hàng: ${target || "chưa cung cấp"}`,
        `Giá bán: ${price || "chưa cung cấp"}`,
        `Điểm nổi bật: ${uspText || "chưa cung cấp"}`,
        `Thông số kỹ thuật: ${specsText || "chưa cung cấp"}`,
        `Công dụng: ${benefitsText || "chưa cung cấp"}`,
        `Chất liệu: ${material || "chưa cung cấp"}`,
        `Kích thước/màu sắc: ${variantsText}`,
        "",
        "Cấu trúc bắt buộc:",
        "1) Tiêu đề (chuẩn SEO, chứa từ khóa chính)",
        "2) Mô tả ngắn (2-3 dòng, hấp dẫn, đánh vào nhu cầu)",
        "3) Điểm nổi bật (bullet points, dễ scan)",
        "4) Mô tả chi tiết (giải thích lợi ích, ứng dụng thực tế)",
        "5) Thông số kỹ thuật",
        "6) Hướng dẫn sử dụng",
        "7) Chính sách / cam kết (nếu có dữ liệu thì nêu, không thì ghi 'Liên hệ shop để được tư vấn thêm').",
        "",
        "Yêu cầu thêm:",
        "- Dùng emoji vừa phải (📌🔥✨).",
        "- Ngắn gọn, dễ đọc trên mobile, không viết lan man.",
        "- Tập trung lợi ích hơn là tính năng.",
        "- Có từ khóa liên quan tự nhiên theo SEO Shopee.",
        "- Văn phong bán hàng nhưng không lố.",
        "- Không bịa thông tin ngoài dữ liệu đã cung cấp.",
        "- Trả lời trực tiếp vào mô tả sản phẩm, không viết lời mở đầu xã giao.",
        "- Không viết các câu như: 'Tuyệt vời', 'Với vai trò...', 'Mình sẽ giúp...', 'Dưới đây là...'.",
        "- Không nhắc lại đề bài/prompt, không giải thích cách làm, không ghi chú meta.",
        "- Chỉ xuất nội dung mô tả cuối cùng theo đúng cấu trúc yêu cầu.",
        "",
        "Đa dạng hóa văn phong (bắt buộc):",
        `- Biến thể phong cách: ${styleProfile.id}`,
        `- Cách mở đầu: ${styleProfile.opening}`,
        `- Trọng tâm diễn đạt: ${styleProfile.emphasis}`,
        `- Hướng CTA: ${styleProfile.cta}`,
        `- Từ khóa SEO ưu tiên chèn tự nhiên: ${seoKeywords.join(", ") || name}`,
        "- Không lặp lại y hệt cấu trúc câu phổ biến của các mô tả trước đó.",
    ]
        .filter(Boolean)
        .join("\n");
};

const fallbackDescription = ({ name, categoryName, subCategoryName, attributes, price, variants }) => {
    const attributeParts = (Array.isArray(attributes) ? attributes : [])
        .filter((a) => a?.name && Array.isArray(a?.values) && a.values.length > 0)
        .slice(0, 3)
        .map((a) => `${a.name} ${a.values.slice(0, 3).join(", ")}`);
    const styleProfile = pickStyleProfile(`${name}|${categoryName}|${subCategoryName}`);

    const categoryText = [categoryName, subCategoryName].filter(Boolean).join(" - ");
    const attrText = attributeParts.length
        ? ` Sản phẩm có nhiều lựa chọn như ${attributeParts.join("; ")}.`
        : "";
    const variantText = Array.isArray(variants) && variants.length
        ? ` Biến thể nổi bật: ${variants.slice(0, 3).join("; ")}.`
        : "";
    const priceText = price ? ` Mức giá tham khảo: ${price}.` : "";
    const openingByStyle = {
        "problem-solution": `${name} giúp giải quyết nhu cầu sử dụng hằng ngày theo cách đơn giản và hiệu quả.`,
        "premium-trust": `${name} mang lại trải nghiệm sử dụng ổn định, phù hợp nhóm khách hàng ưu tiên độ tin cậy.`,
        "value-deal": `${name} là lựa chọn cân bằng tốt giữa chi phí và giá trị sử dụng thực tế.`,
        lifestyle: `${name} phù hợp với nhịp sống năng động, dễ dùng trong nhiều bối cảnh khác nhau.`,
    };

    return `${openingByStyle[styleProfile.id] || `${name} là lựa chọn phù hợp cho nhu cầu sử dụng hằng ngày.`}${
        categoryText ? ` Thuộc nhóm ${categoryText}, sản phẩm dễ phối hợp trong nhiều tình huống sử dụng.` : ""
    }${attrText}${variantText}${priceText} Liên hệ shop để được tư vấn thêm và chọn phiên bản phù hợp.`;
};

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};

const toBooleanOrNull = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return null;
};

const resolveThinkingBudget = (model) => {
    const fromEnv = process.env.GEMINI_THINKING_BUDGET;
    if (fromEnv !== undefined && fromEnv !== null && String(fromEnv).trim() !== "") {
        const parsed = Number(fromEnv);
        if (Number.isFinite(parsed) && parsed >= -1) {
            return Math.floor(parsed);
        }
    }

    const explicitDisable = toBooleanOrNull(process.env.GEMINI_DISABLE_THINKING);
    if (explicitDisable === true) return 0;
    if (explicitDisable === false) return undefined;

    // Gemini 2.5 bật thinking mặc định và dễ hết token output nếu prompt dài.
    return /^gemini-2\.5/i.test(String(model || "")) ? 0 : undefined;
};

const extractGeminiText = (data) => {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return "";
    return parts
        .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
};

export const generateProductDescriptionService = async ({
    name,
    category,
    subCategory,
    attributes,
    target,
    price,
    usp,
    specs,
    benefits,
    material,
    variants,
    imageBase64,
    imageMimeType,
    imageUrl,
}) => {
    if (!name || !String(name).trim()) {
        throw Object.assign(new Error("Product name is required"), { status: 400 });
    }

    const categoryName = toCategoryLabel(category);
    const subCategoryName = toCategoryLabel(subCategory);
    const normalizedName = String(name).trim();
    const prompt = buildPrompt({
        name: normalizedName,
        categoryName,
        subCategoryName,
        attributes,
        target,
        price,
        usp,
        specs,
        benefits,
        material,
        variants,
    });

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    if (!apiKey) {
        return {
            description: fallbackDescription({ name, categoryName, subCategoryName, attributes, price, variants }),
            source: "fallback",
        };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        let inlineImageBase64 = imageBase64 && typeof imageBase64 === "string" ? imageBase64.trim() : "";
        let inlineImageMimeType = imageMimeType || "image/jpeg";

        if (!inlineImageBase64 && imageUrl && typeof imageUrl === "string") {
            try {
                const imgRes = await fetch(imageUrl, {
                    redirect: "follow",
                    headers: { "User-Agent": "Mozilla/5.0 (compatible; DATN-ai-desc/1.0)" },
                });
                if (imgRes.ok) {
                    const buffer = Buffer.from(await imgRes.arrayBuffer());
                    inlineImageBase64 = buffer.toString("base64");
                    inlineImageMimeType = imgRes.headers.get("content-type") || inlineImageMimeType;
                }
            } catch {
                // Skip image context if URL fetch fails.
            }
        }

        const parts = [{ text: prompt }];
        if (inlineImageBase64) {
            const trimmed = inlineImageBase64;
            const isReasonableSize = trimmed.length <= 8 * 1024 * 1024;
            if (isReasonableSize) {
                parts.push({
                    inlineData: {
                        mimeType: inlineImageMimeType,
                        data: trimmed,
                    },
                });
            }
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify((() => {
                    const generationConfig = {
                        temperature: 0.55,
                        topP: 0.8,
                        maxOutputTokens: parsePositiveInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 1024),
                    };
                    const thinkingBudget = resolveThinkingBudget(model);
                    if (thinkingBudget !== undefined) {
                        generationConfig.thinkingConfig = { thinkingBudget };
                    }
                    return {
                        contents: [{ parts }],
                        generationConfig,
                    };
                })()),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini request failed (${response.status})`);
        }

        const data = await response.json();
        const rawDescription = extractGeminiText(data);
        const description = normalizeAiDescription(rawDescription);
        if (!description) {
            throw new Error("AI returned empty description");
        }

        return { description, source: "gemini" };
    } catch (error) {
        console.warn("[ai-desc] generate description fallback:", error?.message || error);
        return {
            description: fallbackDescription({ name, categoryName, subCategoryName, attributes, price, variants }),
            source: "fallback",
        };
    } finally {
        clearTimeout(timeout);
    }
};
