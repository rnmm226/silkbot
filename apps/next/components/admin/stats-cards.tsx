"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileText, Users, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fetchStats, type Stats } from "@/lib/api/admin";

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await fetchStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="w-6 h-6 rounded-full bg-muted" />
            </div>
            <div className="h-8 w-16 bg-muted rounded mb-2" />
            <div className="h-3 w-24 bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 col-span-full">
          <p className="text-sm text-muted-foreground text-center">
            Impossible de charger les statistiques
          </p>
        </Card>
      </div>
    );
  }

  const statsData = [
    {
      key: "documents",
      title: "Documents",
      value: stats.documents,
      increase: stats.documentsTrend,
      icon: FileText,
      delay: "0ms",
    },
    {
      key: "segments",
      title: "Segments",
      value: stats.segments.toLocaleString("fr-FR"),
      increase: stats.segmentsTrend,
      icon: FileText,
      delay: "100ms",
    },
    {
      key: "users",
      title: "Utilisateurs",
      value: stats.users,
      increase: stats.usersTrend,
      icon: Users,
      delay: "200ms",
    },
    {
      key: "verification",
      title: "Vérification",
      value: stats.verificationPending,
      subtitle: stats.verificationPending > 0 ? "En attente" : "Tout vérifié",
      icon: Clock,
      delay: "300ms",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        const isPrimary = index === 0;
        
        return (
          <Card
            key={stat.key}
            onMouseEnter={() => setHoveredCard(index)}
            onMouseLeave={() => setHoveredCard(null)}
            style={{ animationDelay: stat.delay }}
            className={cn(
              "p-4 transition-all duration-500 ease-out animate-slide-in-up cursor-pointer",
              isPrimary ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
              hoveredCard === index ? "scale-105 shadow-2xl" : "shadow-lg"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xs font-medium opacity-90">{stat.title}</h3>
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300",
                  isPrimary ? "bg-primary-foreground/20" : "bg-primary",
                  hoveredCard === index ? "rotate-45" : ""
                )}
              >
                <Icon className={cn(
                  "w-3 h-3",
                  isPrimary ? "text-primary-foreground" : "text-primary-foreground"
                )} />
              </div>
            </div>
            <p className="text-3xl font-bold mb-2">{stat.value}</p>
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              {stat.increase && (
                <>
                  <TrendingUp className="w-3 h-3" />
                  <span>{stat.increase}</span>
                </>
              )}
              {stat.subtitle && <span>{stat.subtitle}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}