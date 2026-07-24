const express = require("express");
const router = express.Router();
const {
  sendMessage, getMessages, getChatMessages, deleteMessage,
  editMessage, markAsRead, getChatMedia, reactToMessage,
} = require("../controllers/messageController");
const protect = require("../middleware/authMiddleware");
const {
  sendMessageValidator, reactToMessageValidator,
  paginationValidator, markAsReadValidator,
  editMessageValidator, messageIdParam, chatIdParam,
} = require("../security/validators");

router.post("/send", protect, sendMessageValidator, sendMessage);
router.get("/:sender/:receiver", protect, paginationValidator, getMessages);
router.get("/chat/:chatId", protect, paginationValidator, getChatMessages);
router.delete("/:messageId", protect, messageIdParam, deleteMessage);
router.put("/:messageId", protect, editMessageValidator, editMessage);
router.post("/:messageId/react", protect, reactToMessageValidator, reactToMessage);
router.put("/read/mark", protect, markAsReadValidator, markAsRead);
router.get("/media/:chatId", protect, paginationValidator, getChatMedia);

module.exports = router;
