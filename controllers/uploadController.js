const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

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

const uploadToCloudinary = (buffer, folder, resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ success: false, message: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env" });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,
      "chatsphere/files"
    );

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        type: req.file.mimetype,
        name: req.file.originalname,
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
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ success: false, message: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env" });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,
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
