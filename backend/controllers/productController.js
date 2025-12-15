import { v2 as cloudinary } from "cloudinary"
import connectCloudinary from "../config/cloudinary.js";
import productModel from "../models/productModel.js";

connectCloudinary()

// function for add product
const addProduct = async (req,res) => {
    try {
        const {name, description, price, category, subCategory, attributes, sizes, bestseller} = req.body;
        
        // Validate required fields
        if (!name || !description || !price || !category) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, description, price, category'
            });
        }

        // Validate attributes or sizes
        const parsedAttributes = attributes ? JSON.parse(attributes) : [];
        const parsedSizes = sizes ? JSON.parse(sizes) : [];
        
        if (parsedAttributes.length === 0 && parsedSizes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide at least one product attribute or size'
            });
        }

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
            images.map(async (item)=>{
                let result = await cloudinary.uploader.upload(item.path,{resource_type:'image'})
                return result.secure_url
            })
        )

        const productData = {
            name,
            description,
            price: Number(price),
            category,
            subCategory: subCategory || null, // Optional
            attributes: parsedAttributes, // New flexible system
            sizes: parsedSizes, // Keep for backward compatibility
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
        const {name, description, price, category, subCategory, sizes, bestseller} = req.body
        const {productId} = req.body
        const product = await productModel.findById(productId)
        
        if(!product){
            return res.status(404).json({success: false, message: 'Product not found'})
        }

        // Check if product belongs to the vendor
        if (product.vendorId.toString() !== req.vendorId.toString()) {
            return res.json({success: false, message: 'Unauthorized - You can only update your own products'});
        }

        product.name = name
        product.description = description
        product.price = price
        product.category = category
        product.subCategory = subCategory
        product.sizes = sizes
        product.bestseller = bestseller
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
