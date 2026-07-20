const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const http = require("http");

const app = require("./app");
const connectDB = require("./config/db");
const initSocketServer = require("./socket/socketHandler");

connectDB();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

initSocketServer(server, allowedOrigins);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});