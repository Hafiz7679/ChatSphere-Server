const crypto = require("crypto");

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";

const csrfProtection = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!req.cookies[CSRF_COOKIE]) {
      const token = crypto.randomBytes(32).toString("hex");
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
    return next();
  }

  const exemptPaths = [
    "/api/auth/login",
    "/api/auth/admin-login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/refresh-token",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
  ];

  if (exemptPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing",
    });
  }

  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return res.status(403).json({
      success: false,
      message: "CSRF token mismatch",
    });
  }

  next();
};

const csrfTokenEndpoint = (req, res) => {
  const token = req.cookies[CSRF_COOKIE] || crypto.randomBytes(32).toString("hex");
  if (!req.cookies[CSRF_COOKIE]) {
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  res.json({ success: true, csrfToken: token });
};

module.exports = { csrfProtection, csrfTokenEndpoint, CSRF_HEADER };
