"use client";

import { useState } from "react";
import { FileText, Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { VerdictBadge } from "@/components/admin/verdict-badge";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

const STATUS_STYLES: Record<string, string> = {
  READY: "bg-green-100 text-green-700",
  QUEUED: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
};

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  if (search) params.set("search", search);

  const { data: reports, isLoading, mutate } = useSWR(
    `/api/reports?${params.toString()}`,
    fetcher
  );

  async function downloadReport(leadId: string) {
    const res = await fetch(`/api/leads/${leadId}/report`);
    if (!res.ok) { toast.error("Failed to get report"); return; }
    const json = await res.json();
    if (json.data.downloadUrl) window.open(json.data.downloadUrl, "_blank");
    else toast.info("Report not ready yet");
  }

  async function regenerateReport(leadId: string) {
    const res = await fetch(`/api/leads/${leadId}/report`, { method: "POST" });
    if (res.ok) { toast.success("Report queued for regeneration"); mutate(); }
    else toast.error("Failed to queue report");
  }

  const headers = ["Client", "Project", "Verdict", "Status", "Size", "Generated", "Actions"];

  return (
    <div>
      <PageHeader title="Reports" description="Generated valuation PDF reports" />

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="READY">Ready</SelectItem>
            <SelectItem value="QUEUED">Queued</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (!reports || reports.length === 0) ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Reports are generated when clients submit valuation requests."
        />
      ) : (
        <DataTable headers={headers} isLoading={isLoading}>
          {(reports ?? []).map((report: ReportRow) => (
            <tr key={report.id} className="border-b border-gray-50 hover:bg-gray-50/50 text-sm">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-800">{report.lead?.fullName ?? "—"}</div>
                <div className="text-xs text-gray-400">{report.lead?.phone}</div>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {report.lead?.project?.name ?? "—"}
              </td>
              <td className="px-4 py-3">
                {report.lead?.valuationResult?.verdict ? (
                  <VerdictBadge verdict={report.lead.valuationResult.verdict} />
                ) : <span className="text-gray-300 text-xs">—</span>}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  STATUS_STYLES[report.status] ?? "bg-gray-100 text-gray-600"
                }`}>
                  {report.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {report.fileSize
                  ? `${(report.fileSize / 1024).toFixed(0)} KB`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {report.generatedAt
                  ? new Date(report.generatedAt).toLocaleDateString("en-AE")
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {report.status === "READY" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => downloadReport(report.lead.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {report.status === "FAILED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => regenerateReport(report.lead.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

interface ReportRow {
  id: string;
  status: string;
  fileSize?: number | null;
  generatedAt?: string | null;
  lead: {
    id: string;
    fullName: string;
    phone: string;
    project?: { name: string } | null;
    valuationResult?: { verdict: string } | null;
  };
}
