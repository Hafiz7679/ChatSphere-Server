const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const errorHandler = require("./middleware/errorMiddleware");
const { sanitizeObject } = require("./utils/helpers");
const {
  generalLimiter,
  authLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  uploadLimiter,
  chatLimiter,
  searchLimiter,
  adminLimiter,
  emailVerificationLimiter,
} = require("./security/rateLimiter");
const { csrfProtection, csrfTokenEndpoint, CSRF_HEADER } = require("./security/csrf");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const chatRoutes = require("./routes/chatRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production") {
  console.log(`[CORS] Allowed origins: ${allowedOrigins.join(", ") || "none"}`);
}

const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
    return callback(null, true);
  }
  if (allowedOrigins.length === 0 || allowedOrigins[0] === "http://localhost:3000") {
    console.warn(`[CORS] Blocked origin "${origin}" — CLIENT_URL not configured for production. Set CLIENT_URL on the server.`);
  }
  return callback(null, true);
};

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
      connectSrc: ["'self'", ...allowedOrigins, "https://res.cloudinary.com", "https://*.cloudinary.com"],
      mediaSrc: ["'self'", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      ...(process.env.NODE_ENV === "production" ? { upgradeInsecureRequests: true } : {}),
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  originAgentCluster: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: true,
  xDnsPrefetchControl: { allow: false },
  xDownloadOptions: true,
  xFrameOptions: { action: "deny" },
  xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
}));

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  exposedHeaders: [CSRF_HEADER, "x-ratelimit-remaining", "x-ratelimit-reset"],
}));

app.use(morgan("dev"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (key.startsWith("$")) {
        delete req.query[key];
      }
    }
  }
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }
  next();
});

app.use(csrfProtection);

app.get("/api/csrf-token", csrfTokenEndpoint);

app.use(generalLimiter);

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/admin-login", authLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/reset-password", resetPasswordLimiter);
app.use("/api/auth/verify-email", emailVerificationLimiter);
app.use("/api/auth/resend-verification", emailVerificationLimiter);
app.use("/api/upload", uploadLimiter);
app.use("/api/messages", chatLimiter);
app.use("/api/chat", chatLimiter);
app.use("/api/auth/users/search", searchLimiter);
app.use("/api/admin", adminLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/log/page-view", express.json({ limit: "1kb" }), (req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/log/error", express.json({ limit: "10kb" }), (req, res) => {
  const { message, stack, url, userId } = req.body || {};
  console.error(`[CLIENT_ERROR] ${message} | ${url} | user:${userId || "anonymous"}`);
  if (process.env.NODE_ENV === "production") {
    const fs = require("fs");
    const logDir = require("path").join(__dirname, "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      require("path").join(logDir, "client-errors.log"),
      `${new Date().toISOString()} | ${message} | ${stack?.slice(0, 200)} | ${url} | user:${userId || "anonymous"}\n`
    );
  }
  res.status(200).json({ ok: true });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
