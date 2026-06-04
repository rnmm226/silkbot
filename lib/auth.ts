// lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  basePath: "/api/auth",
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,  // ⚠️ Important : doit être true
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
    async signIn({ user, account, profile }) {
      console.log("Utilisateur connecté:", user.email);
      return true;
    },
    async redirect({ url, baseUrl }) {
      return `${baseUrl}/dashboard`;
    },
  },
});