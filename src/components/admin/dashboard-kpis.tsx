"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "./verdict-badge";
import { formatNumber } from "@/lib/utils";
import { FolderKanban, Users, BarChart3, Link2 } from "lucide-react";

interface KPIData {
  totalProjects: number;
  activeProjects: number;
  totalLeads: number;
  newLeadsThisMonth: number;
  totalEntries: number;
  totalActiveLinks: number;
  leadsByStatus: Record<string, number>;
  recentLeads: Array<{
    id: string;
    fullName: string;
    phone: string;
    createdAt: string;
    project: { name: string };
    valuationResult?: { verdict: string } | null;
  }>;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <p className="text-xs text-green-600 font-medium mt-1">{trend}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#0B1F3B]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-[#0B1F3B]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardKPIs() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/kpis")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Active Projects"
          value={data.activeProjects}
          subtitle={`${data.totalProjects} total`}
          icon={FolderKanban}
        />
        <KPICard
          title="Total Leads"
          value={formatNumber(data.totalLeads)}
          subtitle={`+${data.newLeadsThisMonth} this month`}
          icon={Users}
          trend={`+${data.newLeadsThisMonth} this month`}
        />
        <KPICard
          title="Comparables"
          value={formatNumber(data.totalEntries)}
          subtitle="Active entries"
          icon={BarChart3}
        />
        <KPICard
          title="Active Links"
          value={data.totalActiveLinks}
          subtitle="Valuation links"
          icon={Link2}
        />
      </div>

      {/* Lead Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.leadsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {status}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(data.leadsByStatus).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No leads yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{lead.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.project.name}
                    </p>
                  </div>
                  {lead.valuationResult?.verdict && (
                    <VerdictBadge
                      verdict={
                        lead.valuationResult.verdict as keyof typeof import("@/lib/constants").VERDICT_LABELS
                      }
                    />
                  )}
                </div>
              ))}
              {data.recentLeads.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No leads yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
