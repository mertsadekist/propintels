"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Phone, CheckCircle } from "lucide-react";

export interface ProjectValuationSummary {
  verdict: string;
  confidence: number;
  ratioToMarket?: number | null;
  benchmarkPsf?: number | null;
  recommendedLow?: number | null;
  recommendedMid?: number | null;
  recommendedHigh?: number | null;
  listingCount: number;
  transactionCount: number;
}

export interface ValuationResult {
  leadId: string;
  verdict: string;
  clientPsf: number;
  recommendedLow?: number | null;
  recommendedMid?: number | null;
  recommendedHigh?: number | null;
  confidence: number;
  ratioToMarket?: number | null;
  explanations: string[];
  listings?: { count: number; medianPsf: number } | null;
  transactions?: { count: number; medianPsf: number } | null;
  projectValuation?: ProjectValuationSummary | null;
  report: { id: string; status: string };
}

export interface PropertyData {
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft: number;
  clientPrice: number;
}

const VERDICT_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  bg: string;
  emoji: string;
}> = {
  ALIGNED: {
    label: "Fair Market Value",
    description: "Your asking price is well-aligned with current market data.",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    emoji: "✅",
  },
  BELOW_MARKET: {
    label: "Below Market",
    description: "Your property is priced competitively below the market average.",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    emoji: "🔵",
  },
  SLIGHTLY_ABOVE: {
    label: "Slightly Above Market",
    description: "Your price is slightly above market. Some negotiation may be expected.",
    color: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200",
    emoji: "⚠️",
  },
  ABOVE_MARKET: {
    label: "Above Market",
    description: "Your price is significantly above market. Consider adjusting for better results.",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    emoji: "🔴",
  },
  INSUFFICIENT_DATA: {
    label: "Limited Data Available",
    description: "We don&apos;t have enough comparable data to provide a reliable estimate.",
    color: "text-gray-700",
    bg: "bg-gray-50 border-gray-200",
    emoji: "ℹ️",
  },
};

interface Props {
  result: ValuationResult;
  property: PropertyData;
  projectName: string;
  currency: string;
}

export function ResultsStep({ result, property, currency }: Props) {
  const verdict = VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.INSUFFICIENT_DATA;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-AE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      {/* Verdict Banner */}
      <Card className={`border ${verdict.bg}`}>
        <CardContent className="pt-6 text-center">
          <div className="text-4xl mb-3">{verdict.emoji}</div>
          <h2 className={`text-2xl font-bold ${verdict.color} mb-2`}>
            {verdict.label}
          </h2>
          <p className="text-sm text-gray-600">{verdict.description}</p>
        </CardContent>
      </Card>

      {/* Price Range */}
      {result.recommendedMid && (
        <Card className="border border-gray-200">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
              Recommended Price Range
            </p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{fmt(result.recommendedLow ?? 0)}</span>
              <span className="text-xl font-bold text-gray-900">{fmt(result.recommendedMid)}</span>
              <span className="text-sm text-gray-500">{fmt(result.recommendedHigh ?? 0)}</span>
            </div>

            <div className="relative h-2 bg-gray-100 rounded-full">
              <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-blue-200 via-green-400 to-orange-200 rounded-full" />
              {result.recommendedLow && result.recommendedHigh && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-white border-2 border-blue-600 rounded-full shadow"
                  style={{
                    left: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((property.clientPrice - (result.recommendedLow ?? 0)) /
                          ((result.recommendedHigh ?? 0) - (result.recommendedLow ?? 0))) *
                          100
                      )
                    )}%`,
                    transform: "translateX(-50%) translateY(-50%)",
                  }}
                />
              )}
            </div>
            <div className="mt-1 text-xs text-center text-blue-600">
              Your price: {fmt(property.clientPrice)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Data */}
      <Card className="border border-gray-200">
        <CardContent className="pt-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Market Data</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xs text-gray-400 mb-1">Your PSF</div>
              <div className="font-bold text-gray-900">
                {currency} {Math.round(result.clientPsf).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">per sqft</div>
            </div>

            {result.transactions && result.transactions.count > 0 && (
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">Market PSF ({result.transactions.count} txns)</div>
                <div className="font-bold text-green-700">
                  {currency} {Math.round(result.transactions.medianPsf).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">median</div>
              </div>
            )}

            {result.listings && result.listings.count > 0 && !result.transactions && (
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">Listed PSF ({result.listings.count} listings)</div>
                <div className="font-bold text-blue-700">
                  {currency} {Math.round(result.listings.medianPsf).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">median</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Project Valuation (if available and different from area) */}
      {result.projectValuation &&
        result.projectValuation.verdict !== "INSUFFICIENT_DATA" &&
        result.projectValuation.recommendedMid && (
          <Card className="border border-indigo-200 bg-indigo-50">
            <CardContent className="pt-5">
              <p className="text-xs text-indigo-600 uppercase tracking-wide mb-3 font-medium">
                Project-Level Comparison
              </p>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-500">
                  {fmt(result.projectValuation.recommendedLow ?? 0)}
                </span>
                <span className="text-lg font-bold text-indigo-700">
                  {fmt(result.projectValuation.recommendedMid)}
                </span>
                <span className="text-sm text-gray-500">
                  {fmt(result.projectValuation.recommendedHigh ?? 0)}
                </span>
              </div>
              <p className="text-xs text-indigo-500 text-center">
                Based on {(result.projectValuation.listingCount ?? 0) + (result.projectValuation.transactionCount ?? 0)} project-specific comparables
              </p>
            </CardContent>
          </Card>
        )}

      {/* Confidence */}
      <Card className="border border-gray-200">
        <CardContent className="pt-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Analysis Confidence</span>
            <span className="font-semibold text-gray-800">{result.confidence}%</span>
          </div>
          <Progress value={result.confidence} className="h-2" />
        </CardContent>
      </Card>

      {/* Analysis Notes */}
      {result.explanations && result.explanations.length > 0 && (
        <Card className="border border-gray-200">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Analysis Notes</p>
            <ul className="space-y-2">
              {result.explanations.map((exp, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-600">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">▸</span>
                  <span>{exp}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-700">
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />
          <span>Your valuation report has been saved. A specialist will reach out to you shortly.</span>
        </div>
        <div className="p-4 bg-[#0B1F3B] rounded-lg text-white text-center">
          <p className="text-sm font-medium mb-2">Speak with our expert team</p>
          <a
            href="tel:+97140000000"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white text-white bg-transparent text-sm font-medium hover:bg-white hover:text-[#0B1F3B] transition-colors"
          >
            <Phone className="h-4 w-4" />
            Call Now
          </a>
        </div>
      </div>
    </div>
  );
}
