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
import Image from "next/image";

// ============================================
// COMPONENTS
// ============================================

// Logo Component
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
      <div className={`flex size-${icon/8} items-center justify-center rounded-md overflow-hidden bg-primary`}>
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

// Accent Bar Component
const AccentBar = () => (
  <div className="h-[3px] w-full bg-primary" />
);

// Auth Card Component
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

// Password Strength Indicator
const PasswordStrength = ({ password }: { password: string }) => {
  if (password.length === 0) return null;
  
  let strength = { label: '', color: '', width: '' };
  
  if (password.length < 6) {
    strength = { label: 'Faible', color: 'bg-destructive', width: 'w-1/3' };
  } else if (password.length < 10) {
    strength = { label: 'Moyen', color: 'bg-yellow-500', width: 'w-2/3' };
  } else {
    strength = { label: 'Fort', color: 'bg-green-500', width: 'w-full' };
  }
  
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-muted-foreground">Force du mot de passe</span>
        <span className={`text-xs font-medium ${
          strength.color === 'bg-destructive' ? 'text-destructive' : 
          strength.color === 'bg-yellow-500' ? 'text-yellow-500' : 
          'text-green-500'
        }`}>
          {strength.label}
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`} />
      </div>
    </div>
  );
};

// Loading Spinner
const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
  </div>
);

// Loading State
const LoadingState = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
    <LoadingSpinner />
  </div>
);

// Password Input with Show/Hide
const PasswordInput = ({ 
  id, 
  value, 
  onChange, 
  disabled, 
  placeholder,
  label
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}) => {
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <Field>
      {label && (
        <FieldLabel htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </FieldLabel>
      )}
      <div className="relative mt-1">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder || '••••••••'}
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          className="border-border bg-background text-foreground pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      </div>
    </Field>
  );
};

// ============================================
// MAIN COMPONENTS
// ============================================

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token || token.length < 10) {
      setError("Lien de réinitialisation invalide ou expiré");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
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
        setError(error.message || "Une erreur est survenue");
      } else {
        setMessage("Mot de passe réinitialisé avec succès !");
        // Redirect after 3 seconds
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch (err) {
      setError("Une erreur est survenue lors de la réinitialisation");
      console.error("Reset password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Invalid token state
  if (!token || token.length < 10) {
    return (
      <AuthCard 
        title="Lien invalide" 
        description="Ce lien de réinitialisation est invalide ou a expiré."
      >
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Veuillez demander un nouveau lien de réinitialisation.
          </p>
          <Link href="/forgot-password?force=true">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Demander un nouveau lien
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  // Success state
  if (message) {
    return (
      <AuthCard 
        title="Succès !" 
        description={message}
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/20 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Vous allez être redirigé vers la page de connexion...
          </p>
          <Link href="/login?force=true">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Aller à la connexion
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  // Main form
  return (
    <AuthCard 
      title="Nouveau mot de passe" 
      description="Choisissez un nouveau mot de passe sécurisé"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          id="password"
          label="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          placeholder="Entrez votre nouveau mot de passe"
        />
        
        {password.length > 0 && (
          <PasswordStrength password={password} />
        )}
        
        <PasswordInput
          id="confirmPassword"
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          placeholder="Confirmez votre mot de passe"
        />
        
        {error && (
          <div className="text-sm text-center p-3 rounded-lg bg-destructive/15 border border-destructive/25 text-destructive-foreground">
            {error}
          </div>
        )}
        
        <Button 
          type="submit" 
          disabled={isLoading || password.length < 6 || password !== confirmPassword} 
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner />
              Réinitialisation...
            </span>
          ) : (
            "Réinitialiser le mot de passe"
          )}
        </Button>
      </form>
      
      <div className="text-center mt-6">
        <Link 
          href="/login?force=true" 
          className="text-sm transition-colors hover:underline underline-offset-4 text-primary hover:text-primary/80"
        >
          Retour à la connexion
        </Link>
      </div>
    </AuthCard>
  );
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden bg-background">
        {/* Background decoration */}
        <div className="pointer-events-none absolute -top-20 -left-16 w-64 h-64 rounded-full blur-[50px] animate-float bg-primary/15" />
        <div className="pointer-events-none absolute -bottom-16 -right-12 w-52 h-52 rounded-full blur-[40px] animate-float-reverse bg-primary/10" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[60px] bg-primary/5" />

        <div className="relative z-10 flex w-full max-w-sm flex-col gap-5 animate-slideUp">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <ResetPasswordContent />
        </div>
        
        {/* Footer */}
        <div className="relative z-10 text-center text-xs text-muted-foreground mt-4">
          <p>© {new Date().getFullYear()} SilkBot. Tous droits réservés.</p>
        </div>
      </div>
    </Suspense>
  );
}

// ============================================
// ADD TO YOUR GLOBAL CSS (globals.css)
// ============================================
/*
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

@keyframes float-reverse {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(20px); }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-float-reverse {
  animation: float-reverse 7s ease-in-out infinite;
}

.animate-slideUp {
  animation: slideUp 0.5s ease-out forwards;
}
*/