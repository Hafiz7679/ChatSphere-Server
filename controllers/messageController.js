const Message = require("../models/Message");

// Send Message
const sendMessage = async (req, res) => {
  try {
    const { sender, receiver, text } = req.body;

    if (!sender || !receiver || !text) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const message = await Message.create({
      sender,
      receiver,
      text,
    });

    res.status(201).json({
      success: true,
      message: "Message Sent",
      data: message,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Messages
const getMessages = async (req, res) => {
  try {
    const { sender, receiver } = req.params;

    const messages = await Message.find({
      $or: [
        {
          sender,
          receiver,
        },
        {
          sender: receiver,
          receiver: sender,
        },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
};