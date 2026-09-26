const nodeMailer = require("nodemailer");
const { logError } = require("../logs");

const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpHost = process.env.SMTP_HOST;

const transporter = nodeMailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendEmail(to, subject, html) {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
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