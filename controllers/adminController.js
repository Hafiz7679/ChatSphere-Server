const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const mongoose = require("mongoose");

const getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalChats = await Chat.countDocuments();

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const onlineUsers = await User.countDocuments({ lastActive: { $gte: twentyFourHoursAgo } });

    const recentUsers = await User.find({}, "-password")
      .sort({ createdAt: -1 })
      .limit(10);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const messagesByDay = await Message.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalMessages,
        totalChats,
        onlineUsers,
        recentUsers,
        messagesByDay,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(query, "-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: { users, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Cannot suspend an admin" });
    }

    user.isSuspended = !user.isSuspended;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isSuspended ? "suspended" : "unsuspended"} successfully`,
      data: { id: user._id, isSuspended: user.isSuspended },
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Cannot delete an admin" });
    }

    await Message.deleteMany({ sender: id });
    await Chat.updateMany(
      { users: id },
      { $pull: { users: id } }
    );
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User and associated data deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getHealth = async (req, res, next) => {
  try {
    let dbStatus = "disconnected";
    try {
      const dbState = mongoose.connection.readyState;
      dbStatus = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";
    } catch {}

    const os = require("os");
    res.status(200).json({
      success: true,
      data: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuLoad: os.loadavg ? os.loadavg() : [0, 0, 0],
        mongoStatus: dbStatus,
        lastErrorTimestamp: null,
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats, getUsers, suspendUser, deleteUser, getHealth };
