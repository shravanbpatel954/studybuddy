import nodemailer from "nodemailer";

export const sendPasswordResetEmail = async (email, resetLink) => {
    const transporter = nodemailer.createTransport({
        service: "gmail", // You can use other services as well like SendGrid or Mailgun
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: email,
        subject: "Password Reset Request",
        text: `To reset your password, click the following link: ${resetLink}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Password reset email sent successfully");
    } catch (error) {
        console.log("Error sending email: ", error);
    }
};
