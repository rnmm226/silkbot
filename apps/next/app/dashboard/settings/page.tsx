"use client";

import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { SidebarSettings } from "@/components/dashboard/sidebar-settings";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import {
  CheckIcon,
  Loader2Icon,
  SunIcon,
  MoonIcon,
  LaptopIcon,
  CheckCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

// Liste des langues disponibles (pour l'affichage)
const languages = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  const [mounted, setMounted] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(session?.user?.image || null);

  // Nom
  const [nameValue, setNameValue] = useState(session?.user?.name || "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAvatarUpdate = async (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
    await refetchSession();
  };

  useEffect(() => {
    setNameValue(session?.user?.name || "");
    setAvatarUrl(session?.user?.image || null);
  }, [session?.user?.name, session?.user?.image]);

  const saveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === session?.user?.name) return;
    setNameSaving(true);
    await authClient.updateUser({
      name: trimmed,
      fetchOptions: {
        onSuccess: () => {
          setNameSaved(true);
          setTimeout(() => setNameSaved(false), 2000);
          refetchSession();
          toast.success( "Nom mis à jour");
        },
      },
    });
    setNameSaving(false);
  };

  const submitPasswordChange = async () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text:  "Tous les champs sont requis" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text:  "Le mot de passe doit contenir au moins 8 caractères" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text:  "Les mots de passe ne correspondent pas" });
      return;
    }

    setPasswordSaving(true);
    await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
      fetchOptions: {
        onSuccess: () => {
          setPasswordMessage({ type: "success", text:  "Mot de passe mis à jour" });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success( "Mot de passe mis à jour");
        },
        onError: (ctx: any) => {
          setPasswordMessage({ type: "error", text: ctx?.error?.message ||  "Erreur" });
          toast.error(ctx?.error?.message ||  "Erreur");
        },
      },
    });
    setPasswordSaving(false);
  };

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
  };

  const handleBack = () => {
    router.push("/dashboard");
  };

  const initials = session?.user?.name?.split(' ').map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  if (!mounted) return null;

  const themeOptions = [
    { value: "light", label:  "Clair", icon: SunIcon },
    { value: "dark", label:  "Sombre", icon: MoonIcon },
    { value: "system", label:  "Système", icon: LaptopIcon },
  ];

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      {/* Header avec LanguageSwitch */}
      <div className="flex justify-between items-center px-8 pt-6 pb-2">
        <h1 className="text-2xl font-bold">{ "Paramètres"}</h1>
      </div>

      <div className="flex flex-1 w-full">
        <SidebarSettings
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={handleLogout}
          onBack={handleBack}
        />

        <div className="flex-1 px-8 py-6 max-w-3xl">
          <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {activeTab === "profile" && (
              <div>
                <h1 className="font-serif text-xl text-foreground mb-6">{ "Profil"}</h1>

                <Card className="p-6">
                  <div className="space-y-6">
                    <AvatarUpload
                      currentAvatar={avatarUrl}
                      initials={initials}
                      onAvatarUpdate={handleAvatarUpdate}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{ "Nom complet"}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="name"
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onBlur={saveName}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                          <span className="w-4 shrink-0">
                            {nameSaving && <Loader2Icon className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                            {!nameSaving && nameSaved && <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{ "Email"}</Label>
                        <Input id="email" type="email" value={session?.user?.email || ""} disabled />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "security" && (
              <div>
                <h1 className="font-serif text-xl text-foreground mb-6">{ "Sécurité"}</h1>

                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">{ "Mot de passe actuel"}</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">{ "Nouveau mot de passe"}</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{ "Confirmer le mot de passe"}</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    {passwordMessage && (
                      <p className={`text-sm ${passwordMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
                        {passwordMessage.text}
                      </p>
                    )}

                    <Button onClick={submitPasswordChange} disabled={passwordSaving}>
                      {passwordSaving ? "..." :  "Mettre à jour le mot de passe"}
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "notifications" && (
              <div>
                <h1 className="font-serif text-xl text-foreground mb-6">{ "Notifications"}</h1>

                <Card className="p-6">
                  <div className="space-y-4">
                    {[
                      { label:  "Notifications par email", description:  "Recevoir des emails sur l'activité du compte" },
                      { label:  "Notifications push", description:  "Recevoir des notifications dans le navigateur" },
                      { label:  "Rappels de conversation", description:  "Être notifié des conversations importantes" },
                      { label:  "Mises à jour", description:  "Recevoir des informations sur les nouvelles fonctionnalités" },
                    ].map((item, index) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between py-3 border-b border-border last:border-0"
                      >
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <Switch defaultChecked={index < 2} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "appearance" && (
              <div>
                <h1 className="font-serif text-xl text-foreground mb-6">{ "Apparence"}</h1>

                <Card className="p-6">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      { "Choisissez le thème de votre interface"}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      {themeOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = theme === option.value;

                        return (
                          <button
                            key={option.value}
                            onClick={() => setTheme(option.value)}
                            className={`
                              relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                              ${isActive
                                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                : "border-border hover:border-primary/30 hover:bg-accent/5"
                              }
                            `}
                          >
                            <Icon className={`w-6 h-6 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-sm font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                              {option.label}
                            </span>
                            {isActive && <CheckCircleIcon className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 p-4 rounded-lg bg-accent/10 border border-border">
                      <p className="text-xs text-muted-foreground">
                        💡 { "Le thème 'Système' suit automatiquement les préférences de votre appareil."}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            
          </div>
        </div>
      </div>
    </div>
  );
}