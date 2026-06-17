// app/actions/auth.ts
'use server';

import { authClient } from "@/lib/auth-client";
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email et mot de passe requis' };
  }

  try {
    const { error } = await authClient.signIn.email({
      email: email,
      password: password,
      callbackURL: "/dashboard",
      rememberMe: false
    });

    if (error) {
      return { error: error.message };
    }

    redirect('/dashboard');
  } catch (err) {
    return { error: 'Une erreur est survenue' };
  }
}