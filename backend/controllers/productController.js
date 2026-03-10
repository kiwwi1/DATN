import productModel from "../models/productModel.js";
import { uploadToR2 } from "../utils/r2Upload.js";

// Compute product-level price (min) and stock (sum) from variants array
function syncFromVariants(variants) {
    const prices = variants.map(v => Number(v.price)).filter(p => !isNaN(p) && p >= 0);
    const price = prices.length > 0 ? Math.min(...prices) : 0;
    const stock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    return { price, stock };
}

// function for add product
const addProduct = async (req,res) => {
    try {
        const {name, description, price, category, subCategory, attributes, sizes, variants, bestseller} = req.body;
        
        // Validate required fields
        if (!name || !description || !category) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, description, category'
            });
        }

        // Parse flexible data
        const parsedAttributes = attributes ? JSON.parse(attributes) : [];
        const parsedSizes = sizes ? JSON.parse(sizes) : [];
        const parsedVariants = variants ? JSON.parse(variants) : [];

        const image1 = req.files?.image1 && req.files.image1[0] 
        const image2 = req.files?.image2 && req.files.image2[0] 
        const image3 = req.files?.image3 && req.files.image3[0] 
        const image4 = req.files?.image4 && req.files.image4[0] 
        const images = [image1,image2,image3,image4].filter((item)=> item !== undefined)

        // Validate at least one image
        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one image is required'
            });
        }

        const imagesUrl = await Promise.all(
            images.map(async (item) => {
                const url = await uploadToR2(item, "products");
                return url;
            })
        );

        // Derive price and stock from variants if provided, otherwise use form values
        const variantSync = parsedVariants.length > 0 ? syncFromVariants(parsedVariants) : null;

        const productData = {
            name,
            description,
            price: variantSync ? variantSync.price : Number(price),
            stock: variantSync ? variantSync.stock : 0,
            category,
            subCategory: subCategory || null,
            attributes: parsedAttributes,
            variants: parsedVariants,
            sizes: parsedSizes,
            bestseller: bestseller === 'true' ? true : false,
            image: imagesUrl,
            date: Date.now(),
            vendorId: req.vendorId,
            vendorShopName: req.vendorShopName
        }

        const product = new productModel(productData)
        await product.save()
        
        return res.status(201).json({
            success: true, 
            message: 'Product added successfully',
            product: product
        });
        
    } catch (error) {
        console.error('Error adding product:', error);
        return res.status(500).json({
            success: false, 
            message: error.message || 'Internal server error'
        });
    }
}

// function for list
const listProduct = async (req,res) => {
    try {  
        const products = await productModel.find({});
        res.json({success: true, products})
    } catch (error) {
        res.json({success: false, message: error.message})
        console.log(error.message)  
    }

}

const listProductsByCategory = async (req,res) => {
    try {
        const {category} = req.body
        const products = await productModel.find({category: category})
        res.json({success: true, products})
    } catch (error) {
        res.json({success: false, message: error.message})
        console.log(error.message)  
    }
}

// function for remove product (vendor can only remove their own products)
const removeProduct = async (req,res) => {
    try {
        const product = await productModel.findById(req.body.id);
        
        if (!product) {
            return res.json({success: false, message: 'Product not found'});
        }

        // Check if product belongs to the vendor
        if (product.vendorId.toString() !== req.vendorId.toString()) {
            return res.json({success: false, message: 'Unauthorized - You can only delete your own products'});
        }

        await productModel.findByIdAndDelete(req.body.id);
        res.json({success: true, message: 'Product removed successfully'});

    } catch (error) {
        res.json({success: false, message: error.message});
        console.log(error.message);   
    }
}


// function for single product info
const singleProduct = async (req,res) => {
    try {
        const {productId} = req.body
        const product = await productModel.findById(productId)
        res.json({success: true, product})
        
    } catch (error) {
        res.json({success: false, message: error.message})
        console.log(error.message)  
        
    }

}
const updateProduct = async (req,res) => {
    try {
        const {productId, name, description, price, category, subCategory, bestseller, attributes, variants} = req.body
        const product = await productModel.findById(productId)
        
        if(!product){
            return res.status(404).json({success: false, message: 'Product not found'})
        }

        // Check if product belongs to the vendor
        if (product.vendorId.toString() !== req.vendorId.toString()) {
            return res.json({success: false, message: 'Unauthorized - You can only update your own products'});
        }

        const parsedAttributes = attributes
            ? (typeof attributes === 'string' ? JSON.parse(attributes) : attributes)
            : product.attributes;
        const parsedVariants = variants
            ? (typeof variants === 'string' ? JSON.parse(variants) : variants)
            : product.variants;

        const variantSync = parsedVariants && parsedVariants.length > 0
            ? syncFromVariants(parsedVariants)
            : null;

        product.name = name
        product.description = description
        product.price = variantSync ? variantSync.price : Number(price)
        product.stock = variantSync ? variantSync.stock : product.stock
        product.category = category
        product.subCategory = subCategory || null
        product.attributes = parsedAttributes
        product.variants = parsedVariants
        product.bestseller = bestseller
        product.markModified('variants')
        await product.save()
        res.json({success: true, message: 'Product updated successfully', product})
        
    } catch (error) {
        res.json({success: false, message: error.message})
        console.log(error.message)
    }
}

// function to list products for specific vendor
const listVendorProducts = async (req, res) => {
    try {
        const products = await productModel.find({ vendorId: req.vendorId });
        res.json({ success: true, products });
    } catch (error) {
        res.json({ success: false, message: error.message });
        console.log(error.message);
    }
}
export {addProduct, listProduct, removeProduct, singleProduct, updateProduct, listVendorProducts, listProductsByCategory}
