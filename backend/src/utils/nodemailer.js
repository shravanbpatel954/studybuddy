const nodemailer = require("nodemailer");
const path = require("path");

/**
 * Mask email for anti-phishing badge (e.g. sh*********@gmail.com)
 */
function maskEmail(email) {
  try {
    const [user, domain] = email.split("@");
    if (!user || !domain) return email;
    const visible = user.slice(0, 2);
    const hidden = "*".repeat(Math.max(4, user.length - 2));
    return `${visible}${hidden}@${domain}`;
  } catch {
    return email;
  }
}

/**
 * Send StudyBuddy password reset email
 * @param {string} to          - recipient email
 * @param {string} resetUrl    - password reset link
 * @param {object} context     - optional { device, location, ip, token }
 */
async function sendResetEmail(to, resetUrl, context = {}) {
  const { device, location, ip, token } = context;

  try {
    // ✅ Validate SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_HOST) {
      console.warn("⚠️ SMTP credentials not configured");

      if (process.env.NODE_ENV !== "production") {
        console.log("📧 Dev Mode → Email Skipped");
        console.log("To:", to);
        console.log("Reset URL:", resetUrl);
        return { success: true, message: "Dev mode: email skipped" };
      }

      throw new Error("SMTP not configured");
    }

    // ✅ Create Transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log("✅ SMTP configured:", process.env.SMTP_HOST);

    const safeDevice = device || "Unknown device";
    const safeLocation = location || "Unknown location";
    const safeIp = ip || "Not available";
    const safeEmail = maskEmail(to);

    // ✅ HTML TEMPLATE (with SVG background, shimmer, device/location, anti-phishing badge)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Reset Your StudyBuddy Password</title>
</head>
<body style="margin:0;padding:0;background:#050718;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#050718;padding:40px 12px;">
  <tr>
    <td align="center">

      <!-- OUTER CARD -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
        style="max-width:640px;background:#050718;border-radius:26px;overflow:hidden;
               box-shadow:0 26px 70px rgba(0,0,0,.65);
               border:1px solid rgba(148,163,184,.3);">

        <!-- INLINE SVG BACKGROUND ART (top) -->
        <tr>
          <td style="padding:0;margin:0;">
            <div style="width:100%;height:120px;background:#050718;">
              <svg width="100%" height="120" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#00e0ff" stop-opacity="0.9" />
                    <stop offset="50%" stop-color="#7f5eff" stop-opacity="0.9" />
                    <stop offset="100%" stop-color="#111827" stop-opacity="1" />
                  </linearGradient>
                  <radialGradient id="orb1" cx="10%" cy="0%" r="55%">
                    <stop offset="0%" stop-color="#22c1c3" stop-opacity="0.9" />
                    <stop offset="100%" stop-color="#050718" stop-opacity="0" />
                  </radialGradient>
                  <radialGradient id="orb2" cx="90%" cy="20%" r="60%">
                    <stop offset="0%" stop-color="#7f5eff" stop-opacity="0.85" />
                    <stop offset="100%" stop-color="#050718" stop-opacity="0" />
                  </radialGradient>
                </defs>
                <rect width="100%" height="120" fill="url(#bgGrad)" />
                <circle cx="15%" cy="15%" r="90" fill="url(#orb1)" />
                <circle cx="85%" cy="10%" r="80" fill="url(#orb2)" />
              </svg>
            </div>
          </td>
        </tr>

        <!-- HEADER WITH LOGO -->
        <tr>
          <td style="padding:0 32px 8px 32px;text-align:center;position:relative;">
            <div style="margin-top:-74px;display:inline-block;padding:12px 18px;
                        background:rgba(15,23,42,0.92);
                        border-radius:999px;
                        border:1px solid rgba(148,163,184,.6);
                        box-shadow:0 18px 38px rgba(15,23,42,.85);">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;">
                    <img src="cid:studybuddyLogo" width="40" height="40"
                         style="border-radius:12px;display:block;" alt="StudyBuddy Logo" />
                  </td>
                  <td style="text-align:left;">
                    <div style="font-size:14px;color:#9ca3af;">StudyBuddy Security</div>
                    <div style="font-size:16px;color:#e5e7eb;font-weight:700;">Password Reset</div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- ANIMATED SHIMMER BAR (SVG) -->
        <tr>
          <td style="padding:4px 32px 0 32px;">
            <svg width="100%" height="4" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="shimmerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#22c55e" stop-opacity="0.2" />
                  <stop offset="50%" stop-color="#22c55e" stop-opacity="0.9" />
                  <stop offset="100%" stop-color="#22c55e" stop-opacity="0.2" />
                </linearGradient>
              </defs>
              <rect x="-40%" y="0" width="40%" height="4" fill="url(#shimmerGrad)">
                <animate attributeName="x"
                  from="-40%" to="100%" dur="2.4s"
                  repeatCount="indefinite" />
              </rect>
            </svg>
          </td>
        </tr>

        <!-- MAIN BODY -->
        <tr>
          <td style="padding:30px 32px 26px 32px;color:#e5e7eb;background:radial-gradient(circle at top,#020617,#020617);">
            <p style="margin:0 0 14px;font-size:16px;color:#f9fafb;">Hello 👋</p>

            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#cbd5f5;">
              We received a request to reset your <strong>StudyBuddy</strong> password.
              If this was you, use the button below to continue securely.
            </p>

            <!-- CTA BUTTON -->
            <div style="text-align:center;margin:30px 0 26px;">
              <a href="${resetUrl}"
                 style="display:inline-block;padding:15px 44px;
                        background:linear-gradient(135deg,#00e0ff,#7f5eff);
                        color:#ffffff;text-decoration:none;border-radius:18px;
                        font-weight:700;font-size:16px;
                        box-shadow:0 16px 40px rgba(56,189,248,.45);">
                Reset Password
              </a>
            </div>

            <!-- BACKUP LINK -->
            <div style="background:rgba(15,23,42,0.9);
                        border-radius:14px;
                        border:1px solid rgba(56,189,248,.35);
                        padding:14px 14px 12px 14px;
                        margin-bottom:18px;">
              <p style="margin:0 0 6px;font-size:12px;color:#93c5fd;font-weight:600;
                        text-transform:uppercase;letter-spacing:.6px;">
                Or copy this link:
              </p>
              <p style="margin:0;word-break:break-all;font-size:12px;">
                <a href="${resetUrl}" style="color:#5fd6ff;text-decoration:none;">
                  ${resetUrl}
                </a>
              </p>
              ${token ? `
              <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">
                <strong>Manual token (if link doesn't work):</strong><br />
                <code style="background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;font-size:10px;word-break:break-all;display:inline-block;margin-top:4px;">${token}</code>
              </p>
              ` : ''}
            </div>

            <!-- SECURITY NOTICE -->
            <div style="background:rgba(251,191,36,0.08);
                        border-radius:14px;
                        border-left:4px solid #fbbf24;
                        padding:14px 14px 12px 16px;
                        margin-bottom:16px;">
              <p style="margin:0 0 6px;font-size:14px;color:#fde68a;font-weight:700;">
                ⏰ Important
              </p>
              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#e5e7eb;">
                <li>This link will expire in <strong>1 hour</strong>.</li>
                <li>If you didn’t request this, you can safely ignore this email.</li>
                <li>Your password will not change until you complete the reset.</li>
              </ul>
            </div>

            <!-- DEVICE & LOCATION CARD -->
            <div style="background:rgba(15,23,42,0.9);
                        border-radius:14px;
                        border:1px solid rgba(148,163,184,.7);
                        padding:14px 14px 12px 16px;
                        margin-bottom:16px;">
              <p style="margin:0 0 6px;font-size:13px;color:#a5b4fc;font-weight:600;">
                🔍 Recent reset request details
              </p>
              <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.7;color:#e5e7eb;">
                <li><strong>Account:</strong> <code style="font-family:monospace;font-size:12px;">${safeEmail}</code></li>
                <li><strong>Device:</strong> ${safeDevice}</li>
                <li><strong>Approx. location:</strong> ${safeLocation}</li>
                <li><strong>IP (approx):</strong> ${safeIp}</li>
              </ul>
            </div>

            <!-- ANTI-PHISHING BADGE -->
            <div style="background:rgba(22,163,74,0.12);
                        border-radius:14px;
                        border:1px solid rgba(34,197,94,0.65);
                        padding:14px 14px 12px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width:26px;font-size:20px;">🛡️</td>
                  <td style="font-size:12px;color:#bbf7d0;line-height:1.7;">
                    <strong style="color:#4ade80;">Verified security email</strong><br />
                    This message was sent by <strong>StudyBuddy Security</strong> only because
                    someone requested a password reset for your account.<br />
                    We will <strong>never</strong> ask you for your password or one-time code
                    in email or chat.
                  </td>
                </tr>
              </table>
            </div>

            <p style="margin:26px 0 0 0;text-align:center;font-size:12px;color:#9ca3af;">
              Stay secure,<br />
              <span style="font-weight:600;color:#e5e7eb;">The StudyBuddy Team</span>
            </p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:16px 24px;background:#020617;text-align:center;border-top:1px solid rgba(15,23,42,1);">
            <p style="margin:0;font-size:11px;color:#6b7280;">
              © ${new Date().getFullYear()} StudyBuddy. All rights reserved.
            </p>
            <p style="margin:4px 0 0;font-size:10px;color:#4b5563;">
              This is an automated email – please do not reply.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
`;

    // ✅ Sender setup
    let senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const mailOptions = {
      from: `"StudyBuddy Security" <${senderEmail}>`,
      to,
      subject: "🔐 Reset Your StudyBuddy Password",
      html,
      attachments: [
        {
          filename: "logo512.png",
          path: path.join(__dirname, "logo512.png"),
          cid: "studybuddyLogo",
          contentDisposition: "inline", // hint to show inline, not as download
        },
      ],
    };

    console.log("📧 Sending reset email to:", to);
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending reset email:", error.message);
    throw error;
  }
}

module.exports = { sendResetEmail };
