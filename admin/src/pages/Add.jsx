import React, { useState, useEffect } from "react";
import { assets } from "../assets/assets.js";
import { backendUrl } from "../App.jsx";
import axios from "axios";
import { toast } from "react-toastify";
import { getDefaultAttributesForCategory } from "../utils/categoryHelper.js";
import AttributesManager from "../components/AttributesManager.jsx";
import VariantsManager from "../components/VariantsManager.jsx";

const Add = ({ token }) => {
  const [image1, setImage1] = useState(false);
  const [image2, setImage2] = useState(false);
  const [image3, setImage3] = useState(false);
  const [image4, setImage4] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [price, setPrice] = useState("");
  const [bestseller, setBestseller] = useState(false);

  // Flexible attributes system
  const [attributes, setAttributes] = useState([]);
  const [variants, setVariants] = useState([]);

  // States for categories
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Fetch main categories on component mount
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const response = await axios.get(backendUrl + "/api/category/list");
        if (response.data.success) {
          // Filter only level 1 (main) categories
          const mainCats = response.data.categories.filter(
            (cat) => cat.level === 1
          );
          setMainCategories(mainCats);

          // Set first category as default if available
          if (mainCats.length > 0) {
            setCategory(mainCats[0]._id);
            setSelectedCategory(mainCats[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast.error("Failed to load categories");
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchMainCategories();
  }, []);

  // Update attributes when category changes
  useEffect(() => {
    if (selectedCategory) {
      const defaultAttrs = getDefaultAttributesForCategory(selectedCategory);
      setAttributes(defaultAttrs);
    }
  }, [selectedCategory]);

  // Fetch subcategories when main category changes
  useEffect(() => {
    const fetchSubCategories = async () => {
      if (!category) {
        setSubCategories([]);
        setSubCategory("");
        return;
      }

      try {
        const response = await axios.get(
          backendUrl + `/api/category/${category}/subcategories`
        );
        if (response.data.success) {
          setSubCategories(response.data.subcategories);

          // Set first subcategory as default if available
          if (response.data.subcategories.length > 0) {
            setSubCategory(response.data.subcategories[0]._id);
          } else {
            setSubCategory("");
          }
        }
      } catch (error) {
        console.error("Error fetching subcategories:", error);
        setSubCategories([]);
        setSubCategory("");
      }
    };

    fetchSubCategories();
  }, [category]);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!name || !description || !price) {
        toast.error("Please fill all required fields");
        return;
      }

      // Validate attributes have at least one value
      const hasValidAttributes = attributes.every(
        (attr) => attr.values && attr.values.length > 0
      );
      if (!hasValidAttributes) {
        toast.error("Please add at least one value for each attribute");
        return;
      }

      // Validate all variant prices are set
      if (variants.length > 0) {
        const missingPrice = variants.some(v => !v.price || v.price <= 0);
        if (missingPrice) {
          toast.error("Vui lòng nhập giá cho tất cả biến thể");
          return;
        }
      }

      // Validate at least one image
      if (!image1 && !image2 && !image3 && !image4) {
        toast.error("Please upload at least one image");
        return;
      }

      const formData = new FormData();

      formData.append("name", name);
      formData.append("description", description);
      formData.append("price", price);
      formData.append("category", category);
      formData.append("subCategory", subCategory);
      formData.append("attributes", JSON.stringify(attributes));
      formData.append("variants", JSON.stringify(variants));
      formData.append("bestseller", bestseller);

      if (image1) formData.append("image1", image1);
      if (image2) formData.append("image2", image2);
      if (image3) formData.append("image3", image3);
      if (image4) formData.append("image4", image4);

      const response = await axios.post(
        backendUrl + "/api/product/add",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            token: token,
          },
        }
      );

      // Check if we have a response
      if (!response || !response.data) {
        toast.error("No response from server");
        return;
      }

      // Handle success
      if (response.data.success) {
        toast.success(response.data.message || "Product added successfully!");
        // Reset form
        setName("");
        setDescription("");
        if (mainCategories.length > 0) {
          setCategory(mainCategories[0]._id);
          setSelectedCategory(mainCategories[0]);
        }
        setSubCategory("");
        setPrice("");
        setAttributes([]);
        setVariants([]);
        setBestseller(false);
        setImage1(false);
        setImage2(false);
        setImage3(false);
        setImage4(false);
      } else {
        // Handle server-side error
        toast.error(response.data.message || "Failed to add product");
      }
    } catch (error) {
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Handle different types of errors
      if (error.response) {
        // Server responded with error
        toast.error(error.response.data?.message || "Server error");
      } else if (error.request) {
        // Request was made but no response
        toast.error("No response from server. Please check your connection.");
      } else {
        // Something else went wrong
        toast.error("Error sending request: " + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 ">
      <form
        onSubmit={onSubmitHandler}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6"
      >
        <div className="lg:col-span-1">
          <p className="text-lg font-medium text-gray-800 mb-3">Upload Image</p>

          <div className="flex gap-4 flex-wrap">
            <label
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden"
              htmlFor="image1"
            >
              <img
                src={image1 ? URL.createObjectURL(image1) : assets.upload_area}
                alt="upload"
                className={`${
                  image1
                    ? "w-full h-full object-cover"
                    : "w-12 h-12 hover:scale-110 transition-transform duration-200"
                }`}
              />
              <input
                type="file"
                id="image1"
                hidden
                accept="image/*"
                onChange={(e) => setImage1(e.target.files[0])}
              />
            </label>
            <label
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden"
              htmlFor="image2"
            >
              <img
                src={image2 ? URL.createObjectURL(image2) : assets.upload_area}
                alt="upload"
                className={`${
                  image2
                    ? "w-full h-full object-cover"
                    : "w-12 h-12 hover:scale-110 transition-transform duration-200"
                }`}
              />
              <input
                type="file"
                id="image2"
                hidden
                accept="image/*"
                onChange={(e) => setImage2(e.target.files[0])}
              />
            </label>
            <label
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden"
              htmlFor="image3"
            >
              <img
                src={image3 ? URL.createObjectURL(image3) : assets.upload_area}
                alt="upload"
                className={`${
                  image3
                    ? "w-full h-full object-cover"
                    : "w-12 h-12 hover:scale-110 transition-transform duration-200"
                }`}
              />
              <input
                type="file"
                id="image3"
                hidden
                accept="image/*"
                onChange={(e) => setImage3(e.target.files[0])}
              />
            </label>
            <label
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden"
              htmlFor="image4"
            >
              <img
                src={image4 ? URL.createObjectURL(image4) : assets.upload_area}
                alt="upload"
                className={`${
                  image4
                    ? "w-full h-full object-cover"
                    : "w-12 h-12 hover:scale-110 transition-transform duration-200"
                }`}
              />
              <input
                type="file"
                id="image4"
                hidden
                accept="image/*"
                onChange={(e) => setImage4(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        <div className="w-full">
          <p className="text-sm font-medium text-gray-700 mb-2">Product Name</p>
          <input
            onChange={(e) => setName(e.target.value)}
            value={name}
            className="w-full border-2 border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
            type="text"
            placeholder="Type product name here"
            required
          />
        </div>

        <div className="w-full">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Product Description
          </p>
          <textarea
            onChange={(e) => setDescription(e.target.value)}
            value={description}
            className="w-full border-2 border-gray-300 rounded-lg p-2.5 h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
            placeholder="Write detailed product description"
            required
          />
        </div>

        <div className="w-full">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Product Category <span className="text-red-500">*</span>
            </p>
            {loadingCategories ? (
              <div className="w-full border-2 border-gray-300 rounded-lg p-2.5 text-gray-500">
                Loading categories...
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setCategory(selectedId);
                  const selected = mainCategories.find(
                    (c) => c._id === selectedId
                  );
                  setSelectedCategory(selected || null);
                }}
                className="w-full border-2 border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                required
              >
                <option value="">-- Select Category --</option>
                {mainCategories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.icon && `${cat.icon} `}
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="w-full">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Product SubCategory
              {subCategories.length === 0 && category && (
                <span className="text-xs text-gray-500 ml-2">
                  (No subcategories available)
                </span>
              )}
            </p>
            <select
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              disabled={!category || subCategories.length === 0}
            >
              <option value="">-- Select SubCategory (Optional) --</option>
              {subCategories.map((subCat) => (
                <option key={subCat._id} value={subCat._id}>
                  {subCat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Product Price
            {variants.length > 0 && (
              <span className="ml-2 text-xs font-normal text-blue-600">(tự động tính từ biến thể)</span>
            )}
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              onChange={(e) => setPrice(e.target.value)}
              value={price}
              type="number"
              className="w-full border-2 border-gray-300 rounded-lg p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        {/* Flexible Attributes System - replaces hardcoded sizes */}
        <div className="lg:col-span-2">
          <AttributesManager
            attributes={attributes}
            setAttributes={setAttributes}
          />
        </div>

        {/* SKU Variants Table — auto-generated from attributes */}
        <div className="lg:col-span-2">
          <VariantsManager
            attributes={attributes}
            variants={variants}
            onChange={setVariants}
          />
        </div>

        <div className="flex items-center gap-2 lg:col-span-2">
          <input
            onChange={() => setBestseller((prev) => !prev)}
            checked={bestseller}
            type="checkbox"
            id="bestseller"
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="bestseller"
            className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900"
          >
            Add to BestSeller
          </label>
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          >
            Add Product
          </button>
        </div>
      </form>
    </div>
  );
};

export default Add;
