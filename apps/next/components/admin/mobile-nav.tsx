"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Files,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Vue d'ensemble", href: "/admin/vue_ensemble", icon: LayoutDashboard },
  { label: "Importer", href: "/admin/documents/upload", icon: Upload },
  { label: "Documents", href: "/admin/documents", icon: Files },
  { label: "Utilisateurs", href: "/admin/accounts", icon: Users },
  { label: "Vérification", href: "/admin/accounts/verification", icon: ShieldCheck },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-8 w-8"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-4 h-4" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <span className="font-semibold text-sm">Navigation</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <nav className="space-y-0.5 flex-1">
              {navigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
