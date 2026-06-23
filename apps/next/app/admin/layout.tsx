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
  Search,
  Bell,
  Mail,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "@/components/admin/mobile-nav";

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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 w-64 bg-card border-r border-border p-4 h-screen overflow-y-auto hidden lg:block">
        <div className="flex items-center gap-2 mb-6 group cursor-pointer">
          <Link href="/" className="flex items-center gap-2">
  <Image 
    src="/silkbot-logo-dark.png"
    alt="SilkBot"
    width={32}
    height={32}
    className="rounded-lg"
  />
  <Image 
    src="/silkbot-black.png"
    alt="SilkBot"
    width={90}
    height={28}
  />
</Link>
        </div>

        <div className="space-y-4">
          {navigation.map((group) => (
            <div key={group.section}>
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {group.section}
              </p>
              <nav className="space-y-0.5">
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
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Pied de sidebar */}
        <div className="absolute bottom-4 left-4 right-4">
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
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-300 hover:bg-destructive/10 hover:text-destructive hover:translate-x-1"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 p-3 md:p-4 lg:p-5 lg:ml-64">
        {/* Header */}
        <header className="space-y-3 md:space-y-4 animate-slide-in-up">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <MobileNav />

              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-9 pr-3 h-9 text-sm bg-card border-border transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative hover:bg-secondary transition-all duration-300 hover:scale-110 h-8 w-8"
                asChild
              >
                <Link href="/admin/messages">
                  <Mail className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative hover:bg-secondary transition-all duration-300 hover:scale-110 h-8 w-8"
                asChild
              >
                <Link href="/admin/notifications">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                </Link>
              </Button>

              <div className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border">
                <Avatar className="w-7 h-7 md:w-8 md:h-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
                  <AvatarImage src="/profile.jpg" alt={user?.name || "Admin"} />
                  <AvatarFallback className="text-xs">
                    {user?.name?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-xs hidden sm:block">
                  <p className="font-semibold text-foreground">{user?.name || "Administrateur"}</p>
                  <p className="text-muted-foreground text-[10px]">{user?.email || "admin@silkbot.com"}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-1">
              Administration
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Gérez la base documentaire et les comptes utilisateurs
            </p>
          </div>
        </header>

        <div className="mt-4 md:mt-5">
          {children}
        </div>
      </main>
    </div>
  );
}