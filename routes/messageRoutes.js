const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getChatMessages,
  deleteMessage,
  editMessage,
  markAsRead,
  getChatMedia,
  reactToMessage,
} = require("../controllers/messageController");
const protect = require("../middleware/authMiddleware");

router.post("/send", protect, sendMessage);
router.get("/:sender/:receiver", protect, getMessages);
router.get("/chat/:chatId", protect, getChatMessages);
router.delete("/:messageId", protect, deleteMessage);
router.put("/:messageId", protect, editMessage);
router.post("/:messageId/react", protect, reactToMessage);
router.put("/read/mark", protect, markAsRead);
router.get("/media/:chatId", protect, getChatMedia);

module.exports = router;
