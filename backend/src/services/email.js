const nodemailer = require('nodemailer');

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '465');
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

async function sendAdminNotification({ request }) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const transport = getTransport();
  if (!transport || !to || !from) return;

  const subject = `New NovaForge request: ${request.projectType} (${request.websiteTier} - $${request.websitePrice})`;
  const text = [
    'New client request received:',
    '',
    `Name: ${request.name}`,
    `Email: ${request.email}`,
    `Project type: ${request.projectType}`,
    `Website tier: ${request.websiteTier}`,
    `Fixed price: $${request.websitePrice}`,
    `Preferred payment: ${request.preferredPaymentMethod || 'bank_transfer'}`,
    `Payer name: ${request.paymentSubmission?.payerFullName || '-'}`,
    `Payer bank identifier: ${request.paymentSubmission?.payerBankIdentifier || '-'}`,
    `Payer bank: ${request.paymentSubmission?.payerBankName || '-'}`,
    `Transfer reference: ${request.paymentSubmission?.transferReference || '-'}`,
    `Transfer date: ${request.paymentSubmission?.transferDate || '-'}`,
    `Payment proof URL: ${request.paymentSubmission?.paymentProofUrl || '-'}`,
    '',
    'Description:',
    request.description
  ].join('\n');

  await transport.sendMail({ to, from, subject, text });
}

async function sendPasswordResetEmail({ email, resetUrl }) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const transport = getTransport();
  if (!transport || !from) return false;

  const subject = 'Reset your NovaForge password';
  const text = [
    'We received a request to reset your NovaForge Web Studios password.',
    '',
    'Use this link to set a new password:',
    resetUrl,
    '',
    'This link expires in 30 minutes.',
    'If you did not request this, you can ignore this email.'
  ].join('\n');

  await transport.sendMail({ to: email, from, subject, text });
  return true;
}

module.exports = { sendAdminNotification, sendPasswordResetEmail };

