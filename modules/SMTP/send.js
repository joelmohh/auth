const nodeMailer = require("nodemailer");
const { logError } = require("../logs");

const transporter = nodeMailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendEmail(to, subject, html) {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM,
            to,
            subject,
            html
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        logError(error);
        throw new Error("Failed to send email.");
    }
}

module.exports = sendEmail;