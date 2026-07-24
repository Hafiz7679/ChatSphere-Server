const sharp = require("sharp");

const IMAGE_MAX_WIDTH = 1920;
const IMAGE_MAX_HEIGHT = 1920;
const IMAGE_QUALITY = 80;
const AVATAR_SIZE = 400;
const AVATAR_QUALITY = 75;

const compressImage = async (buffer, options = {}) => {
  const {
    maxWidth = IMAGE_MAX_WIDTH,
    maxHeight = IMAGE_MAX_HEIGHT,
    quality = IMAGE_QUALITY,
    fit = "inside",
  } = options;

  const metadata = await sharp(buffer).metadata();

  if (metadata.format === "gif") {
    return { buffer, format: "gif" };
  }

  let pipeline = sharp(buffer);

  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    pipeline = pipeline.resize({ width: maxWidth, height: maxHeight, fit, withoutEnlargement: true });
  }

  const outputFormat = metadata.format === "png" ? "png" : "jpeg";

  if (outputFormat === "jpeg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else {
    pipeline = pipeline.png({ quality, compressionLevel: 9 });
  }

  const compressed = await pipeline.toBuffer();
  return { buffer: compressed, format: outputFormat };
};

const compressAvatar = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  if (metadata.format === "gif") {
    return { buffer, format: "gif" };
  }

  const compressed = await sharp(buffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", withoutEnlargement: true })
    .jpeg({ quality: AVATAR_QUALITY, mozjpeg: true })
    .toBuffer();

  return { buffer: compressed, format: "jpeg" };
};

module.exports = { compressImage, compressAvatar };
