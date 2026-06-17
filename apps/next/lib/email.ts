import nodemailer from 'nodemailer';

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  // En développement, on affiche dans la console
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 ===== EMAIL SENT (DEVELOPMENT) =====');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML: ${html}`);
    console.log('📧 ===== END EMAIL =====');
    return { success: true };
  }

  // En production, on envoie réellement
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@silkbot.com',
      to,
      subject,
      html,
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
}