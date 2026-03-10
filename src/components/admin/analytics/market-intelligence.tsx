"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TopArea {
  area: string;
  txnCount: number;
  txnMedianPsf: number;
  listingCount: number;
  listingAvgPsf: number;
  diffPct: number | null;
}

interface Props {
  topAreas: TopArea[];
  onFilterByArea?: (area: string) => void;
}

const MEDALS = ["🥇", "🥈", "🥉", "4.", "5."];

function fmtN(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}

export function MarketIntelligence({ topAreas, onFilterByArea }: Props) {
  if (topAreas.length === 0) {
    return null;
  }

  const hotMarkets = topAreas.slice(0, 5);
  const dealOpportunities = topAreas
    .filter((a) => a.diffPct !== null && a.diffPct < -5)
    .sort((a, b) => (a.diffPct ?? 0) - (b.diffPct ?? 0));
  const recommended = topAreas[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Hot Markets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            🏆 Hot Markets
            <span className="text-xs font-normal text-gray-400">by transaction volume</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hotMarkets.map((area, i) => (
            <div key={area.area} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{MEDALS[i]}</span>
                <div>
                  <button
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 text-left"
                    onClick={() => onFilterByArea?.(area.area)}
                  >
                    {area.area}
                  </button>
                  <p className="text-xs text-gray-400">{fmtN(area.txnCount)} transactions</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{fmtN(area.txnMedianPsf)}</p>
                <p className="text-xs text-gray-400">AED/sqft</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Deal Opportunities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            💎 Deal Opportunities
            <span className="text-xs font-normal text-gray-400">listings below market</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dealOpportunities.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              No areas where listings are significantly below transaction prices
            </p>
          ) : (
            <div className="space-y-2">
              {dealOpportunities.slice(0, 5).map((area) => (
                <div key={area.area} className="flex items-center justify-between">
                  <div>
                    <button
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 text-left"
                      onClick={() => onFilterByArea?.(area.area)}
                    >
                      {area.area}
                    </button>
                    <p className="text-xs text-gray-400">
                      Listed: {fmtN(area.listingAvgPsf)} vs Txn: {fmtN(area.txnMedianPsf)} AED/sqft
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {area.diffPct?.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended Area */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-green-800">
            ⭐ Recommended Area
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-xl font-bold text-green-900">{recommended.area}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
              <div>
                <p className="text-green-600">Transactions</p>
                <p className="font-semibold">{fmtN(recommended.txnCount)}</p>
              </div>
              <div>
                <p className="text-green-600">Median PSF</p>
                <p className="font-semibold">{fmtN(recommended.txnMedianPsf)} AED</p>
              </div>
              {recommended.listingCount > 0 && (
                <div>
                  <p className="text-green-600">Active Listings</p>
                  <p className="font-semibold">{fmtN(recommended.listingCount)}</p>
                </div>
              )}
              {recommended.diffPct !== null && (
                <div>
                  <p className="text-green-600">Listing vs Txn</p>
                  <p className="font-semibold">
                    {recommended.diffPct > 0 ? "+" : ""}
                    {recommended.diffPct.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-green-700 mt-2">
              Most active market — high liquidity and strong transaction volume make this a prime
              area for valuation benchmarking.
            </p>
            {onFilterByArea && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 text-xs border-green-300 text-green-700 hover:bg-green-100"
                onClick={() => onFilterByArea(recommended.area)}
              >
                Filter by this area
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
