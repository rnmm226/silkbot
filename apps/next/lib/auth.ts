// lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

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
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  callbacks: {
    // CORRECTION 1, 3, 4, 5: Typer les paramètres et ignorer ceux non utilisés
    async signIn({ user, account, profile }: SignInParams) {
      // Utiliser _ pour les paramètres non utilisés ou ne pas les déstructurer
      console.log("Utilisateur connecté:", user.email);
      return true;
    },
    // CORRECTION 2: Typer les paramètres et ignorer 'url'
    async redirect({ url: _url, baseUrl }: RedirectParams) {
      // Le paramètre 'url' est préfixé avec _ pour indiquer qu'il n'est pas utilisé
      return `${baseUrl}/dashboard`;
    },
  },
});