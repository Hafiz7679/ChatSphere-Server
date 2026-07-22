const jwt = require("jsonwebtoken");
const User = require("../models/User");

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
        message: "No token found. Please log in to continue.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired. Please log in again.",
          expired: true,
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid token. Authentication failed.",
      });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User belonging to this token no longer exists.",
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Contact support.",
      });
    }

    req.user = decoded;
    req.userDoc = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed. Please try again.",
    });
  }
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
