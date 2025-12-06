const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendResetEmail(to, resetUrl) {
  try {
    await resend.emails.send({
      from: "StudyBuddy <onboarding@resend.dev>",
      to,
      subject: "🔐 Reset Your Password – StudyBuddy",
      html: `
      <div style="
        background: linear-gradient(135deg, #0d1117, #161b22);
        padding: 40px 0;
        width: 100%;
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      ">

        <div style="
          max-width: 560px;
          margin: auto;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px 32px;
          border: 1px solid rgba(75,139,255,0.25);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        ">

          <!-- Header -->
          <h1 style="
            margin: 0;
            font-size: 28px;
            text-align: center;
            background: linear-gradient(135deg,#4B8BFF,#7B5CFF);
            -webkit-background-clip: text;
            color: transparent;
            font-weight: 700;
          ">
            StudyBuddy Password Reset
          </h1>

          <p style="
            color: #C9D1D9;
            font-size: 15px;
            margin-top: 24px;
            line-height: 1.6;
          ">
            You requested to reset your password for your StudyBuddy account.
            No worries — click the button below to create a new one.
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="
              display: inline-block;
              padding: 14px 36px;
              font-size: 16px;
              color: white;
              background: linear-gradient(135deg, #4B8BFF, #7B5CFF);
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              box-shadow: 0 6px 20px rgba(75,139,255,0.35);
            ">
              Reset Password →
            </a>
          </div>

          <!-- Alternate Link -->
          <p style="
            color: #8B949E;
            font-size: 13px;
            margin-top: 16px;
          ">
            If the button doesn't work, copy and paste this link into your browser:
          </p>

          <p style="
            word-break: break-all;
            color: #4B8BFF;
            font-size: 13px;
            background: rgba(75,139,255,0.1);
            padding: 12px;
            border-radius: 10px;
            border-left: 3px solid #4B8BFF;
            font-family: 'Courier New', monospace;
          ">
            ${resetUrl}
          </p>

          <!-- Security Note -->
          <div style="
            background: rgba(255,193,7,0.08);
            border-left: 3px solid #FFC107;
            padding: 14px 16px;
            margin-top: 24px;
            border-radius: 10px;
          ">
            <p style="margin: 0; font-size: 13px; color: #FFC107;">
              ⏰ This link expires in <b>1 hour</b>.
            </p>
          </div>

          <!-- Footer -->
          <p style="
            color: #6E7681;
            font-size: 12px;
            margin-top: 40px;
            text-align: center;
            line-height: 1.5;
          ">
            If you didn't request this, you can safely ignore this email.<br>
            Your password will remain unchanged.
          </p>

          <p style="
            text-align: center;
            color: #444;
            margin-top: 24px;
            font-size: 12px;
          ">
            © ${new Date().getFullYear()} StudyBuddy • Learn Smarter, Not Harder
          </p>

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
