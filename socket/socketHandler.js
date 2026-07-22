const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

const onlineUsers = new Map();
const typingTimers = new Map();
const messageQueue = new Map();
const TYPING_AUTO_CLEAR_MS = 3000;

function addOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeOnlineSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
}

function isOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

function getSocketIds(userId) {
  return onlineUsers.has(userId) ? Array.from(onlineUsers.get(userId)) : [];
}

function clearTypingTimer(userId) {
  const entry = typingTimers.get(userId);
  if (entry) { clearTimeout(entry.timeout); typingTimers.delete(userId); }
}

function flushMessageQueue(userId, io) {
  if (messageQueue.has(userId)) {
    (messageQueue.get(userId) || []).forEach((msg) => {
      getSocketIds(userId).forEach((sid) => io.to(sid).emit("receive_message", msg));
    });
    messageQueue.delete(userId);
  }
}

function initSocketServer(server, allowedOrigins) {
  const { Server } = require("socket.io");

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(";");
        const tokenCookie = cookies.find((c) => c.trim().startsWith("token="));
        if (tokenCookie) token = tokenCookie.split("=")[1];
      }
      if (!token) {
        return next(new Error("Authentication required"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type && decoded.type !== "access") {
        return next(new Error("Invalid token type"));
      }
      socket.verifiedUserId = decoded.id;
      next();
    } catch (err) {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id, "user:", socket.verifiedUserId);
    socket.emit("socket_connected", { userId: socket.verifiedUserId });

    socket.on("register_user", () => {
      const userId = socket.verifiedUserId;
      if (!userId) return;
      socket.userId = userId;
      addOnlineSocket(userId, socket.id);
      io.emit("online_users", Array.from(onlineUsers.keys()));
      flushMessageQueue(userId, io);
    });

    socket.on("send_message", (message) => {
      if (!socket.userId) return;
      const receiverId = message.receiver;
      if (!receiverId) return;
      if (isOnline(receiverId)) {
        getSocketIds(receiverId).forEach((sid) => io.to(sid).emit("receive_message", message));
      } else {
        if (!messageQueue.has(receiverId)) messageQueue.set(receiverId, []);
        messageQueue.get(receiverId).push(message);
      }
      clearTypingTimer(socket.userId);
      getSocketIds(message.sender).forEach((sid) => {
        if (sid !== socket.id) io.to(sid).emit("receive_message", message);
      });
    });

    socket.on("delete_message", async ({ messageId, chatId, senderId }) => {
      if (!socket.userId) return;
      try {
        await Message.findByIdAndUpdate(messageId, { isDeleted: true });
      } catch {}
      const broadcast = (sid) => io.to(sid).emit("message_deleted", { messageId, chatId });
      if (senderId) getSocketIds(senderId).forEach(broadcast);
      const chat = await require("../models/Chat").findById(chatId).catch(() => null);
      if (chat) {
        chat.users.forEach((uid) => {
          if (uid.toString() !== socket.userId) getSocketIds(uid.toString()).forEach(broadcast);
        });
      }
    });

    socket.on("edit_message", async ({ messageId, text, chatId, senderId }) => {
      if (!socket.userId) return;
      try {
        await Message.findByIdAndUpdate(messageId, { content: text, edited: true });
      } catch {}
      const broadcast = (sid) => io.to(sid).emit("message_edited", { messageId, text, chatId });
      if (senderId) getSocketIds(senderId).forEach(broadcast);
      const chat = await require("../models/Chat").findById(chatId).catch(() => null);
      if (chat) {
        chat.users.forEach((uid) => {
          if (uid.toString() !== socket.userId) getSocketIds(uid.toString()).forEach(broadcast);
        });
      }
    });

    socket.on("message_reacted", ({ messageId, chatId, emoji, remove }) => {
      if (!socket.userId) return;
      const userId = socket.userId;
      Message.findById(messageId).then((msg) => {
        if (!msg) return;
        if (remove) {
          msg.reactions = (msg.reactions || []).filter(
            (r) => !(r.emoji === emoji && r.user.toString() === userId)
          );
        } else {
          const existing = (msg.reactions || []).findIndex(
            (r) => r.emoji === emoji && r.user.toString() === userId
          );
          if (existing > -1) msg.reactions.splice(existing, 1);
          else msg.reactions.push({ user: userId, emoji });
        }
        msg.save().catch(() => {});
      }).catch(() => {});
      require("../models/Chat").findById(chatId).then((doc) => {
        if (doc) {
          doc.users.forEach((uid) => {
            if (uid.toString() !== userId)
              getSocketIds(uid.toString()).forEach((sid) => io.to(sid).emit("message_reacted", { messageId, emoji, userId, remove }));
          });
        }
      }).catch(() => {});
    });

    socket.on("message_delivered", async ({ messageId, senderId }) => {
      if (!socket.userId) return;
      try {
        await Message.findByIdAndUpdate(messageId, { status: "delivered" });
      } catch (err) { console.error("message_delivered error:", err.message); }
      getSocketIds(senderId).forEach((sid) => io.to(sid).emit("message_status_updated", { messageId, status: "delivered" }));
    });

    socket.on("mark_as_read", async ({ chatId, senderId }) => {
      if (!socket.userId) return;
      try {
        await Message.updateMany(
          { chat: chatId, sender: { $ne: socket.userId }, status: { $ne: "read" } },
          { status: "read" }
        );
      } catch (err) { console.error("mark_as_read error:", err.message); }
      getSocketIds(senderId).forEach((sid) => io.to(sid).emit("messages_read", { chatId, readBy: socket.userId }));
    });

    socket.on("typing", (data) => {
      if (!socket.userId || !data.receiver) return;
      getSocketIds(data.receiver).forEach((sid) => io.to(sid).emit("typing", { sender: socket.userId }));
      clearTypingTimer(socket.userId);
      const timeout = setTimeout(() => {
        getSocketIds(data.receiver).forEach((sid) => io.to(sid).emit("stop_typing", { sender: socket.userId }));
        typingTimers.delete(socket.userId);
      }, TYPING_AUTO_CLEAR_MS);
      typingTimers.set(socket.userId, { receiver: data.receiver, timeout });
    });

    socket.on("stop_typing", (data) => {
      if (!socket.userId || !data.receiver) return;
      getSocketIds(data.receiver).forEach((sid) => io.to(sid).emit("stop_typing", { sender: socket.userId }));
      clearTypingTimer(socket.userId);
    });

    // WebRTC Calling
    socket.on("call_user", (data) => {
      if (!socket.userId) return;
      const { receiverId, callType } = data;
      const callerId = socket.userId;
      const callerSocketIds = getSocketIds(callerId);
      const receiverSocketIds = getSocketIds(receiverId);
      if (receiverSocketIds.length === 0) {
        callerSocketIds.forEach((sid) => io.to(sid).emit("call_failed", { reason: "User is offline" }));
        return;
      }
      callerSocketIds.forEach((sid) => io.to(sid).emit("call_ringing", { receiverId }));
      receiverSocketIds.forEach((sid) => io.to(sid).emit("incoming_call", { callerId, callType, callerSocketId: socket.id }));
    });

    socket.on("accept_call", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.callerId).forEach((sid) => io.to(sid).emit("call_accepted", { accepterSocketId: socket.id }));
    });

    socket.on("reject_call", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.callerId).forEach((sid) => io.to(sid).emit("call_rejected", { reason: "Busy" }));
    });

    socket.on("end_call", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.targetId).forEach((sid) => io.to(sid).emit("call_ended", { endedBy: socket.userId }));
    });

    socket.on("ice_candidate", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.targetId).forEach((sid) => io.to(sid).emit("ice_candidate", { candidate: data.candidate, from: socket.id }));
    });

    socket.on("offer", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.targetId).forEach((sid) => io.to(sid).emit("offer", { sdp: data.sdp, from: socket.id }));
    });

    socket.on("answer", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.targetId).forEach((sid) => io.to(sid).emit("answer", { sdp: data.sdp, from: socket.id }));
    });

    socket.on("toggle_mic", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.targetId).forEach((sid) => io.to(sid).emit("mic_toggled", { muted: data.muted, by: socket.userId }));
    });

    socket.on("toggle_camera", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.targetId).forEach((sid) => io.to(sid).emit("camera_toggled", { enabled: data.enabled, by: socket.userId }));
    });

    socket.on("screen_share", (data) => {
      if (!socket.userId) return;
      getSocketIds(data.targetId).forEach((sid) => io.to(sid).emit("screen_share", { sharing: data.sharing, by: socket.userId }));
    });

    socket.on("disconnect", () => {
      const userId = socket.userId;
      if (userId) {
        removeOnlineSocket(userId, socket.id);
        if (!isOnline(userId)) {
          const entry = typingTimers.get(userId);
          if (entry) {
            getSocketIds(entry.receiver).forEach((sid) => io.to(sid).emit("stop_typing", { sender: userId }));
          }
          clearTypingTimer(userId);
        }
      }
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });
  });

  return io;
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

module.exports = initSocketServer;
module.exports.getOnlineUserIds = getOnlineUserIds;
