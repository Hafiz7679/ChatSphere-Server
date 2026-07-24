const express = require("express");
const router = express.Router();
const {
  getChats, createChat, createGroupChat,
  addToGroup, removeFromGroup, renameGroup,
} = require("../controllers/chatController");
const protect = require("../middleware/authMiddleware");
const {
  createChatValidator, createGroupChatValidator,
  groupActionValidator, renameGroupValidator,
} = require("../security/validators");

router.get("/", protect, getChats);
router.post("/", protect, createChatValidator, createChat);
router.post("/group", protect, createGroupChatValidator, createGroupChat);
router.put("/group/add", protect, groupActionValidator, addToGroup);
router.put("/group/remove", protect, groupActionValidator, removeFromGroup);
router.put("/group/rename", protect, renameGroupValidator, renameGroup);

module.exports = router;
