"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) { setError(error.message || "Erreur lors de la connexion"); }
      else if (data) { router.push("/dashboard"); }
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
    } catch {
      setError("Erreur lors de la connexion avec Google");
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border shadow-md overflow-hidden animate-slideUp">
        {/* accent bar */}
        <div className="h-[3px] w-full bg-primary" />

        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="font-serif text-2xl font-bold text-foreground">
            Bienvenue
          </CardTitle>
          <CardDescription className="text-muted-foreground font-light">
            Connectez-vous à votre compte
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {/* Google */}
              <Field className="animate-fadeUp [animation-delay:200ms] opacity-0 [animation-fill-mode:forwards]">
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full border-border hover:bg-muted hover:-translate-y-px active:scale-95 transition-all duration-150 font-normal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-2 shrink-0">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
                  </svg>
                  Continuer avec Google
                </Button>
              </Field>

              <FieldSeparator className="animate-fadeIn [animation-delay:300ms] opacity-0 [animation-fill-mode:forwards] *:data-[slot=field-separator-content]:bg-card *:data-[slot=field-separator-content]:text-muted-foreground *:data-[slot=field-separator-content]:text-xs">
                ou continuer avec email
              </FieldSeparator>

              {error && (
                <div className="text-destructive-foreground text-sm text-center p-2 bg-destructive/10 border border-destructive/20 rounded-lg animate-fadeIn">
                  {error}
                </div>
              )}

              <Field className="animate-fadeUp [animation-delay:350ms] opacity-0 [animation-fill-mode:forwards]">
                <FieldLabel htmlFor="email" className="font-medium text-sm text-foreground">
                  Email
                </FieldLabel>
                <Input
                  id="email" type="email" placeholder="m@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required disabled={loading}
                  className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-150"
                />
              </Field>

              <Field className="animate-fadeUp [animation-delay:420ms] opacity-0 [animation-fill-mode:forwards]">
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel htmlFor="password" className="font-medium text-sm text-foreground">
                    Mot de passe
                  </FieldLabel>
                  <a href="/forgot-password" className="text-xs text-primary hover:underline underline-offset-4 transition-colors">
                    Mot de passe oublié ?
                  </a>
                </div>
                <Input
                  id="password" type="password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required disabled={loading}
                  className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-150"
                />
              </Field>

              <Field className="animate-fadeUp [animation-delay:490ms] opacity-0 [animation-fill-mode:forwards]">
                <Button
                  type="submit" disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-px active:scale-95 transition-all duration-150 font-medium shadow-sm"
                >
                  {loading ? "Connexion..." : "Connexion"}
                </Button>
                <FieldDescription className="text-center text-sm text-muted-foreground font-light mt-2">
                  Pas encore de compte ?{" "}
                  <a href="/register" className="text-primary font-medium hover:underline underline-offset-4">
                    Inscription
                  </a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center text-xs text-muted-foreground font-light animate-fadeIn [animation-delay:600ms] opacity-0 [animation-fill-mode:forwards]">
        En continuant, vous acceptez nos{" "}
        <a href="#" className="text-primary hover:underline underline-offset-4">Conditions d&apos;utilisation</a>{" "}
        et notre{" "}
        <a href="#" className="text-primary hover:underline underline-offset-4">Politique de confidentialité</a>.
      </FieldDescription>
    </div>
  );
}