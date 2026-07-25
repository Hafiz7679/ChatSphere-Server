const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ===== STARTUP DIAGNOSTICS =====
console.log("\n=== SERVER STARTUP DIAGNOSTICS ===");
console.log("__filename:", __filename);
console.log("process.cwd():", process.cwd());
console.log("process.env.NODE_ENV:", process.env.NODE_ENV);
console.log("process.env.CLIENT_URL:", process.env.CLIENT_URL);
console.log("process.env.PORT:", process.env.PORT);
console.log("process.env.JWT_SECRET set:", !!process.env.JWT_SECRET);
console.log("process.env.MONGODB_URI set:", !!process.env.MONGODB_URI);
console.log("__dirname:", __dirname);

// Check what app resolves to
try {
  console.log("require.resolve('./app'):", require.resolve("./app"));
  console.log("require.resolve('express'):", require.resolve("express"));
} catch (e) {
  console.log("require.resolve error:", e.message);
}

const express = require("express");
console.log("Express version:", require("express/package.json").version);
// ================================

const app = require("./app");

// List registered routes after app loads
console.log("\n=== ROUTE DIAGNOSTICS ===");
try {
  if (app._router && app._router.stack) {
    let routeCount = 0;
    app._router.stack.forEach((layer) => {
      if (layer.route) {
        routeCount++;
        const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
        console.log(`  ROUTE: ${methods} ${layer.route.path}`);
      } else if (layer.name === "router" || (layer.handle && layer.handle.stack && layer.regexp)) {
        const prefix = layer.regexp.toString().slice(0, 80);
        console.log(`  ROUTER: ${layer.name || "anonymous"} @ ${prefix}`);
      }
    });
    console.log(`Total middleware layers: ${app._router.stack.length}`);
    console.log(`Total route handlers: ${routeCount}`);
  } else {
    console.log("  app._router is NOT available (Express 5 internal structure differs)");
    console.log("  app._router:", app._router);
    console.log("  app._router type:", typeof app._router);
    // Check alternative Express 5 internal structure
    if (app.lazyrouter) {
      console.log("  Express 5 lazyrouter exists");
    }
    // Force router creation
    app._router = null;
    if (app.lazyrouter) app.lazyrouter();
    console.log("  app._router after force:", app._router ? "created" : "still null");
    if (app._router && app._router.stack) {
      console.log(`  Middleware layers after force: ${app._router.stack.length}`);
    }
  }
} catch (e) {
  console.log("  Route listing error:", e.message);
}
console.log("===========================\n");
// =================================

const connectDB = require("./config/db");
const initSocketServer = require("./socket/socketHandler");
const { validateEnv } = require("./security/envCheck");

const envValid = validateEnv();
if (!envValid && process.env.NODE_ENV === "production") {
  console.log("\n⚠️  WARNING: Environment validation failed. Starting anyway for diagnostics.\n");
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
