"use client";

import { StatsCards } from "@/components/admin/stats-cards";
import { RecentActivity } from "@/components/admin/recent-activity";
import { QuickActions } from "@/components/admin/quick-actions";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-3 md:space-y-4">
      <StatsCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="lg:col-span-2">
          <RecentActivity limit={5} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}