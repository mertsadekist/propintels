"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SQM_TO_SQFT = 10.7639;

interface AreaRow {
  area: string;
  txnCount: number;
  txnMedianPsf: number;
  txnMinPsf: number;
  txnMaxPsf: number;
  listingCount: number;
  listingAvgPsf: number;
  diffPct: number | null;
}

export type AreaSortBy = "txnCount" | "txnMedianPsf" | "listingAvgPsf" | "diffPct" | "area";
export type SortDir = "asc" | "desc";

function fmtN(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}

function DiffBadge({ pct }: { pct: number | null }) {
  if (pct === null)
    return <span className="text-gray-400 text-xs">—</span>;
  const abs = Math.abs(pct);
  const sign = pct > 0 ? "+" : "";
  if (pct > 5) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        {sign}{abs.toFixed(1)}%
      </span>
    );
  }
  if (pct < -5) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        {sign}{pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: AreaSortBy;
  sortKey: AreaSortBy;
  sortDir: SortDir;
}) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 text-gray-400" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

interface Props {
  data: AreaRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: AreaSortBy;
  sortDir: SortDir;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSortChange: (key: AreaSortBy) => void;
}

export function AreaComparisonTable({
  data,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  loading,
  onPageChange,
  onSortChange,
}: Props) {
  const totalPages = Math.ceil(total / pageSize);

  const handleSort = (key: AreaSortBy) => {
    onSortChange(key);
  };

  if (data.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No data available for the selected filters
      </div>
    );
  }

  const th = (label: string, key: AreaSortBy, align = "left") => (
    <th
      className={`px-3 py-2.5 text-${align} text-xs font-semibold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap`}
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon col={key} sortKey={sortBy} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              {th("Area", "area")}
              {th("Txn Count", "txnCount", "right")}
              {th("Median PSF (AED/sqft)", "txnMedianPsf", "right")}
              {th("Median PPSM (AED/sqm)", "txnMedianPsf", "right")}
              {th("Range (AED/sqft)", "txnMedianPsf", "right")}
              {th("Listing Avg PSF", "listingAvgPsf", "right")}
              {th("Listing vs Txn", "diffPct", "center")}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const ppsm = Math.round(row.txnMedianPsf * SQM_TO_SQFT);
              return (
                <tr
                  key={row.area}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    i % 2 === 0 ? "" : "bg-gray-50/40"
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{row.area}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmtN(row.txnCount)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-semibold text-gray-900">{fmtN(row.txnMedianPsf)}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmtN(ppsm)}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-500">
                    {fmtN(row.txnMinPsf)} – {fmtN(row.txnMaxPsf)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.listingCount > 0 ? (
                      <span className="text-blue-700 font-medium">{fmtN(row.listingAvgPsf)}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <DiffBadge pct={row.diffPct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {fmtN(total)} areas
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </Button>
            <span className="text-xs text-gray-600 px-1">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || loading}
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
