"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import Link from "next/link";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Lien de réinitialisation invalide ou manquant");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token: token!,
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("Mot de passe réinitialisé avec succès !");
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch (err) {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Lien invalide</CardTitle>
          <CardDescription className="text-center">
            Ce lien de réinitialisation est invalide ou a expiré.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/forgot-password">
            <Button>
              Demander un nouveau lien
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (message) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Succès !</CardTitle>
          <CardDescription className="text-center">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login">
            <Button>
              Aller à la connexion
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Nouveau mot de passe</CardTitle>
        <CardDescription className="text-center">
          Choisissez un nouveau mot de passe sécurisé
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="password">Nouveau mot de passe</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="mt-1"
            />
          </Field>
          
          <Field className="mt-4">
            <FieldLabel htmlFor="confirmPassword">Confirmer le mot de passe</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              className="mt-1"
            />
          </Field>
          
          {error && (
            <div className="text-red-600 text-sm mt-4 p-2 bg-red-50 rounded">
              {error}
            </div>
          )}
          
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full mt-6"
          >
            {isLoading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
          </Button>
        </form>
        
        <div className="text-center mt-6">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <ResetPasswordContent />
      </div>
    </Suspense>
  );
}