const express = require("express");
const router = express.Router();
const {
  getChats,
  createChat,
  createGroupChat,
  addToGroup,
  removeFromGroup,
  renameGroup,
} = require("../controllers/chatController");
const protect = require("../middleware/authMiddleware");

router.get("/", protect, getChats);
router.post("/", protect, createChat);
router.post("/group", protect, createGroupChat);
router.put("/group/add", protect, addToGroup);
router.put("/group/remove", protect, removeFromGroup);
router.put("/group/rename", protect, renameGroup);

module.exports = router;
