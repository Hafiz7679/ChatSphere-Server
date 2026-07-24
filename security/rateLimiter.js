const rateLimit = require("express-rate-limit");
const { logRateLimitEvent } = require("./securityLogger");

const createLimiter = (options) => {
  const limiter = rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: options.customMessage || "Too many requests, please try again later",
    },
    handler: (req, res, next, opts) => {
      logRateLimitEvent(req.path, req.ip, opts.windowMs);
      res.status(429).json(opts.message);
    },
    ...options,
    ...(process.env.NODE_ENV === "test" ? { max: 999999 } : {}),
  });
  return limiter;
};

const generalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  customMessage: "Too many requests, please slow down",
});

const strictLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  customMessage: "Too many requests, please slow down",
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  customMessage: "Too many login attempts. Please try again after 15 minutes.",
  skipSuccessfulRequests: false,
});

const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  customMessage: "Too many registration attempts from this IP. Please try again later.",
});

const forgotPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  customMessage: "Too many password reset requests. Please try again later.",
});

const resetPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  customMessage: "Too many reset attempts. Please try again later.",
});

const uploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  customMessage: "Too many upload requests. Please slow down.",
});

const chatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  customMessage: "Too many chat requests. Please slow down.",
});

const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  customMessage: "Too many search requests. Please slow down.",
});

const adminLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  customMessage: "Too many admin requests. Please slow down.",
});

const emailVerificationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  customMessage: "Too many verification requests. Please try again later.",
});

module.exports = {
  generalLimiter,
  strictLimiter,
  authLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  uploadLimiter,
  chatLimiter,
  searchLimiter,
  adminLimiter,
  emailVerificationLimiter,
};
