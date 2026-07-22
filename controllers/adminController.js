const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getOnlineUserIds } = require("../socket/socketHandler");

const logAdminError = (handler, error) => {
  console.error(`[AdminController] ${handler}: ${error.message}`, error.stack?.split("\n")[1]?.trim() || "");
};

const getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalChats = await Chat.countDocuments();
    const groupChats = await Chat.countDocuments({ isGroupChat: true });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeToday = await User.countDocuments({ lastActive: { $gte: twentyFourHoursAgo } });
    const messagesToday = await Message.countDocuments({ createdAt: { $gte: twentyFourHoursAgo } });
    const onlineUserIds = getOnlineUserIds ? getOnlineUserIds() : [];
    const onlineUsers = onlineUserIds.length;

    const imagesSent = await Message.countDocuments({ "attachments.type": "image" });
    const filesSent = await Message.countDocuments({ "attachments.type": { $in: ["file", "document", "video", "audio"] } });
    const voiceMessages = await Message.countDocuments({ "attachments.type": "voice" });

    const recentUsers = await User.find({}, "-password")
      .sort({ createdAt: -1 })
      .limit(10);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const messagesByDay = await Message.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const registrationsByDay = await User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const latestMessages = await Message.find()
      .populate("sender", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(10);

    const suspendedCount = await User.countDocuments({ isSuspended: true });
    const verifiedCount = await User.countDocuments({ isVerified: true });

    res.status(200).json({
      success: true,
      data: {
        totalUsers, totalMessages, totalChats, groupChats,
        onlineUsers, activeToday, messagesToday,
        imagesSent, filesSent, voiceMessages,
        suspendedCount, verifiedCount,
        recentUsers, messagesByDay, registrationsByDay, latestMessages,
      },
    });
  } catch (error) {
    logAdminError("getStats", error);
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const filter = req.query.filter || "";
    const sortField = req.query.sortField || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (filter === "active") {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query.lastActive = { $gte: twentyFourHoursAgo };
    } else if (filter === "suspended") {
      query.isSuspended = true;
    } else if (filter === "verified") {
      query.isVerified = true;
    } else if (filter === "unverified") {
      query.isVerified = false;
    } else if (filter === "admin") {
      query.role = "admin";
    }

    const sort = { [sortField]: sortOrder };

    const [users, total] = await Promise.all([
      User.find(query, "-password").sort(sort).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    const onlineUserIds = getOnlineUserIds ? getOnlineUserIds() : [];
    const onlineSet = new Set(onlineUserIds.map((id) => id.toString()));

    const usersWithStatus = users.map((u) => ({
      ...u.toObject(),
      status: u.isSuspended ? "suspended" : onlineSet.has(u._id.toString()) ? "online" : "offline",
    }));

    const totalUsers = await User.countDocuments();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeToday = await User.countDocuments({ lastActive: { $gte: twentyFourHoursAgo } });
    const suspendedCount = await User.countDocuments({ isSuspended: true });

    res.status(200).json({
      success: true,
      data: {
        users: usersWithStatus,
        total: totalUsers,
        totalPages: Math.ceil(total / limit),
        page,
        activeToday,
        suspendedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    const user = await User.findById(id, "-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const messageCount = await Message.countDocuments({ sender: id });
    const chatCount = await Chat.countDocuments({ users: id });
    const onlineUserIds = getOnlineUserIds ? getOnlineUserIds() : [];
    const isOnline = onlineUserIds.some((uid) => uid.toString() === id);

    res.status(200).json({
      success: true,
      data: { ...user.toObject(), status: isOnline ? "online" : "offline", messageCount, chatCount },
    });
  } catch (error) {
    next(error);
  }
};

const suspendUserHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role === "admin" && req.userDoc._id.toString() !== id) {
      return res.status(403).json({ success: false, message: "Cannot suspend another admin" });
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

const deleteUserHandler = async (req, res, next) => {
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
    await Promise.all([
      Message.deleteMany({ sender: id }),
      Chat.updateMany({ users: id }, { $pull: { users: id } }),
      User.findByIdAndDelete(id),
    ]);
    res.status(200).json({ success: true, message: "User and associated data deleted successfully" });
  } catch (error) {
    next(error);
  }
};

const changeUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role. Must be 'user' or 'admin'" });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.role = role;
    await user.save();
    res.status(200).json({
      success: true,
      message: `User role changed to ${role}`,
      data: { id: user._id, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }
    const user = await User.findById(id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.password = newPassword;
    user.refreshToken = undefined;
    await user.save();
    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};

const verifyUserEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.isVerified = !user.isVerified;
    await user.save();
    res.status(200).json({
      success: true,
      message: `User ${user.isVerified ? "verified" : "unverified"} successfully`,
      data: { id: user._id, isVerified: user.isVerified },
    });
  } catch (error) {
    next(error);
  }
};

const disableAccount = async (req, res, next) => {
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
      return res.status(403).json({ success: false, message: "Cannot disable an admin account" });
    }
    user.isSuspended = true;
    user.refreshToken = undefined;
    await user.save();
    res.status(200).json({ success: true, message: "Account disabled successfully" });
  } catch (error) {
    next(error);
  }
};

const getOnlineUsers = async (req, res, next) => {
  try {
    const onlineUserIds = getOnlineUserIds ? getOnlineUserIds() : [];
    if (onlineUserIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const users = await User.find(
      { _id: { $in: onlineUserIds } },
      "name email avatar lastActive"
    ).lean();
    const usersWithStatus = users.map((u) => ({
      ...u,
      status: "online",
      lastActive: u.lastActive || new Date(),
    }));
    res.status(200).json({ success: true, data: usersWithStatus });
  } catch (error) {
    next(error);
  }
};

const getMessageStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalMessages = await Message.countDocuments();

    const [messagesToday, messagesThisWeek, messagesThisMonth] = await Promise.all([
      Message.countDocuments({ createdAt: { $gte: startOfDay } }),
      Message.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Message.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

    const daysSinceFirst = Math.max(1, Math.ceil((now - (await Message.findOne().sort({ createdAt: 1 }).select("createdAt").lean())?.createdAt?.getTime() || now) / 86400000));
    const avgMessagesPerDay = Math.round(totalMessages / daysSinceFirst);

    const mostActiveUsers = await Message.aggregate([
      { $group: { _id: "$sender", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $project: { "user.password": 0 } },
    ]);

    const mostActiveGroups = await Message.aggregate([
      { $group: { _id: "$chat", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: "chats", localField: "_id", foreignField: "_id", as: "chat" } },
      { $unwind: { path: "$chat", preserveNullAndEmptyArrays: true } },
      { $match: { "chat.isGroupChat": true } },
    ]);

    const [imagesSent, filesSent, voiceMessages] = await Promise.all([
      Message.countDocuments({ "attachments.type": "image" }),
      Message.countDocuments({ "attachments.type": { $in: ["file", "document"] } }),
      Message.countDocuments({ "attachments.type": "voice" }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMessages, messagesToday, messagesThisWeek, messagesThisMonth,
        avgMessagesPerDay, mostActiveUsers, mostActiveGroups,
        imagesSent, filesSent, voiceMessages,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1));

    const dailyRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const monthlyRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const dailyMessages = await Message.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const monthlyMessages = await Message.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const dailyActiveUsers = await User.aggregate([
      { $match: { lastActive: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastActive" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const growthStats = await User.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: null,
          totalNew: { $sum: 1 },
          verifiedNew: { $sum: { $cond: ["$isVerified", 1, 0] } },
        },
      },
    ]);

    const onlineUserIds = getOnlineUserIds ? getOnlineUserIds() : [];
    const currentOnline = onlineUserIds.length;

    res.status(200).json({
      success: true,
      data: {
        dailyRegistrations, monthlyRegistrations,
        dailyMessages, monthlyMessages,
        dailyActiveUsers, currentOnline,
        growthStats: growthStats[0] || { totalNew: 0, verifiedNew: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const suspendedUsers = await User.countDocuments({ isSuspended: true });
    const unverifiedUsers = await User.countDocuments({ isVerified: false });
    const adminCount = await User.countDocuments({ role: "admin" });

    const spamMessages = await Message.countDocuments({
      content: {
        $regex: /(buy|cheap|free|click here|limited offer|act now|congratulations|you won|winner)/i,
      },
    });

    const deletedMessages = await Message.countDocuments({ isDeleted: true });
    const totalMessages = await Message.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        suspendedUsers, unverifiedUsers, adminCount,
        spamMessages, deletedMessages, totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getHealth = async (req, res, next) => {
  try {
    const os = require("os");
    let dbStatus = "disconnected";
    let dbState = -1;
    try {
      dbState = mongoose.connection.readyState;
      dbStatus = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";
    } catch {}

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuLoad = os.loadavg ? os.loadavg() : [0, 0, 0];
    const cpuPercent = Math.min(100, Math.round((cpuLoad[0] / (cpuCount || 1)) * 100));

    const processMem = process.memoryUsage();
    const heapUsedMB = Math.round(processMem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(processMem.heapTotal / 1024 / 1024);
    const rssMB = Math.round(processMem.rss / 1024 / 1024);

    res.status(200).json({
      success: true,
      data: {
        uptime: process.uptime(),
        cpuUsage: cpuPercent,
        cpuCount,
        cpuLoad: cpuLoad.map((l) => Math.round(l * 100) / 100),
        memoryUsage: memUsagePercent,
        memoryDetails: {
          total: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
          free: Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10,
          used: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10,
        },
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        rss: rssMB,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        mongoStatus: dbStatus,
        mongoState: dbState,
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        environment: process.env.NODE_ENV || "development",
        mongodbUri: (process.env.MONGODB_URI || "").replace(/\/\/[^:]+:[^@]+@/, "//***:***@"),
        clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
        jwtExpiry: "15m",
        refreshTokenExpiry: "7d",
        version: "1.0.0",
        features: {
          emailVerification: !!(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST),
          passwordReset: true,
          fileUploads: !!process.env.CLOUDINARY_CLOUD_NAME,
          voiceMessages: true,
          calls: true,
          pushNotifications: true,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats,
  getUsers,
  getUserById,
  suspendUserHandler,
  deleteUserHandler,
  changeUserRole,
  resetUserPassword,
  verifyUserEmail,
  disableAccount,
  getOnlineUsers,
  getMessageStats,
  getAnalytics,
  getReports,
  getHealth,
  getSettings,
};
