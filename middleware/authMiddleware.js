const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { logInvalidToken } = require("../security/securityLogger");

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type && decoded.type !== "access") {
        logInvalidToken("access", "Wrong token type used", req.ip);
        return res.status(401).json({
          success: false,
          message: "Invalid token type.",
        });
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please log in again.",
          expired: true,
        });
      }
      logInvalidToken("access", err.message, req.ip);
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    if (process.env.NODE_ENV === "development" && decoded.id === "dev-admin") {
      req.user = decoded;
      req.userDoc = { _id: "dev-admin", role: "admin", isSuspended: false, name: "Admin", email: "abdulhafizsk8927@gmail.com" };
      return next();
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      logInvalidToken("access", "User no longer exists", req.ip);
      return res.status(401).json({
        success: false,
        message: "Account no longer exists.",
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Account suspended. Contact support.",
      });
    }

    req.user = decoded;
    req.userDoc = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type && decoded.type !== "access") {
        return next();
      }
      const user = await User.findById(decoded.id).select("-password");
      if (user && !user.isSuspended) {
        req.user = decoded;
        req.userDoc = user;
      }
    }
  } catch {
    // Auth is optional, continue without user
  }
  next();
};

const protectAdmin = async (req, res, next) => {
  try {
    await protect(req, res, () => {
      if (!req.userDoc || req.userDoc.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required.",
        });
      }
      next();
    });
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }
};

module.exports = protect;
module.exports.protect = protect;
module.exports.protectAdmin = protectAdmin;
module.exports.optionalAuth = optionalAuth;
