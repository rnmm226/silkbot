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

  const inputClass = "border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-150";
  const delays = ["200ms","270ms","340ms","410ms","480ms"];

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border shadow-md overflow-hidden animate-slideUp">
        {/* accent bar */}
        <div className="h-[3px] w-full bg-primary" />

        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="font-serif text-2xl font-bold text-foreground">
            Créer un compte
          </CardTitle>
          <CardDescription className="text-muted-foreground font-light">
            Rejoignez la plateforme SilkBot
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error && (
                <div className="text-destructive-foreground text-sm text-center p-2 bg-destructive/10 border border-destructive/20 rounded-lg animate-fadeIn">
                  {error}
                </div>
              )}

              {[
                { id:"nom",             label:"Nom complet",           type:"text",     placeholder:"John Doe",          val:nom,             set:setNom },
                { id:"email",           label:"Email",                 type:"email",    placeholder:"m@example.com",     val:email,           set:setEmail },
                { id:"password",        label:"Mot de passe",          type:"password", placeholder:"••••••••",          val:password,        set:setPassword },
                { id:"confirmPassword", label:"Confirmer le mot de passe", type:"password", placeholder:"••••••••",     val:confirmPassword, set:setConfirmPassword },
              ].map(({ id, label, type, placeholder, val, set }, i) => (
                <Field
                  key={id}
                  className={`animate-fadeUp opacity-0 [animation-fill-mode:forwards]`}
                  style={{ animationDelay: delays[i] } as React.CSSProperties}
                >
                  <FieldLabel htmlFor={id} className="font-medium text-sm text-foreground">
                    {label}
                  </FieldLabel>
                  <Input
                    id={id} type={type} placeholder={placeholder}
                    value={val} onChange={(e) => set(e.target.value)}
                    required disabled={loading}
                    className={inputClass}
                  />
                </Field>
              ))}

              <Field
                className="animate-fadeUp opacity-0 [animation-fill-mode:forwards]"
                style={{ animationDelay: delays[4] } as React.CSSProperties}
              >
                <Button
                  type="submit" disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-px active:scale-95 transition-all duration-150 font-medium shadow-sm"
                >
                  {loading ? "Création en cours..." : "Créer mon compte"}
                </Button>
                <FieldDescription className="text-center text-sm text-muted-foreground font-light mt-2">
                  Déjà un compte ?{" "}
                  <Link href="/login" className="text-primary font-medium hover:underline underline-offset-4">
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