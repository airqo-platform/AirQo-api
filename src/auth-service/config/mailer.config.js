const nodemailer = require("nodemailer");

// Transporter for immediate, high-priority emails.
// 15s timeouts accommodate TLS handshake + DNS round-trip from a container
// environment. The previous 5s window was too tight and caused frequent
// fallbacks to the queue even on healthy connections.
const directTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
  connectionTimeout: 15000, // 15 seconds
  socketTimeout: 15000, // 15 seconds
});

// Transporter for background queue processing.
// pool:true keeps one authenticated SMTP connection alive and reuses it across
// sends, preventing repeated AUTH commands that trigger Google's rate-limit
// ("Too many login attempts") when multiple pods drain the queue simultaneously.
const queueTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
  pool: true,
  maxConnections: 1,
  maxMessages: Infinity,
  connectionTimeout: 20000, // 20 seconds
  socketTimeout: 20000, // 20 seconds
});

module.exports = { directTransporter, queueTransporter };
