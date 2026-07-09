import React, { useContext, useMemo } from "react";
import { ShopContext } from "../../context/ShopContext";
import Title from "../ui/Title";
import ProductItem from "./ProductItem";

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const getVendorKey = (product) => {
  const vendorId = normalizeId(product?.vendorId);
  if (vendorId) return `id:${vendorId}`;

  const shopName = normalizeText(product?.vendorShopName);
  return shopName ? `shop:${shopName}` : "";
};

const getCategoryKey = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || value.name || "");
  }
  return String(value);
};

const hasAvailableStock = (product) => {
  if (!product) return false;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((variant) => Number(variant?.stock) > 0);
  }

  return Number(product.stock) > 0;
};

const getPriceSimilarityScore = (currentPrice, candidatePrice) => {
  const basePrice = Number(currentPrice) || 0;
  const nextPrice = Number(candidatePrice) || 0;
  if (basePrice <= 0 || nextPrice <= 0) return 0;

  const ratio = Math.abs(nextPrice - basePrice) / basePrice;
  if (ratio <= 0.1) return 12;
  if (ratio <= 0.2) return 8;
  if (ratio <= 0.35) return 4;
  return 0;
};

const getSharedTagScore = (currentProduct, candidate) => {
  const currentTags = new Set((currentProduct?.tags || []).map(normalizeText).filter(Boolean));
  if (currentTags.size === 0) return 0;

  const sharedCount = (candidate?.tags || []).reduce((count, tag) => {
    return currentTags.has(normalizeText(tag)) ? count + 1 : count;
  }, 0);

  return Math.min(sharedCount * 4, 12);
};

const getSimilarityScore = (currentProduct, candidate) => {
  const currentCategory = getCategoryKey(currentProduct?.category);
  const currentSubCategory = getCategoryKey(currentProduct?.subCategory);
  const currentSubSubCategory = getCategoryKey(currentProduct?.subSubCategory);

  const candidateCategory = getCategoryKey(candidate?.category);
  const candidateSubCategory = getCategoryKey(candidate?.subCategory);
  const candidateSubSubCategory = getCategoryKey(candidate?.subSubCategory);

  let score = 0;

  if (currentCategory && candidateCategory && currentCategory === candidateCategory) score += 18;
  if (currentSubCategory && candidateSubCategory && currentSubCategory === candidateSubCategory) score += 24;
  if (currentSubSubCategory && candidateSubSubCategory && currentSubSubCategory === candidateSubSubCategory) score += 30;

  if (
    normalizeText(currentProduct?.brand) &&
    normalizeText(currentProduct?.brand) === normalizeText(candidate?.brand)
  ) {
    score += 14;
  }

  score += getPriceSimilarityScore(currentProduct?.price, candidate?.price);
  score += getSharedTagScore(currentProduct, candidate);

  return score;
};

const Section = ({ title1, title2, items }) => {
  if (!items.length) return null;

  return (
    <section className="my-20">
      <div className="text-center text-3xl py-2">
        <Title text1={title1} text2={title2} />
      </div>
      <div className="grid grid-cols-2 gap-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <ProductItem
            key={item._id}
            id={item._id}
            image={item.image}
            name={item.name}
            price={item.price}
            originalPrice={item.originalPrice}
            discount={item.discount}
            rating={item.rating}
            reviewCount={item.reviewCount}
            sold={item.sold}
            vendorShopName={item.vendorShopName}
          />
        ))}
      </div>
    </section>
  );
};

const RelatedProducts = ({ currentProduct }) => {
  const { products, recommendations } = useContext(ShopContext);

  const similarProducts = useMemo(() => {
    if (!currentProduct || products.length === 0) return [];

    const currentId = normalizeId(currentProduct._id);
    const currentVendorKey = getVendorKey(currentProduct);

    return products
      .filter((item) => normalizeId(item._id) !== currentId)
      .filter((item) => item?.isActive !== false)
      .filter(hasAvailableStock)
      .filter((item) => {
        const candidateVendorKey = getVendorKey(item);
        return currentVendorKey && candidateVendorKey ? candidateVendorKey !== currentVendorKey : true;
      })
      .map((item) => ({ item, score: getSimilarityScore(currentProduct, item) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((Number(b.item.sold) || 0) !== (Number(a.item.sold) || 0)) {
          return (Number(b.item.sold) || 0) - (Number(a.item.sold) || 0);
        }
        if ((Number(b.item.rating) || 0) !== (Number(a.item.rating) || 0)) {
          return (Number(b.item.rating) || 0) - (Number(a.item.rating) || 0);
        }
        return (Number(b.item.reviewCount) || 0) - (Number(a.item.reviewCount) || 0);
      })
      .slice(0, 5)
      .map(({ item }) => item);
  }, [currentProduct, products]);

  const interestProducts = useMemo(() => {
    if (!currentProduct || products.length === 0) return [];

    const currentId = normalizeId(currentProduct._id);
    const excludedIds = new Set([currentId, ...similarProducts.map((item) => normalizeId(item._id))]);

    const curatedRecommendations = (recommendations || [])
      .filter((item) => !excludedIds.has(normalizeId(item._id)))
      .filter((item) => item?.isActive !== false)
      .filter(hasAvailableStock)
      .slice(0, 5);

    if (curatedRecommendations.length >= 5) {
      return curatedRecommendations;
    }

    const currentCategory = getCategoryKey(currentProduct?.category);
    const currentSubCategory = getCategoryKey(currentProduct?.subCategory);

    const fallbackPool = products
      .filter((item) => !excludedIds.has(normalizeId(item._id)))
      .filter((item) => item?.isActive !== false)
      .filter(hasAvailableStock)
      .map((item) => {
        let score = 0;
        if (getCategoryKey(item?.category) === currentCategory) score += 18;
        if (getCategoryKey(item?.subCategory) === currentSubCategory) score += 12;
        score += Math.min(Number(item?.sold) || 0, 5000) / 250;
        score += (Number(item?.rating) || 0) * 4;
        score += Math.min(Number(item?.reviewCount) || 0, 200) / 20;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);

    const merged = [...curatedRecommendations];
    for (const item of fallbackPool) {
      if (merged.length >= 5) break;
      if (merged.some((entry) => normalizeId(entry._id) === normalizeId(item._id))) continue;
      merged.push(item);
    }

    return merged;
  }, [currentProduct, products, recommendations, similarProducts]);

  if (!similarProducts.length && !interestProducts.length) return null;

  return (
    <div>
      <Section title1="Sản phẩm " title2="tương tự" items={similarProducts} />
      <Section title1="Bạn có thể " title2="quan tâm" items={interestProducts} />
    </div>
  );
};

export default RelatedProducts;
