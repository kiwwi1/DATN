import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import { conversationModel, messageModel } from "../models/chatModel.js";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const forbidden = (message) => Object.assign(new Error(message), { status: 403 });

const asObjectId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw badRequest("Invalid id");
    }
    return new mongoose.Types.ObjectId(id);
};

export const initConversationService = async (buyerId, vendorId) => {
    const buyerObjectId = asObjectId(buyerId);
    const vendorObjectId = asObjectId(vendorId);

    if (buyerObjectId.toString() === vendorObjectId.toString()) {
        throw badRequest("Cannot create chat with yourself");
    }

    const vendor = await userModel.findById(vendorObjectId).select("role");
    if (!vendor || vendor.role !== "vendor") {
        throw badRequest("Vendor not found");
    }

    const conversation = await conversationModel.findOneAndUpdate(
        { buyerId: buyerObjectId, vendorId: vendorObjectId },
        {
            $setOnInsert: {
                buyerId: buyerObjectId,
                vendorId: vendorObjectId,
            },
        },
        { new: true, upsert: true }
    );

    return conversation;
};

const ensureMember = (conversation, userId) => {
    const uid = userId.toString();
    if (
        conversation.buyerId.toString() !== uid &&
        conversation.vendorId.toString() !== uid
    ) {
        throw forbidden("You are not a member of this conversation");
    }
};

const getSenderRole = (conversation, senderId) => {
    const sid = senderId.toString();
    return conversation.vendorId.toString() === sid ? "vendor" : "buyer";
};

export const sendMessageService = async (conversationId, senderId, content) => {
    const text = String(content || "").trim();
    if (!text) throw badRequest("Message cannot be empty");

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
        throw Object.assign(new Error("Conversation not found"), { status: 404 });
    }
    ensureMember(conversation, senderId);

    const senderRole = getSenderRole(conversation, senderId);

    const message = await messageModel.create({
        conversationId: conversation._id,
        senderId,
        senderRole,
        content: text,
        read: false,
    });

    const unreadField = senderRole === "buyer" ? "unreadVendor" : "unreadBuyer";
    await conversationModel.updateOne(
        { _id: conversation._id },
        {
            $set: { lastMessage: text, updatedAt: new Date() },
            $inc: { [unreadField]: 1 },
        }
    );

    return message;
};

export const getConversationsService = async (userId) => {
    const userObjectId = asObjectId(userId);
    const user = await userModel.findById(userObjectId).select("_id");
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    const conversations = await conversationModel
        .find({ $or: [{ buyerId: userObjectId }, { vendorId: userObjectId }] })
        .populate("buyerId", "name shopName")
        .populate("vendorId", "name shopName")
        .sort({ updatedAt: -1 })
        .lean();

    return conversations.map((c) => {
        const isBuyer = c.buyerId?._id?.toString() === userObjectId.toString();
        const partner = isBuyer ? c.vendorId : c.buyerId;

        return {
            ...c,
            partner: partner
                ? {
                      _id: partner._id,
                      name: partner.shopName || partner.name,
                      rawName: partner.name,
                      shopName: partner.shopName || "",
                  }
                : null,
            unreadCount: isBuyer ? c.unreadBuyer : c.unreadVendor,
            role: isBuyer ? "buyer" : "vendor",
        };
    });
};

export const getMessagesService = async (conversationId, userId) => {
    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
        throw Object.assign(new Error("Conversation not found"), { status: 404 });
    }
    ensureMember(conversation, userId);

    const viewerRole = getSenderRole(conversation, userId);
    const resetField = viewerRole === "vendor" ? "unreadVendor" : "unreadBuyer";

    await Promise.all([
        conversationModel.updateOne({ _id: conversation._id }, { $set: { [resetField]: 0 } }),
        messageModel.updateMany(
            {
                conversationId: conversation._id,
                senderId: { $ne: userId },
                read: false,
            },
            { $set: { read: true } }
        ),
    ]);

    const messages = await messageModel
        .find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .lean();

    return { conversation, messages, viewerRole };
};
