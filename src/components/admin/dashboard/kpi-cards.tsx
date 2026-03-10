import {
  FolderKanban,
  Users,
  Database,
  Link2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

async function fetchKpis() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/dashboard/kpis`,
    {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

interface KpiData {
  totalProjects: number;
  activeProjects: number;
  totalLeads: number;
  newLeadsThisMonth: number;
  totalEntries: number;
  totalActiveLinks: number;
  leadsByStatus: Record<string, number>;
}

export async function KpiCards() {
  const kpis: KpiData | null = await fetchKpis();

  if (!kpis) {
    return <div className="text-sm text-red-500">Failed to load KPIs</div>;
  }

  const cards = [
    {
      label: "Active Projects",
      value: kpis.activeProjects,
      sublabel: `${kpis.totalProjects} total`,
      icon: FolderKanban,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Leads",
      value: kpis.totalLeads,
      sublabel: `+${kpis.newLeadsThisMonth} this month`,
      icon: Users,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Comparable Entries",
      value: kpis.totalEntries,
      sublabel: "Active records",
      icon: Database,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Active Links",
      value: kpis.totalActiveLinks,
      sublabel: "Public valuation links",
      icon: Link2,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="border border-gray-200 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {card.value.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">{card.sublabel}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Lead Status Breakdown */}
      <Card className="border border-gray-200 shadow-sm sm:col-span-2 lg:col-span-4">
        <CardContent className="pt-5 pb-4">
          <p className="text-sm font-medium text-gray-500 mb-3">Lead Pipeline</p>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(kpis.leadsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${getStatusColor(status)}`}
                />
                <span className="text-sm text-gray-600">
                  {formatStatus(status)}:{" "}
                  <span className="font-semibold text-gray-900">{count}</span>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: "bg-blue-400",
    CONTACTED: "bg-yellow-400",
    QUALIFIED: "bg-purple-400",
    APPOINTMENT_SET: "bg-orange-400",
    WON: "bg-green-500",
    LOST: "bg-red-400",
    ARCHIVED: "bg-gray-400",
  };
  return colors[status] ?? "bg-gray-400";
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
