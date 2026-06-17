import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Définir les types pour les callbacks
type SignInParams = {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
    emailVerified?: boolean;
  };
  account: {
    id: string;
    accountId: string;
    providerId: string;
    userId: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    refreshTokenExpiresAt?: Date;
    scope?: string;
    idToken?: string;
  };
  profile?: {
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
  };
};

type RedirectParams = {
  url: string;
  baseUrl: string;
};

export const auth = betterAuth({
  basePath: "/api/auth",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // Configuration du reset password
    resetPasswordTokenExpiresIn: 3600, // 1 heure en secondes
    sendResetPassword: async ({user, url, token}, request) => {
        await sendEmail({
          to: user.email,
          subject: "Réinitialisation de votre mot de passe - SilkBot",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Réinitialisation du mot de passe</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">SilkBot</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Votre assistant professionnel</p>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Réinitialisation du mot de passe</h2>
                
                <p>Bonjour,</p>
                
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte SilkBot.</p>
                
                <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${url}" 
                     style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 14px 35px; 
                            text-decoration: none; 
                            border-radius: 50px;
                            display: inline-block;
                            font-weight: 600;
                            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    Réinitialiser mon mot de passe
                  </a>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #666;">
                    <strong>🔒 Lien valable :</strong> 1 heure<br>
                    <strong>📧 Email :</strong> ${user.email}
                  </p>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.<br>
                  Votre mot de passe actuel reste valide.
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                  © ${new Date().getFullYear()} SilkBot. Tous droits réservés.<br>
                  Ce message est envoyé automatiquement, merci de ne pas y répondre.
                </p>
              </div>
            </body>
            </html>
          `,
        });
    },
    onPasswordReset: async ({ user }, request) => {
      // your logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  callbacks: {
    async signIn({ user, account, profile }: SignInParams) {
      console.log("Utilisateur connecté:", user.email);
      return true;
    },
    async redirect({ url: _url, baseUrl }: RedirectParams) {
      return `${baseUrl}/dashboard`;
    },
  },
});