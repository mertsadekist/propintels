"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerdictBadge } from "@/components/admin/verdict-badge";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Building2 } from "lucide-react";
import type { ValuationSnapshot } from "@/valuation/types";

interface Props {
  snapshot: ValuationSnapshot | null;
}

export function ProjectValuationCard({ snapshot }: Props) {
  if (!snapshot || snapshot.verdict === "INSUFFICIENT_DATA") {
    return (
      <Card className="border border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base">Project Valuation</CardTitle>
          </div>
          <p className="text-xs text-gray-400 mt-1">Compared against same-project listings only</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Insufficient Project Data</p>
            <p className="text-xs text-gray-400 mt-1">
              Not enough project-specific comparables to produce a project-level valuation.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const SQM_TO_SQFT = 10.7639;
  function fmtPsf(psf: number) {
    return {
      sqft: Math.round(psf).toLocaleString(),
      sqm: Math.round(psf * SQM_TO_SQFT).toLocaleString(),
    };
  }

  const transactionPsf = snapshot.transactionMedianPsf ?? 0;
  const listingPsf = snapshot.listingMedianPsf ?? 0;

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-base">Project Valuation</CardTitle>
          </div>
          <VerdictBadge verdict={snapshot.verdict} size="md" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Compared against same-project listings only</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Confidence */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-500">Confidence Score</span>
            <span className="font-semibold text-gray-800">{snapshot.confidence}%</span>
          </div>
          <Progress value={snapshot.confidence} className="h-2" />
        </div>

        {/* Ratio to market */}
        {snapshot.ratioToMarket != null && (
          <div className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
            <span className="text-gray-500">Client vs Project Benchmark</span>
            <span className="font-semibold text-gray-800">
              {(snapshot.ratioToMarket * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {/* PSF Comparison */}
        <div className="grid grid-cols-2 gap-3 text-center">
          {transactionPsf > 0 && (
            <div className="p-3 bg-teal-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Project Txn Median</div>
              <div className="text-base font-bold text-teal-700">
                {fmtPsf(transactionPsf).sqft}
              </div>
              <div className="text-xs text-gray-400">AED/sqft</div>
              <div className="text-xs text-teal-600 mt-0.5">
                {fmtPsf(transactionPsf).sqm} AED/sqm
              </div>
            </div>
          )}
          {listingPsf > 0 && (
            <div className="p-3 bg-indigo-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Project Listing Median</div>
              <div className="text-base font-bold text-indigo-700">
                {fmtPsf(listingPsf).sqft}
              </div>
              <div className="text-xs text-gray-400">AED/sqft</div>
              <div className="text-xs text-indigo-600 mt-0.5">
                {fmtPsf(listingPsf).sqm} AED/sqm
              </div>
            </div>
          )}
        </div>

        {/* Recommended Price Range */}
        {snapshot.recommendedMid && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
              Recommended Price Range (Project)
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                Low: {formatCurrency(Number(snapshot.recommendedLow ?? 0))}
              </div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(Number(snapshot.recommendedMid))}
              </div>
              <div className="text-xs text-gray-400">
                High: {formatCurrency(Number(snapshot.recommendedHigh ?? 0))}
              </div>
            </div>
          </div>
        )}

        {/* Comps count */}
        <div className="flex gap-4 text-xs text-gray-500">
          {(snapshot.listingCount ?? 0) > 0 && (
            <span>{snapshot.listingCount} project listings</span>
          )}
          {(snapshot.transactionCount ?? 0) > 0 && (
            <span>{snapshot.transactionCount} project transactions</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
