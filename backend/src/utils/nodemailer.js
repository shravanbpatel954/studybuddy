const nodemailer = require('nodemailer')

async function sendResetEmail(to, resetUrl){
    // create transporter using env vars
  
    const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - StudyBuddy</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0d1117 0%, #161b22 100%); min-height: 100vh; padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(75, 139, 255, 0.08) 0%, rgba(123, 92, 255, 0.08) 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); border: 1px solid rgba(75, 139, 255, 0.2);">
            <tr>
                <td style="padding: 0;">
                    <!-- Header with gradient -->
                    <div style="background: linear-gradient(135deg, #4B8BFF 0%, #7B5CFF 100%); padding: 32px 24px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);">
                            🔐 Password Reset
                        </h1>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px 32px; background: #0d1117;">
                        <p style="margin: 0 0 20px 0; color: #E6EDF3; font-size: 16px; line-height: 1.6;">
                            Hello,
                        </p>
                        <p style="margin: 0 0 24px 0; color: #C9D1D9; font-size: 15px; line-height: 1.6;">
                            We received a request to reset your password for your StudyBuddy account. Click the button below to create a new password.
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0;">
                            <tr>
                                <td align="center" style="padding: 0;">
                                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #4B8BFF 0%, #7B5CFF 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 16px rgba(75, 139, 255, 0.4); transition: all 0.3s ease; letter-spacing: 0.3px;">
                                        Reset Password
                                    </a>
                                </td>
                            </tr>
                        </table>
                        
                        <!-- Alternative link -->
                        <div style="margin: 24px 0; padding: 16px; background: rgba(75, 139, 255, 0.05); border-radius: 8px; border-left: 3px solid #4B8BFF;">
                            <p style="margin: 0 0 8px 0; color: #8B949E; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                Or copy this link:
                            </p>
                            <p style="margin: 0; word-break: break-all;">
                                <a href="${resetUrl}" style="color: #4B8BFF; text-decoration: none; font-size: 13px; font-family: 'Courier New', monospace;">
                                    ${resetUrl}
                                </a>
                            </p>
                        </div>
                        
                        <!-- Security notice -->
                        <div style="margin-top: 32px; padding: 16px; background: rgba(255, 193, 7, 0.1); border-radius: 8px; border-left: 3px solid #FFC107;">
                            <p style="margin: 0 0 8px 0; color: #FFC107; font-size: 14px; font-weight: 600;">
                                ⏰ Important
                            </p>
                            <ul style="margin: 0; padding-left: 20px; color: #C9D1D9; font-size: 13px; line-height: 1.8;">
                                <li>This link will expire in <strong style="color: #E6EDF3;">1 hour</strong></li>
                                <li>If you didn't request this, you can safely ignore this email</li>
                                <li>Your password will not change until you click the link above</li>
                            </ul>
                        </div>
                        
                        <!-- Footer text -->
                        <p style="margin: 32px 0 0 0; color: #8B949E; font-size: 13px; line-height: 1.6; text-align: center;">
                            Stay secure,<br>
                            <strong style="color: #4B8BFF;">The StudyBuddy Team</strong>
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="padding: 24px 32px; background: rgba(75, 139, 255, 0.03); border-top: 1px solid rgba(75, 139, 255, 0.1); text-align: center;">
                        <p style="margin: 0 0 8px 0; color: #8B949E; font-size: 12px;">
                            © ${new Date().getFullYear()} StudyBuddy. All rights reserved.
                        </p>
                        <p style="margin: 0; color: #6E7681; font-size: 11px;">
                            This is an automated email. Please do not reply to this message.
                        </p>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: '🔐 Reset Your StudyBuddy Password',
        html
    })
}

module.exports = { sendResetEmail }
