"use client";

import { useState } from "react";
import { Search, ClipboardList } from "lucide-react";
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
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => ({ data: d.data ?? [], total: d.meta?.total ?? 0 }));

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-green-600",
  UPDATE: "text-blue-600",
  DELETE: "text-red-500",
  ASSIGN: "text-purple-600",
  IMPORT: "text-orange-600",
  LOGIN: "text-gray-500",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return "text-gray-600";
}

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState("ALL");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (entityType !== "ALL") params.set("entityType", entityType);
  if (search) params.set("action", search);
  params.set("pageSize", "50");

  const { data, isLoading } = useSWR(`/api/audit?${params.toString()}`, fetcher);

  const headers = ["Action", "Entity", "Actor", "IP Address", "Timestamp"];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Immutable log of all system mutations"
      />

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Filter by action..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All entity types</SelectItem>
            <SelectItem value="Project">Project</SelectItem>
            <SelectItem value="Entry">Entry</SelectItem>
            <SelectItem value="ValuationLink">Valuation Link</SelectItem>
            <SelectItem value="Lead">Lead</SelectItem>
            <SelectItem value="Setting">Setting</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (!data?.data || data.data.length === 0) ? (
        <EmptyState
          icon={ClipboardList}
          title="No audit logs"
          description="System activities will be logged here."
        />
      ) : (
        <DataTable headers={headers} isLoading={isLoading}>
          {(data?.data ?? []).map((log: AuditRow) => (
            <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 text-sm">
              <td className="px-4 py-3">
                <span className={`font-mono text-xs font-medium ${getActionColor(log.action)}`}>
                  {log.action}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="text-gray-700">{log.entityType}</div>
                {log.entityId && (
                  <div className="text-xs text-gray-400 font-mono truncate max-w-[100px]">
                    {log.entityId.slice(-8)}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="text-gray-800">{log.actor?.name ?? "System"}</div>
                <div className="text-xs text-gray-400">{log.actor?.email}</div>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                {log.ipAddress ?? "—"}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {new Date(log.createdAt).toLocaleString("en-AE")}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { name: string; email: string } | null;
}
