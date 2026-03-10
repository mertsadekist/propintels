"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "@/components/admin/verdict-badge";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { VERDICT_LABELS } from "@/lib/constants";

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  status: string;
  propertyType: string;
  bedrooms?: number | null;
  areaSqft: number;
  clientPrice: number;
  createdAt: string;
  project: { id: string; name: string };
  assignedAgent?: { id: string; name: string } | null;
  valuationResult?: { verdict: string; confidence: number } | null;
  reports?: Array<{ id: string; status: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-purple-100 text-purple-800",
  QUALIFIED: "bg-cyan-100 text-cyan-800",
  APPOINTMENT_SET: "bg-orange-100 text-orange-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
  ARCHIVED: "bg-gray-100 text-gray-800",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("");

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ pageSize: "50" });
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (verdictFilter) params.set("verdict", verdictFilter);
        const res = await fetch(`/api/leads?${params}`);
        const data = await res.json();
        setLeads(data.data);
        setTotal(data.meta?.total ?? 0);
      } catch {
        toast.error("Failed to load leads");
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(fetchLeads, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, verdictFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="text-sm text-gray-500 mt-1">{total} total leads</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search leads..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {["NEW", "CONTACTED", "QUALIFIED", "APPOINTMENT_SET", "WON", "LOST", "ARCHIVED"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
        <select
          className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
        >
          <option value="">All Verdicts</option>
          <option value="BELOW_MARKET">Below Market</option>
          <option value="ALIGNED">Aligned</option>
          <option value="SLIGHTLY_ABOVE">Slightly Above</option>
          <option value="ABOVE_MARKET">Above Market</option>
          <option value="INSUFFICIENT_DATA">Insufficient Data</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No leads found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => (window.location.href = `/admin/leads/${lead.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.fullName}</p>
                        <p className="text-xs text-gray-500">{lead.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{lead.project.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{lead.propertyType}</p>
                        {lead.bedrooms !== null && lead.bedrooms !== undefined && (
                          <p className="text-xs text-gray-500">{lead.bedrooms}BR</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCurrency(Number(lead.clientPrice))}
                    </TableCell>
                    <TableCell>
                      {lead.valuationResult?.verdict ? (
                        <VerdictBadge
                          verdict={
                            lead.valuationResult.verdict as keyof typeof VERDICT_LABELS
                          }
                        />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={STATUS_COLORS[lead.status] ?? "bg-gray-100"}
                        variant="secondary"
                      >
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {lead.assignedAgent?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
