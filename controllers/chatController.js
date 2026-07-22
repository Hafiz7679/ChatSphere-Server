const Chat = require("../models/Chat");
const User = require("../models/User");
const Message = require("../models/Message");
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getChats = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const chats = await Chat.find({ users: req.user.id })
      .populate("users", "-password")
      .populate("latestMessage")
      .populate("groupAdmin", "-password")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: chats,
    });
  } catch (error) {
    next(error);
  }
};

const createChat = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: "Cannot chat with yourself" });
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let chat = await Chat.findOne({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.user.id } } },
        { users: { $elemMatch: { $eq: userId } } },
      ],
    })
      .populate("users", "-password")
      .populate("latestMessage");

    if (!chat) {
      chat = await Chat.create({
        chatName: "sender",
        isGroupChat: false,
        users: [req.user.id, userId],
      });
      chat = await chat.populate("users", "-password");
    }

    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

const createGroupChat = async (req, res, next) => {
  try {
    const { name, users } = req.body;

    if (!name || !users || users.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Group name and at least 2 users required",
      });
    }

    if (!Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        message: "Users must be an array",
      });
    }

    for (const uid of users) {
      if (!isValidObjectId(uid)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID in users list",
        });
      }
      const userExists = await User.findById(uid);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: `User ${uid} not found`,
        });
      }
    }

    const allUsers = [...new Set([...users, req.user.id])];

    const groupChat = await Chat.create({
      chatName: name,
      isGroupChat: true,
      users: allUsers,
      groupAdmin: req.user.id,
    });

    const fullChat = await Chat.findById(groupChat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(201).json({ success: true, data: fullChat });
  } catch (error) {
    next(error);
  }
};

const addToGroup = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ success: false, message: "chatId and userId are required" });
    }

    if (!isValidObjectId(chatId) || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ success: false, message: "Not a group chat" });
    }

    if (chat.groupAdmin.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Only admin can add users" });
    }

    if (chat.users.includes(userId)) {
      return res.status(400).json({ success: false, message: "User already in group" });
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    chat.users.push(userId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json({ success: true, data: updatedChat });
  } catch (error) {
    next(error);
  }
};

const removeFromGroup = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ success: false, message: "chatId and userId are required" });
    }

    if (!isValidObjectId(chatId) || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ success: false, message: "Not a group chat" });
    }

    if (chat.groupAdmin.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Only admin can remove users" });
    }

    chat.users = chat.users.filter((u) => u.toString() !== userId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json({ success: true, data: updatedChat });
  } catch (error) {
    next(error);
  }
};

const renameGroup = async (req, res, next) => {
  try {
    const { chatId, chatName } = req.body;

    if (!chatId || !chatName) {
      return res.status(400).json({ success: false, message: "chatId and chatName are required" });
    }

    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat ID" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ success: false, message: "Not a group chat" });
    }

    if (chat.groupAdmin.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Only admin can rename" });
    }

    chat.chatName = chatName;
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json({ success: true, data: updatedChat });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChats,
  createChat,
  createGroupChat,
  addToGroup,
  removeFromGroup,
  renameGroup,
};
