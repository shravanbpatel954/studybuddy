const nodemailer = require('nodemailer');

async function sendResetEmail(to, resetUrl) {
    
    // Gmail SMTP Transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: 465,
        secure: true, // Gmail requires secure connection on port 465
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    // FULL HTML EMAIL TEMPLATE
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - StudyBuddy</title>
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#0d1117;padding:40px 20px;">
        <table width="100%" style="max-width:600px;margin:auto;background:#161b22;border-radius:20px;overflow:hidden;border:1px solid rgba(75,139,255,0.25);box-shadow:0 8px 32px rgba(0,0,0,0.4);">
            <tr>
                <td style="background:linear-gradient(135deg,#4B8BFF,#7B5CFF);padding:30px 20px;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:26px;font-weight:700;">
                        🔐 Reset Your Password
                    </h1>
                </td>
            </tr>

            <tr>
                <td style="padding:35px 30px;background:#0d1117;color:#E6EDF3;font-size:15px;line-height:1.7;">
                    <p>Hello,</p>

                    <p>We received a request to reset your password for your StudyBuddy account.</p>

                    <p>Click the button below to create a new password:</p>

                    <div style="text-align:center;margin:30px 0;">
                        <a href="${resetUrl}" 
                           style="background:linear-gradient(135deg,#4B8BFF,#7B5CFF);padding:14px 32px;
                           color:white;border-radius:10px;text-decoration:none;font-size:16px;
                           font-weight:600;display:inline-block;">
                           Reset Password
                        </a>
                    </div>

                    <p>If the button doesn't work, copy this link:</p>

                    <div style="padding:12px;background:#11161d;border-left:3px solid #4B8BFF;border-radius:6px;">
                        <a href="${resetUrl}" style="color:#4B8BFF;word-break:break-all;font-size:13px;">
                            ${resetUrl}
                        </a>
                    </div>

                    <p style="margin-top:30px;background:rgba(255,193,7,0.1);padding:12px;border-left:3px solid #FFC107;border-radius:6px;">
                        This link expires in 1 hour. If you didn’t request this, you can safely ignore it.
                    </p>

                    <p style="margin-top:35px;text-align:center;color:#8B949E;font-size:13px;">
                        Stay secure,<br>
                        <strong style="color:#4B8BFF;">The StudyBuddy Team</strong>
                    </p>
                </td>
            </tr>

            <tr>
                <td style="background:#11161d;text-align:center;padding:20px;color:#8B949E;font-size:12px;border-top:1px solid rgba(75,139,255,0.2);">
                    © ${new Date().getFullYear()} StudyBuddy. All rights reserved.
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // Send Mail
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: "🔐 Reset Your StudyBuddy Password",
        html,
    });
}

module.exports = { sendResetEmail };
