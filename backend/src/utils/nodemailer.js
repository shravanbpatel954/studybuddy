const nodemailer = require("nodemailer");

async function sendResetEmail(to, resetUrl) {
  try {
    console.log("📨 Preparing to send email to:", to);

    // Gmail-compatible transporter (Best for Render)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER, // Your Gmail
        pass: process.env.SMTP_PASS, // App password (16 character)
      },
    });

    // Verify connection (shows in Render logs)
    await transporter.verify();

    const html = `
      <h2>Password Reset - StudyBuddy</h2>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}" 
         style="display:inline-block;padding:12px 24px;background:#4B8BFF;color:white;
         border-radius:8px;text-decoration:none;">
         Reset Password
      </a>
      <p>If the button does not work, copy this link:</p>
      <p>${resetUrl}</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "🔐 Reset Your StudyBuddy Password",
      html,
    });

    console.log("✅ Email successfully sent to:", to);
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    throw err;
  }
}

module.exports = { sendResetEmail };
