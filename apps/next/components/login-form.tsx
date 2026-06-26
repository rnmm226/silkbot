"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldSeparator } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });
      if (error) {
        setError(error.message || "Erreur lors de la connexion");
      } else if (data) {
        const session = await authClient.getSession();
        const role = session?.data?.user?.role;
        router.push(role === "admin" ? "/admin" : "/dashboard");
      }
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/auth/redirect?force=true",
      });
    } catch {
      setError("Erreur lors de la connexion avec Google");
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card
        className="border-border shadow-md overflow-hidden animate-slideUp"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="h-[3px] w-full"
          style={{ background: "var(--primary)" }}
        />

        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle
            className="font-serif text-2xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            Bienvenue
          </CardTitle>
          <CardDescription
            className="font-light"
            style={{ color: "var(--muted-foreground)" }}
          >
            Connectez-vous à votre compte
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full"
                  style={{
                    borderColor: "var(--border)",
                    background: "transparent",
                    color: "var(--foreground)",
                    padding: "10px 16px",
                    borderRadius: "8px",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="w-4 h-4 mr-2 shrink-0"
                  >
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Continuer avec Google
                </Button>
              </Field>

              <FieldSeparator className="my-4">
                <span
                  style={{
                    background: "var(--card)",
                    color: "var(--muted-foreground)",
                    padding: "0 8px",
                    fontSize: "12px",
                  }}
                >
                  ou continuer avec email
                </span>
              </FieldSeparator>

              {error && (
                <div
                  className="text-sm text-center p-2 rounded-lg mb-4"
                  style={{
                    color: "var(--destructive-foreground)",
                    background:
                      "color-mix(in oklch, var(--destructive) 15%, transparent)",
                    border:
                      "1px solid color-mix(in oklch, var(--destructive) 25%, transparent)",
                  }}
                >
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--foreground)" }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-md border transition-all focus:outline-none focus:ring-2"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    Mot de passe
                  </label>
                  <Link
                    href="/reset-password?force=true"
                    className="text-xs transition-colors"
                    style={{ color: "var(--primary)" }}
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-md border transition-all focus:outline-none focus:ring-2"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-medium shadow-sm mt-2"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  padding: "10px 16px",
                  borderRadius: "8px",
                }}
              >
                {loading ? "Connexion..." : "Connexion"}
              </Button>

              <p
                className="text-center text-sm font-light mt-4"
                style={{ color: "var(--muted-foreground)" }}
              >
                Pas encore de compte ?{" "}
                <Link
                  href="/register?force=true"
                  className="font-medium"
                  style={{ color: "var(--primary)" }}
                >
                  Inscription
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <p
        className="text-center text-xs font-light"
        style={{ color: "var(--muted-foreground)" }}
      >
        En continuant, vous acceptez nos{" "}
        <a
          href="#"
          className="transition-colors"
          style={{ color: "var(--primary)" }}
        >
          Conditions d&apos;utilisation
        </a>{" "}
        et notre{" "}
        <a
          href="#"
          className="transition-colors"
          style={{ color: "var(--primary)" }}
        >
          Politique de confidentialité
        </a>
        .
      </p>
    </div>
  );
}
