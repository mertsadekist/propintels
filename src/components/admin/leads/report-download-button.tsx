"use client";

import { useState } from "react";
import { FileText, Loader2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Report {
  id: string;
  status: string;
  generatedAt?: string | null;
}

interface Props {
  leadId: string;
  reports: Report[];
}

export function ReportDownloadButton({ leadId, reports }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const latestReport = reports[0];

  async function generateAndDownload() {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/report`, { method: "POST" });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Failed to generate report");
      }

      // Response is a direct PDF binary — trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "valuation-report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully");

      // Refresh page to update report status badge
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  }

  // No report yet
  if (!latestReport) {
    return (
      <Button size="sm" variant="outline" onClick={generateAndDownload} disabled={isGenerating}>
        {isGenerating ? (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating...</>
        ) : (
          <><FileText className="h-4 w-4 mr-1.5" /> Generate Report</>
        )}
      </Button>
    );
  }

  // Report exists (READY, FAILED, or stale QUEUED) — show regenerate button
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={generateAndDownload} disabled={isGenerating}>
        {isGenerating ? (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating...</>
        ) : latestReport.status === "READY" ? (
          <><Download className="h-4 w-4 mr-1.5" /> Download PDF</>
        ) : (
          <><RefreshCw className="h-4 w-4 mr-1.5" /> Generate Report</>
        )}
      </Button>
    </div>
  );
}
