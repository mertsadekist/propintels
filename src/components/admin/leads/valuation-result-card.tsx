import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerdictBadge } from "@/components/admin/verdict-badge";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Props {
  result: {
    verdict: string;
    confidence: number;
    ratioToMarket?: number | null;
    clientPsf: number | string;
    recommendedLow?: number | string | null;
    recommendedMid?: number | string | null;
    recommendedHigh?: number | string | null;
    listingMedianPsf?: number | string | null;
    listingCount?: number | null;
    transactionMedianPsf?: number | string | null;
    transactionCount?: number | null;
    explanations?: string[] | null;
  };
  areaSqft: number;
}

const SQM_TO_SQFT = 10.7639;
function fmtPsf(psf: number) {
  return {
    sqft: Math.round(psf).toLocaleString(),
    sqm: Math.round(psf * SQM_TO_SQFT).toLocaleString(),
  };
}

export function ValuationResultCard({ result }: Props) {
  const clientPsf = Number(result.clientPsf);
  const transactionPsf = Number(result.transactionMedianPsf ?? 0);
  const listingPsf = Number(result.listingMedianPsf ?? 0);

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Valuation Result</CardTitle>
          <VerdictBadge verdict={result.verdict} size="md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Confidence */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-500">Confidence Score</span>
            <span className="font-semibold text-gray-800">{result.confidence}%</span>
          </div>
          <Progress value={result.confidence} className="h-2" />
        </div>

        {/* PSF Comparison */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Client Rate</div>
            <div className="text-base font-bold text-blue-700">
              {fmtPsf(clientPsf).sqft}
            </div>
            <div className="text-xs text-gray-400">AED/sqft</div>
            <div className="text-xs text-blue-600 mt-0.5">{fmtPsf(clientPsf).sqm} AED/sqm</div>
          </div>
          {transactionPsf > 0 && (
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Txn Median</div>
              <div className="text-base font-bold text-green-700">
                {fmtPsf(transactionPsf).sqft}
              </div>
              <div className="text-xs text-gray-400">AED/sqft</div>
              <div className="text-xs text-green-600 mt-0.5">{fmtPsf(transactionPsf).sqm} AED/sqm</div>
            </div>
          )}
          {listingPsf > 0 && (
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Listing Median</div>
              <div className="text-base font-bold text-purple-700">
                {fmtPsf(listingPsf).sqft}
              </div>
              <div className="text-xs text-gray-400">AED/sqft</div>
              <div className="text-xs text-purple-600 mt-0.5">{fmtPsf(listingPsf).sqm} AED/sqm</div>
            </div>
          )}
        </div>

        {/* Recommended Price Range */}
        {result.recommendedMid && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
              Recommended Price Range
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                Low: {formatCurrency(Number(result.recommendedLow ?? 0))}
              </div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(Number(result.recommendedMid))}
              </div>
              <div className="text-xs text-gray-400">
                High: {formatCurrency(Number(result.recommendedHigh ?? 0))}
              </div>
            </div>
          </div>
        )}

        {/* Comps count */}
        <div className="flex gap-4 text-xs text-gray-500">
          {(result.listingCount ?? 0) > 0 && (
            <span>{result.listingCount} comparable listings</span>
          )}
          {(result.transactionCount ?? 0) > 0 && (
            <span>{result.transactionCount} DLD transactions</span>
          )}
        </div>

        {/* Explanation bullets */}
        {result.explanations && result.explanations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Analysis Notes</p>
            <ul className="space-y-1.5">
              {result.explanations.map((exp, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-2">
                  <span className="text-blue-400 flex-shrink-0">▸</span>
                  <span>{exp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
