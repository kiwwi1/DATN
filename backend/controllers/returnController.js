import {
  createReturnRequestService,
  getReturnRequestByOrderService,
  getUserReturnRequestsService,
  getVendorReturnRequestsService,
  reviewReturnRequestService,
  confirmReturnReceivedService,
} from "../services/returnService.js";

const uid = (req) => req.userId || req.body?.userId;

export const createReturnRequest = async (req, res) => {
  try {
    const { orderId, reason, description, images } = req.body;
    const result = await createReturnRequestService(uid(req), orderId, { reason, description, images });
    res.status(201).json({ success: true, returnRequest: result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const getReturnRequestByOrder = async (req, res) => {
  try {
    const result = await getReturnRequestByOrderService(uid(req), req.params.orderId);
    res.json({ success: true, returnRequest: result || null });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const getUserReturnRequests = async (req, res) => {
  try {
    const result = await getUserReturnRequestsService(uid(req));
    res.json({ success: true, returnRequests: result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const getVendorReturnRequests = async (req, res) => {
  try {
    const result = await getVendorReturnRequestsService(uid(req));
    res.json({ success: true, returnRequests: result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const reviewReturnRequest = async (req, res) => {
  try {
    const { approved, vendorNote } = req.body;
    const result = await reviewReturnRequestService(uid(req), req.params.id, { approved, vendorNote });
    res.json({ success: true, returnRequest: result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const confirmReturnReceived = async (req, res) => {
  try {
    const result = await confirmReturnReceivedService(uid(req), req.params.id);
    res.json({ success: true, returnRequest: result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};
