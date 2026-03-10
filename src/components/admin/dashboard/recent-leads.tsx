import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { VerdictBadge } from "@/components/admin/verdict-badge";
import { ArrowRight } from "lucide-react";

async function fetchRecentLeads() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/leads?pageSize=5`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

const STATUS_VARIANTS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  APPOINTMENT_SET: "bg-orange-100 text-orange-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

interface LeadRow {
  id: string;
  fullName: string;
  phone: string;
  propertyType: string;
  bedrooms?: number | null;
  areaSqft: string;
  status: string;
  createdAt: string;
  project?: { name: string };
  valuationResult?: { verdict: string } | null;
}

export async function RecentLeadsTable() {
  const leads = await fetchRecentLeads();

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-400 text-sm">
          No leads yet. Share a valuation link to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Client</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Project</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Property</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Verdict</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead: LeadRow) => (
              <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{lead.fullName}</div>
                  <div className="text-xs text-gray-400">{lead.phone}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{lead.project?.name}</td>
                <td className="px-4 py-3">
                  <div className="text-gray-700">
                    {lead.propertyType}
                    {lead.bedrooms ? ` · ${lead.bedrooms} BR` : ""}
                  </div>
                  <div className="text-xs text-gray-400">
                    {Number(lead.areaSqft).toLocaleString()} sqft
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      STATUS_VARIANTS[lead.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {lead.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {lead.valuationResult?.verdict ? (
                    <VerdictBadge verdict={lead.valuationResult.verdict} />
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString("en-AE")}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/leads/${lead.id}`}>
                    <ArrowRight className="h-4 w-4 text-gray-300 hover:text-gray-600" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <Link
          href="/admin/leads"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all leads →
        </Link>
      </div>
    </Card>
  );
}
