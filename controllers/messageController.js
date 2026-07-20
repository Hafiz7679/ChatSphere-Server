const mongoose = require("mongoose");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Send Message
const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user?.id;
    const { receiver, chatId, text, replyTo } = req.body;

    if (!senderId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    if (!text && !replyTo && !req.body.attachments) {
      return res.status(400).json({ success: false, message: "Missing message content" });
    }

    let activeChatId = chatId;

    if (receiver && !chatId) {
      if (!isValidObjectId(receiver)) {
        return res.status(400).json({ success: false, message: "Invalid receiver id" });
      }

      let chat = await Chat.findOne({
        isGroupChat: false,
        $and: [
          { users: { $elemMatch: { $eq: senderId } } },
          { users: { $elemMatch: { $eq: receiver } } },
        ],
      });

      if (!chat) {
        chat = await Chat.create({
          chatName: "sender",
          isGroupChat: false,
          users: [senderId, receiver],
        });
      }
      activeChatId = chat._id;
    }

    const messageData = {
      sender: senderId,
      chat: activeChatId,
      status: "sent",
    };

    if (text) messageData.content = text;
    if (replyTo) messageData.replyTo = replyTo;
    if (req.body.attachments) messageData.attachments = req.body.attachments;

    const message = await Message.create(messageData);

    await message.populate("sender", "name avatar email");
    await message.populate("chat");
    await User.populate(message, {
      path: "chat.users",
      select: "name avatar email",
    });

    await Chat.findByIdAndUpdate(activeChatId, { latestMessage: message._id });

    const messageObj = message.toObject();
    messageObj.text = messageObj.content;
    messageObj.receiver = receiver;

    res.status(201).json({
      success: true,
      message: "Message Sent",
      data: messageObj,
    });
  } catch (error) {
    next(error);
  }
};

// Get Messages between two users
const getMessages = async (req, res, next) => {
  try {
    const { sender, receiver } = req.params;

    if (!isValidObjectId(sender) || !isValidObjectId(receiver)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const requesterId = req.user?.id;
    if (!requesterId || (requesterId !== sender && requesterId !== receiver)) {
      return res.status(403).json({ success: false, message: "Not Authorized" });
    }

    const chat = await Chat.findOne({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: sender } } },
        { users: { $elemMatch: { $eq: receiver } } },
      ],
    });

    if (!chat) {
      return res.status(200).json({ success: true, data: [] });
    }

    const messages = await Message.find({ chat: chat._id, isDeleted: false })
      .populate("sender", "name avatar email")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    const formattedMessages = messages.map((msg) => {
      const obj = msg.toObject();
      obj.text = obj.content;
      obj.receiver =
        chat.users.find((u) => u.toString() !== obj.sender._id.toString()) ||
        receiver;
      return obj;
    });

    // Mark messages as delivered
    await Message.updateMany(
      { chat: chat._id, sender: receiver, status: "sent" },
      { status: "delivered" }
    );

    res.status(200).json({
      success: true,
      data: formattedMessages,
    });
  } catch (error) {
    next(error);
  }
};

// Get Messages by Chat ID
const getChatMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat id" });
    }

    const messages = await Message.find({ chat: chatId, isDeleted: false })
      .populate("sender", "name avatar email")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    const formattedMessages = messages.map((msg) => {
      const obj = msg.toObject();
      obj.text = obj.content;
      return obj;
    });

    res.status(200).json({
      success: true,
      data: formattedMessages,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Message
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const senderId = message.sender.toString();
    if (senderId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    message.isDeleted = true;
    await message.save();

    res.status(200).json({
      success: true,
      message: "Message deleted",
    });
  } catch (error) {
    next(error);
  }
};

// Edit Message
const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const senderId = message.sender.toString();
    if (senderId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    message.content = text;
    await message.save();

    res.status(200).json({
      success: true,
      message: "Message edited",
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// Mark as read
const markAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    await Message.updateMany(
      { chat: chatId, sender: { $ne: req.user.id }, status: { $ne: "read" } },
      { status: "read" }
    );

    res.status(200).json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getMessages,
  getChatMessages,
  deleteMessage,
  editMessage,
  markAsRead,
};
