import mongoose from "mongoose";

const shopFollowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "shop_follows",
  }
);

// 1 user chỉ follow 1 shop đúng 1 lần
shopFollowSchema.index({ userId: 1, vendorId: 1 }, { unique: true });

// query thường dùng
shopFollowSchema.index({ vendorId: 1, createdAt: -1 }); // list follower mới nhất
shopFollowSchema.index({ userId: 1, createdAt: -1 });   // list shop user đang follow

const shopFollowModel =
  mongoose.models.shopFollow || mongoose.model("shopFollow", shopFollowSchema);

export default shopFollowModel;