const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm;codecs=opus",
  "audio/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
]);

const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".vbs", ".vbe", ".js", ".jse", ".ws", ".wsf", ".wsc",
  ".wsh", ".ps1", ".ps1xml", ".ps2", ".ps2xml", ".psc1",
  ".psc2", ".msh", ".msh1", ".msh2", ".mshxml",
  ".scf", ".lnk", ".inf", ".reg", ".sh", ".bash",
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type "${ext}" is not allowed`), false);
  }

  if (!ALLOWED_TYPES.has(mime)) {
    return cb(new Error(`File type "${mime}" is not allowed`), false);
  }

  if (mime.startsWith("image/") && !ext.match(/\.(jpe?g|png|gif|webp)$/)) {
    return cb(new Error("Image file extension does not match MIME type"), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },
});

module.exports = upload;
