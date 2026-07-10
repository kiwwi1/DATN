// backend/models/userInteractionModel.js
import mongoose from "mongoose";

const userInteractionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        required: true,
        index: true 
    },
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'product', 
        required: true,
        index: true 
    },
    
    // Interaction types with weights
    interactions: {
        // Explicit feedback (strong signals)
        purchased: { type: Number, default: 0 },      // Weight: 10
        rated: { type: Number, default: 0 },           // 1-5 stars
        reviewed: { type: Boolean, default: false },   // Weight: 8
        
        // Implicit feedback (medium signals)
        addedToCart: { type: Number, default: 0 },     // Weight: 5
        wishlisted: { type: Boolean, default: false }, // Weight: 6
        
        // Weak signals
        viewed: { type: Number, default: 0 },          // Weight: 1
        clicked: { type: Number, default: 0 },         // Weight: 1
        searched: { type: Number, default: 0 },        // Weight: 2
        timeSpent: { type: Number, default: 0 }        // seconds, Weight: 0.1/sec
    },
    
    // Aggregated interaction score
    interactionScore: { type: Number, default: 0 },
    
    // Last interaction
    lastInteraction: { type: Date, default: Date.now },
    
    // Time decay factor (recent interactions more important)
    decayFactor: { type: Number, default: 1 }
}, {
    timestamps: true
});

// Compound index for efficient queries
userInteractionSchema.index({ userId: 1, productId: 1 }, { unique: true });
userInteractionSchema.index({ interactionScore: -1 });
userInteractionSchema.index({ lastInteraction: -1 });

// Method to calculate interaction score
userInteractionSchema.methods.calculateScore = function() {
    const weights = {
        purchased: 10,
        rated: 2,
        reviewed: 8,
        addedToCart: 5,
        wishlisted: 6,
        viewed: 1,
        clicked: 1,
        searched: 2,
        timeSpent: 0.01 // per second
    };
    
    let score = 0;
    score += (this.interactions.purchased || 0) * weights.purchased;
    score += (this.interactions.rated || 0) * weights.rated;
    score += (this.interactions.reviewed ? weights.reviewed : 0);
    score += (this.interactions.addedToCart || 0) * weights.addedToCart;
    score += (this.interactions.wishlisted ? weights.wishlisted : 0);
    score += (this.interactions.viewed || 0) * weights.viewed;
    score += (this.interactions.clicked || 0) * weights.clicked;
    score += (this.interactions.searched || 0) * weights.searched;
    score += (this.interactions.timeSpent || 0) * weights.timeSpent;
    
    // Điểm lưu ở đây được chốt tại thời điểm tương tác (lastInteraction vừa
    // được cập nhật nên decayFactor ≈ 1). Suy hao theo Δt đến "thời điểm tính
    // toán" được nhân bổ sung ở tầng đọc — xem applyTimeDecay (interactionService).
    const daysSinceLastInteraction = (Date.now() - this.lastInteraction) / (1000 * 60 * 60 * 24);
    this.decayFactor = Math.exp(-daysSinceLastInteraction / 30); // hằng số thời gian 30 ngày (~36.8% sau 30 ngày)
    
    this.interactionScore = score * this.decayFactor;
    return this.interactionScore;
};

const userInteractionModel = mongoose.model('userInteraction', userInteractionSchema);
export default userInteractionModel;
