const express = require("express");

const router = express.Router();

const {
  sendMessage,
  getMessages,
} = require("../controllers/messageController");

// Send a message
router.post("/send", sendMessage);

// Get all messages between two users
router.get("/:sender/:receiver", getMessages);

module.exports = router;