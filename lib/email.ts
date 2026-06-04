// lib/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendResetPasswordEmail = async (email: string, token: string) => {
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    
    await transporter.sendMail({
        from: `"Mon App" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject: "Réinitialisation de votre mot de passe",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Réinitialisation du mot de passe</h2>
                <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
                <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                    Réinitialiser mon mot de passe
                </a>
                <p>Ce lien expire dans 1 heure.</p>
                <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            </div>
        `,
    });
};