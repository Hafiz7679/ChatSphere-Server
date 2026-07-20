const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");

connectDB();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Store online users
const onlineUsers = new Map();

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("🟢 User Connected:", socket.id);

  // ===========================
  // Register User
  // ===========================

  socket.on("register_user", (userId) => {
    onlineUsers.set(userId, socket.id);

    console.log("Online Users:");
    console.log(onlineUsers);

    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  // ===========================
  // Send Message
  // ===========================

  socket.on("send_message", (message) => {
    const receiverSocketId = onlineUsers.get(message.receiver);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", message);
    }
  });

  // ===========================
  // Typing
  // ===========================

  socket.on("typing", (data) => {
    const receiverSocketId = onlineUsers.get(data.receiver);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", {
        sender: data.sender,
      });
    }
  });

  // ===========================
  // Stop Typing
  // ===========================

  socket.on("stop_typing", (data) => {
    const receiverSocketId = onlineUsers.get(data.receiver);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stop_typing", {
        sender: data.sender,
      });
    }
  });

  // ===========================
  // Disconnect
  // ===========================

  socket.on("disconnect", () => {
    console.log("🔴 User Disconnected:", socket.id);

    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }

    io.emit("online_users", Array.from(onlineUsers.keys()));
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});