"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Files,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navigation = [
  {
    section: "Tableau de bord",
    items: [
      { label: "Vue d'ensemble", href: "/admin/vue_ensemble", icon: LayoutDashboard },
    ],
  },
  {
    section: "Base documentaire",
    items: [
      { label: "Importer", href: "/admin/documents/upload", icon: Upload },
      { label: "Documents", href: "/admin/documents", icon: Files },
    ],
  },
  {
    section: "Comptes",
    items: [
      { label: "Utilisateurs", href: "/admin/accounts", icon: Users },
      { label: "Vérification", href: "/admin/accounts/verification", icon: ShieldCheck },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.user) {
          setUser({
            name: data.user.name || data.user.email?.split('@')[0] || "Utilisateur",
            email: data.user.email || "admin@silkbot.com",
          });
        }
      } catch (error) {
        console.error("Erreur lors du chargement de l'utilisateur:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Barre latérale */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r bg-background">
        {/* Logo */}
        <div className="flex flex-col items-center border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              <Image
                src="/silkbot-logo.png"
                alt="SilkBot Icon"
                fill
                className="object-contain"
                priority
                sizes="32px"
              />
            </div>
            <div className="relative h-8 w-24">
              <Image
                src="/silkbot-black.png"
                alt="SilkBot"
                fill
                className="object-contain dark:hidden"
                priority
                sizes="96px"
              />
              <Image
                src="/silkbot-white.png"
                alt="SilkBot"
                fill
                className="hidden object-contain dark:block"
                priority
                sizes="96px"
              />
            </div>
          </div>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Administration
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.section} className="mb-5">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <item.icon className={cn(
                        "size-4 shrink-0",
                        isActive && "text-primary"
                      )} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pied de sidebar - Données utilisateur dynamiques */}
        <div className="border-t px-3 py-3">
          {loading ? (
            <div className="mb-2 rounded-lg bg-muted/30 px-3 py-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          ) : user ? (
            <div className="mb-2 rounded-lg bg-muted/30 px-3 py-2">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          ) : (
            <div className="mb-2 rounded-lg bg-muted/30 px-3 py-2">
              <p className="text-xs font-medium">Invité</p>
              <p className="text-[10px] text-muted-foreground">Non connecté</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4 shrink-0" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}