const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = require("./app");
const connectDB = require("./config/db");
const initSocketServer = require("./socket/socketHandler");
const { validateEnv } = require("./security/envCheck");

if (process.env.NODE_ENV === "production") {
  validateEnv();
}

connectDB();

const PORT = process.env.PORT || 5000;
const useHttps = process.env.HTTPS === "true";

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

let server;

if (useHttps) {
  const sslPath = process.env.SSL_PATH || path.join(__dirname, "ssl");
  try {
    const privateKey = fs.readFileSync(path.join(sslPath, "privkey.pem"), "utf8");
    const certificate = fs.readFileSync(path.join(sslPath, "cert.pem"), "utf8");
    const ca = fs.readFileSync(path.join(sslPath, "chain.pem"), "utf8");
    server = https.createServer({ key: privateKey, cert: certificate, ca }, app);
    console.log("🔒 HTTPS enabled");
  } catch (err) {
    console.error("SSL certificate files not found in", sslPath);
    console.error("Falling back to HTTP. Set SSL_PATH or disable HTTPS.");
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

initSocketServer(server, allowedOrigins);

server.listen(PORT, () => {
  console.log(`ChatSphere server running on http${useHttps ? "s" : ""}://localhost:${PORT}`);
});
