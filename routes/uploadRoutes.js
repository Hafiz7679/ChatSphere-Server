const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const {
  uploadFile,
  uploadAvatar,
  uploadVoice,
} = require("../controllers/uploadController");
const protect = require("../middleware/authMiddleware");

router.post("/", protect, upload.single("file"), uploadFile);
router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);
router.post("/voice", protect, upload.single("voice"), uploadVoice);

module.exports = router;
