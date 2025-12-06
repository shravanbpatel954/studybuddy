const nodemailer = require("nodemailer");

async function sendResetEmail(to, resetUrl) {
  try {
    // Create SMTP transporter using Brevo
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,          // smtp-relay.brevo.com
      port: Number(process.env.SMTP_PORT),  // 587
      secure: false,                        // STARTTLS (Brevo recommended)
      auth: {
        user: process.env.SMTP_USER,        // 9d79cc001@smtp-brevo.com
        pass: process.env.SMTP_PASS         // Your Brevo SMTP key
      }
    });

    // HTML Email Template
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - StudyBuddy</title>
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#0d1117;padding:40px 20px;">
      <table width="100%" cellspacing="0" cellpadding="0" border="0" 
             style="max-width:600px;margin:0 auto;background:#161b22;border-radius:20px;overflow:hidden;
             border:1px solid rgba(75,139,255,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.4);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#4B8BFF 0%,#7B5CFF 100%);padding:30px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">
              🔐 Password Reset
            </h1>
          </td>
        </tr>

        <!-- CONTENT -->
        <tr>
          <td style="padding:35px 30px;color:#C9D1D9;font-size:15px;">
            <p>Hello,</p>
            <p>We received a request to reset your StudyBuddy password. Click the button below to create a new password.</p>

            <div style="text-align:center;margin:30px 0;">
              <a href="${resetUrl}" 
                 style="display:inline-block;padding:14px 35px;background:#4B8BFF;color:white;
                        text-decoration:none;border-radius:10px;font-size:16px;font-weight:600;
                        box-shadow:0 4px 15px rgba(0,0,0,0.3);">
                Reset Password
              </a>
            </div>

            <p>If the button doesn't work, copy and paste this link into your browser:</p>

            <p style="word-break:break-word;color:#58A6FF;">
              <a href="${resetUrl}" style="color:#58A6FF;">${resetUrl}</a>
            </p>

            <div style="margin-top:25px;padding:15px;background:rgba(255,193,7,0.1);
                        border-left:3px solid #FFC107;border-radius:6px;color:#C9D1D9;">
              <p style="margin:0;"><strong style="color:#FFC107;">⏰ Important:</strong></p>
              <ul>
                <li>This link expires in <strong>1 hour</strong>.</li>
                <li>If you did not request this, you can ignore this email.</li>
              </ul>
            </div>

            <p style="margin-top:30px;text-align:center;color:#8B949E;">
              Stay secure, <br>
              <strong style="color:#4B8BFF;">The StudyBuddy Team</strong>
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#111722;padding:20px;text-align:center;color:#777;font-size:12px;">
            © ${new Date().getFullYear()} StudyBuddy. All rights reserved.
          </td>
        </tr>

      </table>
    </body>
    </html>
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: "🔐 Reset Your StudyBuddy Password",
      html
    });

    console.log("✅ Reset email sent successfully to:", to);
    return true;

  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    throw error;
  }
}

module.exports = { sendResetEmail };

