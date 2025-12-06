const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendResetEmail(to, resetUrl) {
  try {
    const logoUrl = `${process.env.FRONTEND_URL}/logo192.png`;

    await resend.emails.send({
      from: "StudyBuddy <onboarding@resend.dev>",
      to,
      subject: "Reset Your Password – StudyBuddy",
      html: `
      <div style="
        width: 100%;
        padding: 0;
        margin: 0;
        background: #f5f7fb;
        font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      ">

        <div style="
          max-width: 560px;
          margin: auto;
          padding: 40px 24px;
        ">

          <!-- Card -->
          <div style="
            background: #ffffff;
            border-radius: 18px;
            padding: 36px 30px;
            border: 1px solid #e5e7eb;
          ">

            <!-- Logo + Brand -->
            <div style="text-align:center;">
              <img 
                src="${logoUrl}" 
                alt="StudyBuddy Logo" 
                width="72" 
                style="border-radius:16px; margin-bottom: 14px;"
              />
              <h2 style="
                margin: 0;
                font-size: 26px;
                font-weight: 700;
                color: #1f2937;
              ">
                StudyBuddy
              </h2>
              <p style="
                font-size: 14px;
                color: #4B8BFF;
                margin: 4px 0 0;
                letter-spacing: 0.4px;
              ">
                Learn Smarter, Not Harder
              </p>
            </div>

            <!-- Title -->
            <h3 style="
              font-size: 20px;
              margin-top: 32px;
              color: #111827;
              font-weight: 600;
            ">
              Reset Your Password
            </h3>

            <!-- Message -->
            <p style="
              font-size: 15px;
              color: #4b5563;
              line-height: 1.7;
              margin-top: 12px;
            ">
              You requested to reset your StudyBuddy password.  
              Click the button below to create a new one.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="
                padding: 12px 34px;
                background: #4B8BFF;
                border-radius: 10px;
                color: white;
                text-decoration: none;
                font-size: 15px;
                font-weight: 600;
                display: inline-block;
              ">
                Reset Password →
              </a>
            </div>

            <!-- Backup Link -->
            <p style="
              font-size: 13px;
              color: #6b7280;
              margin-top: 14px;
            ">
              Or copy and paste this link into your browser:
            </p>

            <p style="
              word-break: break-all;
              font-size: 13px;
              background: #eef4ff;
              color: #4B8BFF;
              padding: 12px;
              border-radius: 8px;
              border-left: 3px solid #4B8BFF;
              font-family: 'Courier New', monospace;
            ">
              ${resetUrl}
            </p>

            <!-- Security Note -->
            <p style="
              margin-top: 20px;
              font-size: 13px;
              color: #ef4444;
              background: #ffefef;
              padding: 12px;
              border-radius: 8px;
              border-left: 3px solid #ef4444;
            ">
              This link will expire in 1 hour.
            </p>

            <!-- Footer -->
            <p style="
              text-align: center;
              font-size: 12px;
              color: #9ca3af;
              margin-top: 32px;
            ">
              If you didn't request this, you can safely ignore the email.
            </p>

            <p style="
              text-align: center;
              font-size: 11px;
              color: #b3b8bd;
              margin-top: 12px;
            ">
              © ${new Date().getFullYear()} StudyBuddy — All rights reserved.
            </p>

          </div>
        </div>
      </div>
      `,
    });

    console.log("📧 Email sent successfully via Resend");
  } catch (err) {
    console.error("❌ Resend error:", err);
  }
}

module.exports = { sendResetEmail };
