import { AlertCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  type: "invalid" | "expired";
}

export function TokenInvalidCard({ type }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-sm w-full border border-gray-200 text-center">
        <CardContent className="pt-12 pb-10">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            {type === "expired" ? (
              <Clock className="h-8 w-8 text-gray-400" />
            ) : (
              <AlertCircle className="h-8 w-8 text-gray-400" />
            )}
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {type === "expired" ? "Link Expired" : "Invalid Link"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {type === "expired"
              ? "This valuation link has expired or reached its usage limit. Please contact the agent for a new link."
              : "This valuation link is invalid or has been removed. Please check the URL and try again."}
          </p>
          <p className="text-xs text-gray-400">IST Real Estate Valuation Platform</p>
        </CardContent>
      </Card>
    </div>
  );
}
