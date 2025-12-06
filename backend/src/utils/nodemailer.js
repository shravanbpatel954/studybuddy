import nodemailer from "nodemailer";

export const sendPasswordResetEmail = async (email, resetLink) => {

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Password Reset Request - StudyBuddy",
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the button below to reset your password:</p>
      <a href="${resetLink}"
         style="padding:10px 18px;background:#4F46E5;color:white;
                text-decoration:none;border-radius:6px;">
        Reset Password
      </a>
      <p>If you didn't request this, ignore the email.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Reset email sent to:", email);
  } catch (error) {
    console.log("❌ Email sending error:", error);
  }
};
