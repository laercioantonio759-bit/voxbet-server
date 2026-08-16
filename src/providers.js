const nodemailer = require("nodemailer");
const { id, now } = require("./utils");

const paymentProvider = {
  async createDeposit({ userId, amount }) {
    return {
      provider: "MOCK_PAYMENT",
      externalId: id("pay"),
      status: "COMPLETED",
      userId,
      amount,
      currency: "AOA",
      createdAt: now()
    };
  },

  async createWithdrawal({ userId, amount, destination }) {
    return {
      provider: "MOCK_PAYMENT",
      externalId: id("wd"),
      status: "COMPLETED",
      userId,
      amount,
      destination,
      currency: "AOA",
      createdAt: now()
    };
  }
};

const kycProvider = {
  async verify({ userId }) {
    return {
      provider: "MOCK_KYC",
      externalId: id("kyc"),
      userId,
      status: "VERIFIED",
      verifiedAt: now()
    };
  }
};

const smsProvider = {
  async send({ phone, message }) {
    console.log(`[MOCK SMS] ${phone}: ${message}`);
    return { provider: "MOCK_SMS", status: "SENT", phone };
  }
};

async function emailProvider({ to, subject, text }) {
  if (!process.env.SMTP_HOST || process.env.EMAIL_MODE === "mock") {
    console.log(`[MOCK EMAIL] ${to} | ${subject} | ${text}`);
    return { provider: "MOCK_EMAIL", status: "SENT" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text
  });

  return { provider: "SMTP", status: "SENT" };
}

module.exports = {
  paymentProvider,
  kycProvider,
  smsProvider,
  emailProvider
};