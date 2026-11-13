"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Files, ShieldCheck, Upload, Users } from "lucide-react";

const actions = [
  { label: "Importer un document", href: "/admin/documents/upload", icon: Upload, color: "text-emerald-500 bg-emerald-500/10" },
  { label: "Voir les documents", href: "/admin/documents", icon: Files, color: "text-blue-500 bg-blue-500/10" },
  { label: "Gérer les utilisateurs", href: "/admin/accounts", icon: Users, color: "text-violet-500 bg-violet-500/10" },
  { label: "Vérifications", href: "/admin/accounts/verification", icon: ShieldCheck, color: "text-orange-500 bg-orange-500/10" },
];

export function QuickActions() {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Actions rapides</h3>
      <div className="space-y-1.5">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors group"
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${a.color}`}>
              <a.icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium group-hover:translate-x-0.5 transition-transform">
              {a.label}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
