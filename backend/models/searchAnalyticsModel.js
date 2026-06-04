import mongoose from 'mongoose';

const searchAnalyticsSchema = new mongoose.Schema({
    query: { type: String, required: true, unique: true },
    count: { type: Number, default: 1 },
    lastSearched: { type: Date, default: Date.now },
});

searchAnalyticsSchema.index({ count: -1 });

const searchAnalyticsModel = mongoose.model('searchAnalytics', searchAnalyticsSchema);
export default searchAnalyticsModel;
