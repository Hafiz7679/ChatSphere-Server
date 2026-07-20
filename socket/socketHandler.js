const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

const onlineUsers = new Map();
const typingTimers = new Map();
const TYPING_AUTO_CLEAR_MS = 3000;

function addOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
}

function removeOnlineSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
  }
}

function isOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

function getSocketIds(userId) {
  return onlineUsers.has(userId) ? Array.from(onlineUsers.get(userId)) : [];
}

function clearTypingTimer(userId) {
  const entry = typingTimers.get(userId);
  if (entry) {
    clearTimeout(entry.timeout);
    typingTimers.delete(userId);
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
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.verifiedUserId = decoded.id;
      }
      next();
    } catch {
      next();
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket Connected:", socket.id);

    // ---- Presence ----
    socket.on("register_user", (clientSuppliedUserId) => {
      const userId = socket.verifiedUserId || clientSuppliedUserId;
      if (!userId) return;
      socket.userId = userId;
      addOnlineSocket(userId, socket.id);
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });

    // ---- Messages ----
    socket.on("send_message", (message) => {
      const receiverId = message.receiver;
      // Send to the receiver
      if (receiverId) {
        getSocketIds(receiverId).forEach((sid) => {
          io.to(sid).emit("receive_message", message);
        });
      }
      // Send to other tabs of the sender
      if (socket.userId) {
        clearTypingTimer(socket.userId);
        getSocketIds(message.sender).forEach((sid) => {
          if (sid !== socket.id) io.to(sid).emit("receive_message", message);
        });
      }
    });

    socket.on("delete_message", async ({ messageId, chatId, senderId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { isDeleted: true });
      } catch {}
      const broadcast = (sid) =>
        io.to(sid).emit("message_deleted", { messageId, chatId });
      if (senderId) getSocketIds(senderId).forEach(broadcast);
      const chat = await require("../models/Chat").findById(chatId).catch(() => null);
      if (chat) {
        chat.users.forEach((uid) => {
          if (uid.toString() !== socket.userId)
            getSocketIds(uid.toString()).forEach(broadcast);
        });
      }
    });

    socket.on("edit_message", async ({ messageId, text, chatId, senderId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { content: text });
      } catch {}
      const broadcast = (sid) =>
        io.to(sid).emit("message_edited", { messageId, text, chatId });
      if (senderId) getSocketIds(senderId).forEach(broadcast);
      const chat = await require("../models/Chat").findById(chatId).catch(() => null);
      if (chat) {
        chat.users.forEach((uid) => {
          if (uid.toString() !== socket.userId)
            getSocketIds(uid.toString()).forEach(broadcast);
        });
      }
    });

    socket.on("message_reacted", ({ messageId, chatId, emoji, remove, senderId }) => {
      const broadcast = (sid) =>
        io.to(sid).emit("message_reacted", { messageId, emoji, userId: socket.userId, remove });
      if (senderId) getSocketIds(senderId).forEach(broadcast);
      require("../models/Chat").findById(chatId).then((doc) => {
        if (doc) {
          doc.users.forEach((uid) => {
            if (uid.toString() !== socket.userId)
              getSocketIds(uid.toString()).forEach(broadcast);
          });
        }
      }).catch(() => {});
    });

    socket.on("message_delivered", async ({ messageId, senderId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { status: "delivered" });
      } catch (err) {
        console.error("message_delivered error:", err.message);
      }
      getSocketIds(senderId).forEach((sid) => {
        io.to(sid).emit("message_status_updated", { messageId, status: "delivered" });
      });
    });

    socket.on("mark_as_read", async ({ chatId, senderId }) => {
      try {
        await Message.updateMany(
          { chat: chatId, sender: { $ne: socket.userId }, status: { $ne: "read" } },
          { status: "read" }
        );
      } catch (err) {
        console.error("mark_as_read error:", err.message);
      }
      getSocketIds(senderId).forEach((sid) => {
        io.to(sid).emit("messages_read", { chatId, readBy: socket.userId });
      });
    });

    // ---- Typing ----
    socket.on("typing", (data) => {
      const senderId = socket.userId || data.sender;
      getSocketIds(data.receiver).forEach((sid) =>
        io.to(sid).emit("typing", { sender: senderId })
      );
      clearTypingTimer(senderId);
      const timeout = setTimeout(() => {
        getSocketIds(data.receiver).forEach((sid) =>
          io.to(sid).emit("stop_typing", { sender: senderId })
        );
        typingTimers.delete(senderId);
      }, TYPING_AUTO_CLEAR_MS);
      typingTimers.set(senderId, { to: data.receiver, timeout });
    });

    socket.on("stop_typing", (data) => {
      const senderId = socket.userId || data.sender;
      getSocketIds(data.receiver).forEach((sid) =>
        io.to(sid).emit("stop_typing", { sender: senderId })
      );
      clearTypingTimer(senderId);
    });

    // ---- WebRTC Calling ----
    socket.on("call_user", (data) => {
      const { receiverId, callType } = data; // callType: "audio" | "video"
      const callerId = socket.userId || data.callerId;
      const callerSocketIds = getSocketIds(callerId);
      const receiverSocketIds = getSocketIds(receiverId);

      if (receiverSocketIds.length === 0) {
        callerSocketIds.forEach((sid) =>
          io.to(sid).emit("call_failed", { reason: "User is offline" })
        );
        return;
      }

      // Notify caller that we're ringing
      callerSocketIds.forEach((sid) =>
        io.to(sid).emit("call_ringing", { receiverId })
      );

      // Notify receiver of incoming call
      receiverSocketIds.forEach((sid) =>
        io.to(sid).emit("incoming_call", {
          callerId,
          callType,
          callerSocketId: socket.id,
        })
      );
    });

    socket.on("accept_call", (data) => {
      const { callerId } = data;
      getSocketIds(callerId).forEach((sid) => {
        io.to(sid).emit("call_accepted", {
          accepterSocketId: socket.id,
        });
      });
    });

    socket.on("reject_call", (data) => {
      const { callerId } = data;
      getSocketIds(callerId).forEach((sid) => {
        io.to(sid).emit("call_rejected", { reason: "Busy" });
      });
    });

    socket.on("end_call", (data) => {
      const { targetId } = data;
      getSocketIds(targetId).forEach((sid) => {
        io.to(sid).emit("call_ended", { endedBy: socket.userId });
      });
    });

    socket.on("ice_candidate", (data) => {
      const { targetId, candidate } = data;
      getSocketIds(targetId).forEach((sid) => {
        io.to(sid).emit("ice_candidate", { candidate, from: socket.id });
      });
    });

    socket.on("offer", (data) => {
      const { targetId, sdp } = data;
      getSocketIds(targetId).forEach((sid) => {
        io.to(sid).emit("offer", { sdp, from: socket.id });
      });
    });

    socket.on("answer", (data) => {
      const { targetId, sdp } = data;
      getSocketIds(targetId).forEach((sid) => {
        io.to(sid).emit("answer", { sdp, from: socket.id });
      });
    });

    socket.on("toggle_mic", (data) => {
      const { targetId, muted } = data;
      getSocketIds(targetId).forEach((sid) => {
        io.to(sid).emit("mic_toggled", { muted, by: socket.userId });
      });
    });

    socket.on("toggle_camera", (data) => {
      const { targetId, enabled } = data;
      getSocketIds(targetId).forEach((sid) => {
        io.to(sid).emit("camera_toggled", { enabled, by: socket.userId });
      });
    });

    socket.on("screen_share", (data) => {
      const { targetId, sharing } = data;
      getSocketIds(targetId).forEach((sid) => {
        io.to(sid).emit("screen_share", { sharing, by: socket.userId });
      });
    });

    // ---- Disconnect ----
    socket.on("disconnect", () => {
      console.log("🔴 Socket Disconnected:", socket.id);
      const userId = socket.userId;
      if (userId) {
        removeOnlineSocket(userId, socket.id);
        if (!isOnline(userId)) {
          const entry = typingTimers.get(userId);
          if (entry) {
            getSocketIds(entry.to).forEach((sid) =>
              io.to(sid).emit("stop_typing", { sender: userId })
            );
          }
          clearTypingTimer(userId);
        }
      }
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });
  });

  return io;
}

module.exports = initSocketServer;
