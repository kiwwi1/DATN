import React, { useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useContext } from "react";
import { ShopContext } from "../context/ShopContext";
import { useState } from "react";
import RelatedProducts from "../components/RelatedProducts";
import { formatPrice } from "../utils/priceFormat";
import { toast } from "react-toastify";

const Product = () => {
  const { productId } = useParams();
  const { products, addToCart } = useContext(ShopContext);
  const [productData, setProductData] = useState(false);
  const [image, setImage] = useState("");
  const [size, setSize] = useState(""); // Deprecated: for backward compatibility with old products
  const [selectedAttributes, setSelectedAttributes] = useState({}); // New: {Size: "M", Color: "Red"}

  console.log(productId);

  const fetchProductData = useCallback(() => {
    products.map((item) => {
      if (item._id == productId) {
        setProductData(item);
        setImage(item.image[0]);
        // Reset selections when product changes
        setSize("");
        setSelectedAttributes({});
        return null;
      }
    });
  }, [productId, products]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  return productData ? (
    // neu productData ton tai thi render ra
    <div className="border-t-2 pt-10 transition-opacity ease-in duration-500 opacity-100">
      {/* ------------product data---------------- */}
      <div className="flex gap-12 sm:gap-12 flex-col sm:flex-row">
        {/* ------------product image--------------- */}
        <div className="flex-1 flex flex-col-reverse sm:flex-row gap-3">
          <div className="flex sm:flex-col overflow-x-auto sm:overflow-y-scroll justify-between gap-3 w-full sm:justify-normal sm:w-[18.7%]">
            {productData.image.map((item, index) => (
              <img
                key={index}
                onClick={() => setImage(item)}
                className={`w-[24%] sm:w-full cursor-pointer sm:mb-3 flex-shrink-0 `}
                src={item}
                alt={productData.name}
              />
            ))}
          </div>
          <div className="w-full sm:w-[80%]">
            <img className="w-full h-auto" src={image}></img>
          </div>
        </div>
        {/* ------product info------------ */}
        <div className="flex-1">
          <h1 className="font-medium text-2xl mt-2">{productData.name}</h1>
          
          {/* Brand and Shop Info */}
          <div className="flex items-center gap-3 mt-3">
            {productData.brand && (
              <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium">
                {productData.brand}
              </span>
            )}
            {productData.vendorShopName && (
              <span className="text-sm text-gray-600">
                Bán bởi: <span className="font-medium">{productData.vendorShopName}</span>
              </span>
            )}
          </div>

          {/* Rating and Sold */}
          <div className="flex items-center gap-4 mt-3 pb-3 border-b">
            {productData.rating && (
              <div className="flex items-center gap-1">
                <div className="flex items-center">
                  {[...Array(5)].map((_, index) => (
                    <svg
                      key={index}
                      className={`w-4 h-4 ${
                        index < Math.floor(productData.rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300 fill-current'
                      }`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {productData.rating}
                </span>
                {productData.reviewCount > 0 && (
                  <span className="text-sm text-gray-500">
                    ({productData.reviewCount} đánh giá)
                  </span>
                )}
              </div>
            )}
            {productData.sold > 0 && (
              <span className="text-sm text-gray-600">
                Đã bán: <span className="font-medium">{productData.sold >= 1000 ? `${(productData.sold/1000).toFixed(1)}k` : productData.sold}</span>
              </span>
            )}
          </div>

          {/* Price Section */}
          <div className="mt-5 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold text-orange-600">
                {formatPrice(productData.price)}
              </p>
              {productData.discount > 0 && productData.originalPrice && (
                <>
                  <p className="text-xl text-gray-400 line-through">
                    {formatPrice(productData.originalPrice)}
                  </p>
                  <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded">
                    -{productData.discount}%
                  </span>
                </>
              )}
            </div>
            {productData.discount > 0 && (
              <p className="text-sm text-green-600 mt-2">
                🎉 Tiết kiệm {formatPrice(productData.originalPrice - productData.price)}
              </p>
            )}
          </div>
          {/* Stock Info */}
          {productData.stock > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-green-600 font-medium">✓ Còn hàng</span>
              <span className="text-gray-500">({productData.stock} sản phẩm)</span>
            </div>
          )}

          <p className="mt-5 text-gray-700 md:w-4/5 leading-relaxed">
            {productData.description}
          </p>

          {/* Product Attributes */}
          {productData.attributes && productData.attributes.length > 0 && (
            <div className="flex flex-col gap-4 my-6">
              {productData.attributes.map((attr, attrIndex) => (
                <div key={attrIndex}>
                  <p className="font-medium mb-2">
                    {attr.name}:
                    {selectedAttributes[attr.name] && (
                      <span className="ml-2 text-orange-600 font-semibold">
                        {selectedAttributes[attr.name]}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {attr.values.map((value, valueIndex) => (
                      <button
                        onClick={() => setSelectedAttributes({
                          ...selectedAttributes,
                          [attr.name]: value
                        })}
                        className={`border-2 py-2 px-4 rounded-lg transition-all ${
                          selectedAttributes[attr.name] === value
                            ? "border-orange-500 bg-orange-50 text-orange-600 font-medium" 
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                        key={valueIndex}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fallback to old sizes if attributes don't exist */}
          {(!productData.attributes || productData.attributes.length === 0) && productData.sizes && productData.sizes.length > 0 && (
            <div className="flex flex-col gap-4 my-6">
              <p className="font-medium">Chọn kích thước:</p>
              <div className="flex gap-2 flex-wrap">
                {productData.sizes.map((item, index) => (
                  <button
                    onClick={() => setSize(item)}
                    className={`border-2 py-2 px-4 rounded-lg transition-all ${
                      item === size 
                        ? "border-orange-500 bg-orange-50 text-orange-600 font-medium" 
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    key={index}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selection Summary */}
          {productData.attributes && productData.attributes.length > 0 && Object.keys(selectedAttributes).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
              <p className="text-sm font-medium text-blue-800 mb-2">✓ Bạn đã chọn:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedAttributes).map(([key, value]) => (
                  <span key={key} className="bg-white text-blue-700 text-sm px-3 py-1 rounded-full border border-blue-300 font-medium">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              // Handle new attributes system
              if (productData.attributes && productData.attributes.length > 0) {
                // Check if all attributes are selected
                const allSelected = productData.attributes.every(attr => selectedAttributes[attr.name]);
                if (!allSelected) {
                  toast.error(`Vui lòng chọn ${productData.attributes.map(a => a.name).join(', ')}`);
                  return;
                }
                // Convert selectedAttributes to string format: "Size: M, Color: Red"
                const attributeString = Object.entries(selectedAttributes)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ');
                addToCart(productData._id, attributeString);
              } 
              // Fallback to old sizes system
              else {
                addToCart(productData._id, size);
              }
            }}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white px-12 py-4 text-base font-medium rounded-lg active:scale-95 transition-all shadow-lg"
          >
            🛒 THÊM VÀO GIỎ HÀNG
          </button>
          
          <hr className="mt-8 sm:w-4/5"></hr>
          
          <div className="text-sm text-gray-700 mt-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>Sản phẩm chính hãng 100%</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
              <span>Miễn phí vận chuyển cho đơn hàng trên 500.000₫</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
              </svg>
              <span>Đổi trả miễn phí trong 7 ngày</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span>Hỗ trợ thanh toán khi nhận hàng (COD)</span>
            </div>
          </div>
        </div>
      </div>
      {/* Description and Review Section */}
      <div className="mt-20">
        <div className="flex border-b">
          <button className="border-b-2 border-orange-600 px-6 py-3 font-medium text-orange-600">
            Mô tả sản phẩm
          </button>
          <button className="px-6 py-3 text-gray-600 hover:text-gray-800">
            Đánh giá ({productData.reviewCount || 0})
          </button>
        </div>
        <div className="py-6 px-6 border border-t-0 rounded-b-lg bg-gray-50">
          <div className="flex flex-col gap-4 text-sm text-gray-700 leading-relaxed">
            <p className="font-medium text-base text-gray-800">Chi tiết sản phẩm:</p>
            <p>{productData.description}</p>
            
            {/* Additional Product Details */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {productData.brand && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Thương hiệu:</span>
                  <span className="font-medium">{productData.brand}</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Tình trạng:</span>
                <span className="font-medium text-green-600">
                  {productData.stock > 0 ? 'Còn hàng' : 'Hết hàng'}
                </span>
              </div>
              {productData.tags && productData.tags.length > 0 && (
                <div className="flex justify-between border-b pb-2 sm:col-span-2">
                  <span className="text-gray-600">Tags:</span>
                  <div className="flex gap-2 flex-wrap">
                    {productData.tags.map((tag, index) => (
                      <span key={index} className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Display related products */}
      <RelatedProducts
        category={productData.category}
        subCategory={productData.subCategory}
      />
    </div>
  ) : (
    <div className="opacity-0"></div>
  );
};

export default Product;
