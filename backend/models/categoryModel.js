import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    slug: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true
    },
    description: { 
        type: String,
        default: ''
    },
    image: { 
        type: String,
        default: '' 
    },
    icon: { 
        type: String,
        default: '' 
    },
    level: { 
        type: Number, 
        required: true,
        min: 1,
        max: 3,
        default: 1
    }, // 1 = Main Category, 2 = Sub-category, 3 = Sub-sub-category
    parentCategory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'category',
        default: null 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    order: { 
        type: Number, 
        default: 0 
    }, // Display order
    productCount: {
        type: Number,
        default: 0
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

// Index for better query performance (slug already has unique index via unique: true)
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ level: 1 });

// Virtual for getting subcategories
categorySchema.virtual('subCategories', {
    ref: 'category',
    localField: '_id',
    foreignField: 'parentCategory'
});

const categoryModel = mongoose.models.category || mongoose.model('category', categorySchema);
export default categoryModel;













