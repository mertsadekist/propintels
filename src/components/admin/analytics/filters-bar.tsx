"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";

const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "DUPLEX", label: "Duplex" },
  { value: "OFFICE", label: "Office" },
  { value: "RETAIL", label: "Retail" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "LAND", label: "Land" },
  { value: "OTHER", label: "Other" },
];

export interface AnalyticsFilters {
  area: string;
  propertyType: string;
  bedrooms: string;
  category: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: AnalyticsFilters = {
  area: "",
  propertyType: "",
  bedrooms: "",
  category: "",
  dateFrom: "",
  dateTo: "",
};

interface Props {
  onApply: (filters: AnalyticsFilters) => void;
}

export function FiltersBar({ onApply }: Props) {
  const [areas, setAreas] = useState<string[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [pending, setPending] = useState<AnalyticsFilters>(EMPTY_FILTERS);

  useEffect(() => {
    fetch("/api/analytics/areas")
      .then((r) => r.json())
      .then((j) => setAreas(j.data ?? []))
      .catch(console.error);
  }, []);

  const set = (key: keyof AnalyticsFilters, value: string) => {
    setPending((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    setFilters(pending);
    onApply(pending);
  };

  const handleReset = () => {
    setPending(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    onApply(EMPTY_FILTERS);
  };

  const hasFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="font-medium text-sm text-gray-700">Filters</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto h-7 text-xs text-gray-500">
            <X className="h-3 w-3 mr-1" /> Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Area */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Area</Label>
          <Select value={pending.area} onValueChange={(v) => set("area", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All areas" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {areas.map((a) => (
                <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Property Type */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Property Type</Label>
          <Select value={pending.propertyType} onValueChange={(v) => set("propertyType", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bedrooms */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Bedrooms</Label>
          <Select value={pending.bedrooms} onValueChange={(v) => set("bedrooms", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0" className="text-xs">Studio</SelectItem>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">{n} BR</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Category</Label>
          <Select value={pending.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RESIDENTIAL" className="text-xs">Residential</SelectItem>
              <SelectItem value="COMMERCIAL" className="text-xs">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">From Date</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={pending.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">To Date</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={pending.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleApply} className="h-8 text-xs">
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
