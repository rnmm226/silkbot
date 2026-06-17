"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import {
  Settings2Icon,
  ShieldIcon,
  BellIcon,
  UserCircleIcon,
  LogOutIcon,
  KeyRoundIcon,
  CheckIcon,
  Loader2Icon,
  ChevronLeftIcon,
} from "lucide-react"

// ─────────────────────────────────────────────
// Petit composant de ligne : label à gauche, contrôle à droite, liseré
// ─────────────────────────────────────────────
function SettingsRow({
  label,
  description,
  children,
  stacked = false,
}: {
  label: string
  description?: string
  children: React.ReactNode
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className="py-5 border-b border-border/60">
        <div className="text-sm text-foreground mb-1">{label}</div>
        {description && (
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
        )}
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-border/60">
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const NAV_ITEMS = [
  { key: "general", label: "Général", icon: Settings2Icon },
  { key: "security", label: "Sécurité", icon: ShieldIcon },
  { key: "notifications", label: "Notifications", icon: BellIcon },
  { key: "account", label: "Compte", icon: UserCircleIcon },
] as const

type TabKey = typeof NAV_ITEMS[number]["key"]

export default function SettingsPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [activeTab, setActiveTab] = useState<TabKey>("general")

  const initials = session?.user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  // ── Nom (sauvegarde automatique au blur) ──
  const [nameValue, setNameValue] = useState(session?.user?.name || "")
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    setNameValue(session?.user?.name || "")
  }, [session?.user?.name])

  const saveName = async () => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === session?.user?.name) return
    setNameSaving(true)
    await authClient.updateUser({
      name: trimmed,
      fetchOptions: {
        onSuccess: () => {
          setNameSaved(true)
          setTimeout(() => setNameSaved(false), 2000)
        },
      },
    })
    setNameSaving(false)
  }

  // ── Vérifie si le compte a un mot de passe (provider "credential") ──
  const [hasCredentialAccount, setHasCredentialAccount] = useState<boolean | null>(null)
  const [linkedProvider, setLinkedProvider] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/account/has-password')
      .then(res => res.json())
      .then((data: { hasCredentialAccount: boolean; provider: string | null }) => {
        setHasCredentialAccount(data.hasCredentialAccount)
        setLinkedProvider(data.provider)
      })
      .catch(() => setHasCredentialAccount(null)) // inconnu → on laisse le formulaire visible
  }, [])

  // ── Changement de mot de passe ──
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const mapPasswordError = (raw: string) => {
    const lower = raw.toLowerCase()
    if (lower.includes("credential account not found")) {
      return "Ce compte ne possède pas encore de mot de passe (il a été créé via une connexion externe). Utilisez ce mode de connexion, ou contactez le support pour en définir un."
    }
    if (lower.includes("invalid password") || lower.includes("incorrect")) {
      return "Mot de passe actuel incorrect."
    }
    return raw || "Une erreur est survenue lors de la mise à jour."
  }

  const submitPasswordChange = async () => {
    setPasswordMessage(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text: "Tous les champs sont requis." })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Le nouveau mot de passe doit contenir au moins 8 caractères." })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Les mots de passe ne correspondent pas." })
      return
    }

    setPasswordSaving(true)
    await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
      fetchOptions: {
        onSuccess: () => {
          setPasswordMessage({ type: "success", text: "Mot de passe mis à jour avec succès." })
          setCurrentPassword("")
          setNewPassword("")
          setConfirmPassword("")
        },
        onError: (ctx: any) => {
          setPasswordMessage({ type: "error", text: mapPasswordError(ctx?.error?.message || "") })
        },
      },
    })
    setPasswordSaving(false)
  }

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login")
        },
      },
    })
  }

  return (
    <div className="min-h-full w-full bg-background flex">

      {/* ── Sous-navigation des paramètres ── */}
      <div className="w-56 shrink-0 border-r border-border/60 px-3 py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 mb-5"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Retour
        </button>

        <p className="px-2 mb-2 text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground/70">
          Paramètres
        </p>

        <nav className="space-y-0.5">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
                activeTab === key
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 px-10 py-10 max-w-2xl">

        {activeTab === "general" && (
          <div>
            <h1 className="font-serif text-xl text-foreground mb-6">Profil</h1>

            <SettingsRow label="Avatar">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-sm font-medium text-accent-foreground">
                {initials}
              </div>
            </SettingsRow>

            <SettingsRow label="Nom complet">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  className="w-64 text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring text-right"
                />
                <span className="w-4 shrink-0">
                  {nameSaving && <Loader2Icon className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  {!nameSaving && nameSaved && <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />}
                </span>
              </div>
            </SettingsRow>

            <SettingsRow label="Adresse e-mail" description="Non modifiable">
              <span className="text-sm text-muted-foreground">{session?.user?.email || "—"}</span>
            </SettingsRow>
          </div>
        )}

        {activeTab === "security" && (
          <div>
            <h1 className="font-serif text-xl text-foreground mb-6">Sécurité</h1>

            {hasCredentialAccount === false ? (
              <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 flex gap-3">
                <KeyRoundIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ce compte est connecté via {linkedProvider || "un fournisseur externe"} et ne possède pas de mot de passe propre à modifier ici.
                </p>
              </div>
            ) : (
              <>
                <SettingsRow label="Mot de passe actuel" stacked>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </SettingsRow>
                <SettingsRow label="Nouveau mot de passe" stacked>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </SettingsRow>
                <SettingsRow label="Confirmer le nouveau mot de passe" stacked>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitPasswordChange() }}
                    className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </SettingsRow>

                {passwordMessage && (
                  <p className={`text-xs mt-3 ${passwordMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
                    {passwordMessage.text}
                  </p>
                )}

                <button
                  onClick={submitPasswordChange}
                  disabled={passwordSaving}
                  className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {passwordSaving ? "Mise à jour…" : "Mettre à jour le mot de passe"}
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === "notifications" && (
          <div>
            <h1 className="font-serif text-xl text-foreground mb-6">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Aucune préférence de notification n'est configurable pour le moment.
            </p>
          </div>
        )}

        {activeTab === "account" && (
          <div>
            <h1 className="font-serif text-xl text-foreground mb-6">Compte</h1>
            <SettingsRow label="Session active" description={session?.user?.email}>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/5 transition-colors"
              >
                <LogOutIcon className="w-3.5 h-3.5" />
                Se déconnecter
              </button>
            </SettingsRow>
          </div>
        )}

      </div>
    </div>
  )
}