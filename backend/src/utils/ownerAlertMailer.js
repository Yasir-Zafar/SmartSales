import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendOwnerAnomalyCountChangeEmail({ to, previousCount, currentCount }) {
  const tx = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!tx || !from || !to) return false;

  const direction = currentCount > previousCount ? 'increased' : 'decreased';
  const subject = `SmartSales anomaly count ${direction}: ${previousCount} -> ${currentCount}`;
  const text = [
    'Hello Owner,',
    '',
    `The current abnormal-drop anomaly count has ${direction}.`,
    `Previous count: ${previousCount}`,
    `Current count: ${currentCount}`,
    '',
    'This update was generated from your configured anomaly threshold.',
    '',
    'SmartSales',
  ].join('\n');

  await tx.sendMail({ from, to, subject, text });
  return true;
}
