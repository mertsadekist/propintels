"use client";

import { useState } from "react";
import { Plus, Copy, Check, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { CreateLinkDialog } from "@/components/admin/links/create-link-dialog";
import { useLinks } from "@/hooks/use-links";
import { toast } from "sonner";

export default function LinksPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { links, isLoading, mutate } = useLinks(params.projectId);

  async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for HTTP (non-secure contexts)
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  async function copyUrl(linkId: string) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/v/${linkId}`;
    try {
      await copyToClipboard(url);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  async function toggleLinkStatus(linkId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const res = await fetch(
      `/api/projects/${params.projectId}/links/${linkId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }
    );
    if (res.ok) {
      toast.success(`Link ${newStatus === "ACTIVE" ? "enabled" : "disabled"}`);
      mutate();
    }
  }

  const headers = ["Label", "Status", "Uses", "Expires", "Created By", "Actions"];

  return (
    <div>
      <PageHeader
        title="Valuation Links"
        description="Public links that clients use to request valuations"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Link
          </Button>
        }
      />

      <DataTable headers={headers} isLoading={isLoading}>
        {links.map((link: LinkRow) => (
          <tr key={link.id} className="border-b border-gray-50 hover:bg-gray-50/50 text-sm">
            <td className="px-4 py-3">
              <div className="font-medium text-gray-800">
                {link.label ?? `Link ${link.id.slice(-6)}`}
              </div>
            </td>
            <td className="px-4 py-3">
              <Badge variant={link.status === "ACTIVE" ? "default" : "secondary"}>
                {link.status}
              </Badge>
            </td>
            <td className="px-4 py-3 text-gray-600">
              {link.usedCount}
              {link.maxUses ? ` / ${link.maxUses}` : ""}
            </td>
            <td className="px-4 py-3 text-gray-500 text-xs">
              {link.expiresAt
                ? new Date(link.expiresAt).toLocaleDateString("en-AE")
                : "Never"}
            </td>
            <td className="px-4 py-3 text-gray-600 text-xs">
              {link.agent?.name ?? "—"}
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => copyUrl(link.id)}
                >
                  {copiedId === link.id ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => toggleLinkStatus(link.id, link.status)}
                >
                  {link.status === "ACTIVE" ? (
                    <PowerOff className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Power className="h-3.5 w-3.5 text-green-400" />
                  )}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <CreateLinkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={params.projectId}
        onSuccess={mutate}
      />
    </div>
  );
}

interface LinkRow {
  id: string;
  label?: string | null;
  status: string;
  usedCount: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  agent?: { name: string } | null;
}
