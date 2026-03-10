"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { AddEntryDialog } from "@/components/admin/entries/add-entry-dialog";
import { useEntries } from "@/hooks/use-entries";
import { formatCurrency } from "@/lib/utils";

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
  "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER",
];

export default function EntriesPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [sourceType, setSourceType] = useState<string>("ALL");
  const [propertyType, setPropertyType] = useState<string>("ALL");

  const { entries, isLoading, mutate } = useEntries({
    projectId: params.projectId,
    sourceType: sourceType !== "ALL" ? sourceType : undefined,
    propertyType: propertyType !== "ALL" ? propertyType : undefined,
  });

  const headers = [
    "Source",
    "Type",
    "BR",
    "Area",
    "Price",
    "Price / Area",
    "Portal",
    "Date",
    "",
  ];

  return (
    <div>
      <PageHeader
        title="Comparable Entries"
        description="Manage listing and transaction data for valuation"
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sources</SelectItem>
            <SelectItem value="LISTING">Listings</SelectItem>
            <SelectItem value="TRANSACTION">Transactions</SelectItem>
          </SelectContent>
        </Select>

        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable headers={headers} isLoading={isLoading}>
        {entries.map((entry: EntryRow) => (
          <EntryTableRow key={entry.id} entry={entry} />
        ))}
      </DataTable>

      <AddEntryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={params.projectId}
        onSuccess={mutate}
      />
    </div>
  );
}

interface EntryRow {
  id: string;
  sourceType: string;
  propertyType: string;
  bedrooms?: number | null;
  areaSqft?: string | null;
  transactionAreaSqft?: string | null;
  askPrice?: string | null;
  transactionPrice?: string | null;
  askPsf?: string | null;
  transactionPsf?: string | null;
  portal?: string | null;
  createdDate?: string | null;
  transactionDate?: string | null;
}

const SQM_TO_SQFT = 10.7639;

function EntryTableRow({ entry }: { entry: EntryRow }) {
  const isListing = entry.sourceType === "LISTING";

  const sqft  = Number(isListing ? entry.areaSqft : entry.transactionAreaSqft) || 0;
  const sqm   = sqft > 0 ? sqft / SQM_TO_SQFT : 0;
  const psf   = Number(isListing ? entry.askPsf : entry.transactionPsf) || 0;
  const ppsm  = psf > 0 ? psf * SQM_TO_SQFT : 0;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 text-sm">
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            isListing
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {isListing ? "Listing" : "Transaction"}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-700">
        {entry.propertyType.charAt(0) + entry.propertyType.slice(1).toLowerCase()}
      </td>
      <td className="px-4 py-3 text-gray-600">{entry.bedrooms ?? "—"}</td>
      <td className="px-4 py-3 text-gray-600">
        {sqft > 0 ? (
          <>
            <div>{Math.round(sqft).toLocaleString()} <span className="text-xs text-gray-400">sqft</span></div>
            <div className="text-xs text-gray-400">{sqm.toLocaleString(undefined, { maximumFractionDigits: 1 })} sqm</div>
          </>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-gray-700 font-medium">
        {formatCurrency(
          Number(isListing ? entry.askPrice : entry.transactionPrice)
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">
        {psf > 0 ? (
          <>
            <div>{Math.round(psf).toLocaleString()} <span className="text-xs text-gray-400">AED/sqft</span></div>
            <div className="text-xs text-gray-400">{Math.round(ppsm).toLocaleString()} AED/sqm</div>
          </>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">{entry.portal ?? "—"}</td>
      <td className="px-4 py-3 text-gray-400 text-xs">
        {new Date(
          isListing ? (entry.createdDate ?? "") : (entry.transactionDate ?? "")
        ).toLocaleDateString("en-AE")}
      </td>
      <td className="px-4 py-3">
        <button className="text-xs text-gray-400 hover:text-red-500">
          Delete
        </button>
      </td>
    </tr>
  );
}
