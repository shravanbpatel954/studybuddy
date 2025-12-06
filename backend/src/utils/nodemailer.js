const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendResetEmail(to, resetUrl) {
  try {
    await resend.emails.send({
      from: "StudyBuddy <onboarding@resend.dev>",
      to,
      subject: "Reset Your StudyBuddy Password",
      html: `
        <h2>Password Reset</h2>
        <p>Click below to reset:</p>
        <a href="${resetUrl}">${resetUrl}</a>
      `,
    });

    console.log("Email sent successfully via Resend");
  } catch (err) {
    console.error("Resend error:", err);
  }
}

module.exports = { sendResetEmail };
