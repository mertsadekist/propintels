"use client";

import { useState } from "react";
import { RefreshCw, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RevalueResult {
  verdict: string;
  confidence: number;
  totalComps: number;
  area?: string | null;
}

interface Props {
  leadId: string;
}

export function RevalueButton({ leadId }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RevalueResult | null>(null);

  async function handleRevalue() {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/revalue`, { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Re-valuation failed");
      }

      const data: RevalueResult = json.data;
      setResult(data);

      if (data.verdict === "INSUFFICIENT_DATA") {
        toast.warning(
          `Re-valuation complete — still insufficient data (${data.totalComps} comp${data.totalComps === 1 ? "" : "s"} found${data.area ? ` in ${data.area}` : ""}).`
        );
      } else {
        toast.success(
          `Re-valuation complete — ${data.verdict.replace(/_/g, " ")} · ${data.totalComps} comps · ${Math.round(data.confidence)}% confidence`
        );
      }

      // Reload page to reflect updated valuation result
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-valuation failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRevalue}
      disabled={isRunning}
      className="text-blue-600 border-blue-200 hover:bg-blue-50"
    >
      {isRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          Re-running…
        </>
      ) : result ? (
        <>
          <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
          Done
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Re-run Valuation
        </>
      )}
    </Button>
  );
}
