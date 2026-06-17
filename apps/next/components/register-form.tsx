"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Field, FieldDescription, FieldGroup, FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function RegisterForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const [nom, setNom]                       = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]                   = useState("");
  const [loading, setLoading]               = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await authClient.signUp.email({ name: nom, email, password });
      if (error) { setError("Erreur lors de l'inscription"); return; }
      if (data)  { router.push("/dashboard"); }
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    borderColor: 'var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    borderRadius: '8px',
    padding: '8px 12px',
    width: '100%',
    transition: 'all 0.15s ease'
  };

  const delays = ["200ms","270ms","340ms","410ms","480ms"];

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border shadow-md overflow-hidden animate-slideUp" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        {/* accent bar */}
        <div className="h-[3px] w-full" style={{ background: 'var(--primary)' }} />

        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="font-serif text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Créer un compte
          </CardTitle>
          <CardDescription className="font-light" style={{ color: 'var(--muted-foreground)' }}>
            Rejoignez la plateforme SilkBot
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error && (
                <div className="text-sm text-center p-2 rounded-lg animate-fadeIn mb-4"
                  style={{ color: 'var(--destructive-foreground)', background: 'color-mix(in oklch, var(--destructive) 15%, transparent)', border: '1px solid color-mix(in oklch, var(--destructive) 25%, transparent)' }}>
                  {error}
                </div>
              )}

              {/* Nom complet */}
              <Field className="mb-4">
                <FieldLabel htmlFor="nom" className="font-medium text-sm mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Nom complet
                </FieldLabel>
                <Input
                  id="nom" type="text" placeholder="John Doe"
                  value={nom} onChange={(e) => setNom(e.target.value)}
                  required disabled={loading}
                  style={inputStyle}
                  className="focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </Field>

              {/* Email */}
              <Field className="mb-4">
                <FieldLabel htmlFor="email" className="font-medium text-sm mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Email
                </FieldLabel>
                <Input
                  id="email" type="email" placeholder="m@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required disabled={loading}
                  style={inputStyle}
                  className="focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </Field>

              {/* Mot de passe */}
              <Field className="mb-4">
                <FieldLabel htmlFor="password" className="font-medium text-sm mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Mot de passe
                </FieldLabel>
                <Input
                  id="password" type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required disabled={loading}
                  style={inputStyle}
                  className="focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </Field>

              {/* Confirmer mot de passe */}
              <Field className="mb-4">
                <FieldLabel htmlFor="confirmPassword" className="font-medium text-sm mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Confirmer le mot de passe
                </FieldLabel>
                <Input
                  id="confirmPassword" type="password" placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  required disabled={loading}
                  style={inputStyle}
                  className="focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </Field>

              {/* Bouton d'inscription */}
              <Field>
                <Button
                  type="submit" disabled={loading}
                  className="w-full font-medium shadow-sm mt-2"
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'var(--primary-foreground)',
                    padding: '10px 16px',
                    borderRadius: '8px'
                  }}
                >
                  {loading ? "Création en cours..." : "Créer mon compte"}
                </Button>
                <FieldDescription className="text-center text-sm font-light mt-4" style={{ color: 'var(--muted-foreground)' }}>
                  Déjà un compte ?{" "}
                  <Link href="/login" className="font-medium" style={{ color: 'var(--primary)' }}>
                    Connexion
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}