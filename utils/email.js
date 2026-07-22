const nodemailer = require("nodemailer");

let transporter = null;
let transportType = null;

const ETBANNER = "=".repeat(60);

const logEtherealBanner = (previewUrl) => {
  console.log("");
  console.log(ETBANNER);
  console.log("  EMAIL PREVIEW (Ethereal Test Email)");
  console.log("  Your emails are being sent via Ethereal (test-only).");
  console.log("  To receive real emails, configure RESEND_API_KEY or SMTP in .env");
  console.log("");
  console.log(`  ${previewUrl}`);
  console.log(ETBANNER);
  console.log("");
};

const getTransporter = async () => {
  if (transporter) return { transporter, transportType };

  const useResend = process.env.RESEND_API_KEY;

  if (useResend) {
    try {
      const { Resend } = require("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      transportType = "resend";
      console.log("Email: using Resend");
      return { transporter: resend, transportType };
    } catch {
      console.warn("Email: Resend SDK not installed, falling back");
    }
  }

  if (process.env.SENDGRID_API_KEY) {
    transportType = "sendgrid";
    transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });
    await transporter.verify();
    console.log("Email: using SendGrid");
    return { transporter, transportType };
  }

  if (process.env.SMTP_HOST) {
    transportType = "smtp";
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
    console.log(`Email: using SMTP (${process.env.SMTP_HOST})`);
    return { transporter, transportType };
  }

  transportType = "ethereal";
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
  console.log("Email: using Ethereal (test-only — emails will not reach real inboxes)");
  return { transporter, transportType };
};

const sendEmail = async ({ to, subject, html }) => {
  const { transporter: t, transportType: tt } = await getTransporter();
  console.log(`[EMAIL] Sending "${subject}" to ${to} via ${tt}`);

  if (tt === "resend") {
    const { data, error } = await t.emails.send({
      from: process.env.RESEND_FROM || "ChatSphere <noreply@chatsphere.app>",
      to,
      subject,
      html,
    });
    if (error) {
      console.error(`[EMAIL] Resend API error for ${to}: ${error.message}`);
      throw new Error(error.message);
    }
    console.log(`[EMAIL] Sent via Resend to ${to}: ${data?.id}`);
    return data;
  }

  let info;
  try {
    info = await t.sendMail({
      from: `"ChatSphere" <${process.env.SMTP_USER || "noreply@chatsphere.com"}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`[EMAIL] Nodemailer send failed for ${to}:`, err);
    throw err;
  }

  console.log(`[EMAIL] Message sent to ${to}: ${info.messageId} (via ${tt})`);

  if (tt === "ethereal" && info.messageId) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) logEtherealBanner(previewUrl);
  }

  return { info, transportType: tt };
};

const buildEmailTemplate = (title, content, buttonText, buttonLink) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b1020;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding:32px;background:#1a1f3a;border-radius:16px;border:1px solid rgba(124,58,237,0.15);">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:48px;height:48px;margin:0 auto 12px;background:linear-gradient(135deg,#8b5cf6,#f59e0b);border-radius:12px;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-size:24px;font-weight:bold;">C</span>
            </div>
            <h1 style="margin:0;font-size:22px;color:#f1f5f9;font-weight:700;">${title}</h1>
          </div>
          <div style="color:#94a3b8;font-size:14px;line-height:1.7;">${content}</div>
          ${buttonText && buttonLink ? `
          <div style="text-align:center;margin:24px 0;">
            <a href="${buttonLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#8b5cf6,#3b82f6);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${buttonText}</a>
          </div>` : ""}
          <p style="margin:16px 0 0;font-size:12px;color:#475569;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;" />
          <p style="margin:0;font-size:11px;color:#475569;text-align:center;">ChatSphere &mdash; Stay connected</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const sendVerificationEmail = async (email, verificationToken) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const verifyLink = `${clientUrl}/verify-email/${verificationToken}`;

  return sendEmail({
    to: email,
    subject: "Verify your ChatSphere email address",
    html: buildEmailTemplate(
      "Verify your email",
      `<p style="margin:0 0 16px;">Thanks for joining ChatSphere! Please confirm your email address by clicking the button below.</p>
       <p style="margin:0 0 16px;">This link will expire in <strong style="color:#f1f5f9;">24 hours</strong>.</p>`,
      "Verify Email",
      verifyLink
    ),
  });
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const resetLink = `${clientUrl}/reset-password/${resetToken}`;

  return sendEmail({
    to: email,
    subject: "Reset your ChatSphere password",
    html: buildEmailTemplate(
      "Reset your password",
      `<p style="margin:0 0 16px;">You requested a password reset for your ChatSphere account. Click the button below to set a new password.</p>
       <p style="margin:0 0 16px;">This link will expire in <strong style="color:#f1f5f9;">1 hour</strong>. If you didn't request this, you can ignore this email.</p>`,
      "Reset Password",
      resetLink
    ),
  });
};

const sendWelcomeEmail = async (email, name) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  return sendEmail({
    to: email,
    subject: "Welcome to ChatSphere!",
    html: buildEmailTemplate(
      `Welcome, ${name}!`,
      `<p style="margin:0 0 16px;">Your ChatSphere account is ready to go. Start chatting with friends, share files, and stay connected.</p>
       <p style="margin:0 0 16px;">Here are some features you'll love:</p>
       <ul style="margin:0 0 16px;padding-left:20px;color:#94a3b8;">
         <li style="margin-bottom:8px;">End-to-end encrypted messaging</li>
         <li style="margin-bottom:8px;">File and image sharing</li>
         <li style="margin-bottom:8px;">Voice and video calls</li>
         <li>Group chats</li>
       </ul>`,
      "Start Chatting",
      `${clientUrl}/login`
    ),
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail };
