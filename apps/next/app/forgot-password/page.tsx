"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
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
import Image from "next/image";

// ============================================
// COMPOSANTS
// ============================================

const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const [iconError, setIconError] = useState(false);
  const [textError, setTextError] = useState(false);
  
  const dimensions = {
    sm: { icon: 24, text: 70, textClass: 'text-base' },
    md: { icon: 32, text: 90, textClass: 'text-lg' },
    lg: { icon: 40, text: 110, textClass: 'text-xl' }
  };
  
  const { icon, text, textClass } = dimensions[size];
  
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-md overflow-hidden bg-primary">
        {iconError ? (
          <span className="text-sm font-bold text-primary-foreground">⚖️</span>
        ) : (
          <Image 
            src="/silkbot-logo-white.png"
            alt="SilkBot Logo"
            width={icon}
            height={icon}
            className="object-contain"
            onError={() => setIconError(true)}
          />
        )}
      </div>
      {textError ? (
        <span className={`font-serif font-semibold text-foreground ${textClass}`}>
          Silk<span className="text-primary">Bot</span>
        </span>
      ) : (
        <Image 
          src="/silkbot-black.png"
          alt="SilkBot"
          width={text}
          height={Math.round(text/3)}
          className="object-contain"
          onError={() => setTextError(true)}
        />
      )}
    </Link>
  );
};

const AccentBar = () => (
  <div className="h-[3px] w-full bg-primary" />
);

const AuthCard = ({ 
  children, 
  title, 
  description 
}: { 
  children: React.ReactNode;
  title?: string;
  description?: string;
}) => (
  <Card className="w-full max-w-md bg-card border-border">
    <AccentBar />
    <CardHeader>
      <div className="flex justify-center mb-4">
        <Logo size="md" />
      </div>
      {title && (
        <CardTitle className="text-2xl text-center text-foreground">
          {title}
        </CardTitle>
      )}
      {description && (
        <CardDescription className="text-center text-muted-foreground">
          {description}
        </CardDescription>
      )}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
  </div>
);

const LoadingState = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
    <LoadingSpinner />
  </div>
);

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

function ForgotPasswordContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("Veuillez entrer votre adresse email");
      return;
    }
    
    if (!isValidEmail(email)) {
      setError("Veuillez entrer une adresse email valide");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await authClient.requestPasswordReset({
        email: email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message || "Une erreur est survenue");
      } else {
        setMessage("Un email de réinitialisation a été envoyé à votre adresse");
        setEmail("");
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      setError("Une erreur est survenue lors de l'envoi de l'email");
      console.error("Forgot password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (message) {
    return (
      <AuthCard 
        title="Email envoyé !" 
        description="Vérifiez votre boîte de réception"
      >
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/20 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nous avons envoyé un email de réinitialisation à
            </p>
            <p className="text-sm font-medium text-foreground">{email}</p>
            <p className="text-sm text-muted-foreground">
              Cliquez sur le lien dans l&apos;email pour réinitialiser votre mot de passe.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => {
                setMessage("");
                setResendCooldown(0);
              }}
              disabled={resendCooldown > 0}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? (
                `Renvoyer dans ${resendCooldown}s`
              ) : (
                "Renvoyer l'email"
              )}
            </Button>
            
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Retour à la connexion
              </Button>
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard 
      title="Mot de passe oublié" 
      description="Entrez votre adresse email et nous vous enverrons un lien de réinitialisation"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field>
          <FieldLabel htmlFor="email" className="text-sm font-medium text-foreground">
            Adresse email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="nom@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="mt-1 border-border bg-background text-foreground placeholder:text-muted-foreground"
            autoComplete="email"
          />
        </Field>
        
        {error && (
          <div className="text-sm text-center p-3 rounded-lg bg-destructive/15 border border-destructive/25 text-destructive-foreground">
            {error}
          </div>
        )}
        
        <Button 
          type="submit" 
          disabled={isLoading || !email || !isValidEmail(email)} 
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner />
              Envoi en cours...
            </span>
          ) : (
            "Envoyer le lien de réinitialisation"
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Vous vous souvenez ?
            </span>
          </div>
        </div>

        <div className="text-center">
          <Link 
            href="/login" 
            className="text-sm transition-colors hover:underline underline-offset-4 text-primary hover:text-primary/80"
          >
            Retour à la connexion
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}

// ============================================
// PAGE
// ============================================

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden bg-background">
        <div className="pointer-events-none absolute -top-20 -left-16 w-64 h-64 rounded-full blur-[50px] animate-float bg-primary/15" />
        <div className="pointer-events-none absolute -bottom-16 -right-12 w-52 h-52 rounded-full blur-[40px] animate-float-reverse bg-primary/10" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[60px] bg-primary/5" />

        <div className="relative z-10 flex w-full max-w-sm flex-col gap-5 animate-slideUp">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <ForgotPasswordContent />
        </div>
        
        <div className="relative z-10 text-center text-xs text-muted-foreground mt-4">
          <p>© {new Date().getFullYear()} SilkBot. Tous droits réservés.</p>
        </div>
      </div>
    </Suspense>
  );
}