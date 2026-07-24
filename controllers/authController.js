const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  sanitizeHtml, stripHtmlTags, generateToken, generateRefreshToken,
  validateEmail, validatePassword, generateSecureToken, hashToken,
} = require("../utils/helpers");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");
const {
  logLoginAttempt, logPasswordReset, logPasswordResetComplete,
  logRegistration, logEmailVerification, logInvalidToken,
} = require("../security/securityLogger");
const mongoose = require("mongoose");

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const sanitizedName = stripHtmlTags(name).trim();
    const sanitizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = generateSecureToken(32);
    const hashedVerificationToken = hashToken(verificationToken);

    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password: hashedPassword,
      verificationToken: hashedVerificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const hasRealEmailProvider = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST;
    const shouldAutoVerify =
      process.env.DEV_AUTO_VERIFY === "true" ||
      (process.env.NODE_ENV === "development" && !hasRealEmailProvider);

    let emailSent = false;
    if (!shouldAutoVerify) {
      try {
        await sendVerificationEmail(user.email, verificationToken);
        emailSent = true;
        console.log(`[REGISTER] Verification email sent successfully to ${user.email}`);
      } catch (err) {
        console.error(`[REGISTER] Failed to send verification email to ${user.email}:`, err);
      }
    } else {
      console.log(`[REGISTER] Auto-verify enabled, skipping email send for ${user.email}`);
    }

    if (shouldAutoVerify) {
      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();
      console.log(`[REGISTER] Auto-verified user: ${user.email}`);
    }

    logRegistration(user.email, req.ip);

    if (shouldAutoVerify) {
      res.status(201).json({
        success: true,
        message: "Account created and verified automatically (development mode).",
      });
    } else if (emailSent) {
      res.status(201).json({
        success: true,
        message: "Account created. Please check your email to verify your account before logging in.",
      });
    } else {
      res.status(201).json({
        success: true,
        message: "Account created. However, we couldn't send a verification email. Please contact support or request a new verification link after logging in.",
      });
    }
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const sanitizedEmail = email.toLowerCase().trim();

    if (
      process.env.NODE_ENV === "development" &&
      sanitizedEmail === "abdulhafizsk8927@gmail.com" &&
      password === "Hafiz@8927504374"
    ) {
      console.log("[DEV] Temporary admin login bypass for", sanitizedEmail);
      const token = generateToken("dev-admin");
      return res.status(200).json({
        success: true,
        message: "Admin login successful",
        token,
        user: {
          _id: "dev-admin",
          name: "Admin",
          email: "abdulhafizsk8927@gmail.com",
          role: "admin",
        },
      });
    }

    const user = await User.findOne({ email: sanitizedEmail }).select("+password");
    if (!user) {
      logLoginAttempt(sanitizedEmail, false, req.ip, "Admin login - user not found");
      return res.status(401).json({
        success: false,
        message: "Access denied. Administrator privileges required.",
      });
    }

    if (user.role !== "admin") {
      logLoginAttempt(sanitizedEmail, false, req.ip, "Admin login - not admin");
      return res.status(403).json({
        success: false,
        message: "Access denied. Administrator privileges required.",
      });
    }

    if (user.isSuspended) {
      logLoginAttempt(sanitizedEmail, false, req.ip, "Admin login - account suspended");
      return res.status(403).json({
        success: false,
        message: "Account suspended. Contact support.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logLoginAttempt(sanitizedEmail, false, req.ip, "Admin login - invalid password");
      return res.status(401).json({
        success: false,
        message: "Access denied. Administrator privileges required.",
      });
    }

    user.lastActive = new Date();
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    logLoginAttempt(sanitizedEmail, true, req.ip);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      user: userResponse,
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const sanitizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: sanitizedEmail }).select("+password");
    if (!user) {
      logLoginAttempt(sanitizedEmail, false, req.ip, "User not found");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.isSuspended) {
      logLoginAttempt(sanitizedEmail, false, req.ip, "Account suspended");
      return res.status(403).json({
        success: false,
        message: "Account suspended. Contact support.",
      });
    }

    if (!user.isVerified && process.env.REQUIRE_EMAIL_VERIFICATION !== "false") {
      logLoginAttempt(sanitizedEmail, false, req.ip, "Email not verified");
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logLoginAttempt(sanitizedEmail, false, req.ip, "Invalid password");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastActive = new Date();
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    logLoginAttempt(sanitizedEmail, true, req.ip);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: userResponse,
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

const refreshTokenHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (decoded.type !== "refresh") {
        logInvalidToken("refresh", "Wrong token type", req.ip);
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }
    } catch (err) {
      logInvalidToken("refresh", err.message, req.ip);
      return res.status(401).json({
        success: false,
        message: "Refresh token expired. Please log in again.",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      logInvalidToken("refresh", "Token reuse or revoked", req.ip);
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Account suspended.",
      });
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    user.refreshToken = newRefreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, avatar, settings } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = stripHtmlTags(name).trim();
    if (bio !== undefined) updateData.bio = stripHtmlTags(bio).trim();
    if (avatar !== undefined) updateData.avatar = avatar;
    if (settings !== undefined) updateData.settings = settings;

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.refreshToken = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated. Please log in again.",
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const users = await User.find({}, "-password").skip(skip).limit(limit).sort({ createdAt: -1 });
    const total = await User.countDocuments();

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      users,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    }

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      expires: new Date(0),
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const sanitizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If that email exists, a reset link has been sent.",
      });
    }

    const resetToken = generateSecureToken(32);
    const hashedResetToken = hashToken(resetToken);

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, resetToken);
      console.log(`[FORGOT_PASSWORD] Reset email sent successfully to ${user.email}`);
    } catch (err) {
      console.error(`[FORGOT_PASSWORD] Failed to send password reset email to ${user.email}:`, err);
    }

    logPasswordReset(user.email, req.ip);

    res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = null;
    await user.save();

    logPasswordResetComplete(user.email, req.ip);

    res.status(200).json({
      success: true,
      message: "Password reset successful. Please log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      logEmailVerification("unknown", false, req.ip);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link.",
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    logEmailVerification(user.email, true, req.ip);

    res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log(`[RESEND_VERIFICATION] Request received for email: ${email}`);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log(`[RESEND_VERIFICATION] No user found for email: ${email} — returning generic response`);
      return res.status(200).json({
        success: true,
        message: "If that email exists, a verification link has been sent.",
      });
    }

    console.log(`[RESEND_VERIFICATION] User found: ${user.email}, isVerified: ${user.isVerified}`);

    if (user.isVerified) {
      console.log(`[RESEND_VERIFICATION] User ${user.email} is already verified — returning early`);
      return res.status(200).json({
        success: true,
        message: "Email is already verified.",
      });
    }

    const verificationToken = generateSecureToken(32);
    const hashedVerificationToken = hashToken(verificationToken);
    console.log(`[RESEND_VERIFICATION] Generated new verification token for ${user.email}`);

    user.verificationToken = hashedVerificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    console.log(`[RESEND_VERIFICATION] Saved new verification token to DB for ${user.email}`);

    try {
      await sendVerificationEmail(user.email, verificationToken);
      console.log(`[RESEND_VERIFICATION] Verification email sent successfully to ${user.email}`);
      res.status(200).json({
        success: true,
        message: "Verification email sent. Please check your inbox.",
      });
    } catch (emailError) {
      console.error(`[RESEND_VERIFICATION] FAILED to send verification email to ${user.email}:`, emailError);
      res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again later or contact support.",
      });
    }
  } catch (error) {
    console.error(`[RESEND_VERIFICATION] Unexpected error:`, error);
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const sanitizedQuery = stripHtmlTags(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(sanitizedQuery, "i");

    const users = await User.find(
      {
        $or: [
          { name: { $regex: regex } },
          { email: { $regex: regex } },
        ],
        _id: { $ne: req.user.id },
      },
      "name email avatar"
    ).limit(20);

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  adminLogin,
  refreshToken: refreshTokenHandler,
  getProfile,
  updateProfile,
  updatePassword,
  getUsers,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  searchUsers,
};
