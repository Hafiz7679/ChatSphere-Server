const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const path = require("path");
const { compressImage, compressAvatar } = require("../utils/compress");

const isCloudinaryConfigured = () => {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.error("⚠️  Cloudinary not configured. File uploads will fail. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env");
}

const uploadToCloudinary = (buffer, folder, resourceType = "auto", options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = { folder, resource_type: resourceType, ...options };
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const sanitizeFileName = (originalName) => {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
  return sanitized + ext;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, message: "File size exceeds 50MB limit" });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ success: false, message: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env" });
    }

    let uploadBuffer = req.file.buffer;
    let resourceType = "auto";

    if (req.file.mimetype.startsWith("image/")) {
      try {
        const compressed = await compressImage(req.file.buffer);
        uploadBuffer = compressed.buffer;
        resourceType = "image";
      } catch (err) {
        console.error("Image compression failed, uploading original:", err.message);
      }
    }

    const result = await uploadToCloudinary(
      uploadBuffer,
      "chatsphere/files",
      resourceType
    );

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        type: req.file.mimetype,
        name: sanitizeFileName(req.file.originalname),
        size: req.file.size,
        duration: result.duration || null,
      },
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (req.file.size > MAX_AVATAR_SIZE) {
      return res.status(400).json({ success: false, message: "Avatar size exceeds 5MB limit" });
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ success: false, message: "Only image files are allowed for avatars" });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ success: false, message: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env" });
    }

    let uploadBuffer = req.file.buffer;
    try {
      const compressed = await compressAvatar(req.file.buffer);
      uploadBuffer = compressed.buffer;
    } catch (err) {
      console.error("Avatar compression failed, uploading original:", err.message);
    }

    const result = await uploadToCloudinary(
      uploadBuffer,
      "chatsphere/avatars",
      "image"
    );

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    console.error("Avatar upload error:", error.message);
    next(error);
  }
};

const uploadVoice = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, message: "File size exceeds 50MB limit" });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ success: false, message: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env" });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,
      "chatsphere/voice",
      "video"
    );

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        duration: result.duration || 0,
      },
    });
  } catch (error) {
    console.error("Voice upload error:", error.message);
    next(error);
  }
};

module.exports = { uploadFile, uploadAvatar, uploadVoice };
