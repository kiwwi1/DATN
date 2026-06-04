import multer from "multer";
import os from "os";
import path from "path";
import crypto from "crypto";

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, os.tmpdir());
    },
    filename: (_req, file, callback) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
        callback(null, unique);
    },
});

const MAX_UPLOAD_FILE_SIZE_MB = Number(process.env.MAX_UPLOAD_FILE_SIZE_MB || 5);
const MAX_UPLOAD_FILES = Number(process.env.MAX_UPLOAD_FILES || 6);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

const fileFilter = (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
        callback(Object.assign(new Error("Unsupported file type"), { status: 400 }), false);
        return;
    }
    callback(null, true);
};

const upload = multer({
    storage,
    limits: {
        fileSize: Math.max(1, MAX_UPLOAD_FILE_SIZE_MB) * 1024 * 1024,
        files: Math.max(1, MAX_UPLOAD_FILES),
    },
    fileFilter,
});

export default upload
