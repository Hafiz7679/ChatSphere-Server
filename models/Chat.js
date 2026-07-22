const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
      default: "",
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    isPinned: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pinned: { type: Boolean, default: false },
      },
    ],
    isArchived: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        archived: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chat", chatSchema);
