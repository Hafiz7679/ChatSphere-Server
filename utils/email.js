const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.verify();
    return transporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  console.log("📧 Ethereal email:", testAccount.user);
  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  const t = await getTransporter();
  const info = await t.sendMail({
    from: `"ChatSphere" <${t.options.auth?.user || "noreply@chatsphere.com"}>`,
    to,
    subject,
    html,
  });

  if (process.env.NODE_ENV !== "production" && info.messageId) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("📧 Preview:", previewUrl);
    }
  }

  return info;
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const resetLink = `${clientUrl}/reset-password/${resetToken}`;

  return sendEmail({
    to: email,
    subject: "Password Reset - ChatSphere",
    html: `
      <div style="max-width:480px;margin:40px auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1e293b;border-radius:16px;padding:32px;color:#e2e8f0;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:48px;height:48px;margin:0 auto 12px;background:linear-gradient(135deg,#8b5cf6,#f59e0b);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-weight:bold;">C</div>
          <h1 style="margin:0;font-size:22px;color:#fff;">Reset Your Password</h1>
        </div>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#94a3b8;">You requested a password reset for your ChatSphere account. Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetLink}" style="display:block;text-align:center;padding:14px 24px;background:linear-gradient(135deg,#8b5cf6,#f59e0b);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:24px 0;">Reset Password</a>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #334155;margin:24px 0;" />
        <p style="margin:0;font-size:11px;color:#475569;text-align:center;">ChatSphere &mdash; Stay connected</p>
      </div>
    `,
  });
};

const sendVerificationEmail = async (email, verificationToken) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const verifyLink = `${clientUrl}/verify-email/${verificationToken}`;

  return sendEmail({
    to: email,
    subject: "Verify Your Email - ChatSphere",
    html: `
      <div style="max-width:480px;margin:40px auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1e293b;border-radius:16px;padding:32px;color:#e2e8f0;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:48px;height:48px;margin:0 auto 12px;background:linear-gradient(135deg,#8b5cf6,#f59e0b);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-weight:bold;">C</div>
          <h1 style="margin:0;font-size:22px;color:#fff;">Verify Your Email</h1>
        </div>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#94a3b8;">Welcome to ChatSphere! Please verify your email address by clicking the button below. This link expires in 24 hours.</p>
        <a href="${verifyLink}" style="display:block;text-align:center;padding:14px 24px;background:linear-gradient(135deg,#8b5cf6,#f59e0b);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:24px 0;">Verify Email</a>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b;">If you didn't create an account, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #334155;margin:24px 0;" />
        <p style="margin:0;font-size:11px;color:#475569;text-align:center;">ChatSphere &mdash; Stay connected</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendPasswordResetEmail, sendVerificationEmail };
