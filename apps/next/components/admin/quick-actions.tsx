"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Users, ShieldCheck, FileText, MessageSquare, Bell } from "lucide-react";
import Link from "next/link";

const actions = [
  {
    label: "Importer un document",
    href: "/admin/documents/upload",
    icon: Upload,
    color: "bg-emerald-500",
  },
  {
    label: "Voir les utilisateurs",
    href: "/admin/accounts",
    icon: Users,
    color: "bg-blue-500",
  },
  {
    label: "Vérifier les comptes",
    href: "/admin/accounts/verification",
    icon: ShieldCheck,
    color: "bg-amber-500",
  },
  {
    label: "Liste des documents",
    href: "/admin/documents",
    icon: FileText,
    color: "bg-purple-500",
  },
  {
    label: "Messages",
    href: "/admin/messages",
    icon: MessageSquare,
    color: "bg-rose-500",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    color: "bg-indigo-500",
  },
];

export function QuickActions() {
  return (
    <Card className="p-6 transition-all duration-500 hover:shadow-xl animate-slide-in-up">
      <h2 className="text-xl font-semibold text-foreground mb-6">Actions rapides</h2>
      <div className="space-y-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            asChild
            variant="outline"
            className="w-full justify-start gap-3 h-11 transition-all duration-300 hover:scale-105 hover:shadow-md bg-transparent"
          >
            <Link href={action.href}>
              <div className={`${action.color} w-6 h-6 rounded flex items-center justify-center text-white`}>
                <action.icon className="w-3 h-3" />
              </div>
              <span className="text-sm">{action.label}</span>
            </Link>
          </Button>
        ))}
      </div>
    </Card>
  );
}