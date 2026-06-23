"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  {
    section: "Tableau de bord",
    items: [
      { label: "Vue d'ensemble", href: "/admin/vue_ensemble" },
    ],
  },
  {
    section: "Base documentaire",
    items: [
      { label: "Importer", href: "/admin/documents/upload" },
      { label: "Documents", href: "/admin/documents" },
    ],
  },
  {
    section: "Comptes",
    items: [
      { label: "Utilisateurs", href: "/admin/accounts" },
      { label: "Vérification", href: "/admin/accounts/verification" },
    ],
  },
  {
    section: "Communication",
    items: [
      { label: "Messages", href: "/admin/messages" },
      { label: "Notifications", href: "/admin/notifications" },
    ],
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
          <Menu className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <span className="text-lg font-semibold text-foreground">SilkBot</span>
        </div>

        <div className="space-y-4">
          {navigation.map((group) => (
            <div key={group.section}>
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {group.section}
              </p>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}